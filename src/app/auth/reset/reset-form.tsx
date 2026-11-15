"use client";

import { useActionState } from "react";
import { updatePassword, type ResetState } from "./actions";

export function ResetForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined as ResetState);

  return (
    <form action={action} className="mt-8 flex flex-col gap-3">
      <label className="text-sm text-muted" htmlFor="password">
        New password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        autoFocus
        className="field"
      />
      <label className="text-sm text-muted" htmlFor="confirm">
        Confirm password
      </label>
      <input
        id="confirm"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        className="field"
      />
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button className="btn-primary mt-2" type="submit" disabled={pending}>
        {pending ? "Working…" : "Update password"}
      </button>
    </form>
  );
}
