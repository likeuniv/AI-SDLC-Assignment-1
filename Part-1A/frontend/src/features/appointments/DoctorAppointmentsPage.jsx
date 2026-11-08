import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { ErrorMessage, Loading, StatusMessage } from '../../components/Feedback.jsx';
import { formatHospitalTime } from '../shared/time.js';

export function DoctorAppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let active = true;
    api.get('/api/v1/appointments?page=1&pageSize=50').then(
      (result) => {
        if (active) {
          setAppointments(result.items);
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
  }, [refreshVersion]);

  async function complete(appointmentId) {
    setBusyId(appointmentId);
    setError(null);
    setMessage('');
    try {
      const updated = await api.post(`/api/v1/appointments/${appointmentId}/completion`, {});
      setAppointments((current) => current.map((item) => (
        item.appointmentId === updated.appointmentId ? updated : item
      )));
      setMessage('Appointment completed. The server confirmed the change.');
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="panel">
      <p className="eyebrow">Doctor workspace</p>
      <h1>Upcoming appointments</h1>
      <button className="button-secondary" onClick={() => {
        setLoading(true);
        setRefreshVersion((current) => current + 1);
      }} type="button">Refresh worklist</button>
      <ErrorMessage error={error} />
      {loading ? <Loading label="Loading your worklist…" /> : appointments.length === 0 ? (
        <p className="empty-state">You have no upcoming appointments.</p>
      ) : (
        <ul className="record-list">
          {appointments.map((appointment) => (
            <li className="record-card" key={appointment.appointmentId}>
              <h2>{appointment.recipientName}</h2>
              <p>{appointment.recipientType.toLowerCase()} · {formatHospitalTime(appointment.startAt)}</p>
              <p>Status: <strong>{appointment.status}</strong></p>
              {appointment.status === 'BOOKED' && (
                <button
                  disabled={busyId === appointment.appointmentId}
                  onClick={() => complete(appointment.appointmentId)}
                  type="button"
                >
                  {busyId === appointment.appointmentId ? 'Saving…' : 'Mark completed'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <StatusMessage>{message}</StatusMessage>
    </section>
  );
}
