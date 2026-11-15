import { NextResponse } from "next/server";
import { searchCities } from "@/lib/geo";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const places = await searchCities(q).catch(() => []);
  return NextResponse.json(places.map((p) => ({ label: p.label })));
}
