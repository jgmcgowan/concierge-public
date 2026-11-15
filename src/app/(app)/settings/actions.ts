"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PREFS_COOKIE, parsePrefs } from "@/lib/prefs";

export async function saveSettings(formData: FormData) {
  const prefs = parsePrefs(
    JSON.stringify({
      wake: formData.get("wake"),
      sleep: formData.get("sleep"),
      minGapMinutes: Number(formData.get("minGapMinutes")),
      interests: formData.getAll("interests"),
      homeCity: String(formData.get("homeCity") ?? "").trim(),
      homeAirport: String(formData.get("homeAirport") ?? "").trim().toUpperCase(),
      blockWorkHours: formData.get("blockWorkHours") === "on",
      workStart: formData.get("workStart"),
      workEnd: formData.get("workEnd"),
    }),
  );

  const jar = await cookies();
  jar.set(PREFS_COOKIE, JSON.stringify(prefs), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
  redirect("/settings?saved=1");
}
