// Curated NAICS codes relevant to economic development site selection.
// Covers major 2-digit sectors and the sub-sectors most commonly seen in RFIs.

export interface NaicsEntry {
  code: string;
  description: string;
}

export const NAICS_LIST: NaicsEntry[] = [
  // --- Agriculture / Forestry ------------------------------------------------
  { code: "11",   description: "Agriculture, Forestry, Fishing and Hunting" },
  // --- Mining / Oil & Gas ---------------------------------------------------
  { code: "21",   description: "Mining, Quarrying, and Oil and Gas Extraction" },
  // --- Utilities ------------------------------------------------------------
  { code: "22",   description: "Utilities" },
  { code: "2211", description: "Electric Power Generation, Transmission and Distribution" },
  { code: "2212", description: "Natural Gas Distribution" },
  { code: "2213", description: "Water, Sewage and Other Systems" },
  // --- Construction ---------------------------------------------------------
  { code: "23",   description: "Construction" },
  // --- Manufacturing --------------------------------------------------------
  { code: "311",  description: "Food Manufacturing" },
  { code: "3111", description: "Animal Food Manufacturing" },
  { code: "3112", description: "Grain and Oilseed Milling" },
  { code: "3114", description: "Fruit and Vegetable Preserving and Specialty Food" },
  { code: "3115", description: "Dairy Product Manufacturing" },
  { code: "3116", description: "Animal Slaughtering and Processing" },
  { code: "3119", description: "Other Food Manufacturing" },
  { code: "312",  description: "Beverage and Tobacco Product Manufacturing" },
  { code: "3121", description: "Beverage Manufacturing" },
  { code: "313",  description: "Textile Mills" },
  { code: "314",  description: "Textile Product Mills" },
  { code: "315",  description: "Apparel Manufacturing" },
  { code: "321",  description: "Wood Product Manufacturing" },
  { code: "322",  description: "Paper Manufacturing" },
  { code: "323",  description: "Printing and Related Support Activities" },
  { code: "324",  description: "Petroleum and Coal Products Manufacturing" },
  { code: "325",  description: "Chemical Manufacturing" },
  { code: "3251", description: "Basic Chemical Manufacturing" },
  { code: "3252", description: "Resin, Synthetic Rubber, and Artificial Fibers Manufacturing" },
  { code: "3253", description: "Pesticide, Fertilizer, and Other Agricultural Chemical Manufacturing" },
  { code: "3254", description: "Pharmaceutical and Medicine Manufacturing" },
  { code: "3255", description: "Paint, Coating, and Adhesive Manufacturing" },
  { code: "3256", description: "Soap, Cleaning Compound, and Toilet Preparation Manufacturing" },
  { code: "326",  description: "Plastics and Rubber Products Manufacturing" },
  { code: "3261", description: "Plastics Product Manufacturing" },
  { code: "3262", description: "Rubber Product Manufacturing" },
  { code: "327",  description: "Nonmetallic Mineral Product Manufacturing" },
  { code: "3271", description: "Clay Product and Refractory Manufacturing" },
  { code: "3273", description: "Cement and Concrete Product Manufacturing" },
  { code: "331",  description: "Primary Metal Manufacturing" },
  { code: "3311", description: "Iron and Steel Mills and Ferroalloy Manufacturing" },
  { code: "3312", description: "Steel Product Manufacturing from Purchased Steel" },
  { code: "3315", description: "Foundries" },
  { code: "332",  description: "Fabricated Metal Product Manufacturing" },
  { code: "3321", description: "Forging and Stamping" },
  { code: "3325", description: "Hardware Manufacturing" },
  { code: "3326", description: "Spring and Wire Product Manufacturing" },
  { code: "3329", description: "Other Fabricated Metal Product Manufacturing" },
  { code: "333",  description: "Machinery Manufacturing" },
  { code: "3331", description: "Agricultural, Construction, and Mining Machinery Manufacturing" },
  { code: "3332", description: "Industrial Machinery Manufacturing" },
  { code: "3333", description: "Commercial and Service Industry Machinery Manufacturing" },
  { code: "3334", description: "HVAC and Commercial Refrigeration Equipment Manufacturing" },
  { code: "3339", description: "Other General Purpose Machinery Manufacturing" },
  { code: "334",  description: "Computer and Electronic Product Manufacturing" },
  { code: "3341", description: "Computer and Peripheral Equipment Manufacturing" },
  { code: "3342", description: "Communications Equipment Manufacturing" },
  { code: "3344", description: "Semiconductor and Other Electronic Component Manufacturing" },
  { code: "3345", description: "Navigational, Measuring, Electromedical, and Control Instruments" },
  { code: "335",  description: "Electrical Equipment, Appliance, and Component Manufacturing" },
  { code: "3351", description: "Electric Lighting Equipment Manufacturing" },
  { code: "3353", description: "Electrical Equipment Manufacturing" },
  { code: "3359", description: "Other Electrical Equipment and Component Manufacturing" },
  { code: "336",  description: "Transportation Equipment Manufacturing" },
  { code: "3361", description: "Motor Vehicle Manufacturing" },
  { code: "3362", description: "Motor Vehicle Body and Trailer Manufacturing" },
  { code: "3363", description: "Motor Vehicle Parts Manufacturing" },
  { code: "3364", description: "Aerospace Product and Parts Manufacturing" },
  { code: "3369", description: "Other Transportation Equipment Manufacturing" },
  { code: "337",  description: "Furniture and Related Product Manufacturing" },
  { code: "339",  description: "Miscellaneous Manufacturing" },
  { code: "3391", description: "Medical Equipment and Supplies Manufacturing" },
  // --- Wholesale Trade ------------------------------------------------------
  { code: "42",   description: "Wholesale Trade" },
  { code: "423",  description: "Merchant Wholesalers, Durable Goods" },
  { code: "424",  description: "Merchant Wholesalers, Nondurable Goods" },
  // --- Retail Trade ---------------------------------------------------------
  { code: "44",   description: "Retail Trade — Motor Vehicle and Parts Dealers, Food, Health" },
  { code: "45",   description: "Retail Trade — General Merchandise, Sporting Goods, Online" },
  // --- Transportation & Warehousing -----------------------------------------
  { code: "481",  description: "Air Transportation" },
  { code: "484",  description: "Truck Transportation" },
  { code: "485",  description: "Transit and Ground Passenger Transportation" },
  { code: "486",  description: "Pipeline Transportation" },
  { code: "488",  description: "Support Activities for Transportation" },
  { code: "493",  description: "Warehousing and Storage" },
  { code: "4931", description: "General Warehousing and Storage" },
  { code: "4932", description: "Refrigerated Warehousing and Storage" },
  // --- Information ----------------------------------------------------------
  { code: "511",  description: "Publishing Industries" },
  { code: "515",  description: "Broadcasting (except Internet)" },
  { code: "517",  description: "Telecommunications" },
  { code: "518",  description: "Computing Infrastructure Providers, Data Processing, Web Hosting" },
  { code: "5182", description: "Data Processing, Hosting, and Related Services" },
  { code: "5191", description: "Other Information Services (incl. Internet Publishing)" },
  // --- Finance & Insurance --------------------------------------------------
  { code: "52",   description: "Finance and Insurance" },
  { code: "522",  description: "Credit Intermediation and Related Activities" },
  { code: "524",  description: "Insurance Carriers and Related Activities" },
  // --- Real Estate ----------------------------------------------------------
  { code: "531",  description: "Real Estate" },
  { code: "532",  description: "Rental and Leasing Services" },
  // --- Professional, Scientific & Technical ---------------------------------
  { code: "541",  description: "Professional, Scientific, and Technical Services" },
  { code: "5413", description: "Architectural, Engineering, and Related Services" },
  { code: "5415", description: "Computer Systems Design and Related Services" },
  { code: "5417", description: "Scientific Research and Development Services" },
  { code: "5419", description: "Other Professional, Scientific, and Technical Services" },
  // --- Management -----------------------------------------------------------
  { code: "55",   description: "Management of Companies and Enterprises" },
  // --- Administrative & Waste Management ------------------------------------
  { code: "561",  description: "Administrative and Support Services" },
  { code: "562",  description: "Waste Management and Remediation Services" },
  // --- Educational Services -------------------------------------------------
  { code: "61",   description: "Educational Services" },
  // --- Health Care ----------------------------------------------------------
  { code: "621",  description: "Ambulatory Health Care Services" },
  { code: "622",  description: "Hospitals" },
  { code: "623",  description: "Nursing and Residential Care Facilities" },
  { code: "624",  description: "Social Assistance" },
  // --- Arts & Entertainment -------------------------------------------------
  { code: "71",   description: "Arts, Entertainment, and Recreation" },
  // --- Accommodation & Food Service -----------------------------------------
  { code: "721",  description: "Accommodation" },
  { code: "722",  description: "Food Services and Drinking Places" },
  // --- Other Services -------------------------------------------------------
  { code: "811",  description: "Repair and Maintenance" },
  { code: "812",  description: "Personal and Laundry Services" },
  // --- Public Administration ------------------------------------------------
  { code: "92",   description: "Public Administration" },
];

// Quick lookup by code (exact match).
export const NAICS_BY_CODE = Object.fromEntries(
  NAICS_LIST.map((e) => [e.code, e.description]),
);

// The select options sorted by code.
export const NAICS_OPTIONS = [
  { value: "", label: "— Select NAICS code —" },
  ...NAICS_LIST.map((e) => ({ value: e.code, label: `${e.code} — ${e.description}` })),
];
