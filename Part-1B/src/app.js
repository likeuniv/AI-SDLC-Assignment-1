import express from "express";
import { registerAnalyzeRoute } from "./routes/analyze.js";
import { toSafeHttpError } from "./errors/safe-errors.js";

const JSON_BODY_LIMIT = "16kb";

const safeErrors = {
  invalidRequest: {
    code: "INVALID_REQUEST",
    message: "Request body must be valid JSON.",
  },
  requestTooLarge: {
    code: "REQUEST_TOO_LARGE",
    message: "Request body exceeds the allowed size.",
  },
  internalError: {
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred.",
  },
};

const requestParsingErrorTypes = new Set([
  "entity.parse.failed",
  "entity.verify.failed",
  "encoding.unsupported",
  "charset.unsupported",
  "request.aborted",
  "request.size.invalid",
]);

function isBodyTooLarge(error) {
  return error?.type === "entity.too.large";
}

function sendSafeError(res, status, error) {
  res.locals.safeErrorCode = error.code;
  return res.status(status).json({
    error: {
      code: error.code,
      message: error.message,
    },
  });
}

export function logSafely(logger, entry) {
  try {
    const result = logger.info(JSON.stringify(entry));
    if (result && typeof result.then === "function") {
      void Promise.resolve(result).catch(() => {});
    }
  } catch {
    // Logging failures must not affect request handling.
  }
}

export function createApp({
  logger = console,
  provider,
  extractionService,
} = {}) {
  const app = express();

  app.use((req, res, next) => {
    const startedAt = process.hrtime.bigint();

    res.once("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const logEntry = {
        event: "http_request",
        method: req.method,
        status: res.statusCode,
        duration_ms: Math.round(durationMs),
      };

      if (res.locals.safeErrorCode) {
        logEntry.error_code = res.locals.safeErrorCode;
      }

      logSafely(logger, logEntry);
    });

    next();
  });

  app.use(express.json({ limit: JSON_BODY_LIMIT, strict: true }));

  registerAnalyzeRoute(app, { provider, extractionService });

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    if (isBodyTooLarge(error)) {
      return sendSafeError(res, 413, safeErrors.requestTooLarge);
    }

    if (requestParsingErrorTypes.has(error?.type)) {
      return sendSafeError(res, 400, safeErrors.invalidRequest);
    }

    const safeError = toSafeHttpError(error);
    return sendSafeError(res, safeError.status, safeError);
  });

  return app;
}
