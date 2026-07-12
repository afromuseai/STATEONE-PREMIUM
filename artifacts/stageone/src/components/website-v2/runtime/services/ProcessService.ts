/**
 * ProcessService — No-op replacement for WebContainer process spawning.
 *
 * Process execution is handled server-side by the api-server.
 * This service exists to preserve the interface contract.
 */

export class ProcessService {
  async run(
    _container: any,
    _command: string,
    _args: string[] = []
  ) {
    return {
      output: "",
      exitCode: 0,
    }
  }
}