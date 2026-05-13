// Fuzzy name matching for pharmacy product → medicine DB entry

const STOP = new Set([
  "tablets", "tablet", "capsules", "capsule", "pack", "the", "and", "with",
  "for", "film", "coated", "modified", "release", "oral", "solution", "suspension",
  "prolonged", "gastro", "resistant", "effervescent", "chewable", "dispersible",
  "hard", "soft", "gel", "cream", "ointment", "lotion", "syrup", "liquid",
  "injection", "infusion", "x", "of", "a",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

export function matchScore(medicineName: string, productName: string): number {
  const medTokens  = tokenize(medicineName);
  const prodTokens = new Set(tokenize(productName));
  if (medTokens.length === 0) return 0;
  const hits = medTokens.filter((t) => prodTokens.has(t)).length;
  return hits / medTokens.length;
}

export function bestMatch(medicineName: string, results: Array<{ name: string; [k: string]: unknown }>): number {
  let best = -1;
  let bestIdx = -1;
  results.forEach((r, i) => {
    const s = matchScore(medicineName, r.name);
    if (s > best) { best = s; bestIdx = i; }
  });
  return best >= 0.4 ? bestIdx : -1;
}
