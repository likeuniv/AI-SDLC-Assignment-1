import { HttpError } from '../shared/errors.js';
import { sendError } from '../shared/responses.js';

function normalizeError(error) {
  if (error instanceof HttpError) {
    return error;
  }
  if (error?.type === 'entity.parse.failed' || error instanceof SyntaxError) {
    return new HttpError(400, 'INVALID_REQUEST', 'The request body is malformed.');
  }
  if (error?.code === 'SQLITE_BUSY' || error?.code === 'SQLITE_LOCKED') {
    return new HttpError(503, 'SERVICE_UNAVAILABLE', 'The service is temporarily unavailable.');
  }
  return new HttpError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again later.');
}

export function createErrorHandler(logger = console) {
  return (error, request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    const safeError = normalizeError(error);
    if (safeError.status >= 500) {
      logger.error({
        event: 'request_failed',
        requestId: request.id ?? 'unavailable',
        status: safeError.status,
        code: safeError.code,
        method: request.method,
        path: request.path,
      });
    }

    sendError(
      response,
      safeError.status,
      safeError.code,
      safeError.message,
      safeError.details,
    );
  };
}
