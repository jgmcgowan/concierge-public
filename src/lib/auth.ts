import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Verified user id from the session JWT, or null. Deduped per request. */
export const getUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
});

export async function requireUserId(): Promise<string> {
  const id = await getUserId();
  if (!id) redirect("/login");
  return id;
}

/** Open signup only when explicitly enabled (first account bootstrap). */
export function signupAllowed() {
  return process.env.CONCIERGE_ALLOW_SIGNUP === "true";
}

export function safeNext(raw: FormDataEntryValue | string | null | undefined, fallback = "/") {
  const next = typeof raw === "string" ? raw : "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
