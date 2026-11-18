import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  evaluateBoundaryFixtures,
  evaluateSchema,
} from "./schema-validator.js";
import { evaluateBehavior } from "./invariant-checker.js";
import { evaluateSemantics } from "./semantic-evaluator.js";
import { evaluateAdversarial } from "./adversarial-evaluator.js";

function safeErrorShape(caseDefinition, actual) {
  if (caseDefinition.expected.type === "error") {
    return actual.errorCode === caseDefinition.expected.code &&
      actual.status === caseDefinition.expected.status;
  }
  return false;
}

export function evaluateCase({
  caseDefinition,
  output = null,
  statement = caseDefinition.input.statement,
  errorCode = null,
  status = null,
  contextIsolated = true,
}) {
  const actual = { output, errorCode, status };
  let structural;

  if (errorCode) {
    const errorIsExpected = safeErrorShape(caseDefinition, actual);
    const adversarialError =
      caseDefinition.expected.type === "adversarial_safe" &&
      errorCode !== null;

    structural = {
      passed: errorIsExpected || adversarialError,
      findings: errorIsExpected || adversarialError
        ? []
        : ["SAFE_ERROR_SHAPE_INVALID"],
    };
  } else {
    structural = evaluateSchema(output, { statement });
  }

  if (caseDefinition.input.type === "validator_boundary") {
    const boundaryResults = evaluateBoundaryFixtures(caseDefinition);
    const failures = boundaryResults.filter((item) => !item.passed);

    structural = {
      passed: structural.passed && failures.length === 0,
      findings: [
        ...structural.findings,
        ...failures.map((item) => item.check_id.toUpperCase()),
      ],
    };
  }

  const behavioral = evaluateBehavior({
    caseDefinition,
    statement,
    output,
    errorCode,
    status,
    contextIsolated,
  });

  const semantic = evaluateSemantics(caseDefinition.expected, actual);

  const adversarial = evaluateAdversarial({
    caseDefinition,
    statement,
    output,
    errorCode,
  });

  const layers = { structural, behavioral, semantic };

  if (adversarial) {
    layers.adversarial = adversarial;
  }

  return {
    case_id: caseDefinition.case_id,
    layers,
    adversarial_passed: adversarial?.passed ?? null,
  };
}

function readJsonFile(filePath, label) {
  try {
    return JSON.parse(readFileSync(resolve(filePath), "utf8"));
  } catch (error) {
    throw new Error(
      `Unable to read ${label} JSON file "${filePath}": ${error.message}`,
    );
  }
}

function parseArguments(args) {
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (!["--case", "--input", "--statement", "--expected"].includes(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }

    const value = args[index + 1];

    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${argument}`);
    }

    const key = argument.slice(2);

    if (options[key] !== undefined) {
      throw new Error(`Argument ${argument} was provided more than once`);
    }

    options[key] = value;
    index += 1;
  }

  return options;
}

function printReport(result) {
  const layers = result.layers;
  const layerNames = [
    ["structural", "Structural"],
    ["behavioral", "Behavioral"],
    ["semantic", "Semantic"],
    ["adversarial", "Adversarial"],
  ];

  const overallPassed = Object.values(layers).every(
    (layer) => layer.passed === true,
  );

  console.log("\n==========================================");
  console.log("       AI SPEND ANALYZER - SENSOR");
  console.log("==========================================");
  console.log(`Case: ${result.case_id}`);
  console.log("------------------------------------------");

  for (const [key, label] of layerNames) {
    const layer = layers[key];

    if (!layer) {
      console.log(`${label.padEnd(16)} N/A`);
      continue;
    }

    console.log(
      `${label.padEnd(16)} ${layer.passed ? "PASS" : "FAIL"}`,
    );

    for (const finding of layer.findings ?? []) {
      console.log(`  - ${finding}`);
    }
  }

  console.log("------------------------------------------");
  console.log(`OVERALL          ${overallPassed ? "PASS" : "FAIL"}`);
  console.log("==========================================\n");

  return overallPassed;
}

export async function runStandalone(args = process.argv.slice(2)) {
  const options = parseArguments(args);

  if (!options.input) {
    throw new Error("The --input argument is required.");
  }

  const datasetMode = Boolean(options.case);
  const customMode = Boolean(options.statement && options.expected);

  if (datasetMode === customMode) {
    throw new Error(
      "Choose either --case EC-001 or --statement \"...\" --expected expected.json.",
    );
  }

  if (datasetMode && (options.statement || options.expected)) {
    throw new Error(
      "Do not combine --case with --statement or --expected.",
    );
  }

  const output = readJsonFile(options.input, "AI output");

  let caseDefinition;
  let statement;

  if (datasetMode) {
    const dataset = JSON.parse(
      readFileSync(
        new URL("../evals/dataset.json", import.meta.url),
        "utf8",
      ),
    );

    caseDefinition = dataset.cases.find(
      (item) => item.case_id === options.case,
    );

    if (!caseDefinition) {
      throw new Error(`Evaluation case not found: ${options.case}`);
    }

    if (!["statement", "independent_statement"].includes(
      caseDefinition.input.type,
    )) {
      throw new Error(
        `${options.case} is not a standalone transaction-statement case. Its input type is ${caseDefinition.input.type}.`,
      );
    }

    statement = caseDefinition.input.statement;
  } else {
    statement = options.statement;

    caseDefinition = {
      case_id: "CUSTOM",
      input: {
        type: "statement",
        statement,
      },
      expected: readJsonFile(options.expected, "expected result"),
      tags: [],
      requirement_ids: [],
      acceptance_ids: [],
    };

    if (!["result", "adversarial_safe", "error"].includes(
      caseDefinition.expected.type,
    )) {
      throw new Error("The expected JSON has an unsupported type.");
    }
  }

  const result = evaluateCase({
    caseDefinition,
    output,
    statement,
  });

  const passed = printReport(result);
  return passed;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const passed = await runStandalone();
    process.exitCode = passed ? 0 : 1;
  } catch (error) {
    console.error(`Sensor error: ${error.message}`);
    console.error(
      '\nUsage:\n' +
      '  node .harness/sensor.js --case EC-001 --input output.json\n' +
      '  node .harness/sensor.js --statement "Paid 20rs at tea shop" --input output.json --expected expected.json\n',
    );
    process.exitCode = 2;
  }
}
