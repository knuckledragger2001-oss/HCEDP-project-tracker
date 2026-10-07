// Central runtime config. Read secrets/model names from env only.

export const config = {
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    // Optional pins. Left unset (the normal case), RFI parsing uses whatever the
    // newest Sonnet is, discovered automatically — see lib/anthropic/models.ts.
    // Set either variable to force one exact model ID instead, e.g. to hold back
    // a release that misbehaves or to give difficult documents a stronger model.
    modelOverride: process.env.ANTHROPIC_MODEL?.trim() || null,
    highEffortModelOverride:
      process.env.ANTHROPIC_MODEL_HIGH_EFFORT?.trim() || null,
  },
  storage: {
    driver: process.env.STORAGE_DRIVER ?? "local",
    localDir: process.env.STORAGE_LOCAL_DIR ?? "./storage-uploads",
  },
} as const;

export function isAnthropicConfigured(): boolean {
  return config.anthropic.apiKey.trim().length > 0;
}
