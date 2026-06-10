import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { StorageDriver, StoredObject } from "./types";

// Local-disk implementation. Keys are relative paths under the configured root
// (e.g. "2026/06/<uuid>-site-summary.xlsx"), kept opaque to callers.
export class LocalStorageDriver implements StorageDriver {
  constructor(private readonly rootDir: string) {}

  private resolve(key: string): string {
    const full = path.resolve(this.rootDir, key);
    const root = path.resolve(this.rootDir);
    // Guard against path traversal escaping the storage root.
    if (full !== root && !full.startsWith(root + path.sep)) {
      throw new Error("Invalid storage key");
    }
    return full;
  }

  async put(
    data: Buffer,
    opts: { fileName: string; contentType: string },
  ): Promise<StoredObject> {
    const now = new Date();
    const safeName = opts.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const key = path.posix.join(
      String(now.getUTCFullYear()),
      String(now.getUTCMonth() + 1).padStart(2, "0"),
      `${randomUUID()}-${safeName}`,
    );
    const dest = this.resolve(key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, data);
    return { key, size: data.length, contentType: opts.contentType };
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolve(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
}
