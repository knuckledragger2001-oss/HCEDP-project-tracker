"use client";

import { useActionState, useEffect, useRef } from "react";
import { createUser, type CreateUserState } from "./actions";

export default function CreateUserForm() {
  const [state, action, pending] = useActionState<CreateUserState, FormData>(
    createUser,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the inputs after a successful create.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5"
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
        <select name="role" className="input" defaultValue="USER">
          <option value="USER">User</option>
          <option value="ADMIN">Admin</option>
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
      <div className="flex items-end gap-3 lg:col-span-5">
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
    </form>
  );
}
