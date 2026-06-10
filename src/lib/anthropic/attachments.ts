import { parseOffice } from "officeparser";
import type Anthropic from "@anthropic-ai/sdk";

export interface IncomingFile {
  fileName: string;
  mimeType: string;
  data: Buffer;
}

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const OFFICE_EXT = /\.(xlsx|xls|docx|doc|pptx|ppt|odt|odp|ods)$/i;

type ContentBlock = Anthropic.ContentBlockParam;

// Turn uploaded files into Claude content blocks. PDFs and images are passed
// natively for best fidelity; Office documents are flattened to text via
// officeparser; anything else is best-effort decoded as UTF-8 text.
export async function filesToContentBlocks(
  files: IncomingFile[],
): Promise<ContentBlock[]> {
  const blocks: ContentBlock[] = [];

  for (const file of files) {
    const isPdf =
      file.mimeType === "application/pdf" ||
      file.fileName.toLowerCase().endsWith(".pdf");

    if (isPdf) {
      blocks.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: file.data.toString("base64"),
        },
        title: file.fileName,
      });
      continue;
    }

    if (IMAGE_TYPES.has(file.mimeType)) {
      blocks.push({
        type: "text",
        text: `Attachment image: ${file.fileName}`,
      });
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: file.mimeType as
            | "image/jpeg"
            | "image/png"
            | "image/gif"
            | "image/webp",
          data: file.data.toString("base64"),
        },
      });
      continue;
    }

    if (OFFICE_EXT.test(file.fileName)) {
      try {
        const text = await parseOffice(file.data);
        blocks.push({
          type: "text",
          text: `--- Attachment "${file.fileName}" (extracted text) ---\n${text}`,
        });
      } catch {
        blocks.push({
          type: "text",
          text: `--- Attachment "${file.fileName}": could not extract text ---`,
        });
      }
      continue;
    }

    // Fallback: treat as plain text.
    blocks.push({
      type: "text",
      text: `--- Attachment "${file.fileName}" ---\n${file.data.toString("utf8").slice(0, 200_000)}`,
    });
  }

  return blocks;
}
