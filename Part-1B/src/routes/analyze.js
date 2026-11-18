import { createOpenAIAdapter } from "../ai/openai-adapter.js";
import { createExtractionService } from "../services/extraction-service.js";
import { createSafeError } from "../errors/safe-errors.js";

const recognizedProviderCodes = new Set([
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_TIMEOUT",
  "INVALID_MODEL_RESPONSE",
]);

export function registerAnalyzeRoute(
  app,
  { provider, extractionService } = {},
) {
  const service =
    extractionService ??
    createExtractionService({
      provider: provider ?? createOpenAIAdapter(),
    });

  app.post("/api/analyze", async (req, res, next) => {
    const body = req.body;
    if (
      body === null ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !Object.hasOwn(body, "statement") ||
      typeof body.statement !== "string" ||
      body.statement.trim() === ""
    ) {
      return next(createSafeError("INVALID_REQUEST"));
    }

    try {
      const result = await service.extract(body.statement);
      return res.status(200).json(result);
    } catch (error) {
      if (recognizedProviderCodes.has(error?.code)) {
        return next(createSafeError(error.code));
      }
      return next(error);
    }
  });
}
