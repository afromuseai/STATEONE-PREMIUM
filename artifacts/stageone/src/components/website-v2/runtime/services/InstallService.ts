/**
 * InstallService — No-op replacement for npm install in WebContainer.
 *
 * The api-server preview generator does not need dependencies installed.
 * It generates a self-contained HTML preview from project source files.
 */

export class InstallService {
  async execute(): Promise<boolean> {
    // No-op: preview generator works from source files directly.
    return true
  }
}