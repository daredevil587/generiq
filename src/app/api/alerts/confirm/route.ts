import { NextResponse } from "next/server";
import { confirmWatchlistEntry, deleteWatchlistByToken } from "@/lib/medicines-dal";
import { siteUrl } from "@/lib/site-url";

export async function GET(req: Request) {
  const url    = new URL(req.url);
  const token  = url.searchParams.get("token") ?? "";
  const action = url.searchParams.get("action") ?? "confirm";

  if (!token) {
    return NextResponse.redirect(`${siteUrl}/?alert=invalid`);
  }

  if (action === "delete") {
    await deleteWatchlistByToken(token);
    return NextResponse.redirect(`${siteUrl}/?alert=unsubscribed`);
  }

  const ok = await confirmWatchlistEntry(token);
  if (!ok) return NextResponse.redirect(`${siteUrl}/?alert=invalid`);

  return NextResponse.redirect(`${siteUrl}/?alert=confirmed`);
}
