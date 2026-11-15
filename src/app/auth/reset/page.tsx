import Link from "next/link";
import { getUserId } from "@/lib/auth";
import { ResetForm } from "./reset-form";

export default async function ResetPasswordPage() {
  const signedIn = !!(await getUserId());

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <h1 className="font-display text-3xl">Choose a new password</h1>
      {signedIn ? (
        <ResetForm />
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">That link expired. Request a new one.</p>
          <Link href="/login/forgot" className="btn-primary mt-8">
            Forgot password
          </Link>
        </>
      )}
    </main>
  );
}
