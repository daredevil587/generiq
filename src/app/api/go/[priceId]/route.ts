import { NextResponse } from "next/server";
import { getPharmacyUrl, logPharmacyClick } from "@/lib/medicines-dal";

interface Props { params: Promise<{ priceId: string }> }

export async function GET(_req: Request, { params }: Props) {
  const { priceId } = await params;
  const id = parseInt(priceId, 10);
  if (isNaN(id)) return NextResponse.redirect("/", { status: 302 });

  const row = await getPharmacyUrl(id);
  if (!row) return NextResponse.redirect("/", { status: 302 });

  // Log the click in the background — don't block the redirect
  logPharmacyClick(id, row.pharmacy_name, row.medicine_id);

  return NextResponse.redirect(row.url, { status: 302 });
}
