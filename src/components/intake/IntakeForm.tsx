"use client";

import { useRef, useState } from "react";
import type { ParsedProject, StagedAttachment } from "@/lib/anthropic/schema";
import ReviewForm from "./ReviewForm";

interface IntakeResponse {
  proposal: ParsedProject;
  attachments: StagedAttachment[];
  rawEmailText: string;
  model: string | null;
  parserAvailable: boolean;
}

export default function IntakeForm() {
  const [emailText, setEmailText] = useState("");
  const [highEffort, setHighEffort] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IntakeResponse | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("emailText", emailText);
      fd.set("highEffort", String(highEffort));
      for (const f of files) fd.append("files", f);
      const res = await fetch("/api/intake", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to parse RFI.");
        setLoading(false);
        return;
      }
      setResult(json as IntakeResponse);
    } catch {
      setError("Network error. Is the dev server running?");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <ReviewForm
        proposal={result.proposal}
        attachments={result.attachments}
        rawEmailText={result.rawEmailText}
        parsedModel={result.model}
        parserAvailable={result.parserAvailable}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">New RFI intake</h1>
        <p className="text-sm text-gray-500">
          Paste the full RFI email and attach any supplemental files. Claude
          extracts the fields; you review and edit before anything is saved.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card p-4 space-y-3">
        <label className="block">
          <span className="label">Pasted RFI email</span>
          <textarea
            className="input font-mono text-sm"
            rows={16}
            placeholder="Paste the full forwarded RFI email here…"
            value={emailText}
            onChange={(e) => setEmailText(e.target.value)}
          />
        </label>

        <div>
          <span className="label">Attachments</span>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept=".pdf,.xlsx,.xls,.docx,.pptx,.png,.jpg,.jpeg,.gif,.webp"
            className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-2 file:text-white hover:file:bg-brand-dark"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          {files.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-gray-500">
              {files.map((f) => (
                <li key={f.name}>
                  {f.name} ({Math.round(f.size / 1024)} KB)
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={highEffort}
            onChange={(e) => setHighEffort(e.target.checked)}
          />
          Use the higher-capability model for this difficult document
        </label>

        <div className="flex justify-end">
          <button className="btn-primary" onClick={submit} disabled={loading}>
            {loading ? "Parsing…" : "Parse RFI"}
          </button>
        </div>
      </div>
    </div>
  );
}
