import { NextResponse } from "next/server";
import { localOtpStore } from "@/auth";

export async function POST(req: Request) {
  try {
    const { phone } = (await req.json()) as { phone?: string };
    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    // Try to use Cloudflare D1 + Twilio (production)
    let cloudflareCtx: { env: Record<string, string> } | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { getCloudflareContext } = await import("@opennextjs/cloudflare") as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cloudflareCtx = await (getCloudflareContext as () => Promise<any>)();
    } catch {
      // Not in Cloudflare runtime — fall back to local dev mode
    }

    if (cloudflareCtx?.env?.DB) {
      const db = cloudflareCtx.env.DB as unknown as D1Database;
      const expiresStr = expires.toISOString().replace("T", " ").split(".")[0];

      await (db as D1Database)
        .prepare(
          "INSERT OR REPLACE INTO verification_tokens (identifier, token, expires) VALUES (?, ?, ?)"
        )
        .bind(phone, otp, expiresStr)
        .run();

      const accountSid = cloudflareCtx.env.TWILIO_ACCOUNT_SID;
      const authToken = cloudflareCtx.env.TWILIO_AUTH_TOKEN;
      const twilioPhone = cloudflareCtx.env.TWILIO_PHONE_NUMBER;

      // Dev mode — don't actually send SMS
      if (!accountSid || accountSid === "placeholder") {
        console.log(`[DEV] OTP for ${phone}: ${otp}`);
        return NextResponse.json({ success: true, dev: true });
      }

      const auth = btoa(`${accountSid}:${authToken}`);
      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${auth}`,
          },
          body: new URLSearchParams({
            Body: `Your GeneriQ verification code is: ${otp}`,
            From: twilioPhone,
            To: phone,
          }),
        }
      );

      if (!twilioRes.ok) {
        const errorData = await twilioRes.json() as Record<string, unknown>;
        throw new Error(`Twilio error: ${JSON.stringify(errorData)}`);
      }

      return NextResponse.json({ success: true });
    } else {
      // Local dev: store OTP in-memory and log it to console
      localOtpStore.set(phone, { otp, expires });
      console.log(`\n[DEV AUTH] Phone OTP for ${phone}: ${otp}\n`);
      return NextResponse.json({ success: true, dev: true, message: "Check server console for OTP" });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to send OTP";
    console.error("Error sending OTP:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
