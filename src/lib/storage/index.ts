import { config } from "@/lib/config";
import type { StorageDriver } from "./types";
import { LocalStorageDriver } from "./local";

export type { StorageDriver, StoredObject } from "./types";

let driver: StorageDriver | null = null;

// Returns the configured storage driver. To add S3 / Vercel Blob later,
// implement StorageDriver and branch on config.storage.driver here — no
// feature code needs to change.
export function getStorage(): StorageDriver {
  if (driver) return driver;

  switch (config.storage.driver) {
    case "local":
      driver = new LocalStorageDriver(config.storage.localDir);
      break;
    // case "s3":   driver = new S3StorageDriver(...); break;
    // case "blob": driver = new BlobStorageDriver(...); break;
    default:
      throw new Error(`Unknown STORAGE_DRIVER: ${config.storage.driver}`);
  }
  return driver;
}
