// Central runtime config. Read secrets/model names from env only.

export const config = {
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    // Anthropic has no "always the newest Sonnet" alias — each release gets a
    // new model ID. To move to a newer model, set ANTHROPIC_MODEL in the host
    // environment (no deploy of code needed); these are only the fallbacks.
    // Check that a new generation still supports structured outputs
    // (output_config.format) before switching — see src/lib/anthropic/parser.ts.
    model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
    // Optional separate model for difficult documents (the "high effort" box on
    // intake). Defaults to the same Sonnet; point it at a stronger model via
    // ANTHROPIC_MODEL_HIGH_EFFORT if that ever proves worthwhile.
    highEffortModel:
      process.env.ANTHROPIC_MODEL_HIGH_EFFORT ?? "claude-sonnet-5-5",
  },
  storage: {
    driver: process.env.STORAGE_DRIVER ?? "local",
    localDir: process.env.STORAGE_LOCAL_DIR ?? "./storage-uploads",
  },
} as const;

export function isAnthropicConfigured(): boolean {
  return config.anthropic.apiKey.trim().length > 0;
}
