"use client";

import { useEffect, useRef, useState } from "react";
import {
  emptyProposal,
  type ParsedProject,
  type StagedAttachment,
} from "@/lib/anthropic/schema";
import ReviewForm from "./ReviewForm";
import UpdateReviewForm from "./UpdateReviewForm";

interface ProjectOption {
  id: string;
  codename: string;
}

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

  // Update-an-existing-project mode.
  const [updateMode, setUpdateMode] = useState(false);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [updateTargetId, setUpdateTargetId] = useState("");

  useEffect(() => {
    if (!updateMode || projectOptions.length > 0) return;
    (async () => {
      try {
        const res = await fetch("/api/projects");
        const json = await res.json();
        const opts: ProjectOption[] = (json.projects ?? []).map(
          (p: { id: string; codename: string }) => ({
            id: p.id,
            codename: p.codename,
          }),
        );
        setProjectOptions(opts);
        if (opts.length > 0 && !updateTargetId) setUpdateTargetId(opts[0].id);
      } catch {
        // Non-fatal — the picker just stays empty.
      }
    })();
  }, [updateMode, projectOptions.length, updateTargetId]);

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

  // Skip parsing entirely — open a blank, editable form for leads that did not
  // arrive by email (phone, referral, event, etc.).
  function enterManually() {
    setResult({
      proposal: emptyProposal(emailText),
      attachments: [],
      rawEmailText: emailText,
      model: null,
      parserAvailable: false,
    });
  }

  if (result && updateMode && updateTargetId) {
    return (
      <UpdateReviewForm projectId={updateTargetId} proposal={result.proposal} />
    );
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">New RFI intake</h1>
          <p className="text-sm text-gray-500">
            Paste the full RFI email and attach any supplemental files. Claude
            extracts the fields; you review and edit before anything is saved.
          </p>
        </div>
        <button className="btn-secondary whitespace-nowrap" onClick={enterManually}>
          Enter manually (no email)
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={updateMode}
            onChange={(e) => setUpdateMode(e.target.checked)}
          />
          This is updated information for an existing project
        </label>
        {updateMode && (
          <div className="mt-3">
            <span className="label">Project to update</span>
            <select
              className="input max-w-md"
              value={updateTargetId}
              onChange={(e) => setUpdateTargetId(e.target.value)}
            >
              {projectOptions.length === 0 && (
                <option value="">No projects yet</option>
              )}
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.codename}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-gray-500">
              After parsing, you&apos;ll review each changed field and choose what
              to apply. The original is not modified until you confirm.
            </p>
          </div>
        )}
      </div>

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
