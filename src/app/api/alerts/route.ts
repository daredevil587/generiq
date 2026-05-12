import { NextResponse } from "next/server";
import { createWatchlistEntry, getMedicineById, getPricesByMedicineId } from "@/lib/medicines-dal";
import { sendConfirmationEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const { email, medicineId } = await req.json() as { email?: string; medicineId?: number };

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    if (!medicineId || typeof medicineId !== "number") {
      return NextResponse.json({ error: "Invalid medicineId" }, { status: 400 });
    }

    const [medicine, prices] = await Promise.all([
      getMedicineById(medicineId),
      getPricesByMedicineId(medicineId),
    ]);
    if (!medicine) return NextResponse.json({ error: "Medicine not found" }, { status: 404 });

    const retailPrices = prices.filter(p => p.source !== "nhs_drug_tariff");
    const minPrice = retailPrices.length > 0
      ? Math.min(...retailPrices.map(p => parseFloat(p.price_gbp))).toFixed(2)
      : null;

    const { token, alreadyExists } = await createWatchlistEntry(email, medicineId, minPrice);

    if (!alreadyExists) {
      await sendConfirmationEmail(email, medicine.name, token);
    }

    return NextResponse.json({ ok: true, alreadyExists });
  } catch (err) {
    console.error("[alerts POST]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
