// Central runtime config. Read secrets/model names from env only.

export const config = {
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    // Single config value for the routine parsing model — easy to change.
    model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
    // Optional more-capable model for difficult documents.
    highEffortModel:
      process.env.ANTHROPIC_MODEL_HIGH_EFFORT ?? "claude-opus-4-8",
  },
  storage: {
    driver: process.env.STORAGE_DRIVER ?? "local",
    localDir: process.env.STORAGE_LOCAL_DIR ?? "./storage-uploads",
  },
} as const;

export function isAnthropicConfigured(): boolean {
  return config.anthropic.apiKey.trim().length > 0;
}
