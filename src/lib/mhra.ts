// MHRA Products search integration
// The MHRA site (products.mhra.gov.uk) uses Azure Cognitive Search with private credentials.
// Set MHRA_SEARCH_SERVICE, MHRA_SEARCH_INDEX, and MHRA_SEARCH_KEY in .env.local to enable live search.
// Falls back to the local seed database when credentials are absent.

export interface MHRAProduct {
  productName: string;
  substanceName: string;
  plNumber?: string;
  docType: string;
  territory?: string;
  url?: string;
}

export interface MHRASearchResponse {
  resultCount: number;
  results: MHRAProduct[];
  source: "mhra" | "seed";
}

export async function searchMHRA(query: string, page = 1): Promise<MHRASearchResponse> {
  const service = process.env.MHRA_SEARCH_SERVICE;
  const index = process.env.MHRA_SEARCH_INDEX;
  const key = process.env.MHRA_SEARCH_KEY;
  const apiVersion = process.env.MHRA_SEARCH_API_VERSION ?? "2020-06-30";
  const pageSize = 10;

  if (!service || !index || !key) {
    return { resultCount: 0, results: [], source: "seed" };
  }

  const skip = (page - 1) * pageSize;
  const params = new URLSearchParams({
    "api-version": apiVersion,
    search: query,
    queryType: "full",
    $count: "true",
    $top: String(pageSize),
    $skip: String(skip),
    searchMode: "all",
    highlight: "content",
    $select: "product_name,substance_name,pl_number,doc_type,territory,file_name",
  });

  const url = `https://${service}.search.windows.net/indexes/${index}/docs?${params}`;

  const res = await fetch(url, {
    headers: { "api-key": key },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`MHRA search failed: ${res.status}`);
  }

  const data = await res.json() as { value?: Record<string, string>[]; "@odata.count"?: number };

  const results: MHRAProduct[] = (data.value ?? []).map((item: Record<string, string>) => ({
    productName: item.product_name ?? "",
    substanceName: item.substance_name ?? "",
    plNumber: item.pl_number,
    docType: item.doc_type ?? "",
    territory: item.territory,
    url: item.file_name ? `https://products.mhra.gov.uk${item.file_name}` : undefined,
  }));

  return {
    resultCount: data["@odata.count"] ?? results.length,
    results,
    source: "mhra",
  };
}
