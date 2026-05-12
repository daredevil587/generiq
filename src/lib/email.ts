import { Resend } from "resend";
import { siteUrl } from "./site-url";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM ?? "GeneriQ <noreply@generiq.co.uk>";

async function send(to: string, subject: string, html: string) {
  if (!resend) {
    console.log("[email] no RESEND_API_KEY — would send:", { to, subject });
    return;
  }
  await resend.emails.send({ from: FROM, to, subject, html });
}

export async function sendConfirmationEmail(to: string, medicineName: string, token: string) {
  const confirmUrl = `${siteUrl}/api/alerts/confirm?token=${token}`;
  const unsubUrl   = `${siteUrl}/api/alerts/confirm?token=${token}&action=delete`;
  await send(to, `Confirm your price alert — ${medicineName}`, `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="margin:0 0 16px;color:#18181b">Confirm your GeneriQ price alert</h2>
      <p style="color:#52525b">You asked to be notified when <strong>${medicineName}</strong> drops in price.</p>
      <p style="color:#52525b">Click the button below to confirm — we'll email you the moment the price falls.</p>
      <a href="${confirmUrl}" style="display:inline-block;margin:20px 0;background:#6366f1;color:#fff;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none">
        Confirm alert
      </a>
      <p style="font-size:12px;color:#a1a1aa;margin-top:24px">
        Didn't request this? <a href="${unsubUrl}" style="color:#a1a1aa">Click here to ignore it</a>.
      </p>
    </div>
  `);
}

export async function sendPriceDropEmail(
  to: string,
  medicineName: string,
  newPrice: string,
  oldPrice: string | null,
  medicineId: number,
  token: string,
) {
  const viewUrl   = `${siteUrl}/medicine/${medicineId}`;
  const unsubUrl  = `${siteUrl}/api/alerts/confirm?token=${token}&action=delete`;
  const oldText   = oldPrice ? ` (was ${oldPrice})` : "";
  await send(to, `Price drop: ${medicineName} is now ${newPrice}`, `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="margin:0 0 8px;color:#18181b">Price drop alert</h2>
      <p style="color:#52525b;margin:0 0 16px">Good news! <strong>${medicineName}</strong> has dropped in price.</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:20px">
        <p style="margin:0;font-size:22px;font-weight:700;color:#16a34a">${newPrice}<span style="font-size:14px;font-weight:400;color:#86efac">${oldText}</span></p>
      </div>
      <a href="${viewUrl}" style="display:inline-block;background:#6366f1;color:#fff;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none">
        Compare prices on GeneriQ
      </a>
      <p style="font-size:12px;color:#a1a1aa;margin-top:24px">
        <a href="${unsubUrl}" style="color:#a1a1aa">Unsubscribe from this alert</a>
      </p>
    </div>
  `);
}
