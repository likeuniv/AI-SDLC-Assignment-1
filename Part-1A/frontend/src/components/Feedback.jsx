export function ErrorMessage({ error, children }) {
  const message = error?.message ?? children;
  if (!message) {
    return null;
  }
  return <p className="feedback error" role="alert">{message}</p>;
}

export function StatusMessage({ children, role = 'status' }) {
  if (!children) {
    return null;
  }
  return <p className="feedback success" role={role}>{children}</p>;
}

export function FieldErrors({ error, field }) {
  const messages = error?.details
    ?.filter((detail) => detail?.field === field)
    .map((detail) => detail.issue ?? detail.message)
    .filter((message) => typeof message === 'string');
  if (!messages?.length) {
    return null;
  }
  return <span className="field-error">{messages.join(' ')}</span>;
}

export function Loading({ label = 'Loading…' }) {
  return <p role="status" aria-live="polite">{label}</p>;
}
