import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const canonicalSchemaPath = path.join(
  projectRoot,
  "specs/001-ai-spend-analyzer/contracts/output-schema.json",
);
const openApiPath = path.join(
  projectRoot,
  "specs/001-ai-spend-analyzer/contracts/http-api.yaml",
);
const outputSchema = JSON.parse(readFileSync(canonicalSchemaPath, "utf8"));
const openApiLines = readFileSync(openApiPath, "utf8").split(/\r?\n/);
const activeCurrencyCodes = new Set(Intl.supportedValuesOf("currency"));

const ajv = new Ajv2020({ allErrors: true, strict: false });
ajv.addFormat("iso-4217-currency", {
  type: "string",
  validate: (currency) =>
    currency === "XXX" || activeCurrencyCodes.has(currency),
});
const validateOutput = ajv.compile(outputSchema);

const requiredFields = [
  "amount",
  "currency",
  "category",
  "transaction_type",
  "merchant_or_person",
  "description",
  "confidence",
  "requires_clarification",
  "clarification_question",
];

const allowedCategories = [
  "FOOD",
  "TRANSPORTATION",
  "SHOPPING",
  "GROCERIES",
  "HEALTHCARE",
  "BILLS",
  "ENTERTAINMENT",
  "SALARY",
  "TRANSFER",
  "REFUND",
  "OTHER",
  "UNKNOWN",
];
const allowedTransactionTypes = ["CREDIT", "DEBIT", "UNKNOWN"];

function validResult(overrides = {}) {
  return {
    amount: 20,
    currency: "INR",
    category: "FOOD",
    transaction_type: "DEBIT",
    merchant_or_person: "Sample Cafe",
    description: "Cafe purchase",
    confidence: 0.9,
    requires_clarification: false,
    clarification_question: null,
    ...overrides,
  };
}

function isValid(result) {
  return validateOutput(result);
}

function getYamlBlock(lines, header, indentation) {
  const prefix = " ".repeat(indentation);
  const start = lines.findIndex((line) => line === `${prefix}${header}`);
  assert.notEqual(start, -1, `Expected OpenAPI YAML block ${header}`);

  const block = [lines[start]];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "") {
      block.push(line);
      continue;
    }

    const lineIndentation = line.match(/^ */)[0].length;
    if (lineIndentation <= indentation) {
      break;
    }
    block.push(line);
  }
  return block;
}

function directYamlKeys(block, indentation) {
  return block
    .filter((line) => line.match(/^ */)[0].length === indentation)
    .map((line) => line.slice(indentation).match(/^([^:]+):/)?.[1])
    .filter(Boolean);
}

test("canonical output schema requires exactly the nine contract fields", () => {
  assert.deepEqual(Object.keys(outputSchema.properties).sort(), [...requiredFields].sort());
  assert.deepEqual([...outputSchema.required].sort(), [...requiredFields].sort());
});

test("canonical output schema rejects additional output properties", () => {
  assert.equal(outputSchema.additionalProperties, false);
  assert.equal(isValid(validResult({ unexpected: true })), false);
});

test("canonical output schema accepts all permitted enum values", () => {
  for (const category of allowedCategories) {
    assert.equal(isValid(validResult({ category })), true);
  }

  for (const transaction_type of allowedTransactionTypes) {
    assert.equal(isValid(validResult({ transaction_type })), true);
  }
});

test("canonical output schema rejects invalid field types and enum values", () => {
  const invalidResults = [
    { amount: "20" },
    { currency: 20 },
    { currency: "US" },
    { category: "TRAVEL" },
    { transaction_type: "PAYMENT" },
    { merchant_or_person: 20 },
    { description: 20 },
    { confidence: "0.9" },
    { requires_clarification: "false" },
    { clarification_question: 20 },
  ];

  for (const override of invalidResults) {
    assert.equal(isValid(validResult(override)), false);
  }

  assert.equal(isValid(validResult({ merchant_or_person: null })), true);
  assert.equal(
    isValid(validResult({ requires_clarification: true, clarification_question: "Which date?" })),
    true,
  );
});

test("amount must be positive when numeric and may be null for clarification", () => {
  assert.equal(isValid(validResult({ amount: 0 })), false);
  assert.equal(isValid(validResult({ amount: -1 })), false);
  assert.equal(
    isValid(validResult({
      amount: null,
      requires_clarification: true,
      clarification_question: "What was the amount?",
    })),
    true,
  );
});

test("currency must be an active ISO 4217 alphabetic code or XXX", () => {
  for (const currency of ["INR", "USD", "EUR", "XXX"]) {
    assert.equal(isValid(validResult({ currency })), true);
  }

  assert.equal(isValid(validResult({ currency: "ZZZ" })), false);
  assert.equal(isValid(validResult({ currency: "usd" })), false);
});

test("description must be non-empty and no longer than 160 characters", () => {
  assert.equal(isValid(validResult({ description: "" })), false);
  assert.equal(isValid(validResult({ description: "d".repeat(160) })), true);
  assert.equal(isValid(validResult({ description: "d".repeat(161) })), false);
});

test("confidence must be between zero and one inclusive", () => {
  assert.equal(isValid(validResult({ confidence: 0 })), true);
  assert.equal(isValid(validResult({ confidence: 1 })), true);
  assert.equal(isValid(validResult({ confidence: -0.01 })), false);
  assert.equal(isValid(validResult({ confidence: 1.01 })), false);
});

test("clarification requires a non-empty question and no clarification requires null", () => {
  assert.equal(
    isValid(validResult({ requires_clarification: true, clarification_question: "" })),
    false,
  );
  assert.equal(
    isValid(validResult({ requires_clarification: true, clarification_question: null })),
    false,
  );
  assert.equal(
    isValid(validResult({ requires_clarification: true, clarification_question: "What was purchased?" })),
    true,
  );
  assert.equal(
    isValid(validResult({ requires_clarification: false, clarification_question: null })),
    true,
  );
  assert.equal(
    isValid(validResult({ requires_clarification: false, clarification_question: "What was purchased?" })),
    false,
  );
});

test("OpenAPI success response resolves its relative reference to the canonical schema", () => {
  const analyzeRoute = getYamlBlock(openApiLines, "/api/analyze:", 2);
  const postOperation = getYamlBlock(analyzeRoute, "post:", 4);
  const responses = getYamlBlock(postOperation, "responses:", 6);
  const successResponse = getYamlBlock(responses, '"200":', 8);
  const responseContent = getYamlBlock(successResponse, "content:", 10);
  const jsonContent = getYamlBlock(responseContent, "application/json:", 12);
  const responseSchema = getYamlBlock(jsonContent, "schema:", 14);
  const referenceLine = responseSchema.find((line) => /^ {16}\$ref:/.test(line));
  assert.ok(referenceLine, "Expected a schema reference in the 200 response");

  const reference = referenceLine.match(/^ {16}\$ref:\s*["']?([^"'\s]+)["']?\s*$/)?.[1];
  assert.equal(reference, "./output-schema.json");
  assert.equal(
    path.resolve(path.dirname(openApiPath), reference),
    canonicalSchemaPath,
  );
});

test("OpenAPI request requires exactly one non-empty statement and rejects extra properties", () => {
  const analyzeRoute = getYamlBlock(openApiLines, "/api/analyze:", 2);
  const postOperation = getYamlBlock(analyzeRoute, "post:", 4);
  const requestBody = getYamlBlock(postOperation, "requestBody:", 6);
  const requestContent = getYamlBlock(requestBody, "content:", 8);
  const jsonContent = getYamlBlock(requestContent, "application/json:", 10);
  const requestSchema = getYamlBlock(jsonContent, "schema:", 12);
  const properties = getYamlBlock(requestSchema, "properties:", 14);
  const statement = getYamlBlock(properties, "statement:", 16);
  const requestSchemaText = requestSchema.join("\n");
  const statementText = statement.join("\n");

  assert.match(requestBody.join("\n"), /^        required: true$/m);
  assert.match(requestSchemaText, /^              type: object$/m);
  assert.match(requestSchemaText, /^              required: \[statement\]$/m);
  assert.match(requestSchemaText, /^              additionalProperties: false$/m);
  assert.deepEqual(directYamlKeys(properties, 16), ["statement"]);
  assert.match(statementText, /^                  type: string$/m);
  assert.match(statementText, /^                  minLength: 1$/m);
  assert.match(statementText, /^                  pattern: "\\\\S"$/m);
});
