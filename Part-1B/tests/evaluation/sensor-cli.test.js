import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const projectRoot = resolve(".");
const sensorPath = resolve(".harness/sensor.js");

const validOutput = {
  amount: 20,
  currency: "INR",
  category: "FOOD",
  transaction_type: "DEBIT",
  merchant_or_person: "Tea shop",
  description: "Paid at tea shop",
  confidence: 0.9,
  requires_clarification: false,
  clarification_question: null,
};

function runSensor(args) {
  return spawnSync(process.execPath, [sensorPath, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
  });
}

test("standalone sensor evaluates an output against a dataset case", () => {
  const directory = mkdtempSync(join(tmpdir(), "sensor-test-"));

  try {
    const inputPath = join(directory, "output.json");
    writeFileSync(inputPath, JSON.stringify(validOutput));

    const result = runSensor([
      "--case",
      "EC-001",
      "--input",
      inputPath,
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Structural\s+PASS/);
    assert.match(result.stdout, /Behavioral\s+PASS/);
    assert.match(result.stdout, /Semantic\s+PASS/);
    assert.match(result.stdout, /OVERALL\s+PASS/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("standalone sensor evaluates an output against custom expectations", () => {
  const directory = mkdtempSync(join(tmpdir(), "sensor-test-"));

  try {
    const inputPath = join(directory, "output.json");
    const expectedPath = join(directory, "expected.json");

    writeFileSync(inputPath, JSON.stringify(validOutput));
    writeFileSync(
      expectedPath,
      JSON.stringify({
        type: "result",
        fields: {
          amount: 20,
          currency: "INR",
          category: "FOOD",
          transaction_type: "DEBIT",
          merchant_or_person: "Tea shop",
          requires_clarification: false,
        },
        description_keywords: ["paid", "tea"],
        question_keywords: [],
      }),
    );

    const result = runSensor([
      "--statement",
      "Paid 20rs at tea shop",
      "--input",
      inputPath,
      "--expected",
      expectedPath,
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Case: CUSTOM/);
    assert.match(result.stdout, /OVERALL\s+PASS/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("standalone sensor returns a failure exit code for an invalid output", () => {
  const directory = mkdtempSync(join(tmpdir(), "sensor-test-"));

  try {
    const inputPath = join(directory, "output.json");
    writeFileSync(inputPath, JSON.stringify({ amount: -20 }));

    const result = runSensor([
      "--case",
      "EC-001",
      "--input",
      inputPath,
    ]);

    assert.equal(result.status, 1);
    assert.match(result.stdout, /OVERALL\s+FAIL/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("standalone sensor rejects missing arguments", () => {
  const result = runSensor([]);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /--input argument is required/);
});
