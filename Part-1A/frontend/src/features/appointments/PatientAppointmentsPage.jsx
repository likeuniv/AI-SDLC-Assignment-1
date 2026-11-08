import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../app/useAuth.js';
import { ErrorMessage, Loading, StatusMessage } from '../../components/Feedback.jsx';
import { formatHospitalTime } from '../shared/time.js';

const PAGE_SIZE = 20;

function isAuthorizedBeneficiary(item) {
  return item.authorizationStatus !== 'PENDING_AUTHORIZATION'
    && item.authorizationStatus !== 'REJECTED';
}

export function PatientAppointmentsPage() {
  const { account } = useAuth();
  const [view, setView] = useState('upcoming');
  const [appointments, setAppointments] = useState({ items: [], total: 0 });
  const [doctors, setDoctors] = useState([]);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [doctorId, setDoctorId] = useState('');
  const [slots, setSlots] = useState([]);
  const [recipient, setRecipient] = useState('self');
  const [slotId, setSlotId] = useState('');
  const [page, setPage] = useState(1);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({
      view,
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    api.get(`/api/v1/appointments?${query}`).then(
      (data) => {
        if (active) {
          setAppointments(data);
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
  }, [view, page, refreshVersion]);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get('/api/v1/doctors?page=1&pageSize=50'),
      api.get('/api/v1/beneficiaries'),
    ]).then(
      ([doctorResult, beneficiaryResult]) => {
        if (active) {
          setDoctors(doctorResult.items);
          setBeneficiaries(beneficiaryResult);
        }
      },
      (requestError) => {
        if (active) {
          setError(requestError);
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!doctorId) {
      return undefined;
    }
    let active = true;
    api.get(`/api/v1/doctors/${doctorId}/availability?page=1&pageSize=50`).then(
      (result) => {
        if (active) {
          setSlots(result.items);
          setSlotId('');
          setError(null);
        }
      },
      (requestError) => {
        if (active) {
          setSlots([]);
          setError(requestError);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [doctorId]);

  async function book(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage('');
    const body = {
      doctorAccountId: Number(doctorId),
      availabilitySlotId: Number(slotId),
      ...(recipient === 'self'
        ? { patientRecipientAccountId: account.accountId }
        : { beneficiaryId: Number(recipient) }),
    };
    try {
      const created = await api.post('/api/v1/appointments', body);
      setMessage('Appointment booked. The server confirmed this appointment.');
      if (view === 'upcoming' && page === 1) {
        setAppointments((current) => ({
          ...current,
          items: [created, ...current.items]
            .sort((left, right) => Date.parse(right.startAt) - Date.parse(left.startAt))
            .slice(0, PAGE_SIZE),
          total: current.total + 1,
        }));
      }
      setSlotId('');
    } catch (requestError) {
      setError(requestError);
    } finally {
      setSaving(false);
    }
  }

  async function cancel(appointment) {
    if (!globalThis.confirm('Cancel this appointment?')) {
      return;
    }
    setError(null);
    setMessage('');
    try {
      const updated = await api.post(`/api/v1/appointments/${appointment.appointmentId}/cancellation`, {});
      setAppointments((current) => ({
        ...current,
        items: current.items.map((item) => item.appointmentId === updated.appointmentId
          ? updated
          : item),
      }));
      setMessage('Appointment cancelled. The server confirmed the change.');
    } catch (requestError) {
      setError(requestError);
    }
  }

  const pageCount = Math.max(1, Math.ceil(appointments.total / PAGE_SIZE));
  const eligibleBeneficiaries = beneficiaries.filter(isAuthorizedBeneficiary);
  return (
    <div className="page-grid">
      <section className="panel">
        <p className="eyebrow">Patient services</p>
        <h1>Appointments</h1>
        <button className="button-secondary" onClick={() => {
          setLoading(true);
          setRefreshVersion((current) => current + 1);
        }} type="button">Refresh appointments</button>
        <div className="segmented-control" aria-label="Appointment list">
          <button
            aria-pressed={view === 'upcoming'}
            className={view === 'upcoming' ? 'selected' : 'button-secondary'}
            onClick={() => {
              setView('upcoming');
              setPage(1);
              setLoading(true);
            }}
            type="button"
          >
            Upcoming
          </button>
          <button
            aria-pressed={view === 'history'}
            className={view === 'history' ? 'selected' : 'button-secondary'}
            onClick={() => {
              setView('history');
              setPage(1);
              setLoading(true);
            }}
            type="button"
          >
            History
          </button>
        </div>
        <ErrorMessage error={error} />
        {loading ? <Loading label="Loading appointments…" /> : appointments.items.length === 0 ? (
          <p className="empty-state">No {view} appointments.</p>
        ) : (
          <>
            <ul className="record-list">
              {appointments.items.map((appointment) => (
                <li className="record-card" key={appointment.appointmentId}>
                  <h2>{appointment.doctorName}</h2>
                  <p>{appointment.recipientName} · {appointment.recipientType.toLowerCase()}</p>
                  <p>{formatHospitalTime(appointment.startAt)} – {formatHospitalTime(appointment.endAt)}</p>
                  <p>Status: <strong>{appointment.status}</strong></p>
                  {appointment.status === 'BOOKED' && (
                    <button className="button-danger" onClick={() => cancel(appointment)} type="button">
                      Cancel appointment
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className="pagination">
              <button className="button-secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button">Previous</button>
              <span>Page {page} of {pageCount}</span>
              <button className="button-secondary" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)} type="button">Next</button>
            </div>
          </>
        )}
        <StatusMessage>{message}</StatusMessage>
      </section>

      <section className="panel">
        <h2>Book an appointment</h2>
        <p className="muted">Choose a doctor, an eligible recipient and an available future slot.</p>
        <form onSubmit={book}>
          <label>
            Appointment for
            <select onChange={(event) => setRecipient(event.target.value)} value={recipient}>
              <option value="self">Myself</option>
              {beneficiaries.map((item) => (
                <option
                  disabled={!isAuthorizedBeneficiary(item)}
                  key={item.id ?? item.beneficiaryId}
                  value={item.id ?? item.beneficiaryId}
                >
                  {item.fullName ?? 'Adult beneficiary'} — {item.authorizationStatus ?? 'minor'}
                </option>
              ))}
            </select>
          </label>
          {recipient !== 'self' && !eligibleBeneficiaries.some(
            (item) => String(item.id ?? item.beneficiaryId) === recipient,
          ) && (
            <p className="feedback warning">
              Adult beneficiary details and booking are unavailable until authorization is approved.
            </p>
          )}
          <label>
            Doctor
            <select onChange={(event) => setDoctorId(event.target.value)} required value={doctorId}>
              <option value="">Select a doctor</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>{doctor.professionalName}</option>
              ))}
            </select>
          </label>
          <label>
            Available slot
            <select
              onChange={(event) => setSlotId(event.target.value)}
              required
              value={slotId}
            >
              <option value="">Select an available time</option>
              {slots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {formatHospitalTime(slot.startAt)} – {formatHospitalTime(slot.endAt)}
                </option>
              ))}
            </select>
          </label>
          {doctorId && slots.length === 0 && <p className="muted">No unbooked future slots are available.</p>}
          <ErrorMessage error={error} />
          <button disabled={saving || !doctorId || !slotId || (
            recipient !== 'self' && !eligibleBeneficiaries.some(
              (item) => String(item.id ?? item.beneficiaryId) === recipient,
            )
          )} type="submit">
            {saving ? 'Booking…' : 'Book appointment'}
          </button>
        </form>
      </section>
    </div>
  );
}
