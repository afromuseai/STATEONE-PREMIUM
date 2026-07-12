/**
 * BootService — No-op replacement for WebContainer boot.
 *
 * In the new architecture, there is no in-browser container to boot.
 * The api-server handles all preview generation server-side.
 * This service exists to preserve the RuntimeEngine lifecycle contract.
 */

export interface MockContainer {
  fs: {
    writeFile: (path: string, content: string) => Promise<void>
    readFile: (path: string, encoding?: string) => Promise<string>
    readdir: (path: string) => Promise<string[]>
    rm: (path: string) => Promise<void>
  }
  on: (event: string, handler: (...args: any[]) => void) => void
  spawn: (cmd: string, args: string[]) => Promise<{ output: { pipeTo: (writable: any) => void }; exit: Promise<number> }>
}

export class BootService {
  async execute(): Promise<MockContainer> {
    // No-op: no WebContainer to boot. Return a mock container that
    // satisfies the interface expected by downstream services.
    return createMockContainer()
  }
}

function createMockContainer(): MockContainer {
  const files = new Map<string, string>()

  return {
    fs: {
      async writeFile(path: string, content: string) {
        files.set(path, content)
      },
      async readFile(path: string, _encoding?: string) {
        return files.get(path) ?? ""
      },
      async readdir(_path: string) {
        return Array.from(files.keys())
      },
      async rm(_path: string) {
        files.clear()
      },
    },
    on(_event: string, _handler: (...args: any[]) => void) {
      // No-op event listener
    },
    async spawn(_cmd: string, _args: string[]) {
      return {
        output: {
          pipeTo(_writable: any) {
            // No-op
          },
        },
        exit: Promise.resolve(0),
      }
    },
  }
}