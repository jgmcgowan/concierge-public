"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp, type AuthState } from "./actions";

export function LoginForm({ next, allowSignup }: { next: string; allowSignup: boolean }) {
  const [state, action, pending] = useActionState(async (prev: AuthState, form: FormData) => {
    return form.get("intent") === "signup" ? signUp(prev, form) : signIn(prev, form);
  }, undefined as AuthState);

  return (
    <form action={action} className="mt-8 flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
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
      <label className="text-sm text-muted" htmlFor="password">
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete={allowSignup ? "new-password" : "current-password"}
        required
        minLength={8}
        className="field"
      />
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.info && <p className="text-sm text-accent">{state.info}</p>}
      <button className="btn-primary mt-2" name="intent" value="signin" disabled={pending}>
        {pending ? "Working…" : "Sign in"}
      </button>
      <Link href="/login/forgot" className="text-center text-sm text-muted hover:text-ink">
        Forgot password?
      </Link>
      {allowSignup && (
        <button className="btn" name="intent" value="signup" disabled={pending}>
          Create account
        </button>
      )}
    </form>
  );
}
