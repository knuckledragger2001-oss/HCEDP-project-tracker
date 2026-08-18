"use client";

// "Archive to CRM": opens the signed-in user's own email client (via a mailto
// link — Outlook if that's their default handler, which it is for HCEDP staff)
// with a new message addressed to the city contact this completed Placer AI
// request was for, BCC'd to the CRM's email-to-record archive address so
// GrowthZone logs it automatically. We only ever build a mailto link and hand
// it to the browser — no mail is ever sent from the server.

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/components/ui/Toast";
import { Field, Text } from "@/components/intake/fields";

export interface CrmContact {
  name: string;
  email: string;
}

// The CRM's email-to-record address: any message BCC'd here is logged against
// the contact automatically.
const ARCHIVE_BCC = "archive@hayscaldwelleconomicdevelopmentpartnership.growthzoneapp.com";

function buildMailto(opts: {
  to: string;
  cc: string | null;
  bcc: string;
  subject: string;
  body: string;
}): string {
  const params = new URLSearchParams();
  if (opts.cc) params.set("cc", opts.cc);
  params.set("bcc", opts.bcc);
  params.set("subject", opts.subject);
  if (opts.body) params.set("body", opts.body);
  return `mailto:${encodeURIComponent(opts.to)}?${params.toString()}`;
}

export interface ArchivableRequest {
  id: string;
  placeName: string;
  purpose: string | null;
}

export default function ArchiveRequestDialog({
  request,
  contacts,
  defaultCcEmail,
  suggestedContact,
  onClose,
  onArchived,
}: {
  request: ArchivableRequest;
  contacts: CrmContact[];
  defaultCcEmail: string | null;
  /** The partner login that submitted this request, if any — a strong default. */
  suggestedContact: CrmContact | null;
  onClose: () => void;
  onArchived: (
    request: { id: string; archivedAt: string; archiveContactName: string | null },
    contact: CrmContact,
  ) => void;
}) {
  const toast = useToast();
  const [contactName, setContactName] = useState(suggestedContact?.name ?? "");
  const [contactEmail, setContactEmail] = useState(suggestedContact?.email ?? "");
  const [emailTouched, setEmailTouched] = useState(false);
  const [cc, setCc] = useState(defaultCcEmail ?? "");
  const [subject, setSubject] = useState(`Placer AI report: ${request.placeName}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedContacts = useMemo(
    () => [...contacts].sort((a, b) => a.name.localeCompare(b.name)),
    [contacts],
  );

  function onNameChange(value: string) {
    setContactName(value);
    // Recognized contact name and the email hasn't been hand-edited yet →
    // autofill it, since these dialogs get used on the same handful of people.
    if (!emailTouched) {
      const match = contacts.find((c) => c.name.toLowerCase() === value.toLowerCase());
      if (match) setContactEmail(match.email);
    }
  }

  async function send() {
    const name = contactName.trim();
    const email = contactEmail.trim();
    if (!name) return setError("Who is this correspondence with?");
    if (!email || !email.includes("@")) return setError("Enter a valid email address.");

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/placer-requests/${request.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactName: name, contactEmail: email }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not archive this request.");

      const mailto = buildMailto({
        to: email,
        cc: cc.trim() || null,
        bcc: ARCHIVE_BCC,
        subject: subject.trim() || request.placeName,
        body: request.purpose ?? "",
      });
      window.location.href = mailto;

      onArchived(body.request, body.contact as CrmContact);
      toast.success("Archived. Finish and send the email in Outlook.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not archive this request.");
    } finally {
      setBusy(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:p-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl bg-surface p-5 shadow-xl">
        <h2 className="text-base font-semibold text-foreground">Archive to CRM</h2>
        <p className="mt-0.5 text-xs text-muted">
          Opens an email in Outlook, BCC&rsquo;d to the CRM so this gets logged
          against the contact.
        </p>

        <div className="mt-4 space-y-3">
          <Field label="Contact name *">
            <input
              className="input"
              list="crm-contact-names"
              value={contactName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. Jane Doe"
            />
            <datalist id="crm-contact-names">
              {sortedContacts.map((c) => (
                <option key={c.email} value={c.name} />
              ))}
            </datalist>
          </Field>
          <Field label="Contact email *">
            <input
              className="input mono"
              type="email"
              list="crm-contact-emails"
              value={contactEmail}
              onChange={(e) => {
                setContactEmail(e.target.value);
                setEmailTouched(true);
              }}
              placeholder="jane@cityname.gov"
            />
            <datalist id="crm-contact-emails">
              {sortedContacts.map((c) => (
                <option key={c.email} value={c.email} />
              ))}
            </datalist>
          </Field>
          <Field label="CC" hint="Defaults to your coverage partner — edit or clear as needed.">
            <input
              className="input"
              type="email"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
            />
          </Field>
          <Field label="Subject">
            <Text value={subject} onChange={setSubject} />
          </Field>
          <p className="text-[11px] text-muted-2">
            BCC (always included): <span className="mono">{ARCHIVE_BCC}</span>
          </p>
        </div>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={send} disabled={busy}>
            {busy ? "Opening…" : "Open in Outlook"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
