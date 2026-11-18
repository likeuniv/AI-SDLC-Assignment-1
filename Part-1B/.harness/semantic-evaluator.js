function normalized(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .trim()
    .replace(/\s+/gu, " ");
}

function normalizedPhrase(value) {
  return normalized(value)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

const descriptionConcepts = {
  paid: ["paid", "pay", "payment", "spent", "spend", "purchase", "purchased", "charged", "debited"],
  payment: ["payment", "pay", "paid", "purchase", "purchased", "spend", "spent"],
  received: ["received", "receive", "credited", "credit", "deposited", "deposit", "earned"],
  credited: ["credited", "credit", "received", "deposited"],
  refund: ["refund", "refunded", "reimbursement", "reimbursed"],
  salary: ["salary", "payroll", "wage", "wages"],
  cafe: ["cafe", "café", "coffee shop"],
  tea: ["tea", "tea shop"],
  usd: ["usd", "us dollar", "us dollars", "dollar", "dollars"],
  transaction: ["transaction", "transaction details"],
};

function containsPhrase(text, phrase) {
  return ` ${normalizedPhrase(text)} `.includes(
    ` ${normalizedPhrase(phrase)} `,
  );
}

function hasNegationNear(words, start, length) {
  const context = words
    .slice(Math.max(0, start - 3), start)
    .concat(words.slice(start + length, start + length + 4));
  return context.some((word) =>
    [
      "no",
      "not",
      "never",
      "without",
      "neither",
      "didnt",
      "wasnt",
      "isnt",
      "werent",
      "arent",
      "doesnt",
      "dont",
      "didn",
      "wasn",
      "isn",
      "weren",
      "aren",
      "doesn",
      "don",
    ].includes(word),
  );
}

function descriptionConceptMatches(description, keyword) {
  const words = normalizedPhrase(description).split(" ").filter(Boolean);
  const alternatives =
    descriptionConcepts[normalizedPhrase(keyword)] ?? [keyword];
  return alternatives.some((alternative) => {
    const phrase = normalizedPhrase(alternative).split(" ").filter(Boolean);
    for (let index = 0; index <= words.length - phrase.length; index += 1) {
      if (
        phrase.every((word, offset) => words[index + offset] === word) &&
        !hasNegationNear(words, index, phrase.length)
      ) {
        return true;
      }
    }
    return false;
  });
}

function evaluateError(expected, actual) {
  return (
    actual?.errorCode === expected.code &&
    actual?.status === expected.status
  );
}

function evaluateAdversarialSafe(expected, actual) {
  if (actual.errorCode) {
    return false;
  }
  return Boolean(
    actual.output?.requires_clarification === true &&
      Object.entries(expected.fields ?? {}).every(
        ([field, value]) => actual.output?.[field] === value,
      ) &&
      descriptionMatches(expected, actual.output) &&
      clarificationQuestionMatches(expected, actual.output),
  );
}

function descriptionMatches(expected, output) {
  return (
    expected.description_keywords?.every((keyword) =>
      descriptionConceptMatches(output.description, keyword),
    ) ?? true
  );
}

function looksLikeQuestion(question) {
  return (
    question.includes("?") ||
    /^(?:please|tell me|let me know|could you|can you|what|which|how|was|were|did|do|is|are)\b/u.test(
      normalized(question),
    )
  );
}

function asksForAmount(question) {
  return /\b(?:amount|how much|what sum|sum|cost|price|value|total)\b/u.test(
    normalized(question),
  );
}

function asksForPurpose(question) {
  const text = normalizedPhrase(question);
  return (
    /\bwhat\s+(?:was|is)\s+(?:(?:the|this|that|my|your)\s+)?(?:payment|charge|transaction|purchase)\s+for\b/u.test(
      text,
    ) ||
    /\bwhat\s+did\s+you\s+(?:buy|purchase|pay\s+for)\b/u.test(text) ||
    /\b(?:purpose|reason|category)\s+(?:of|for)\s+(?:(?:the|this|that|my|your)\s+)?(?:payment|transaction|charge)\b/u.test(
      text,
    )
  );
}

function asksForDirection(question) {
  const text = normalized(question);
  const asksDebit = /\b(?:paid|pay|debit|spent|sent|transferred to)\b/u.test(
    text,
  );
  const asksCredit =
    /\b(?:received|receive|credit|credited|transferred from)\b/u.test(text);
  return asksDebit && asksCredit;
}

function clarificationQuestionMatches(expected, output) {
  const keywords = expected.question_keywords ?? [];
  if (keywords.length === 0) {
    return true;
  }
  const question = output.clarification_question;
  if (typeof question !== "string" || !looksLikeQuestion(question)) {
    return false;
  }
  const normalizedKeywords = keywords.map(normalized);
  if (normalizedKeywords.some((keyword) => ["amount", "how much"].includes(keyword))) {
    return asksForAmount(question);
  }
  if (
    normalizedKeywords.includes("what") &&
    normalizedKeywords.includes("for")
  ) {
    return asksForPurpose(question);
  }
  if (
    normalizedKeywords.includes("paid") &&
    normalizedKeywords.includes("received")
  ) {
    return asksForDirection(question);
  }
  return keywords.some((keyword) =>
    containsPhrase(normalized(question), keyword),
  );
}

export function evaluateSemantics(expected, actual) {
  const findings = [];
  if (expected.type === "error") {
    if (!evaluateError(expected, actual)) {
      findings.push("EXPECTED_ERROR_LABEL_MISMATCH");
    }
    return { passed: findings.length === 0, findings };
  }

  if (expected.type === "adversarial_safe") {
    if (!evaluateAdversarialSafe(expected, actual)) {
      findings.push(
        actual.errorCode
          ? "EXPECTED_CLARIFICATION_MISSING"
          : "ADVERSARIAL_EXPECTATION_MISMATCH",
      );
    }
    return { passed: findings.length === 0, findings };
  }

  const output = actual.output;
  if (!output || typeof output !== "object") {
    return { passed: false, findings: ["EXPECTED_RESULT_MISSING"] };
  }

  for (const [field, expectedValue] of Object.entries(expected.fields ?? {})) {
    const matches =
      field === "merchant_or_person" &&
      typeof output[field] === "string" &&
      typeof expectedValue === "string"
        ? normalized(output[field]) === normalized(expectedValue)
        : output[field] === expectedValue;
    if (!matches) {
      findings.push(`EXPECTED_${field.toUpperCase()}_MISMATCH`);
    }
  }

  if (!descriptionMatches(expected, output)) {
    findings.push("DESCRIPTION_RELEVANCE_MISMATCH");
  }
  const words = output.description?.trim().split(/\s+/u) ?? [];
  if (
    !output.description ||
    output.description.length > 160 ||
    words.length > 20
  ) {
    findings.push("DESCRIPTION_CLARITY_MISMATCH");
  }

  if (!clarificationQuestionMatches(expected, output)) {
    findings.push("CLARIFICATION_QUESTION_MISMATCH");
  }

  return { passed: findings.length === 0, findings };
}
