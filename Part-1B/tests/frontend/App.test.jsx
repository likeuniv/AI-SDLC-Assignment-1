import { cleanup, fireEvent, render, screen, waitFor } from "../../frontend/node_modules/@testing-library/react/dist/index.js";
import { afterEach, describe, expect, it, vi } from "../../frontend/node_modules/vitest/dist/index.js";
import React from "../../frontend/node_modules/react/index.js";
import App from "../../frontend/src/App.jsx";

const successfulResult = {
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

function mockSuccessfulAnalysis(result = successfulResult) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => result,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AI Spend Analyzer application", () => {
  it("displays the approved application title", () => {
    render(React.createElement(App));

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "AI Spend Analyzer",
      }),
    ).toBeTruthy();
    expect(
      screen.getByText("Understand your transactions with AI"),
    ).toBeTruthy();
  });

  it("shows a welcoming input panel and an empty result state", () => {
    render(React.createElement(App));

    expect(
      screen.getByRole("heading", { name: "Analyze your transaction" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Your result will appear here" }),
    ).toBeTruthy();
    expect(
      screen.getByText(/one transaction at a time/i),
    ).toBeTruthy();
  });

  it("provides exactly one transaction-statement textbox", () => {
    render(React.createElement(App));

    const textboxes = screen.getAllByRole("textbox", {
      name: /transaction statement/i,
    });
    expect(textboxes).toHaveLength(1);
    expect(textboxes[0].getAttribute("placeholder")).toBe(
      "Example: Paid ₹250 for lunch at Swiggy",
    );
    expect(screen.getByText("0 characters")).toBeTruthy();
  });

  it("updates the character count as the statement changes", () => {
    render(React.createElement(App));

    fireEvent.change(
      screen.getByRole("textbox", { name: /transaction statement/i }),
      { target: { value: "Paid ₹250" } },
    );

    expect(screen.getByText("9 characters")).toBeTruthy();
  });

  it("submits the entered statement with the Analyze action", async () => {
    const fetchMock = mockSuccessfulAnalysis();
    render(React.createElement(App));

    fireEvent.change(
      screen.getByRole("textbox", { name: /transaction statement/i }),
      { target: { value: "Paid 20 rupees at Sample Cafe" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /^analyze$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analyze",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          statement: "Paid 20 rupees at Sample Cafe",
        }),
      }),
    );
  });

  it("displays a loading state while the analysis request is pending", async () => {
    let resolveRequest;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveRequest = resolve;
          }),
      ),
    );
    render(React.createElement(App));

    fireEvent.change(
      screen.getByRole("textbox", { name: /transaction statement/i }),
      { target: { value: "Paid 20 rupees at Sample Cafe" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /^analyze$/i }));

    expect((await screen.findByRole("status")).textContent).toMatch(/analyz/i);

    resolveRequest({
      ok: true,
      status: 200,
      json: async () => successfulResult,
    });
  });

  it("renders a successful extraction using the approved nine-field contract", async () => {
    mockSuccessfulAnalysis();
    render(React.createElement(App));

    fireEvent.change(
      screen.getByRole("textbox", { name: /transaction statement/i }),
      { target: { value: "Paid 20 rupees at Sample Cafe" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /^analyze$/i }));

    for (const field of [
      /amount/i,
      /currency/i,
      /category/i,
      /transaction type/i,
      /merchant or person/i,
      /description/i,
      /confidence/i,
      /requires clarification/i,
      /clarification question/i,
    ]) {
      expect(await screen.findByText(field)).toBeTruthy();
    }

    expect(screen.getByText("20")).toBeTruthy();
    expect(screen.getByText("INR")).toBeTruthy();
    expect(screen.getByText("FOOD")).toBeTruthy();
    expect(screen.getByText("DEBIT")).toBeTruthy();
    expect(screen.getByText("Sample Cafe")).toBeTruthy();
    expect(screen.getByText("Cafe purchase")).toBeTruthy();
    expect(screen.getByText("0.92")).toBeTruthy();
    expect(screen.getByText("No")).toBeTruthy();
    expect(screen.getByText("Not provided")).toBeTruthy();
  });

  it("displays the clarification state and question when clarification is required", async () => {
    const clarificationResult = {
      amount: 500,
      currency: "XXX",
      category: "UNKNOWN",
      transaction_type: "DEBIT",
      merchant_or_person: null,
      description: "Payment purpose is unclear",
      confidence: 0.64,
      requires_clarification: true,
      clarification_question: "What was the payment for?",
    };
    mockSuccessfulAnalysis(clarificationResult);
    render(React.createElement(App));

    fireEvent.change(
      screen.getByRole("textbox", { name: /transaction statement/i }),
      { target: { value: "Paid 500" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /^analyze$/i }));

    expect(
      await screen.findByRole("heading", {
        name: "What was the payment for?",
      }),
    ).toBeTruthy();
    expect(screen.getByRole("status").textContent).toMatch(/clarification/i);
    expect(screen.getByText("UNKNOWN")).toBeTruthy();
    expect(screen.getByText("XXX")).toBeTruthy();
  });

  it("prevents duplicate submissions while a request is pending", async () => {
    let resolveRequest;
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(React.createElement(App));

    fireEvent.change(
      screen.getByRole("textbox", { name: /transaction statement/i }),
      { target: { value: "Paid 20 rupees at Sample Cafe" } },
    );
    const analyzeButton = screen.getByRole("button", { name: /^analyze$/i });
    fireEvent.click(analyzeButton);
    fireEvent.click(analyzeButton);

    expect((await screen.findByRole("status")).textContent).toMatch(/analyz/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(analyzeButton.disabled).toBe(true);

    resolveRequest({
      ok: true,
      status: 200,
      json: async () => successfulResult,
    });
  });

  it("submits a corrected statement as a fresh request without earlier context", async () => {
    const clarificationResult = {
      amount: 500,
      currency: "XXX",
      category: "UNKNOWN",
      transaction_type: "DEBIT",
      merchant_or_person: null,
      description: "Payment purpose is unclear",
      confidence: 0.6,
      requires_clarification: true,
      clarification_question: "What was the payment for?",
    };
    const correctedResult = {
      amount: 500,
      currency: "INR",
      category: "FOOD",
      transaction_type: "DEBIT",
      merchant_or_person: "Sample Cafe",
      description: "Payment at Sample Cafe",
      confidence: 0.9,
      requires_clarification: false,
      clarification_question: null,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => clarificationResult,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => correctedResult,
      });
    vi.stubGlobal("fetch", fetchMock);
    render(React.createElement(App));

    const statementInput = screen.getByRole("textbox", {
      name: /transaction statement/i,
    });
    fireEvent.change(statementInput, {
      target: { value: "Paid 500" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^analyze$/i }));
    await screen.findByRole("heading", { name: "Clarification needed" });

    expect(statementInput.value).toBe("Paid 500");
    fireEvent.change(statementInput, {
      target: { value: "Paid 500 rupees at Sample Cafe" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^analyze$/i }));

    await screen.findByRole("heading", { name: "Transaction result" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].body).toBe(
      JSON.stringify({ statement: "Paid 500" }),
    );
    expect(fetchMock.mock.calls[1][1].body).toBe(
      JSON.stringify({ statement: "Paid 500 rupees at Sample Cafe" }),
    );
    expect(screen.getByText("Sample Cafe")).toBeTruthy();
  });

  it.each([
    {
      code: "INVALID_REQUEST",
      status: 400,
      message: "Enter one non-empty transaction statement.",
      kind: "validation-error",
      heading: "Check your transaction",
    },
    {
      code: "REQUEST_TOO_LARGE",
      status: 413,
      message: "The statement is too long. Shorten it and try again.",
      kind: "validation-error",
      heading: "Check your transaction",
    },
    {
      code: "MULTIPLE_TRANSACTIONS",
      status: 422,
      message: "Please submit one transaction at a time.",
      kind: "validation-error",
      heading: "Check your transaction",
    },
    {
      code: "INVALID_MODEL_RESPONSE",
      status: 502,
      message: "We couldn't interpret this transaction. Please try rephrasing it.",
      kind: "analysis-error",
      heading: "We couldn’t interpret that transaction",
    },
    {
      code: "PROVIDER_UNAVAILABLE",
      status: 503,
      message: "The analysis service is temporarily unavailable.",
      kind: "analysis-error",
      heading: "Analysis unavailable",
    },
    {
      code: "PROVIDER_TIMEOUT",
      status: 504,
      message: "The analysis took too long. Please try again.",
      kind: "analysis-error",
      heading: "Analysis timed out",
    },
    {
      code: "INTERNAL_ERROR",
      status: 500,
      message:
        "Something went wrong while analyzing your transaction. Please try again later.",
      kind: "analysis-error",
      heading: "Analysis error",
    },
  ])(
    "shows the approved safe message and category for $code",
    async ({ code, status, message, kind, heading }) => {
      const marker = "SYNTHETIC-RAW-ERROR-MARKER";
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status,
          json: async () => ({
            error: {
              code,
              message: marker,
            },
          }),
        }),
      );
      render(React.createElement(App));

      fireEvent.change(
        screen.getByRole("textbox", { name: /transaction statement/i }),
        { target: { value: "Paid 20 rupees at Sample Cafe" } },
      );
      fireEvent.click(screen.getByRole("button", { name: /^analyze$/i }));

      const alert = await screen.findByRole("alert");
      expect(alert.querySelector("h3").textContent).toBe(heading);
      expect(alert.querySelector("p").textContent).toBe(message);
      expect(alert.className).toContain(kind);
      expect(alert.textContent).not.toContain(marker);
      expect(screen.queryByRole("status")).toBeNull();
      expect(
        screen.getByRole("button", { name: /^analyze$/i }).disabled,
      ).toBe(false);
    },
  );

  it("uses a safe fallback for unknown backend error codes", async () => {
    const marker = "SYNTHETIC-RAW-ERROR-MARKER";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          error: {
            code: "UNKNOWN_SYNTHETIC_CODE",
            message: marker,
          },
        }),
      }),
    );
    render(React.createElement(App));

    fireEvent.change(
      screen.getByRole("textbox", { name: /transaction statement/i }),
      { target: { value: "Paid 20 rupees at Sample Cafe" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /^analyze$/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "The request could not be completed. Please try again.",
    );
    expect(alert.textContent).not.toContain(marker);
    expect(alert.textContent).not.toContain("UNKNOWN_SYNTHETIC_CODE");
  });

  it("shows a safe connection message when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("synthetic raw network exception")),
    );
    render(React.createElement(App));

    fireEvent.change(
      screen.getByRole("textbox", { name: /transaction statement/i }),
      { target: { value: "Paid 20 rupees at Sample Cafe" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /^analyze$/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "Unable to contact the analysis service. Please check your connection and try again.",
    );
    expect(alert.textContent).not.toContain("synthetic raw network exception");
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: /^analyze$/i }).disabled).toBe(
      false,
    );
  });

  it("allows a successful fresh submission after a failed request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({
          error: { code: "INVALID_MODEL_RESPONSE", message: "raw response" },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => successfulResult,
      });
    vi.stubGlobal("fetch", fetchMock);
    render(React.createElement(App));

    const input = screen.getByRole("textbox", {
      name: /transaction statement/i,
    });
    fireEvent.change(input, {
      target: { value: "Paid 20 rupees at Sample Cafe" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^analyze$/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "We couldn't interpret this transaction. Please try rephrasing it.",
    );
    expect(screen.queryByRole("heading", { name: /transaction result/i })).toBeNull();

    fireEvent.change(input, {
      target: { value: "Paid 25 rupees at Sample Cafe" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^analyze$/i }));

    expect(
      await screen.findByRole("heading", { name: "Transaction result" }),
    ).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not leave an earlier successful result visible after a later failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => successfulResult,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({
          error: {
            code: "INVALID_MODEL_RESPONSE",
            message: "raw provider details",
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    render(React.createElement(App));

    const input = screen.getByRole("textbox", {
      name: /transaction statement/i,
    });
    fireEvent.change(input, {
      target: { value: "Paid 20 rupees at Sample Cafe" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^analyze$/i }));
    expect(
      await screen.findByRole("heading", { name: "Transaction result" }),
    ).toBeTruthy();

    fireEvent.change(input, {
      target: { value: "Paid 20 at a cafe and received 50 from Rahul" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^analyze$/i }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "Transaction result" }),
    ).toBeNull();
    expect(screen.queryByText("Sample Cafe")).toBeNull();
  });
});
