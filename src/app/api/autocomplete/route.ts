import { NextRequest, NextResponse } from 'next/server';
import { getAutocompleteSuggestions } from '@/lib/medicines-dal';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') ?? '';
  if (q.length < 2) return NextResponse.json([]);

  try {
    const suggestions = await getAutocompleteSuggestions(q, 7);
    return NextResponse.json(suggestions);
  } catch {
    return NextResponse.json([]);
  }
}
