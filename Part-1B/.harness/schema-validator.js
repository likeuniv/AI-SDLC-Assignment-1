import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";
import { checkTransactionInvariants } from "../src/transaction-invariants.js";
import { isIso4217Currency } from "../src/iso4217-format.js";

const canonicalSchema = JSON.parse(
  readFileSync(
    new URL("../specs/001-ai-spend-analyzer/contracts/output-schema.json", import.meta.url),
    "utf8",
  ),
);
const ajv = new Ajv2020({
  allErrors: true,
  coerceTypes: false,
  removeAdditional: false,
  useDefaults: false,
  strict: false,
});
ajv.addFormat("iso-4217-currency", {
  type: "string",
  validate: isIso4217Currency,
});
const validateCanonical = ajv.compile(canonicalSchema);

function descriptionWordCount(description) {
  const trimmed = description.trim();
  return trimmed ? trimmed.split(/\s+/u).length : 0;
}

export function validateOutput(output) {
  if (!validateCanonical(output)) {
    return false;
  }
  return descriptionWordCount(output.description) <= 20;
}

export function evaluateSchema(output, { statement = "" } = {}) {
  const passed = validateOutput(output);
  const invariantFindings =
    passed && statement
      ? checkTransactionInvariants(statement, output).filter((finding) =>
          /20-word limit/u.test(finding),
        )
      : [];
  const valid = passed && invariantFindings.length === 0;

  return {
    passed: valid,
    findings: valid ? [] : ["OUTPUT_SCHEMA_INVALID"],
  };
}

export function evaluateBoundaryFixtures(caseDefinition) {
  const fixtures = caseDefinition.input.fixtures ?? [];
  return fixtures.map((fixture) => {
    const candidate = {
      ...caseDefinition.input.output,
      ...fixture.patch,
    };
    const schemaAccepted = validateOutput(candidate);
    const invariantViolations = checkTransactionInvariants(
      "Paid 20 at a cafe",
      candidate,
    );
    const accepted =
      schemaAccepted &&
      !invariantViolations.includes("Description exceeds the 20-word limit.");

    return {
      check_id: `boundary_${fixture.name}`,
      passed: accepted === fixture.accepted,
    };
  });
}
