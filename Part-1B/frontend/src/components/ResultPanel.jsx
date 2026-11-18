function displayValue(value) {
  return value === null ? "Not provided" : String(value);
}

function ResultPanel({ result }) {
  const requiresClarification = result.requires_clarification;
  const headingId = requiresClarification
    ? "clarification-heading"
    : "result-heading";

  return (
    <article
      className={`panel result-card${requiresClarification ? " is-clarification" : ""}`}
      aria-labelledby={headingId}
    >
      <header className="result-header">
        <div>
          <p className="result-eyebrow">
            {requiresClarification ? "ONE MORE DETAIL" : "ANALYSIS COMPLETE"}
          </p>
          <h3 id={headingId}>
            {requiresClarification ? "Clarification needed" : "Transaction result"}
          </h3>
        </div>
        <span
          className={`result-state${requiresClarification ? " needs-clarification" : ""}`}
        >
          <span className="state-dot" aria-hidden="true" />
          {requiresClarification ? "Needs input" : "Ready"}
        </span>
      </header>

      {requiresClarification && (
        <div className="clarification-callout" role="status">
          <p>Clarification required before these transaction details are complete.</p>
          <h4>{result.clarification_question}</h4>
        </div>
      )}

      <div
        className={`transaction-summary${requiresClarification ? " is-clarification" : ""}`}
        role="group"
        aria-label="Transaction summary"
      >
        <div className="amount-block">
          <div>
            <span className="detail-label">Amount</span>
            <p className="amount-value">{displayValue(result.amount)}</p>
          </div>
          <div className="currency-block">
            <span className="detail-label">Currency</span>
            <span className="currency-value">{result.currency}</span>
          </div>
        </div>
        <div className="classification-block">
          <div className="classification-item">
            <span className="detail-label">Category</span>
            <span className="result-badge category-badge">{result.category}</span>
          </div>
          <div className="classification-item">
            <span className="detail-label">Transaction type</span>
            <span
              className={`result-badge direction-badge ${result.transaction_type.toLowerCase()}`}
            >
              {result.transaction_type}
            </span>
          </div>
        </div>
      </div>

      <div className="result-details">
        <div className="detail-item">
          <span className="detail-label">Merchant or person</span>
          <span className="detail-value">
            {displayValue(result.merchant_or_person)}
          </span>
        </div>
        <div className="detail-item description-item">
          <span className="detail-label">Description</span>
          <span className="detail-value">{result.description}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Confidence</span>
          <span className="detail-value confidence-value">
            {result.confidence}
          </span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Requires clarification</span>
          <span className="detail-value">
            {requiresClarification ? "Yes" : "No"}
          </span>
        </div>
        <div className="detail-item clarification-detail">
          <span className="detail-label">Clarification question</span>
          <span className="detail-value">
            {displayValue(result.clarification_question)}
          </span>
        </div>
      </div>
    </article>
  );
}

export default ResultPanel;
