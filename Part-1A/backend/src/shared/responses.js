export function sendSuccess(response, status, message, data) {
  if (status === 204) {
    return response.status(204).end();
  }

  return response.status(status).json({
    success: true,
    message,
    data,
  });
}

export function sendError(response, status, code, message, details = []) {
  return response.status(status).json({
    success: false,
    message,
    error: {
      code,
      details,
    },
  });
}
