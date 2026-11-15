import "server-only";
import { cookies } from "next/headers";
import { PREFS_COOKIE, parsePrefs } from "./prefs";

export async function getPrefs() {
  const jar = await cookies();
  return parsePrefs(jar.get(PREFS_COOKIE)?.value);
}
