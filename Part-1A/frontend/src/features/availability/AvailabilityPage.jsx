import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../app/useAuth.js';
import { ErrorMessage, Loading, StatusMessage } from '../../components/Feedback.jsx';
import { formatHospitalTime, HOSPITAL_TIME_ZONE, isHospitalTimeZoneConfigured } from '../shared/time.js';

const PAGE_SIZE = 50;

export function AvailabilityPage() {
  const { account } = useAuth();
  const isDoctor = account.role === 'DOCTOR';
  const [doctorId, setDoctorId] = useState(isDoctor ? String(account.accountId) : '');
  const [submittedDoctorId, setSubmittedDoctorId] = useState(isDoctor ? String(account.accountId) : '');
  const [schedule, setSchedule] = useState({ items: [], total: 0, page: 1 });
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ startAt: '', endAt: '' });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(Boolean(isDoctor));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [canManage, setCanManage] = useState(true);

  useEffect(() => {
    if (!submittedDoctorId) {
      return undefined;
    }
    let active = true;
    api.get(`/api/v1/doctors/${submittedDoctorId}/availability?page=${page}&pageSize=${PAGE_SIZE}`).then(
      (data) => {
        if (active) {
          setSchedule(data);
          setLoading(false);
          setError(null);
        }
      },
      (requestError) => {
        if (active) {
          if (requestError.code === 'FORBIDDEN') {
            setCanManage(false);
          }
          setError(requestError);
          setLoading(false);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [submittedDoctorId, page]);

  function submitDoctor(event) {
    event.preventDefault();
    setLoading(true);
    setPage(1);
    setSubmittedDoctorId(doctorId.trim());
  }

  async function refreshSchedule() {
    const data = await api.get(`/api/v1/doctors/${submittedDoctorId}/availability?page=${page}&pageSize=${PAGE_SIZE}`);
    setSchedule(data);
  }

  async function saveSlot(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage('');
    try {
      if (editingId) {
        await api.patch(`/api/v1/doctors/${submittedDoctorId}/availability/${editingId}`, form);
      } else {
        await api.post(`/api/v1/doctors/${submittedDoctorId}/availability`, form);
      }
      setForm({ startAt: '', endAt: '' });
      setEditingId(null);
      setMessage('Availability was saved.');
      await refreshSchedule();
    } catch (requestError) {
      if (requestError.code === 'FORBIDDEN') {
        setCanManage(false);
      }
      setError(requestError);
    } finally {
      setSaving(false);
    }
  }

  async function removeSlot(slotId) {
    if (!globalThis.confirm('Remove this availability slot?')) {
      return;
    }
    setError(null);
    setMessage('');
    try {
      await api.delete(`/api/v1/doctors/${submittedDoctorId}/availability/${slotId}`);
      setMessage('Availability was removed.');
      await refreshSchedule();
    } catch (requestError) {
      if (requestError.code === 'FORBIDDEN') {
        setCanManage(false);
      }
      setError(requestError);
    }
  }

  function startEdit(slot) {
    setEditingId(slot.id);
    setForm({ startAt: slot.startAt, endAt: slot.endAt });
    setError(null);
    setMessage('');
  }

  return (
    <div className="page-grid">
      {!isDoctor && (
        <section className="panel">
          <h1>Doctor schedule</h1>
          <form className="filter-form" onSubmit={submitDoctor}>
            <label>
              Doctor account ID
              <input
                inputMode="numeric"
                onChange={(event) => setDoctorId(event.target.value)}
                required
                value={doctorId}
              />
            </label>
            <button type="submit">View schedule</button>
          </form>
          <p className="muted">Schedule access is checked by the server for every request.</p>
        </section>
      )}
      {submittedDoctorId && (
        <>
          <section className="panel">
            <p className="eyebrow">Schedule</p>
            <h1>Availability</h1>
            {isHospitalTimeZoneConfigured
              ? <p className="muted">Times shown in {HOSPITAL_TIME_ZONE}. Enter ISO 8601 times with an explicit valid offset.</p>
              : <p className="feedback warning">Set VITE_HOSPITAL_TIME_ZONE to display hospital-local times. Current display is UTC.</p>}
            <ErrorMessage error={error} />
            {loading ? <Loading label="Loading schedule…" /> : schedule.items.length === 0 ? (
              <p className="empty-state">No availability slots are listed for this page.</p>
            ) : (
              <>
                <ul className="record-list">
                  {schedule.items.map((slot) => (
                    <li className="record-card" key={slot.id}>
                      <p><strong>{formatHospitalTime(slot.startAt)}</strong></p>
                      <p>Ends {formatHospitalTime(slot.endAt)}</p>
                      <p>{slot.isBooked ? 'Booked' : 'Available'}</p>
                      {!slot.isBooked && canManage && (
                        <div className="button-row">
                          <button className="button-secondary" onClick={() => startEdit(slot)} type="button">Edit</button>
                          <button className="button-danger" onClick={() => removeSlot(slot.id)} type="button">Remove</button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="pagination">
                  <button className="button-secondary" disabled={page <= 1} onClick={() => {
                    setLoading(true);
                    setPage((current) => current - 1);
                  }} type="button">Previous</button>
                  <span>{schedule.total} slots · page {page}</span>
                  <button className="button-secondary" disabled={page * PAGE_SIZE >= schedule.total} onClick={() => {
                    setLoading(true);
                    setPage((current) => current + 1);
                  }} type="button">Next</button>
                </div>
              </>
            )}
          </section>
          {canManage && <section className="panel">
            <h2>{editingId ? 'Edit slot' : 'Add availability'}</h2>
            <p className="muted">Use a full timestamp such as 2026-12-01T09:00:00-05:00. The API validates the offset against hospital time.</p>
            <form onSubmit={saveSlot}>
              <label>
                Starts at
                <input
                  onChange={(event) => setForm((current) => ({ ...current, startAt: event.target.value }))}
                  placeholder="2026-12-01T09:00:00-05:00"
                  required
                  value={form.startAt}
                />
              </label>
              <label>
                Ends at
                <input
                  onChange={(event) => setForm((current) => ({ ...current, endAt: event.target.value }))}
                  placeholder="2026-12-01T09:30:00-05:00"
                  required
                  value={form.endAt}
                />
              </label>
              <ErrorMessage error={error} />
              <StatusMessage>{message}</StatusMessage>
              <div className="button-row">
                <button disabled={saving} type="submit">{saving ? 'Saving…' : editingId ? 'Save slot' : 'Create slot'}</button>
                {editingId && <button className="button-secondary" onClick={() => {
                  setEditingId(null);
                  setForm({ startAt: '', endAt: '' });
                }} type="button">Cancel edit</button>}
              </div>
            </form>
          </section>}
        </>
      )}
    </div>
  );
}
