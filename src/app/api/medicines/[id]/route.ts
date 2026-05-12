import { NextRequest, NextResponse } from 'next/server';
import { getMedicineById, getPricesByMedicineId, getIngredientsByMedicineId } from '@/lib/medicines-dal';

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Props) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  try {
    const [medicine, prices, ingredients] = await Promise.all([
      getMedicineById(numId),
      getPricesByMedicineId(numId),
      getIngredientsByMedicineId(numId),
    ]);
    if (!medicine) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ medicine, prices, ingredients });
  } catch (err) {
    console.error('Medicine fetch error:', err);
    return NextResponse.json({ error: 'Failed to load medicine' }, { status: 500 });
  }
}
