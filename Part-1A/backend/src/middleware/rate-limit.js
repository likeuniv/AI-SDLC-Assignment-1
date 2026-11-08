import { rateLimitExceeded } from '../shared/errors.js';

export function createRateLimit({ maxRequests, windowMs, now = () => Date.now() }) {
  const requestsByClient = new Map();

  return (request, response, next) => {
    const currentTime = Number(now());
    const clientKey = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    for (const [key, state] of requestsByClient) {
      if (state.resetAt <= currentTime) {
        requestsByClient.delete(key);
      }
    }

    const state = requestsByClient.get(clientKey);
    if (!state || state.resetAt <= currentTime) {
      requestsByClient.set(clientKey, { count: 1, resetAt: currentTime + windowMs });
      next();
      return;
    }

    if (state.count >= maxRequests) {
      response.setHeader('Retry-After', String(Math.max(1, Math.ceil((state.resetAt - currentTime) / 1000))));
      next(rateLimitExceeded());
      return;
    }
    state.count += 1;
    next();
  };
}
