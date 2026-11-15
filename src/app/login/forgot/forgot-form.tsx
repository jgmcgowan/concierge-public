"use client";

import { useActionState } from "react";
import { requestPasswordReset, type AuthState } from "../actions";

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined as AuthState);

  return (
    <form action={action} className="mt-8 flex flex-col gap-3">
      <label className="text-sm text-muted" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        autoFocus
        className="field"
      />
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.info && <p className="text-sm text-accent">{state.info}</p>}
      <button className="btn-primary mt-2" type="submit" disabled={pending}>
        {pending ? "Working…" : "Send reset link"}
      </button>
    </form>
  );
}
