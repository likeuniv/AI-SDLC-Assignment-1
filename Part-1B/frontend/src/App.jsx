import { useRef, useState } from "react";
import ResultPanel from "./components/ResultPanel.jsx";
import TransactionForm from "./components/TransactionForm.jsx";

const safeErrorPresentations = {
  INVALID_REQUEST: {
    kind: "validation-error",
    title: "Check your transaction",
    message: "Enter one non-empty transaction statement.",
  },
  REQUEST_TOO_LARGE: {
    kind: "validation-error",
    title: "Check your transaction",
    message: "The statement is too long. Shorten it and try again.",
  },
  MULTIPLE_TRANSACTIONS: {
    kind: "validation-error",
    title: "Check your transaction",
    message: "Please submit one transaction at a time.",
  },
  PROVIDER_UNAVAILABLE: {
    kind: "analysis-error",
    title: "Analysis unavailable",
    message: "The analysis service is temporarily unavailable.",
  },
  PROVIDER_TIMEOUT: {
    kind: "analysis-error",
    title: "Analysis timed out",
    message: "The analysis took too long. Please try again.",
  },
  INVALID_MODEL_RESPONSE: {
    kind: "analysis-error",
    title: "We couldn’t interpret that transaction",
    message:
      "We couldn't interpret this transaction. Please try rephrasing it.",
  },
  INTERNAL_ERROR: {
    kind: "analysis-error",
    title: "Analysis error",
    message:
      "Something went wrong while analyzing your transaction. Please try again later.",
  },
};

const safeFallbackError = {
  kind: "analysis-error",
  title: "We couldn’t complete the analysis",
  message: "The request could not be completed. Please try again.",
};

const safeConnectionError = {
  kind: "analysis-error",
  title: "Connection problem",
  message:
    "Unable to contact the analysis service. Please check your connection and try again.",
};

function getSafeErrorPresentation(errorCode) {
  return Object.hasOwn(safeErrorPresentations, errorCode)
    ? safeErrorPresentations[errorCode]
    : safeFallbackError;
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M4.5 7.5h15a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V6a2 2 0 0 1 2-2h13"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16 13h5m-5 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0ZM7.5 11h3"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function App() {
  const [statement, setStatement] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const requestPending = useRef(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (requestPending.current || statement.trim() === "") {
      return;
    }

    requestPending.current = true;
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statement }),
        cache: "no-store",
      });

      if (!response.ok) {
        let errorCode;
        try {
          errorCode = (await response.json())?.error?.code;
        } catch {
          errorCode = undefined;
        }
        setError(getSafeErrorPresentation(errorCode));
        return;
      }

      const responseResult = await response.json();
      setResult(responseResult);
    } catch {
      setError(safeConnectionError);
    } finally {
      setIsLoading(false);
      requestPending.current = false;
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <BrandMark />
          <div className="brand-copy">
            <h1>AI Spend Analyzer</h1>
            <p>Understand your transactions with AI</p>
          </div>
        </div>
      </header>

      <main className="page-content">
        <section className="page-intro" aria-labelledby="page-title">
          <p className="eyebrow">TRANSACTION INSIGHTS</p>
          <h2 id="page-title">Analyze your transaction</h2>
          <p>
            Turn a short statement into clear, structured details. We’ll ask
            when something important is missing.
          </p>
        </section>

        <div className="analysis-layout">
          <section className="panel input-panel" aria-labelledby="input-title">
            <div className="panel-heading">
              <span className="step-indicator" aria-hidden="true">
                01
              </span>
              <div>
                <h3 id="input-title">Your transaction</h3>
                <p>Enter one transaction at a time in your own words.</p>
              </div>
            </div>
            <TransactionForm
              statement={statement}
              isLoading={isLoading}
              onStatementChange={setStatement}
              onSubmit={handleSubmit}
            />
            <p className="privacy-note">
              Your statement is analyzed for this request and isn’t saved by
              this app.
            </p>
          </section>

          <section
            className="result-column"
            aria-label="Transaction analysis"
            aria-live="polite"
          >
            {isLoading ? (
              <div className="panel loading-panel" role="status">
                <span className="loading-spinner" aria-hidden="true" />
                <div>
                  <h3>Analyzing transaction</h3>
                  <p>Checking the details you provided…</p>
                </div>
              </div>
            ) : error ? (
              <div
                className={`panel error-panel ${error.kind}`}
                role="alert"
              >
                <span className="state-icon error-icon" aria-hidden="true">
                  !
                </span>
                <div>
                  <h3>{error.title}</h3>
                  <p>{error.message}</p>
                </div>
              </div>
            ) : result ? (
              <ResultPanel result={result} />
            ) : (
              <div className="panel empty-panel">
                <span className="empty-icon" aria-hidden="true">
                  <svg viewBox="0 0 32 32" fill="none">
                    <path
                      d="M7 8.5A2.5 2.5 0 0 1 9.5 6h13A2.5 2.5 0 0 1 25 8.5v15a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 7 23.5v-15Z"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    />
                    <path
                      d="M11 12h10M11 16h6m-6 4h8"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <h3>Your result will appear here</h3>
                <p>
                  Submit a transaction to see its amount, category, merchant,
                  and other supported details.
                </p>
                <span className="empty-step">02 · YOUR ANALYSIS</span>
              </div>
            )}
          </section>
        </div>
        <p className="page-footnote">
          One transaction per request. Avoid including sensitive personal
          information.
        </p>
      </main>
    </div>
  );
}

export default App;
