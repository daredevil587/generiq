import { NextResponse } from "next/server";

export interface ScanResult {
  name:        string | null;
  brand:       string | null;
  ingredients: string[];
}

const PROMPT = `You are analysing a medicine, supplement, or skincare product label photo.
Extract the following and respond ONLY with valid JSON — no extra text:
{
  "name":        "<main product/medicine name>",
  "brand":       "<brand or manufacturer name, null if same as name or not visible>",
  "ingredients": ["<active ingredient 1 with dose if shown>", "..."]
}
Rules:
- name: the primary product name printed prominently on the label
- brand: company/brand name only if clearly different from the product name
- ingredients: active pharmaceutical or nutritional ingredients with their strengths (e.g. "Ibuprofen 200mg", "Vitamin C 1000mg")
- Use null for name or brand if not found; use [] for ingredients if none visible
- If this is not a medicine/supplement/skincare label, still extract whatever text names are visible`;

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured. Add it to Vercel environment variables." },
      { status: 503 },
    );
  }

  let image: string;
  try {
    const body = await req.json();
    image = body.image;
    if (!image || !image.startsWith("data:image/")) {
      return NextResponse.json({ error: "Invalid image payload" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let openAiRes: Response;
  try {
    openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: image, detail: "high" } },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return NextResponse.json({ error: "OpenAI request timed out" }, { status: 504 });
  }

  if (!openAiRes.ok) {
    const detail = await openAiRes.text().catch(() => "");
    return NextResponse.json(
      { error: `OpenAI error ${openAiRes.status}`, detail },
      { status: 502 },
    );
  }

  const data = await openAiRes.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";

  // Extract JSON — model sometimes wraps it in markdown code fences
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ error: "No JSON in response", raw: content }, { status: 422 });
  }

  try {
    const result: ScanResult = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "JSON parse failed", raw: content }, { status: 422 });
  }
}
