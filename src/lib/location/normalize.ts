// Deterministic location normalizer.
//
// Staff type a company location however they know it — "Chicago, IL", "Illinois",
// "IL", "Berlin, Germany", "Germany". We keep the raw text exactly as entered and
// also resolve it into structured parts (city / state / country) so reports can
// group consistently (e.g. "all Illinois projects"). This is intentionally a
// plain lookup — no AI — so it is instant, reliable, and runs the same on the
// server (authoritative, on save) and the client (live preview while typing).

export interface NormalizedLocation {
  city: string | null;
  // 2-letter USPS code for US states; null otherwise.
  state: string | null;
  // Canonical country name; "United States" when a US state is detected.
  country: string | null;
}

// USPS code -> full state/territory name.
export const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", PR: "Puerto Rico",
};

// Full state name (lowercased) -> USPS code.
const STATE_NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATES).map(([code, name]) => [name.toLowerCase(), code]),
);

// Common country names plus a few aliases. The value is the canonical name.
const COUNTRY_ALIASES: Record<string, string> = {
  "usa": "United States", "us": "United States", "u.s.": "United States",
  "u.s.a.": "United States", "united states": "United States",
  "united states of america": "United States", "america": "United States",
  "uk": "United Kingdom", "u.k.": "United Kingdom",
  "united kingdom": "United Kingdom", "great britain": "United Kingdom",
  "england": "United Kingdom", "scotland": "United Kingdom",
  "wales": "United Kingdom",
};

// Broader country list for single-token recognition (canonical names).
export const COUNTRIES: string[] = [
  "United States", "Canada", "Mexico", "United Kingdom", "Ireland", "France",
  "Germany", "Spain", "Portugal", "Italy", "Netherlands", "Belgium",
  "Switzerland", "Austria", "Sweden", "Norway", "Denmark", "Finland",
  "Poland", "Czech Republic", "Hungary", "Romania", "Greece", "Turkey",
  "Russia", "Ukraine", "China", "Japan", "South Korea", "North Korea",
  "India", "Pakistan", "Bangladesh", "Vietnam", "Thailand", "Malaysia",
  "Singapore", "Indonesia", "Philippines", "Taiwan", "Hong Kong",
  "Australia", "New Zealand", "Brazil", "Argentina", "Chile", "Colombia",
  "Peru", "Israel", "Saudi Arabia", "United Arab Emirates", "Qatar",
  "South Africa", "Nigeria", "Egypt", "Kenya", "Morocco",
];

const COUNTRY_LOOKUP: Record<string, string> = (() => {
  const map: Record<string, string> = { ...COUNTRY_ALIASES };
  for (const c of COUNTRIES) map[c.toLowerCase()] = c;
  return map;
})();

function matchState(token: string): string | null {
  const t = token.trim();
  if (!t) return null;
  const upper = t.toUpperCase();
  if (US_STATES[upper]) return upper; // 2-letter code
  const code = STATE_NAME_TO_CODE[t.toLowerCase()];
  return code ?? null;
}

function matchCountry(token: string): string | null {
  const t = token.trim().toLowerCase().replace(/\.$/, "");
  return COUNTRY_LOOKUP[t] ?? null;
}

// Resolve a free-text location into { city, state, country }. Unknown text is
// left in city as a best-effort label so nothing is silently dropped.
export function normalizeLocation(raw: string): NormalizedLocation {
  const result: NormalizedLocation = { city: null, state: null, country: null };
  const cleaned = raw.trim();
  if (!cleaned) return result;

  const parts = cleaned.split(",").map((p) => p.trim()).filter(Boolean);
  const leftover: string[] = [];

  for (const part of parts) {
    const state = matchState(part);
    if (state && !result.state) {
      result.state = state;
      continue;
    }
    const country = matchCountry(part);
    if (country && !result.country) {
      result.country = country;
      continue;
    }
    leftover.push(part);
  }

  // A US state implies the United States.
  if (result.state && !result.country) result.country = "United States";

  // First unrecognized chunk is treated as the city/locality.
  if (leftover.length) result.city = leftover[0];

  return result;
}

// Human-readable summary of what the normalizer resolved, for live UI hints.
// e.g. "Chicago, Illinois, United States" or "Illinois, United States".
export function describeLocation(n: NormalizedLocation): string {
  const stateLabel = n.state ? US_STATES[n.state] ?? n.state : null;
  return [n.city, stateLabel, n.country].filter(Boolean).join(", ");
}
