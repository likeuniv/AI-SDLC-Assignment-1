function TransactionForm({
  statement,
  isLoading,
  onStatementChange,
  onSubmit,
}) {
  return (
    <form className="transaction-form" onSubmit={onSubmit}>
      <label htmlFor="transaction-statement">Transaction statement</label>
      <textarea
        id="transaction-statement"
        name="statement"
        rows={5}
        value={statement}
        onChange={(event) => onStatementChange(event.target.value)}
        disabled={isLoading}
        placeholder="Example: Paid ₹250 for lunch at Swiggy"
        aria-describedby="statement-hint statement-count"
        required
      />
      <div className="input-meta">
        <p id="statement-hint">Keep it simple and include the details you know.</p>
        <p id="statement-count" aria-live="polite">
          {statement.length} {statement.length === 1 ? "character" : "characters"}
        </p>
      </div>
      <button
        className="analyze-button"
        type="submit"
        disabled={isLoading || statement.trim() === ""}
        aria-label={isLoading ? "Analyzing" : "Analyze"}
      >
        {isLoading ? (
          <>
            <span className="button-spinner" aria-hidden="true" />
            Analyzing…
          </>
        ) : (
          <>
            Analyze Transaction
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M4.5 10h11m0 0-4.25-4.25M15.5 10l-4.25 4.25"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </>
        )}
      </button>
    </form>
  );
}

export default TransactionForm;
