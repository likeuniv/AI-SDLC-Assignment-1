import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { ErrorMessage, Loading, StatusMessage } from '../../components/Feedback.jsx';
import { formatHospitalTime } from '../shared/time.js';

const PAGE_SIZE = 20;

export function StaffAppointmentsPage() {
  const [status, setStatus] = useState('');
  const [appointments, setAppointments] = useState({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [canCancel, setCanCancel] = useState(true);

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (status) {
      query.set('status', status);
    }
    api.get(`/api/v1/admin/appointments?${query}`).then(
      (data) => {
        if (active) {
          setAppointments(data);
          setError(null);
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
  }, [page, status, refreshVersion]);

  async function cancel(appointmentId) {
    if (!globalThis.confirm('Cancel this appointment?')) {
      return;
    }
    setBusyId(appointmentId);
    setError(null);
    setMessage('');
    try {
      const updated = await api.post(`/api/v1/appointments/${appointmentId}/cancellation`, {});
      setAppointments((current) => ({
        ...current,
        items: current.items.map((item) => (
          item.appointmentId === updated.appointmentId ? updated : item
        )),
      }));
      setMessage('Appointment cancelled. The server confirmed the change.');
    } catch (requestError) {
      if (requestError.code === 'FORBIDDEN') {
        setCanCancel(false);
      }
      setError(requestError);
    } finally {
      setBusyId(null);
    }
  }

  const pageCount = Math.max(1, Math.ceil(appointments.total / PAGE_SIZE));
  return (
    <section className="panel">
      <p className="eyebrow">Staff workspace</p>
      <h1>Appointments</h1>
      <button className="button-secondary" onClick={() => {
        setLoading(true);
        setRefreshVersion((current) => current + 1);
      }} type="button">Refresh appointments</button>
      <label className="compact-label">
        Filter by status
        <select onChange={(event) => {
          setLoading(true);
          setStatus(event.target.value);
          setPage(1);
        }} value={status}>
          <option value="">All statuses</option>
          <option value="BOOKED">Booked</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </label>
      <ErrorMessage error={error} />
      {loading ? <Loading label="Loading appointments…" /> : appointments.items.length === 0 ? (
        <p className="empty-state">No appointments match this view.</p>
      ) : (
        <>
          <ul className="record-list">
            {appointments.items.map((appointment) => (
              <li className="record-card" key={appointment.appointmentId}>
                <h2>{appointment.doctorName}</h2>
                <p>{appointment.recipientName} · {appointment.recipientType.toLowerCase()}</p>
                <p>{formatHospitalTime(appointment.startAt)} – {formatHospitalTime(appointment.endAt)}</p>
                <p>Status: <strong>{appointment.status}</strong></p>
                {appointment.status === 'BOOKED' && canCancel && (
                  <button
                    className="button-danger"
                    disabled={busyId === appointment.appointmentId}
                    onClick={() => cancel(appointment.appointmentId)}
                    type="button"
                  >
                    {busyId === appointment.appointmentId ? 'Saving…' : 'Cancel appointment'}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="pagination">
            <button className="button-secondary" disabled={page <= 1} onClick={() => {
              setLoading(true);
              setPage((current) => current - 1);
            }} type="button">Previous</button>
            <span>Page {page} of {pageCount}</span>
            <button className="button-secondary" disabled={page >= pageCount} onClick={() => {
              setLoading(true);
              setPage((current) => current + 1);
            }} type="button">Next</button>
          </div>
        </>
      )}
      <StatusMessage>{message}</StatusMessage>
      <p className="muted">Staff can view, book and cancel only when authorized. Rescheduling and completion are not available in this workspace.</p>
    </section>
  );
}
