import { signupAllowed } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const allowSignup = signupAllowed();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <h1 className="font-display text-3xl">Concierge</h1>
      <p className="mt-2 text-sm text-muted">
        {allowSignup ? "Create your account, then turn off sign-up." : "Sign in with your email."}
      </p>
      {error === "link" && (
        <p className="mt-4 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          That link expired. Sign in again.
        </p>
      )}
      <LoginForm next={typeof next === "string" ? next : "/"} allowSignup={allowSignup} />
    </main>
  );
}
