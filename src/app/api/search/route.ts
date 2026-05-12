import { NextRequest, NextResponse } from 'next/server';
import { searchMedicines } from '@/lib/medicines-dal';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') ?? '';
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') ?? '20', 10), 100);
  const offset = parseInt(request.nextUrl.searchParams.get('offset') ?? '0', 10);

  try {
    const tab        = request.nextUrl.searchParams.get('tab') ?? 'all';
    const gender     = request.nextUrl.searchParams.get('gender') ?? undefined;
    const subcategory = request.nextUrl.searchParams.get('subcategory') ?? undefined;
    const { rows, total } = await searchMedicines(q, limit, offset, tab, gender, subcategory);
    return NextResponse.json({ results: rows, total, source: 'db' });
  } catch (err) {
    console.error('Search error:', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
