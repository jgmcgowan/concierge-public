import Link from "next/link";
import { ForgotForm } from "./forgot-form";

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <h1 className="font-display text-3xl">Reset password</h1>
      <p className="mt-2 text-sm text-muted">We will email you a link to choose a new password.</p>
      <ForgotForm />
      <Link href="/login" className="mt-4 text-center text-sm text-muted hover:text-ink">
        Back to sign in
      </Link>
    </main>
  );
}
