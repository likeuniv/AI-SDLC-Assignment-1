import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("importing the server module does not start a listener", () => {
  const serverUrl = new URL("../../src/server.js", import.meta.url).href;
  const source = `
    await import(${JSON.stringify(serverUrl)});
    process.stdout.write("server-module-imported");
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], {
    encoding: "utf8",
    timeout: 2_000,
  });

  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "server-module-imported");
});

test("startServer starts only when explicitly called", async () => {
  const { startServer } = await import("../../src/server.js");
  const logEntries = [];
  const server = startServer({
    port: 0,
    logger: { info: (entry) => logEntries.push(JSON.parse(entry)) },
  });

  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  try {
    assert.equal(server.listening, true);
    assert.equal(logEntries.length, 1);
    assert.equal(logEntries[0].event, "server_started");
    assert.equal(typeof logEntries[0].port, "number");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("synchronous and asynchronous server_started logger failures do not prevent listening or terminate the process", async (t) => {
  const serverUrl = new URL("../../src/server.js", import.meta.url).href;

  for (const failureMode of ["synchronous", "asynchronous"]) {
    await t.test(`${failureMode} failure`, () => {
      const loggerImplementation =
        failureMode === "synchronous"
          ? 'info() { throw new Error("synthetic startup logger failure"); }'
          : 'async info() { throw new Error("synthetic startup logger rejection"); }';
      const source = `
        import { startServer } from ${JSON.stringify(serverUrl)};
        process.on("unhandledRejection", () => {
          process.stderr.write("UNHANDLED_REJECTION");
          process.exitCode = 1;
        });
        const server = startServer({
          port: 0,
          logger: { ${loggerImplementation} }
        });
        server.once("listening", () => {
          process.stdout.write("LISTENING");
          setTimeout(() => server.close(), 25);
        });
        server.once("error", () => {
          process.stderr.write("SERVER_ERROR");
          process.exitCode = 1;
        });
      `;
      const result = spawnSync(
        process.execPath,
        ["--input-type=module", "-e", source],
        {
          encoding: "utf8",
          timeout: 3_000,
        },
      );

      assert.equal(result.error, undefined);
      assert.equal(result.status, 0);
      assert.equal(result.stdout, "LISTENING");
      assert.equal(result.stderr, "");
    });
  }
});
