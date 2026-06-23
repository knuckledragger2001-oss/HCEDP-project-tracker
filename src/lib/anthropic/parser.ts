import Anthropic from "@anthropic-ai/sdk";
import { config, isAnthropicConfigured } from "@/lib/config";
import {
  ParsedProjectSchema,
  parsedProjectJsonSchema,
  type ParsedProject,
} from "./schema";
import { filesToContentBlocks, type IncomingFile } from "./attachments";

export class AnthropicNotConfiguredError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY is not set. Add it to your .env to enable RFI parsing.",
    );
    this.name = "AnthropicNotConfiguredError";
  }
}

const SYSTEM_PROMPT = `You are an intake analyst for the Hays Caldwell Economic Development Partnership (HCEDP). You read economic-development RFIs (requests for information) that arrive as forwarded emails plus attachments, and you extract a structured record.

RFIs are messy and inconsistent. Figures arrive in varying units, requirements may be time-phased, and some needs are qualitative. Extract everything you can and DO NOT invent facts. If a value is missing, leave it null.

Call the record_rfi tool exactly once with your extraction.

GENERAL RULES
- codename: the project's anonymized codename (e.g. "Project Zero Sugar").
- leadSource: classify the original sender. The Texas Governor's Office / EDT / "gov.texas.gov" => TEXAS_GOVERNORS_OFFICE. Opportunity Austin => OPPORTUNITY_AUSTIN. Sent directly by the company => DIRECT. Otherwise OTHER (and put detail in leadSourceOther). The HCEDP staffer who forwarded it internally is NOT the lead source; the external originator is.
- sourceContactName / sourceContactEmail: the originating contact to respond to.
- submissionDestination: where the response is to be submitted.
- companyLocationRaw: the company's current/home location if stated (e.g. "Chicago, IL", "Illinois", or just "Germany" for a foreign company). Copy it as written — do not guess. Leave null if the RFI keeps the company anonymous or gives no location.
- Capital investment: capture total/land/building/equipment as plain numbers in USD (e.g. 1600000000, not "$1.6B").
- avgWage: a single USD number.
- jobPhases: one entry per phased job figure, with the count and the timeframe exactly as written (e.g. count 75, timeframe "Year One"; count 200, timeframe "3-5 years").
- minAcreage: minimum site acreage as a plain number.
- minBuildingSqFt: minimum building square footage required, as a plain number (e.g. 250000 for 250,000 sq ft). Extract from any statement of building size, floor space, or facility size. Leave null if not stated.
- siteLocationPreferences: array of the stated preferences (e.g. ["Industrial Park", "Freestanding Site", "Incubator Site"]).
- criticalCriteria: the must-have needs the RFI lists "in order of importance". Preserve that order using rank 1, 2, 3, ... These drive site selection.
- requiredDeliverables: what the response must include (e.g. "Site Summary Spreadsheet", "RFI Response combined into one PDF").
- qualitativeNotes: capture soft/qualitative needs that do not fit a structured field (e.g. "supportive educational ecosystem"), each as { label, content }.
- Dates: output ISO 8601 (YYYY-MM-DD). Map the email's sent/received date to rfiReceivedDate, the submission deadline to responseDueDate, the projected decision date and start-of-production date to their fields. Leave responseSubmittedDate and siteVisitDate null unless explicitly stated (these are usually filled in later by HCEDP).

UTILITY NORMALIZATION (critical — follow exactly)
For every utility, store the normalized value, the original raw value as written (rawValue), and time-phasing as datapoints. When a figure is given in more than one unit, prefer the most directly stated one and note the choice in assumptionNote.
- ELECTRICITY: normalize to Megawatts (MW). Capture day-one demand (kind "day-one") with its date, peak demand (kind "peak") with its date, and any load ramp as dated datapoints (kind "ramp"). Set normalizedValue to the peak MW and normalizedUnit "MW".
- WATER: normalize to thousands of gallons per day ("thousand gal/day"). If only a monthly figure is given, convert to daily (divide by 30), set flagged=true and explain in assumptionNote. If a daily figure is stated directly, prefer it.
- WASTEWATER: same unit and handling as water ("thousand gal/day").
- GAS: natural gas is reported inconsistently — standardize to thousands of cubic feet per day ("thousand ft3/day") and ALWAYS keep the raw value. If only a monthly figure is given, convert (divide by 30) and flag it. Capture stated alternatives (e.g. diesel, battery storage) in alternatives.
Always keep rawValue verbatim. Whenever you convert or assume a unit, set flagged=true and write a short assumptionNote.

PARSE WARNINGS
Populate parseWarnings with one entry per value you had to assume, convert, or infer, so a human can verify it. Use kind "conversion" for unit conversions, "assumption" for inferred values, and "missing" for important fields you could not find. Each entry: { field, message, kind }.`;

const USER_INSTRUCTION = `Extract the structured RFI record from the pasted email text and any attachments below. Apply the unit-normalization rules exactly and record any assumptions/conversions in parseWarnings.`;

export interface ParseRfiInput {
  emailText: string;
  files?: IncomingFile[];
  highEffort?: boolean;
}

export interface ParseRfiResult {
  proposal: ParsedProject;
  model: string;
}

export async function parseRfi(input: ParseRfiInput): Promise<ParseRfiResult> {
  if (!isAnthropicConfigured()) {
    throw new AnthropicNotConfiguredError();
  }

  const client = new Anthropic({ apiKey: config.anthropic.apiKey });
  const model = input.highEffort
    ? config.anthropic.highEffortModel
    : config.anthropic.model;

  const attachmentBlocks = await filesToContentBlocks(input.files ?? []);

  const userContent: Anthropic.ContentBlockParam[] = [
    { type: "text", text: USER_INSTRUCTION },
    {
      type: "text",
      text: `--- PASTED EMAIL TEXT ---\n${input.emailText || "(none provided)"}`,
    },
    ...attachmentBlocks,
  ];

  const tool: Anthropic.Tool = {
    name: "record_rfi",
    description:
      "Record the structured RFI extraction. Call exactly once with all fields you can determine.",
    input_schema: parsedProjectJsonSchema() as Anthropic.Tool.InputSchema,
  };

  const response = await client.messages.create({
    model,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    tools: [tool],
    tool_choice: { type: "tool", name: "record_rfi" },
    messages: [{ role: "user", content: userContent }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("Claude did not return a structured record_rfi result.");
  }

  const parsed = ParsedProjectSchema.parse(toolUse.input);
  return { proposal: parsed, model };
}
