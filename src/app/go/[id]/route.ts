import { NextRequest, NextResponse } from "next/server";
import { getPharmacyUrl, logPharmacyClick } from "@/lib/medicines-dal";

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Props) {
  const { id } = await params;
  const priceId = parseInt(id, 10);

  if (isNaN(priceId)) {
    return NextResponse.redirect(new URL("/search", _req.url));
  }

  const row = await getPharmacyUrl(priceId).catch(() => null);

  if (!row?.url) {
    return NextResponse.redirect(new URL("/search", _req.url));
  }

  // Fire-and-forget click log — never block the redirect
  logPharmacyClick(priceId, row.pharmacy_name, row.medicine_id).catch(() => {});

  return NextResponse.redirect(row.url, { status: 302 });
}
