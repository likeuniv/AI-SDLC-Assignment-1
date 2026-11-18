import { cleanup, render, screen } from "../../frontend/node_modules/@testing-library/react/dist/index.js";
import { afterEach, describe, expect, it } from "../../frontend/node_modules/vitest/dist/index.js";
import React from "../../frontend/node_modules/react/index.js";
import ResultPanel from "../../frontend/src/components/ResultPanel.jsx";

const completeResult = {
  amount: 20,
  currency: "INR",
  category: "FOOD",
  transaction_type: "DEBIT",
  merchant_or_person: "Sample Cafe",
  description: "Cafe purchase",
  confidence: 0.92,
  requires_clarification: false,
  clarification_question: null,
};

const clarificationResult = {
  amount: null,
  currency: "XXX",
  category: "UNKNOWN",
  transaction_type: "UNKNOWN",
  merchant_or_person: null,
  description: "Transaction details are incomplete",
  confidence: 0.5,
  requires_clarification: true,
  clarification_question: "Was 500 paid to Maya or received from Maya?",
};

afterEach(cleanup);

describe("transaction result presentation", () => {
  it("displays a normal complete transaction result", () => {
    render(React.createElement(ResultPanel, { result: completeResult }));

    expect(screen.getByRole("heading", { name: /transaction result/i })).toBeTruthy();
    expect(
      screen.getByRole("group", { name: /transaction summary/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("group", { name: /transaction summary/i }).textContent,
    ).toContain("20");
    expect(screen.getByText("INR")).toBeTruthy();
    expect(screen.getByText("FOOD", { selector: ".result-badge" })).toBeTruthy();
    expect(screen.getByText("DEBIT", { selector: ".result-badge" })).toBeTruthy();
    expect(screen.getByText("Sample Cafe")).toBeTruthy();
    expect(screen.getByText("Cafe purchase")).toBeTruthy();
  });

  it("presents clarification distinctly without implying a complete successful result", () => {
    render(React.createElement(ResultPanel, { result: clarificationResult }));

    expect(
      screen.getByRole("heading", { name: /clarification needed/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("status").textContent,
    ).toMatch(/one more detail|clarification/i);
    expect(
      screen.queryByRole("heading", { name: /transaction result/i }),
    ).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByRole("group", { name: /transaction summary/i }).className,
    ).toContain("is-clarification");
  });

  it("shows a non-empty clarification question prominently", () => {
    render(React.createElement(ResultPanel, { result: clarificationResult }));

    const question = screen.getByRole("heading", {
      name: clarificationResult.clarification_question,
    });
    expect(question).toBeTruthy();
  });

  it("renders null and UNKNOWN values explicitly without inventing values", () => {
    render(React.createElement(ResultPanel, { result: clarificationResult }));

    expect(screen.getAllByText("UNKNOWN")).toHaveLength(2);
    expect(screen.getByText("XXX")).toBeTruthy();
    expect(screen.getAllByText(/not provided/i).length).toBeGreaterThan(0);
    expect(screen.queryByText("0")).toBeNull();
  });
});
