import Anthropic from "@anthropic-ai/sdk";
import { config } from "@/lib/config";

// ---------------------------------------------------------------------------
// "Always the newest Sonnet" — resolved from Anthropic's Models API.
// ---------------------------------------------------------------------------
// Anthropic publishes no permanent "latest Sonnet" alias, so instead we ask the
// Models API which Sonnet is newest and cache the answer. A new release is then
// picked up within CACHE_TTL_MS with no code change or redeploy.
//
// Safety rails, because a model can change under us without anyone reviewing it:
//   • Setting ANTHROPIC_MODEL / ANTHROPIC_MODEL_HIGH_EFFORT in the environment
//     pins that exact model and skips discovery entirely (the escape hatch if a
//     new Sonnet ever misbehaves).
//   • Only models that report support for everything the RFI parser sends
//     (structured outputs, PDF and image input) are considered.
//   • If discovery fails we keep the last answer, else FALLBACK_SONNET.
//   • parseRfi retries once on FALLBACK_SONNET if a freshly discovered model
//     rejects the request (see parser.ts).

export const FALLBACK_SONNET = "claude-sonnet-5-5";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // re-check for new releases every 6h
const FAILURE_RETRY_MS = 5 * 60 * 1000; // don't hammer the API if lookup fails

// "claude-sonnet-5-5", "claude-sonnet-5-5-20261001" — the current naming. Older
// generations ("claude-3-7-sonnet-…") don't match and are intentionally ignored.
const SONNET_ID = /^claude-sonnet-\d+(?:-\d+)*$/;

type Capability = { supported: boolean } | null | undefined;

export interface ModelCandidate {
  id: string;
  created_at: string;
  capabilities?: {
    structured_outputs?: Capability;
    pdf_input?: Capability;
    image_input?: Capability;
  } | null;
}

// A missing capability block means "unknown", which we allow; only an explicit
// `supported: false` rules a model out.
function lacks(cap: Capability): boolean {
  return cap?.supported === false;
}

/**
 * The newest usable Sonnet in `models`, or null if none qualify. Pure so it can
 * be reasoned about (and tested) without the network.
 */
export function pickLatestSonnet(models: ModelCandidate[]): string | null {
  const usable = models.filter(
    (m) =>
      SONNET_ID.test(m.id) &&
      !lacks(m.capabilities?.structured_outputs) &&
      !lacks(m.capabilities?.pdf_input) &&
      !lacks(m.capabilities?.image_input),
  );
  usable.sort((a, b) => {
    const byDate = Date.parse(b.created_at) - Date.parse(a.created_at);
    if (byDate !== 0 && !Number.isNaN(byDate)) return byDate;
    // Same release date (e.g. alias + dated snapshot): prefer the plain alias.
    return a.id.length - b.id.length;
  });
  return usable[0]?.id ?? null;
}

let cached: { id: string; checkedAt: number } | null = null;
let lastFailureAt = 0;
let inFlight: Promise<string> | null = null;

async function discoverLatestSonnet(client: Anthropic): Promise<string> {
  const found: ModelCandidate[] = [];
  for await (const model of client.models.list({ limit: 1000 })) {
    found.push(model);
  }
  const latest = pickLatestSonnet(found);
  if (!latest) throw new Error("Models API returned no usable Sonnet model.");
  return latest;
}

/** Newest Sonnet available to this API key (cached; never throws). */
export async function latestSonnet(client: Anthropic): Promise<string> {
  const now = Date.now();
  if (cached && now - cached.checkedAt < CACHE_TTL_MS) return cached.id;
  // After a failed lookup, keep serving what we have for a few minutes.
  if (now - lastFailureAt < FAILURE_RETRY_MS) return cached?.id ?? FALLBACK_SONNET;

  inFlight ??= discoverLatestSonnet(client)
    .then((id) => {
      if (cached?.id !== id) {
        console.info(
          `[anthropic] RFI parsing model: ${id}${cached ? ` (was ${cached.id})` : ""}`,
        );
      }
      cached = { id, checkedAt: Date.now() };
      return id;
    })
    .catch((err: unknown) => {
      lastFailureAt = Date.now();
      console.warn(
        `[anthropic] Could not look up the latest Sonnet; using ${cached?.id ?? FALLBACK_SONNET}.`,
        err instanceof Error ? err.message : err,
      );
      return cached?.id ?? FALLBACK_SONNET;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/**
 * Stop using a discovered model that rejected a request (and that the fallback
 * then handled). It is rediscovered, and given one more chance, at the next
 * cache expiry — by which time the app or the model may have been updated.
 */
export function demoteModel(id: string): void {
  if (cached?.id === id) cached = { id: FALLBACK_SONNET, checkedAt: Date.now() };
}

export interface ResolvedModel {
  model: string;
  /** True when pinned through the environment (no discovery, no auto-retry). */
  pinned: boolean;
}

/** Which model to parse an RFI with: an env-var pin if set, else newest Sonnet. */
export async function resolveParserModel(
  client: Anthropic,
  highEffort: boolean,
): Promise<ResolvedModel> {
  const pin = highEffort
    ? config.anthropic.highEffortModelOverride
    : config.anthropic.modelOverride;
  if (pin) return { model: pin, pinned: true };
  return { model: await latestSonnet(client), pinned: false };
}
