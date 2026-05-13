export interface ScrapeResult {
  pharmacyName: string;
  priceGbp: string;
  url: string;
  packSize?: string;
  strength?: string;
  inStock: boolean;
  offerText?: string;
  imageUrl?: string;
  matchScore: number;
}

export interface PharmacyScraper {
  name: string;
  search(query: string, page: import("playwright").Page): Promise<ScrapeResult[]>;
}
