import { randomUUID } from 'node:crypto';

export function requestContext(request, response, next) {
  const requestId = randomUUID();
  request.id = requestId;
  response.setHeader('X-Request-Id', requestId);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Frame-Options', 'DENY');
  next();
}
