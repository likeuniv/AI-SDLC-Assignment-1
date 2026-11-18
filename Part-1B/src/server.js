import { pathToFileURL } from "node:url";
import { createApp, logSafely } from "./app.js";

export function startServer({
  port = Number(process.env.PORT ?? 3000),
  logger = console,
} = {}) {
  const app = createApp({ logger });
  const server = app.listen(port, () => {
    logSafely(logger, { event: "server_started", port });
  });

  return server;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  startServer();
}
