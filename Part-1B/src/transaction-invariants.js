const activeCurrencyCodes = new Set(Intl.supportedValuesOf("currency"));

const currencyIndicators = {
  INR: /\bINR\b|\brupees?\b|(?<![A-Za-z])rs\.?(?![A-Za-z])|₹/iu,
  USD: /\bUSD\b|\bUS dollars?\b/iu,
  EUR: /\bEUR\b|\beuros?\b|€/u,
  GBP: /\bGBP\b|\bpounds?\b|£/iu,
  JPY: /\bJPY\b|\byen\b|¥/iu,
  CAD: /\bCAD\b|\bCanadian dollars?\b/iu,
  AUD: /\bAUD\b|\bAustralian dollars?\b/iu,
};

const categoryIndicators = {
  FOOD: /\b(?:food|caf[eé]|restaurant|tea|coffee|meal|breakfast|lunch|dinner|snack|bakery)\b/iu,
  TRANSPORTATION: /\b(?:transport(?:ation)?|uber|taxi|cab|bus|train|metro|flight|fuel|petrol|diesel|ride)\b/iu,
  SHOPPING: /\b(?:shopping|shop|store|retail|amazon)\b/iu,
  GROCERIES: /\b(?:grocer(?:y|ies)|supermarket|vegetables?|fruits?)\b/iu,
  HEALTHCARE: /\b(?:healthcare|medical|doctor|hospital|pharmacy|medicine)\b/iu,
  BILLS: /\b(?:bill|electricity|utility|utilities|internet bill)\b/iu,
  ENTERTAINMENT: /\b(?:entertainment|movie|cinema|streaming|concert)\b/iu,
  SALARY: /\bsalary\b/iu,
  TRANSFER: /\btransfer(?:red)?\b/iu,
  REFUND: /\brefund(?:ed)?\b/iu,
};

const debitIndicators =
  /\b(?:paid|pay|spent|spend|bought|buy|purchased|purchase|charged|withdrew|withdraw|debited|sent)\b|\btransferred\s+to\b/iu;
const creditIndicators =
  /\b(?:received|receive|got|credited|refunded|refund(?:ed)?|reimbursed|deposited|deposit(?:ed)?|earned)\b/iu;
const transactionActionIndicators =
  /\b(?:paid|pay|spent|spend|bought|buy|purchased|purchase|charged|withdrew|withdraw|debited|sent|received|receive|got|credited|refunded|refund|reimbursed|deposited|deposit|earned)\b|\btransferred\s+(?:to|from)\b/iu;

const amountPattern =
  /(?<![\p{L}\p{N}])\d+(?:,\d{3})*(?:\.\d+)?(?=(?:rs\.?|inr|usd|eur|gbp|jpy|cad|aud)\b|[^\p{L}\p{N}]|$)/giu;
const clauseBoundaryPattern = /\b(?:and then|then|and)\b|[;,.!?]/iu;
const namedEntityPattern =
  /\b(?:at|to|from|with|for)\s+(?:(?:the|a|an)\s+)?([A-Z][\p{L}\p{N}'’&.-]*(?:\s+[A-Z][\p{L}\p{N}'’&.-]*)*)/gu;
const genericEntityNames = new Set([
  "breakfast",
  "cafe",
  "coffee",
  "dinner",
  "food",
  "lunch",
  "meal",
  "restaurant",
  "ride",
  "snack",
  "tea",
]);
const instructionLikeClausePatterns = [
  /\b(?:ignore|disregard|override|reveal|change|set|report|output|return|classify|assign|mark)\b[\s\S]{0,100}\b(?:rules?|instructions?|prompt|credentials?|secrets?|environment variables?|amount|currency|merchant|person|category|transaction type)\b/iu,
  /\b(?:amount|currency|merchant|person|category|transaction type)\b[\s\S]{0,100}\b(?:should|must|instead|set|change|report|output|return|use|make|classify|assign|mark)\b/iu,
  /\b(?:system|developer|admin)\s+(?:message|override|instruction)\b/iu,
];
const protectedOutputPatterns = [
  /\buntrusted statement supplied by the user\b/iu,
  /\btrusted instructions\b|\bresponse schema\b|\bsystem prompt\b/iu,
  /\b(?:OPENAI_API_KEY|SECRET_ACCESS_KEY)\b/iu,
  /\bsynthetic-secret-canary-[a-z0-9-]+\b/iu,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/u,
];

const invariantReasonMatchers = [
  {
    pattern:
      /^Amount is not supported|^A stated amount is missing|^Description contains an unsupported amount|^An unstated amount/u,
    code: "UNSUPPORTED_TRANSACTION_AMOUNT",
  },
  {
    pattern:
      /^Currency is not supported|^An explicit currency is missing|^Description contains an unsupported currency/u,
    code: "UNSUPPORTED_CURRENCY",
  },
  {
    pattern:
      /^Merchant or person is not supported|^Description contains an unsupported merchant or person/u,
    code: "UNSUPPORTED_MERCHANT",
  },
  {
    pattern:
      /^Category is not supported|^Description contains an unsupported transaction detail|^An unstated payment purpose/u,
    code: "UNSUPPORTED_CATEGORY",
  },
  {
    pattern:
      /^Transaction direction is not supported|^Transaction direction conflicts|^Description contains an unsupported transaction direction|^An unclear transaction direction/u,
    code: "UNSUPPORTED_TRANSACTION_DIRECTION",
  },
  {
    pattern: /^Statement contains multiple distinct transactions/u,
    code: "MULTIPLE_TRANSACTIONS_DETECTED",
  },
];

function normalizeText(value) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function extractNumericAmounts(statement) {
  return [...statement.matchAll(amountPattern)].map((match) =>
    Number(match[0].replaceAll(",", "")),
  );
}

function transactionEvidence(statement) {
  return statement
    .split(/(?:[;.!?\n]+|,(?=\s))/u)
    .filter(
      (clause) =>
        !instructionLikeClausePatterns.some((pattern) => pattern.test(clause)),
    )
    .join(" ");
}

export function checkProtectedOutput(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return ["Transaction result must be an object."];
  }

  return Object.values(value)
    .filter((field) => typeof field === "string")
    .some((field) =>
      protectedOutputPatterns.some((pattern) => pattern.test(field)),
    )
    ? ["Output contains protected prompt or credential-like text."]
    : [];
}

export function invariantFailureReasonCode(violations) {
  if (
    violations.some((violation) =>
      /^Statement contains multiple distinct transactions/u.test(violation),
    )
  ) {
    return "MULTIPLE_TRANSACTIONS_DETECTED";
  }
  const reasonCode = violations
    .map((violation) =>
      invariantReasonMatchers.find(({ pattern }) => pattern.test(violation))
        ?.code,
    )
    .find(Boolean);
  return reasonCode ?? "UNKNOWN_INVARIANT_FAILURE";
}

function extractExplicitCurrencyCodes(statement) {
  const found = new Set();

  for (const [currency, indicator] of Object.entries(currencyIndicators)) {
    if (indicator.test(statement)) {
      found.add(currency);
    }
  }

  for (const match of statement.matchAll(/(?<![A-Za-z])([A-Z]{3})(?![A-Za-z])/gu)) {
    const currency = match[1];
    if (activeCurrencyCodes.has(currency)) {
      found.add(currency);
    }
  }

  return found;
}

function hasMultipleTransactionClauses(statement) {
  const clauses = statement.split(clauseBoundaryPattern);
  const transactionClauses = clauses.filter(
    (clause) =>
      transactionActionIndicators.test(clause) &&
      /\d+(?:,\d{3})*(?:\.\d+)?/u.test(clause),
  );

  return transactionClauses.length > 1;
}

function clauseCategories(clause) {
  return new Set(
    Object.entries(categoryIndicators)
      .filter(([, indicator]) => indicator.test(clause))
      .map(([category]) => category),
  );
}

function clauseNamedEntities(clause) {
  return new Set(
    [...clause.matchAll(namedEntityPattern)]
      .map((match) => normalizeText(match[1]))
      .filter((entity) => entity && !genericEntityNames.has(entity)),
  );
}

function setsAreDisjoint(first, second) {
  return first.size > 0 && second.size > 0 && ![...first].some((value) =>
    second.has(value),
  );
}

export function hasImplicitSecondTransaction(statement) {
  const clauses = statement
    .split(clauseBoundaryPattern)
    .filter(
      (clause) =>
        clause.trim() !== "" &&
        !instructionLikeClausePatterns.some((pattern) => pattern.test(clause)),
    )
    .map((clause) => ({
      action: transactionActionIndicators.test(clause),
      amounts: extractNumericAmounts(clause),
      categories: clauseCategories(clause),
      entities: clauseNamedEntities(clause),
    }))
    .filter((clause) => clause.amounts.length === 1);

  for (let firstIndex = 0; firstIndex < clauses.length; firstIndex += 1) {
    const first = clauses[firstIndex];
    for (let secondIndex = firstIndex + 1; secondIndex < clauses.length; secondIndex += 1) {
      const second = clauses[secondIndex];
      if (first.action === second.action) {
        continue;
      }

      if (
        setsAreDisjoint(first.categories, second.categories) ||
        setsAreDisjoint(first.entities, second.entities)
      ) {
        return true;
      }
    }
  }

  return false;
}

export function hasMultipleTransactionStatement(statement) {
  if (typeof statement !== "string") {
    return false;
  }

  return (
    hasMultipleTransactionClauses(statement) ||
    hasImplicitSecondTransaction(statement)
  );
}

function isBarePaymentWithoutPurpose(statement) {
  return /^\s*(?:i\s+)?(?:paid|spent)\s+(?:(?:inr|rs\.?|rupees?)\s*)?\d+(?:,\d{3})*(?:\.\d+)?(?:\s*(?:inr|rs\.?|rupees?))?\s*[.!?]*\s*$/iu.test(
    statement,
  );
}

function isAmountMentionedInDescription(description, amounts) {
  const describedAmounts = [...description.matchAll(amountPattern)].map((match) =>
    Number(match[0].replaceAll(",", "")),
  );
  return describedAmounts.every((amount) => amounts.includes(amount));
}

function hasUnsupportedNamedEntity(description, statement) {
  const mentions = description.matchAll(
    /\b(?:at|to|from|with)\s+([A-Z][\p{L}'’-]*(?:\s+[A-Z][\p{L}'’-]*)*)/gu,
  );
  const normalizedStatement = normalizeText(statement);

  for (const mention of mentions) {
    if (!normalizedStatement.includes(normalizeText(mention[1]))) {
      return true;
    }
  }

  return false;
}

/**
 * Returns deterministic contract/invariant violations without changing either argument.
 *
 * @param {string} statement The current transaction statement.
 * @param {object} result The candidate extraction result.
 * @returns {string[]} Static descriptions of detected violations.
 */
export function checkTransactionInvariants(statement, result) {
  const violations = [];

  if (typeof statement !== "string") {
    return ["Transaction statement must be a string."];
  }

  if (result === null || typeof result !== "object" || Array.isArray(result)) {
    return ["Transaction result must be an object."];
  }

  const evidence = transactionEvidence(statement);
  if (typeof result.description === "string") {
    const trimmedDescription = result.description.trim();
    const wordCount =
      trimmedDescription === "" ? 0 : trimmedDescription.split(/\s+/u).length;

    if (wordCount > 20) {
      violations.push("Description exceeds the 20-word limit.");
    }
  }

  const amounts = extractNumericAmounts(evidence);
  if (typeof result.amount === "number") {
    if (!amounts.includes(result.amount)) {
      violations.push("Amount is not supported by the statement.");
    }
  } else if (result.amount === null && amounts.length > 0) {
    violations.push("A stated amount is missing from the result.");
  } else if (
    result.amount === null &&
    amounts.length === 0 &&
    result.requires_clarification !== true
  ) {
    violations.push("A missing amount requires clarification.");
  }

  const currencies = extractExplicitCurrencyCodes(evidence);
  if (typeof result.currency === "string" && result.currency !== "XXX") {
    if (!currencies.has(result.currency)) {
      violations.push("Currency is not supported by the statement.");
    }
  } else if (
    result.currency === "XXX" &&
    currencies.size > 0
  ) {
    violations.push("An explicit currency is missing from the result.");
  }

  if (
    typeof result.merchant_or_person === "string" &&
    result.merchant_or_person.trim() !== "" &&
    !normalizeText(evidence).includes(normalizeText(result.merchant_or_person))
  ) {
    violations.push("Merchant or person is not supported by the statement.");
  }

  if (typeof result.description === "string") {
    if (!isAmountMentionedInDescription(result.description, amounts)) {
      violations.push("Description contains an unsupported amount.");
    }

    const describedCurrencies = extractExplicitCurrencyCodes(result.description);
    if ([...describedCurrencies].some((currency) => !currencies.has(currency))) {
      violations.push("Description contains an unsupported currency.");
    }

    if (hasUnsupportedNamedEntity(result.description, evidence)) {
      violations.push("Description contains an unsupported merchant or person.");
    }

    if (
      Object.entries(categoryIndicators).some(
        ([category, indicator]) =>
          indicator.test(result.description) && !indicator.test(evidence),
      )
    ) {
      violations.push("Description contains an unsupported transaction detail.");
    }

    if (
      (debitIndicators.test(result.description) &&
        !debitIndicators.test(evidence)) ||
      (creditIndicators.test(result.description) &&
        !creditIndicators.test(evidence))
    ) {
      violations.push("Description contains an unsupported transaction direction.");
    }
  }

  if (
    typeof result.category === "string" &&
    result.category !== "UNKNOWN" &&
    result.category !== "OTHER" &&
    !categoryIndicators[result.category]?.test(evidence)
  ) {
    violations.push("Category is not supported by the statement.");
  }

  const hasDebitEvidence = debitIndicators.test(evidence);
  const hasCreditEvidence = creditIndicators.test(evidence);
  if (hasDebitEvidence !== hasCreditEvidence) {
    const supportedDirection = hasDebitEvidence ? "DEBIT" : "CREDIT";
    if (result.transaction_type !== supportedDirection) {
      violations.push("Transaction direction conflicts with the statement.");
    }
  } else if (
    !hasDebitEvidence &&
    !hasCreditEvidence &&
    result.transaction_type !== "UNKNOWN"
  ) {
    violations.push("Transaction direction is not supported by the statement.");
  }

  if (hasMultipleTransactionStatement(statement)) {
    violations.push("Statement contains multiple distinct transactions.");
  }

  if (result.requires_clarification === true) {
    if (
      typeof result.clarification_question !== "string" ||
      result.clarification_question.trim() === ""
    ) {
      violations.push("Clarification requires a non-empty question.");
    }
  } else if (
    result.requires_clarification === false &&
    result.clarification_question !== null
  ) {
    violations.push(
      "Clarification question must be null when clarification is not required.",
    );
  }

  if (
    amounts.length === 0 &&
    (result.amount !== null || result.requires_clarification !== true)
  ) {
    violations.push("An unstated amount must not be fabricated and requires clarification.");
  }

  if (
    !hasDebitEvidence &&
    !hasCreditEvidence &&
    result.requires_clarification !== true
  ) {
    violations.push("An unclear transaction direction requires clarification.");
  }

  if (isBarePaymentWithoutPurpose(evidence)) {
    if (result.category !== "UNKNOWN") {
      violations.push("An unstated payment purpose requires an UNKNOWN category.");
    }

    if (result.requires_clarification !== true) {
      violations.push("A payment without a stated purpose requires clarification.");
    }
  }

  return violations;
}
