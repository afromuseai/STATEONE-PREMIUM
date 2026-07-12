/**
 * WebContainerManager — No-op replacement.
 *
 * WebContainer is no longer used. This module exists to prevent import
 * errors in any remaining references during the migration.
 */

export class WebContainerManager {
  static async boot(): Promise<null> {
    return null
  }

  static getInstance(): null {
    return null
  }

  static async dispose() {
    // No-op
  }
}