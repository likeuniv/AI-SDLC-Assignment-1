import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { ErrorMessage, Loading } from '../../components/Feedback.jsx';

const PAGE_SIZE = 10;

export function DiscoveryPage() {
  const [filters, setFilters] = useState({ name: '', specialization: '' });
  const [submitted, setSubmitted] = useState(filters);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    for (const [field, value] of Object.entries(submitted)) {
      if (value.trim()) {
        query.set(field, value.trim());
      }
    }
    api.get(`/api/v1/doctors?${query.toString()}`).then(
      (data) => {
        if (active) {
          setResult(data);
          setLoading(false);
        }
      },
      (requestError) => {
        if (active) {
          setError(requestError);
          setLoading(false);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [page, submitted]);

  function update(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    setPage(1);
    setLoading(true);
    setSubmitted({ ...filters });
  }

  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  return (
    <section className="panel">
      <p className="eyebrow">Care team</p>
      <h1>Find a doctor</h1>
      <p className="muted">Search professional profiles by name, specialty or both.</p>
      <form className="filter-form" onSubmit={submit}>
        <label>
          Doctor name
          <input
            name="name"
            onChange={(event) => update('name', event.target.value)}
            value={filters.name}
          />
        </label>
        <label>
          Specialization
          <input
            name="specialization"
            onChange={(event) => update('specialization', event.target.value)}
            value={filters.specialization}
          />
        </label>
        <button type="submit">Search</button>
      </form>
      <ErrorMessage error={error} />
      {loading ? <Loading label="Searching doctors…" /> : result.items.length === 0 ? (
        <p className="empty-state">No doctors matched your search. Try another name or specialty.</p>
      ) : (
        <>
          <p className="muted" aria-live="polite">{result.total} doctor{result.total === 1 ? '' : 's'} found</p>
          <ul className="record-list">
            {result.items.map((doctor) => (
              <li className="record-card" key={doctor.id}>
                <h2>{doctor.professionalName}</h2>
                {doctor.professionalSummary && <p>{doctor.professionalSummary}</p>}
                <p><strong>Specializations:</strong> {doctor.specializations.map((item) => item.name).join(', ') || 'Not listed'}</p>
                <p><strong>Departments:</strong> {doctor.departments.map((item) => item.name).join(', ') || 'Not listed'}</p>
              </li>
            ))}
          </ul>
          <div className="pagination">
            <button
              className="button-secondary"
              disabled={page <= 1}
              onClick={() => {
                setLoading(true);
                setPage((current) => current - 1);
              }}
              type="button"
            >
              Previous
            </button>
            <span>Page {page} of {pageCount}</span>
            <button
              className="button-secondary"
              disabled={page >= pageCount}
              onClick={() => {
                setLoading(true);
                setPage((current) => current + 1);
              }}
              type="button"
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
