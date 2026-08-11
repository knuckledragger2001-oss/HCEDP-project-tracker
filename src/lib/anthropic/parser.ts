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
- leadSource: classify the original sender. The Texas Governor's Office / EDT / "gov.texas.gov" => TEXAS_GOVERNORS_OFFICE. Opportunity Austin => OPPORTUNITY_AUSTIN. Sent directly by the company itself => DIRECT_COMPANY. A regional economic-development partner => DIRECT_REGIONAL_PARTNERS. A site-selection consultant => DIRECT_SITE_SELECTOR. A commercial real-estate broker => DIRECT_BROKER. Originating from an HCEDP marketing trip / mission => DIRECT_MARKETING_TRIP. Any other direct or unclear origin => DIRECT_OTHER (put detail in leadSourceOther). The HCEDP staffer who forwarded it internally is NOT the lead source; the external originator is.
- sourceContactName / sourceContactEmail: the originating contact to respond to.
- submissionDestination: where the response is to be submitted.
- companyLocationRaw: the company's current/home location if stated (e.g. "Chicago, IL", "Illinois", or just "Germany" for a foreign company). Copy it as written — do not guess. Leave null if the RFI keeps the company anonymous or gives no location.
- Capital investment: capture total/land/building/equipment as plain numbers in USD (e.g. 1600000000, not "$1.6B").
- avgWage: a single USD number.
- jobs: the single HIGHEST total job count the prospect quotes — peak headcount at full build-out. If the figure is phased (e.g. 75 in Year One, 200 by years 3-5), take the largest number (200). Plain integer. Leave null if no job figure is given.
- minAcreage: minimum site acreage as a plain number.
- maxAcreage: maximum site acreage, only if the RFI states a range or an upper bound (e.g. "100-250 acres" => minAcreage 100, maxAcreage 250). Null if only a single/minimum figure is given.
- minBuildingSqFt: minimum building square footage required, as a plain number (e.g. 250000 for 250,000 sq ft). Extract from any statement of building size, floor space, or facility size. Leave null if not stated.
- maxBuildingSqFt: maximum building square footage, only if the RFI states a range or an upper bound. Null if only a single/minimum figure is given.
- siteLocationPreferences: array of the stated preferences (e.g. ["Industrial Park", "Freestanding Site", "Incubator Site"]).
- existingBuildingPreference: whether the company wants an existing building — YES if an existing building is required/wanted, NO if they want land/greenfield only or explicitly not an existing building, PREFERRED if an existing building is preferred but not required. Null if not stated.
- railPreference: whether rail service is required — YES / NO / PREFERRED using the same convention. Null if not stated.
- criticalCriteria: the must-have needs the RFI lists "in order of importance". Preserve that order using rank 1, 2, 3, ... These drive site selection.
- requiredDeliverables: what the response must include (e.g. "Site Summary Spreadsheet", "RFI Response combined into one PDF").
- qualitativeNotes: capture soft/qualitative needs that do not fit a structured field (e.g. "supportive educational ecosystem"), each as { label, content }.
- Dates: output ISO 8601 (YYYY-MM-DD). Map the email's sent/received date to rfiReceivedDate, the submission deadline to responseDueDate, the projected decision date and start-of-production date to their fields. Leave responseSubmittedDate and siteVisitDate null unless explicitly stated (these are usually filled in later by HCEDP).

UTILITIES (capture verbatim — do NOT convert or normalize)
Record each utility requirement as free text, exactly as stated in the RFI, including units, time-phasing, and any ramp-up as written. Do not convert units, do not compute daily-from-monthly, do not pick a single "peak" number. Just capture what the RFI says so staff read the original figures.
- electricityNeeds: the electrical demand as written (e.g. "50 MW day-one, ramping to 300 MW by 2030; redundant feeds required").
- waterNeeds: the water demand as written (e.g. "2 million gallons/day").
- wastewaterNeeds: the wastewater/sewer needs as written.
- gasNeeds: the natural-gas needs as written, plus any stated alternatives (diesel, battery storage).
Leave a field null if that utility isn't mentioned.

PARSE WARNINGS
Populate parseWarnings with one entry per value you had to assume or infer, so a human can verify it. Use kind "assumption" for inferred values and "missing" for important fields you could not find. Each entry: { field, message, kind }.`;

const USER_INSTRUCTION = `Extract the structured RFI record from the pasted email text and any attachments below. Capture utility figures verbatim (no unit conversion), take the single highest job number, and record any assumptions in parseWarnings.`;

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
