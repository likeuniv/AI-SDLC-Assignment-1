import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import http from "node:http";
import test from "node:test";

function createRecordingLogger() {
  const entries = [];
  return {
    entries,
    info(entry) {
      entries.push(entry);
    },
  };
}

async function withServer(app, run) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  try {
    await run(server.address().port);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function sendRequest(port, { method = "POST", path = "/", headers, body = "" }) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      { host: "127.0.0.1", port, method, path, headers },
      (response) => {
        let responseBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          responseBody += chunk;
        });
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body: responseBody,
          }),
        );
      },
    );

    request.once("error", reject);
    request.end(body);
  });
}

function parseJson(response) {
  return JSON.parse(response.body);
}

test("createApp returns an Express app without starting a listener", async () => {
  const { createApp } = await import("../../src/app.js");
  const app = createApp({ logger: createRecordingLogger() });

  assert.equal(typeof app, "function");
  assert.equal(typeof app.listen, "function");
  assert.equal(app.server, undefined);
});

test("application/json requests are parsed while non-JSON bodies are not parsed", async () => {
  const { createApp } = await import("../../src/app.js");
  const app = createApp({ logger: createRecordingLogger() });

  app.post("/_test/json", (req, res) => {
    res.json({
      bodyIsObject: req.body !== null && typeof req.body === "object",
      keys: Object.keys(req.body ?? {}),
    });
  });

  await withServer(app, async (port) => {
    const jsonResponse = await sendRequest(port, {
      path: "/_test/json",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ statement: "synthetic statement" }),
    });
    assert.equal(jsonResponse.status, 200);
    assert.deepEqual(parseJson(jsonResponse), {
      bodyIsObject: true,
      keys: ["statement"],
    });

    const textResponse = await sendRequest(port, {
      path: "/_test/json",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ statement: "synthetic statement" }),
    });
    assert.equal(textResponse.status, 200);
    assert.deepEqual(parseJson(textResponse), {
      bodyIsObject: false,
      keys: [],
    });
  });
});

test("malformed JSON receives a safe INVALID_REQUEST error without echoing content", async () => {
  const { createApp } = await import("../../src/app.js");
  const logger = createRecordingLogger();
  const app = createApp({ logger });
  const marker = "SYNTHETIC-PRIVATE-MARKER";

  await withServer(app, async (port) => {
    const response = await sendRequest(port, {
      headers: { "content-type": "application/json" },
      body: `{"statement":"${marker}"`,
    });

    assert.equal(response.status, 400);
    const payload = parseJson(response);
    assert.deepEqual(Object.keys(payload), ["error"]);
    assert.deepEqual(Object.keys(payload.error).sort(), ["code", "message"]);
    assert.equal(payload.error.code, "INVALID_REQUEST");
    assert.ok(payload.error.message.length > 0);
    assert.equal(response.body.includes(marker), false);
  });
});

test("requests larger than 16 KB receive a safe REQUEST_TOO_LARGE error", async () => {
  const { createApp } = await import("../../src/app.js");
  const app = createApp({ logger: createRecordingLogger() });
  const marker = "SYNTHETIC-OVERSIZED-MARKER";
  const body = JSON.stringify({ statement: `${marker}${"x".repeat(17_000)}` });

  await withServer(app, async (port) => {
    const response = await sendRequest(port, {
      headers: { "content-type": "application/json" },
      body,
    });

    assert.equal(response.status, 413);
    const payload = parseJson(response);
    assert.equal(payload.error.code, "REQUEST_TOO_LARGE");
    assert.ok(payload.error.message.length > 0);
    assert.equal(response.body.includes(marker), false);
  });
});

test("operational request logs contain only allowlisted metadata", async () => {
  const { createApp } = await import("../../src/app.js");
  const logger = createRecordingLogger();
  const app = createApp({ logger });
  const marker = "SYNTHETIC-LOG-EXCLUSION-MARKER";

  await withServer(app, async (port) => {
    await sendRequest(port, {
      headers: { "content-type": "application/json" },
      body: `{"statement":"${marker}"`,
    });
  });

  assert.equal(logger.entries.length, 1);
  const entry = JSON.parse(logger.entries[0]);
  assert.deepEqual(
    Object.keys(entry).sort(),
    ["duration_ms", "error_code", "event", "method", "status"].sort(),
  );
  assert.equal(entry.event, "http_request");
  assert.equal(entry.method, "POST");
  assert.equal(entry.status, 400);
  assert.equal(entry.error_code, "INVALID_REQUEST");
  assert.equal(logger.entries.join("\n").includes(marker), false);
});

test("logger failures do not break request handling or terminate the process", () => {
  const appUrl = new URL("../../src/app.js", import.meta.url).href;
  const source = `
    import http from "node:http";
    import { createApp } from ${JSON.stringify(appUrl)};
    const app = createApp({ logger: { info() { throw new Error("synthetic logger failure"); } } });
    app.get("/_test/health", (_req, res) => res.status(204).end());
    const server = app.listen(0, "127.0.0.1", () => {
      http.get({ host: "127.0.0.1", port: server.address().port, path: "/_test/health" }, (res) => {
        res.resume();
        res.on("end", () => {
          process.stdout.write(String(res.statusCode));
          server.close();
        });
      });
    });
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], {
    encoding: "utf8",
    timeout: 3_000,
  });

  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "204");
});

test("asynchronous request logger rejection does not affect the response or terminate the process", () => {
  const appUrl = new URL("../../src/app.js", import.meta.url).href;
  const source = `
    import http from "node:http";
    import { createApp } from ${JSON.stringify(appUrl)};
    process.on("unhandledRejection", () => {
      process.stderr.write("UNHANDLED_REJECTION");
      process.exitCode = 1;
    });
    const app = createApp({ logger: { info: async () => { throw new Error("synthetic async logger failure"); } } });
    app.get("/_test/health", (_req, res) => res.status(204).end());
    const server = app.listen(0, "127.0.0.1", () => {
      http.get({ host: "127.0.0.1", port: server.address().port, path: "/_test/health" }, (res) => {
        res.resume();
        res.on("end", () => {
          process.stdout.write(String(res.statusCode));
          setTimeout(() => server.close(), 25);
        });
      });
    });
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], {
    encoding: "utf8",
    timeout: 3_000,
  });

  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "204");
  assert.equal(result.stderr, "");
});
