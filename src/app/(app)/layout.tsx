import Link from "next/link";
import { signOut } from "@/app/login/actions";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b border-line">
        <nav className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="font-display text-xl">
            Concierge
          </Link>
          <div className="flex items-center gap-1 text-sm">
            <Link href="/" className="rounded-lg px-3 py-1.5 hover:bg-sunken">
              Plan
            </Link>
            <Link href="/settings" className="rounded-lg px-3 py-1.5 hover:bg-sunken">
              Settings
            </Link>
            <form action={signOut}>
              <button type="submit" className="rounded-lg px-3 py-1.5 text-muted hover:bg-sunken hover:text-ink">
                Sign out
              </button>
            </form>
          </div>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-16 pt-6 sm:px-6">
        {children}
      </main>
    </>
  );
}
