import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { globalRateLimit } from "./middleware/rate-limiter";
import { db, errorEventsTable } from "@workspace/db";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(globalRateLimit());
app.use("/api", router);

// ── Global error handler (Feature #6: Error Tracking) ─────────────────────────
// Must be registered AFTER routes (4-arg signature = Express error handler).
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
  const message = err.message ?? "Internal Server Error";

  logger.error(
    { err, method: req.method, path: req.path, statusCode },
    "Unhandled server error",
  );

  // Persist to error_events table (fire-and-forget)
  const userId = (req as { user?: { userId: string } }).user?.userId ?? null;
  db.insert(errorEventsTable)
    .values({
      userId,
      type: "server",
      message: message.slice(0, 2000),
      stack: err.stack?.slice(0, 5000),
      path: req.path.slice(0, 500),
      method: req.method,
      statusCode,
      metadata: {
        query: req.query,
        userAgent: req.headers["user-agent"],
      },
    })
    .catch(() => {}); // never throw inside error handler

  if (res.headersSent) return;
  res.status(statusCode).json({ error: message });
});

export default app;
