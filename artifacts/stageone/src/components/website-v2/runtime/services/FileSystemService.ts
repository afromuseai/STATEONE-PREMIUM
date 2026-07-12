/**
 * FileSystemService — No-op replacement for WebContainer file system operations.
 *
 * File operations are handled by the api-server and database.
 * This service exists to preserve the interface contract.
 */

export class FileSystemService {
  async write(
    _container: any,
    _path: string,
    _content: string
  ) {
    return true
  }

  async read(
    _container: any,
    _path: string
  ) {
    return ""
  }

  async delete(
    _container: any,
    _path: string
  ) {
    return true
  }

  async list(
    _container: any,
    _path: string = "/"
  ) {
    return []
  }
}