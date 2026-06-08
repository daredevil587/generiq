export interface BaseMedicine {
  id: string;
  name: string;
  brandNames: string[];
  category: string;
  description: string;
  atcCode?: string;
  emaProductNumbers?: string[];
  source: 'seed' | 'ema' | 'fda';
}

export interface Medicine extends BaseMedicine {
  forms: MedicineForm[];
  mhraLicenseNumbers: string[];
  bnfCode?: string;
}

export interface MedicineForm {
  formId: string;
  form: string;
  strength: string;
  packSizes: PackPrice[];
}

export interface PackPrice {
  packSize: string;
  nhsDrugTariff?: number; // pence
  pharmacyPrices: PharmacyPrice[];
}

export interface PharmacyPrice {
  pharmacy: string;
  logo: string;
  price: number; // pence
  url?: string;
  inStock: boolean;
  deliveryDays?: number;
  isPlaceholder: boolean;
}

// Seed data - NHS Drug Tariff Category C indicative prices (pence)
// Pharmacy prices are representative placeholders until live feeds are connected
export const MEDICINES: Medicine[] = [
  {
    id: "ibuprofen",
    name: "Ibuprofen",
    brandNames: ["Nurofen", "Calprofen", "Brufen", "Ibugel"],
    category: "Analgesics & NSAIDs",
    description: "Non-steroidal anti-inflammatory drug (NSAID) used to relieve pain, fever and inflammation.",
    mhraLicenseNumbers: ["PL 00221/0117", "PL 17736/0062"],
    source: 'seed' as const,
    bnfCode: "0407010H0",
    forms: [
      {
        formId: "ibuprofen-tab-200mg",
        form: "Tablet",
        strength: "200mg",
        packSizes: [
          {
            packSize: "16 tablets",
            nhsDrugTariff: 74,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 89, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 129, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 119, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 109, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 115, inStock: true, isPlaceholder: true },
            ],
          },
          {
            packSize: "84 tablets",
            nhsDrugTariff: 340,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 399, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 549, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 499, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 459, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 479, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
      {
        formId: "ibuprofen-tab-400mg",
        form: "Tablet",
        strength: "400mg",
        packSizes: [
          {
            packSize: "84 tablets",
            nhsDrugTariff: 510,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 589, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 799, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 749, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 699, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 729, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "paracetamol",
    name: "Paracetamol",
    brandNames: ["Panadol", "Calpol", "Hedex"],
    category: "Analgesics & NSAIDs",
    description: "Widely used analgesic and antipyretic for mild to moderate pain and fever.",
    mhraLicenseNumbers: ["PL 00221/0118", "PL 06831/0209"],
    source: 'seed' as const,
    bnfCode: "0407010AC",
    forms: [
      {
        formId: "paracetamol-tab-500mg",
        form: "Tablet",
        strength: "500mg",
        packSizes: [
          {
            packSize: "16 tablets",
            nhsDrugTariff: 53,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 65, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 75, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 72, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 69, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 71, inStock: true, isPlaceholder: true },
            ],
          },
          {
            packSize: "100 tablets",
            nhsDrugTariff: 299,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 345, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 449, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 399, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 369, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 389, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "amoxicillin",
    name: "Amoxicillin",
    brandNames: ["Amoxil"],
    category: "Antibacterials",
    description: "Broad-spectrum penicillin antibiotic used for bacterial infections.",
    mhraLicenseNumbers: ["PL 04425/0088"],
    source: 'seed' as const,
    bnfCode: "0501013B0",
    forms: [
      {
        formId: "amoxicillin-cap-250mg",
        form: "Capsule",
        strength: "250mg",
        packSizes: [
          {
            packSize: "21 capsules",
            nhsDrugTariff: 69,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 799, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 999, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 949, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 899, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 929, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
      {
        formId: "amoxicillin-cap-500mg",
        form: "Capsule",
        strength: "500mg",
        packSizes: [
          {
            packSize: "21 capsules",
            nhsDrugTariff: 115,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 1099, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 1399, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 1299, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 1199, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 1249, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "atorvastatin",
    name: "Atorvastatin",
    brandNames: ["Lipitor"],
    category: "Cardiovascular - Lipid Regulating",
    description: "HMG-CoA reductase inhibitor (statin) for lowering cholesterol and reducing cardiovascular risk.",
    mhraLicenseNumbers: ["PL 00057/0853"],
    source: 'seed' as const,
    bnfCode: "0212000B0",
    forms: [
      {
        formId: "atorvastatin-tab-10mg",
        form: "Tablet",
        strength: "10mg",
        packSizes: [
          {
            packSize: "28 tablets",
            nhsDrugTariff: 87,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 999, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 1299, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 1199, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 1099, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 1149, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
      {
        formId: "atorvastatin-tab-20mg",
        form: "Tablet",
        strength: "20mg",
        packSizes: [
          {
            packSize: "28 tablets",
            nhsDrugTariff: 99,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 1099, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 1499, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 1349, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 1199, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 1249, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
      {
        formId: "atorvastatin-tab-40mg",
        form: "Tablet",
        strength: "40mg",
        packSizes: [
          {
            packSize: "28 tablets",
            nhsDrugTariff: 109,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 1199, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 1599, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 1449, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 1299, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 1349, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "lisinopril",
    name: "Lisinopril",
    brandNames: ["Zestril", "Carace"],
    category: "Cardiovascular - ACE Inhibitors",
    description: "ACE inhibitor for hypertension, heart failure, and diabetic nephropathy.",
    mhraLicenseNumbers: ["PL 00057/0427"],
    source: 'seed' as const,
    bnfCode: "0205051P0",
    forms: [
      {
        formId: "lisinopril-tab-5mg",
        form: "Tablet",
        strength: "5mg",
        packSizes: [
          {
            packSize: "28 tablets",
            nhsDrugTariff: 74,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 899, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 1199, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 1099, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 999, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 1049, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
      {
        formId: "lisinopril-tab-10mg",
        form: "Tablet",
        strength: "10mg",
        packSizes: [
          {
            packSize: "28 tablets",
            nhsDrugTariff: 78,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 949, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 1249, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 1149, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 1049, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 1099, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "amlodipine",
    name: "Amlodipine",
    brandNames: ["Istin"],
    category: "Cardiovascular - Calcium Channel Blockers",
    description: "Calcium channel blocker for hypertension and angina.",
    mhraLicenseNumbers: ["PL 00057/0523"],
    source: 'seed' as const,
    bnfCode: "0206020A0",
    forms: [
      {
        formId: "amlodipine-tab-5mg",
        form: "Tablet",
        strength: "5mg",
        packSizes: [
          {
            packSize: "28 tablets",
            nhsDrugTariff: 70,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 849, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 1149, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 1049, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 949, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 999, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
      {
        formId: "amlodipine-tab-10mg",
        form: "Tablet",
        strength: "10mg",
        packSizes: [
          {
            packSize: "28 tablets",
            nhsDrugTariff: 77,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 899, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 1199, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 1099, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 999, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 1049, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "metformin",
    name: "Metformin",
    brandNames: ["Glucophage"],
    category: "Diabetes - Biguanides",
    description: "First-line oral antidiabetic for type 2 diabetes mellitus.",
    mhraLicenseNumbers: ["PL 11648/0010"],
    source: 'seed' as const,
    bnfCode: "0601022B0",
    forms: [
      {
        formId: "metformin-tab-500mg",
        form: "Tablet",
        strength: "500mg",
        packSizes: [
          {
            packSize: "84 tablets",
            nhsDrugTariff: 93,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 1099, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 1499, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 1349, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 1199, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 1249, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
      {
        formId: "metformin-tab-850mg",
        form: "Tablet",
        strength: "850mg",
        packSizes: [
          {
            packSize: "56 tablets",
            nhsDrugTariff: 98,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 1149, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 1549, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 1399, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 1249, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 1299, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "omeprazole",
    name: "Omeprazole",
    brandNames: ["Losec", "Mepradec"],
    category: "Gastro-intestinal - Proton Pump Inhibitors",
    description: "Proton pump inhibitor (PPI) for gastric acid-related conditions including GORD and peptic ulcers.",
    mhraLicenseNumbers: ["PL 15513/0205"],
    source: 'seed' as const,
    bnfCode: "0103050E0",
    forms: [
      {
        formId: "omeprazole-cap-20mg",
        form: "Gastro-resistant Capsule",
        strength: "20mg",
        packSizes: [
          {
            packSize: "28 capsules",
            nhsDrugTariff: 108,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 1249, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 1649, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 1499, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 1349, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 1399, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
      {
        formId: "omeprazole-cap-40mg",
        form: "Gastro-resistant Capsule",
        strength: "40mg",
        packSizes: [
          {
            packSize: "28 capsules",
            nhsDrugTariff: 125,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 1449, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 1849, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 1699, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 1549, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 1599, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "sertraline",
    name: "Sertraline",
    brandNames: ["Lustral"],
    category: "Antidepressants - SSRIs",
    description: "Selective serotonin reuptake inhibitor (SSRI) for depression, OCD, panic disorder and PTSD.",
    mhraLicenseNumbers: ["PL 00057/0600"],
    source: 'seed' as const,
    bnfCode: "0403030AC",
    forms: [
      {
        formId: "sertraline-tab-50mg",
        form: "Tablet",
        strength: "50mg",
        packSizes: [
          {
            packSize: "28 tablets",
            nhsDrugTariff: 159,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 1799, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 2299, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 2099, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 1899, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 1999, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
      {
        formId: "sertraline-tab-100mg",
        form: "Tablet",
        strength: "100mg",
        packSizes: [
          {
            packSize: "28 tablets",
            nhsDrugTariff: 220,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 2499, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 3199, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 2899, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 2649, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 2749, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "salbutamol",
    name: "Salbutamol",
    brandNames: ["Ventolin", "Salamol", "Airomir"],
    category: "Respiratory - Bronchodilators",
    description: "Short-acting beta-2 agonist (SABA) for acute relief of bronchospasm in asthma and COPD.",
    mhraLicenseNumbers: ["PL 00221/0102", "PL 17780/0043"],
    source: 'seed' as const,
    bnfCode: "0301011R0",
    forms: [
      {
        formId: "salbutamol-inh-100mcg",
        form: "CFC-free Inhaler",
        strength: "100mcg/actuation",
        packSizes: [
          {
            packSize: "200 dose inhaler",
            nhsDrugTariff: 174,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 1999, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 2599, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 2399, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 2199, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 2299, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "ramipril",
    name: "Ramipril",
    brandNames: ["Tritace"],
    category: "Cardiovascular - ACE Inhibitors",
    description: "ACE inhibitor for hypertension, heart failure, post-MI, and diabetic nephropathy.",
    mhraLicenseNumbers: ["PL 04452/0003"],
    source: 'seed' as const,
    bnfCode: "0205051R0",
    forms: [
      {
        formId: "ramipril-cap-2.5mg",
        form: "Capsule",
        strength: "2.5mg",
        packSizes: [
          {
            packSize: "28 capsules",
            nhsDrugTariff: 76,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 899, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 1199, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 1099, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 999, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 1049, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
      {
        formId: "ramipril-cap-5mg",
        form: "Capsule",
        strength: "5mg",
        packSizes: [
          {
            packSize: "28 capsules",
            nhsDrugTariff: 83,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 999, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 1299, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 1199, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 1099, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 1149, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "bisoprolol",
    name: "Bisoprolol",
    brandNames: ["Cardicor", "Emcor"],
    category: "Cardiovascular - Beta Blockers",
    description: "Selective beta-1 blocker for hypertension, angina, and heart failure.",
    mhraLicenseNumbers: ["PL 04452/0015"],
    source: 'seed' as const,
    bnfCode: "0206020B0",
    forms: [
      {
        formId: "bisoprolol-tab-2.5mg",
        form: "Tablet",
        strength: "2.5mg",
        packSizes: [
          {
            packSize: "28 tablets",
            nhsDrugTariff: 71,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 849, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 1149, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 1049, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 949, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 999, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
      {
        formId: "bisoprolol-tab-5mg",
        form: "Tablet",
        strength: "5mg",
        packSizes: [
          {
            packSize: "28 tablets",
            nhsDrugTariff: 74,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 899, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 1199, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 1099, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 999, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 1049, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "naproxen",
    name: "Naproxen",
    brandNames: ["Naprosyn", "Feminax Ultra"],
    category: "Analgesics & NSAIDs",
    description: "NSAID used for pain, inflammation, and musculoskeletal disorders.",
    mhraLicenseNumbers: ["PL 00057/0723"],
    source: 'seed' as const,
    bnfCode: "1001010M0",
    forms: [
      {
        formId: "naproxen-tab-250mg",
        form: "Tablet",
        strength: "250mg",
        packSizes: [
          {
            packSize: "28 tablets",
            nhsDrugTariff: 138,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 1599, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 2099, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 1899, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 1699, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 1799, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
      {
        formId: "naproxen-tab-500mg",
        form: "Tablet",
        strength: "500mg",
        packSizes: [
          {
            packSize: "28 tablets",
            nhsDrugTariff: 185,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 2099, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 2699, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 2499, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 2299, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 2399, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "fluoxetine",
    name: "Fluoxetine",
    brandNames: ["Prozac", "Oxactin"],
    category: "Antidepressants - SSRIs",
    description: "SSRI for depression, OCD, bulimia nervosa and panic disorder.",
    mhraLicenseNumbers: ["PL 00057/0386"],
    source: 'seed' as const,
    bnfCode: "0403030E0",
    forms: [
      {
        formId: "fluoxetine-cap-20mg",
        form: "Capsule",
        strength: "20mg",
        packSizes: [
          {
            packSize: "30 capsules",
            nhsDrugTariff: 117,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 1349, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 1749, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 1599, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 1449, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 1499, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "lansoprazole",
    name: "Lansoprazole",
    brandNames: ["Zoton FasTab"],
    category: "Gastro-intestinal - Proton Pump Inhibitors",
    description: "Proton pump inhibitor for GORD, peptic ulcers, and H. pylori eradication.",
    mhraLicenseNumbers: ["PL 04425/0125"],
    source: 'seed' as const,
    bnfCode: "0103050C0",
    forms: [
      {
        formId: "lansoprazole-cap-15mg",
        form: "Gastro-resistant Capsule",
        strength: "15mg",
        packSizes: [
          {
            packSize: "28 capsules",
            nhsDrugTariff: 95,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 1099, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 1449, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 1299, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 1149, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 1199, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
      {
        formId: "lansoprazole-cap-30mg",
        form: "Gastro-resistant Capsule",
        strength: "30mg",
        packSizes: [
          {
            packSize: "28 capsules",
            nhsDrugTariff: 113,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 1299, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 1699, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 1549, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 1399, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 1449, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "doxycycline",
    name: "Doxycycline",
    brandNames: ["Vibramycin-D", "Efracea"],
    category: "Antibacterials - Tetracyclines",
    description: "Tetracycline antibiotic for respiratory, urogenital and skin infections, and malaria prophylaxis.",
    mhraLicenseNumbers: ["PL 00057/0449"],
    source: 'seed' as const,
    bnfCode: "0501030P0",
    forms: [
      {
        formId: "doxycycline-cap-100mg",
        form: "Capsule",
        strength: "100mg",
        packSizes: [
          {
            packSize: "8 capsules",
            nhsDrugTariff: 191,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 2199, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 2799, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 2599, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 2399, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 2499, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "simvastatin",
    name: "Simvastatin",
    brandNames: ["Zocor"],
    category: "Cardiovascular - Lipid Regulating",
    description: "HMG-CoA reductase inhibitor (statin) for lowering cholesterol.",
    mhraLicenseNumbers: ["PL 00025/0310"],
    source: 'seed' as const,
    bnfCode: "0212000Y0",
    forms: [
      {
        formId: "simvastatin-tab-10mg",
        form: "Tablet",
        strength: "10mg",
        packSizes: [
          {
            packSize: "28 tablets",
            nhsDrugTariff: 76,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 899, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 1199, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 1099, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 999, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 1049, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
      {
        formId: "simvastatin-tab-40mg",
        form: "Tablet",
        strength: "40mg",
        packSizes: [
          {
            packSize: "28 tablets",
            nhsDrugTariff: 87,
            pharmacyPrices: [
              { pharmacy: "Pharmacy2U", logo: "P2U", price: 999, inStock: true, deliveryDays: 1, isPlaceholder: true },
              { pharmacy: "Boots", logo: "BOO", price: 1299, inStock: true, isPlaceholder: true },
              { pharmacy: "Lloyds Pharmacy", logo: "LLP", price: 1199, inStock: true, isPlaceholder: true },
              { pharmacy: "Well Pharmacy", logo: "WEL", price: 1099, inStock: true, deliveryDays: 2, isPlaceholder: true },
              { pharmacy: "Day Lewis", logo: "DL", price: 1149, inStock: true, isPlaceholder: true },
            ],
          },
        ],
      },
    ],
  },
];

export function searchMedicines(query: string): Medicine[] {
  if (!query.trim()) return MEDICINES;
  const q = query.toLowerCase().trim();
  return MEDICINES.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      m.brandNames.some((b) => b.toLowerCase().includes(q)) ||
      m.category.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q)
  );
}

export function getMedicineById(id: string): Medicine | undefined {
  return MEDICINES.find((m) => m.id === id);
}

export function formatPrice(pence: number): string {
  if (pence < 100) return `${pence}p`;
  return `£${(pence / 100).toFixed(2)}`;
}

export const CATEGORIES = [...new Set(MEDICINES.map((m) => m.category))].sort();

