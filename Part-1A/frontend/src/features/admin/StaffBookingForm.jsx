import { useState } from 'react';
import { api } from '../../api/client.js';
import { ErrorMessage, StatusMessage } from '../../components/Feedback.jsx';
import { formatHospitalTime } from '../shared/time.js';

export function StaffBookingForm() {
  const [values, setValues] = useState({
    responsibleAccountId: '',
    doctorAccountId: '',
    slotId: '',
    recipientType: 'PATIENT',
    beneficiaryId: '',
  });
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [canBook, setCanBook] = useState(true);

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setError(null);
    setMessage('');
  }

  async function loadSlots(event) {
    event.preventDefault();
    setLoadingSlots(true);
    setError(null);
    try {
      const result = await api.get(
        `/api/v1/doctors/${values.doctorAccountId}/availability?page=1&pageSize=50`,
      );
      setSlots(result.items.filter((slot) => (
        !slot.isBooked && Date.parse(slot.startAt) > Date.now()
      )));
      setValues((current) => ({ ...current, slotId: '' }));
    } catch (requestError) {
      if (requestError.code === 'FORBIDDEN') {
        setCanBook(false);
      }
      setError(requestError);
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  async function book(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage('');
    try {
      const appointment = await api.post('/api/v1/appointments', {
        doctorAccountId: Number(values.doctorAccountId),
        availabilitySlotId: Number(values.slotId),
        responsibleAccountId: Number(values.responsibleAccountId),
        ...(values.recipientType === 'PATIENT'
          ? { patientRecipientAccountId: Number(values.responsibleAccountId) }
          : { beneficiaryId: Number(values.beneficiaryId) }),
      });
      setMessage('Appointment booked. The server confirmed the change.');
      setValues((current) => ({ ...current, slotId: '' }));
      setSlots((current) => current.filter((slot) => slot.id !== appointment.availabilitySlotId));
    } catch (requestError) {
      if (requestError.code === 'FORBIDDEN') {
        setCanBook(false);
      }
      setError(requestError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="subsection">
      <h2>Book for a patient</h2>
      <p className="muted">Enter a responsible patient account ID. The server verifies all staff permissions and patient ownership.</p>
      {!canBook && <p className="muted">Booking controls are hidden because the API denied this permission.</p>}
      {canBook && (
        <>
      <form className="filter-form" onSubmit={loadSlots}>
        <label>
          Responsible patient account ID
          <input
            inputMode="numeric"
            name="responsibleAccountId"
            onChange={(event) => update('responsibleAccountId', event.target.value)}
            required
            value={values.responsibleAccountId}
          />
        </label>
        <label>
          Doctor account ID
          <input
            inputMode="numeric"
            name="doctorAccountId"
            onChange={(event) => update('doctorAccountId', event.target.value)}
            required
            value={values.doctorAccountId}
          />
        </label>
        <button disabled={loadingSlots} type="submit">
          {loadingSlots ? 'Loading…' : 'Find available slots'}
        </button>
      </form>
      {slots.length > 0 && (
        <form onSubmit={book}>
          <label>
            Recipient
            <select
              name="recipientType"
              onChange={(event) => update('recipientType', event.target.value)}
              value={values.recipientType}
            >
              <option value="PATIENT">Responsible patient</option>
              <option value="BENEFICIARY">Beneficiary</option>
            </select>
          </label>
          {values.recipientType === 'BENEFICIARY' && (
            <label>
              Beneficiary ID
              <input
                inputMode="numeric"
                name="beneficiaryId"
                onChange={(event) => update('beneficiaryId', event.target.value)}
                required
                value={values.beneficiaryId}
              />
            </label>
          )}
          <label>
            Available time
            <select
              name="slotId"
              onChange={(event) => update('slotId', event.target.value)}
              required
              value={values.slotId}
            >
              <option value="">Select a slot</option>
              {slots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {formatHospitalTime(slot.startAt)} – {formatHospitalTime(slot.endAt)}
                </option>
              ))}
            </select>
          </label>
          <button disabled={saving || !values.slotId} type="submit">
            {saving ? 'Booking…' : 'Book for patient'}
          </button>
        </form>
      )}
      {!loadingSlots && values.doctorAccountId && slots.length === 0 && (
        <p className="muted">No unbooked future slots are available to display.</p>
      )}
        </>
      )}
      <ErrorMessage error={error} />
      <StatusMessage>{message}</StatusMessage>
    </section>
  );
}
