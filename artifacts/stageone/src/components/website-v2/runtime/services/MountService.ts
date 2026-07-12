/**
 * MountService — No-op replacement for WebContainer mount.
 *
 * Files are already persisted in the database. The api-server reads them
 * directly when generating previews. No in-browser filesystem mount needed.
 */

export class MountService {
  async execute(): Promise<boolean> {
    // No-op: files are already in the database.
    return true
  }
}