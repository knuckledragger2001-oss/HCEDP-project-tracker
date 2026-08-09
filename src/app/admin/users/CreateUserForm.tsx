"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createUser, type CreateUserState } from "./actions";
import { PARTNER_CITIES, PARTNER_CITY_LABELS } from "@/lib/placer/schema";

export default function CreateUserForm() {
  const [state, action, pending] = useActionState<CreateUserState, FormData>(
    createUser,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [role, setRole] = useState("USER");

  // Clear the inputs after a successful create.
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setRole("USER");
    }
  }, [state]);

  const isPartner = role === "PARTNER";

  return (
    <form
      ref={formRef}
      action={action}
      className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6"
    >
      <div className="lg:col-span-2">
        <label className="label">Email</label>
        <input name="email" type="email" required className="input" />
      </div>
      <div>
        <label className="label">Name</label>
        <input name="name" className="input" placeholder="optional" />
      </div>
      <div>
        <label className="label">Role</label>
        <select
          name="role"
          className="input"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="USER">User (internal)</option>
          <option value="ADMIN">Admin (internal)</option>
          <option value="PARTNER">Partner (city)</option>
        </select>
      </div>
      <div>
        <label className="label">City</label>
        <select
          name="partnerCity"
          className="input disabled:opacity-40"
          defaultValue=""
          disabled={!isPartner}
          required={isPartner}
        >
          <option value="" disabled>
            {isPartner ? "Choose…" : "—"}
          </option>
          {PARTNER_CITIES.map((c) => (
            <option key={c} value={c}>
              {PARTNER_CITY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Temp password</label>
        <input
          name="password"
          type="text"
          required
          minLength={8}
          className="input"
          placeholder="min 8 chars"
        />
      </div>
      <div className="flex flex-col gap-1 lg:col-span-6">
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Adding…" : "Add user"}
          </button>
          {state?.error && (
            <span className="text-sm text-red-600">{state.error}</span>
          )}
          {state?.ok && (
            <span className="text-sm text-green-700">User added.</span>
          )}
        </div>
        {isPartner && (
          <p className="text-xs text-muted">
            Partner logins only see the Placer AI request area for their city —
            never the internal projects tracker.
          </p>
        )}
      </div>
    </form>
  );
}
