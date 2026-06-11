import ExcelJS from "exceljs";
import { writeFileSync } from "node:fs";

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile("naics_2022.xlsx");
const ws = wb.worksheets[0];

const entries = [];
let trailingT = 0;
ws.eachRow((row, n) => {
  if (n === 1) return;
  const codeCell = row.getCell(2).value;
  const titleCell = row.getCell(3).value;
  if (codeCell == null || titleCell == null) return;
  const code = String(codeCell).trim();
  let title = String(titleCell).trim();
  // Census appends a superscript "T" footnote marker to some titles.
  if (/[a-z)]T$/.test(title)) {
    const before = title;
    title = title.replace(/T$/, "").trim();
    trailingT++;
    if (trailingT <= 8) console.error("  strip T:", JSON.stringify(before), "->", JSON.stringify(title));
  }
  if (!/^\d{2,6}$/.test(code)) return;
  entries.push({ code, description: title });
});

// Sort by code so the picklist reads hierarchically.
entries.sort((a, b) => a.code.localeCompare(b.code));

const byLevel = {};
for (const e of entries) {
  const L = e.code.length;
  byLevel[L] = (byLevel[L] || 0) + 1;
}
console.error("counts by digit length:", byLevel, "total:", entries.length, "trailingT stripped:", trailingT);

const esc = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const lines = entries.map(
  (e) => `  { code: "${e.code}", description: "${esc(e.description)}" },`,
);

const out = `// Full 2022 NAICS code set (2- through 6-digit), generated from the U.S. Census
// Bureau's official "2-6 digit 2022 Codes" file. Regenerate with scripts/gen-naics.mjs.

export interface NaicsEntry {
  code: string;
  description: string;
}

export const NAICS_LIST: NaicsEntry[] = [
${lines.join("\n")}
];

// Quick lookup by code (exact match).
export const NAICS_BY_CODE: Record<string, string> = Object.fromEntries(
  NAICS_LIST.map((e) => [e.code, e.description]),
);

// The select options, already sorted hierarchically by code.
export const NAICS_OPTIONS = [
  { value: "", label: "— Select NAICS code —" },
  ...NAICS_LIST.map((e) => ({ value: e.code, label: \`\${e.code} — \${e.description}\` })),
];
`;

writeFileSync("src/lib/naics.ts", out);
console.error("wrote src/lib/naics.ts");
