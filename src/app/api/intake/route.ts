import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "@/lib/storage";
import {
  parseRfi,
  AnthropicNotConfiguredError,
} from "@/lib/anthropic/parser";
import type { IncomingFile } from "@/lib/anthropic/attachments";
import { emptyProposal, type StagedAttachment } from "@/lib/anthropic/schema";

export const runtime = "nodejs";
// Allow large-ish RFI attachments.
export const maxDuration = 120;

/**
 * Single internal intake endpoint.
 *
 * Accepts multipart/form-data with:
 *   - emailText: the full pasted RFI email
 *   - files:     zero or more supplemental attachments
 *
 * Stages the uploaded files into storage, asks Claude to extract structured
 * fields, and returns a PROPOSAL for human review. It deliberately does NOT
 * write a Project — saving happens via POST /api/projects after review.
 *
 * A future scheduled Outlook-reader can POST the same shape here with no other
 * changes.
 */
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data." },
      { status: 400 },
    );
  }

  const emailText = (form.get("emailText") as string | null) ?? "";
  const highEffort = form.get("highEffort") === "true";

  const uploads = form
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (!emailText.trim() && uploads.length === 0) {
    return NextResponse.json(
      { error: "Provide pasted email text and/or at least one attachment." },
      { status: 400 },
    );
  }

  // Read + stage files into storage; keep buffers around for the parser.
  const storage = getStorage();
  const incoming: IncomingFile[] = [];
  const staged: StagedAttachment[] = [];

  for (const file of uploads) {
    const data = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";
    incoming.push({ fileName: file.name, mimeType, data });
    const stored = await storage.put(data, {
      fileName: file.name,
      contentType: mimeType,
    });
    staged.push({
      fileName: file.name,
      mimeType,
      sizeBytes: data.length,
      storageKey: stored.key,
      kind: "attachment",
    });
  }

  try {
    const { proposal, model } = await parseRfi({
      emailText,
      files: incoming,
      highEffort,
    });
    return NextResponse.json({
      proposal,
      attachments: staged,
      rawEmailText: emailText,
      model,
      parserAvailable: true,
    });
  } catch (err) {
    if (err instanceof AnthropicNotConfiguredError) {
      // Parser disabled — return a blank draft so the user can fill it manually.
      const proposal = emptyProposal(emailText);
      proposal.parseWarnings = [
        {
          field: "_parser",
          message:
            "ANTHROPIC_API_KEY is not set, so automatic parsing was skipped. Fill the fields manually, then save.",
          kind: "missing",
        },
      ];
      return NextResponse.json({
        proposal,
        attachments: staged,
        rawEmailText: emailText,
        model: null,
        parserAvailable: false,
      });
    }
    console.error("Intake parse failed:", err);
    return NextResponse.json(
      { error: "Failed to parse RFI. See server logs for details." },
      { status: 500 },
    );
  }
}
