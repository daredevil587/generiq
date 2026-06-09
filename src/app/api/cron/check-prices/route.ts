import { NextResponse } from "next/server";
import { getWatchlistForPriceCheck, claimWatchlistForNotification } from "@/lib/medicines-dal";
import { sendPriceDropEmail } from "@/lib/email";
import { formatGBP } from "@/lib/format-utils";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = await getWatchlistForPriceCheck();
  let notified = 0;

  for (const entry of entries) {
    if (!entry.new_price_gbp) continue;
    // Claim the row before sending — prevents duplicate emails on Vercel retry
    const claimed = await claimWatchlistForNotification(entry.id, entry.new_price_gbp);
    if (!claimed) continue;
    try {
      await sendPriceDropEmail(
        entry.email,
        entry.medicine_name,
        formatGBP(entry.new_price_gbp),
        entry.current_price_gbp ? formatGBP(entry.current_price_gbp) : null,
        entry.medicine_id,
        entry.token,
      );
      notified++;
    } catch (err) {
      console.error(`[cron] failed for watchlist id=${entry.id}`, err);
    }
  }

  return NextResponse.json({ checked: entries.length, notified });
}
