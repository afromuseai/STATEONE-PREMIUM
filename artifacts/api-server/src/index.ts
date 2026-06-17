import app from "./app";
import { logger } from "./lib/logger";
import { worker } from "./lib/worker";
import "./lib/job-handlers"; // register all built-in handlers at startup

const rawPort = process.env["API_PORT"] ?? process.env["PORT"] ?? "8080";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid port value: "${rawPort}"`);
}

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  worker.start();
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal: string) {
  logger.info({ signal }, "Shutdown signal received");
  worker.stop();
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
  // Force-exit if server takes too long to drain
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
