// Storage abstraction. Feature code depends only on these types, never on a
// concrete driver, so an S3 / Vercel Blob driver can be swapped in later.

export interface StoredObject {
  // Opaque key used to retrieve the object later. Persisted on Attachment.
  key: string;
  size: number;
  contentType: string;
}

export interface StorageDriver {
  /** Persist bytes and return an opaque key + metadata. */
  put(
    data: Buffer,
    opts: { fileName: string; contentType: string },
  ): Promise<StoredObject>;

  /** Read bytes back for a previously stored key. */
  get(key: string): Promise<Buffer>;

  /** Remove an object. No-op if it does not exist. */
  delete(key: string): Promise<void>;
}
