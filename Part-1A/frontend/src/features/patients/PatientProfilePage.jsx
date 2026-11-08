import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../app/useAuth.js';
import { ErrorMessage, FieldErrors, Loading, StatusMessage } from '../../components/Feedback.jsx';

const EMPTY_PROFILE = {
  dateOfBirth: '',
  gender: '',
  contactEmail: '',
  contactPhone: '',
};

function toFormValue(value) {
  return value ?? '';
}

export function PatientProfilePage() {
  const { account } = useAuth();
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    api.get(`/api/v1/patients/${account.accountId}`).then(
      (data) => {
        if (active) {
          setProfile({
            dateOfBirth: toFormValue(data.dateOfBirth),
            gender: toFormValue(data.gender),
            contactEmail: toFormValue(data.contactEmail),
            contactPhone: toFormValue(data.contactPhone),
          });
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
  }, [account.accountId]);

  function update(field, value) {
    setProfile((current) => ({ ...current, [field]: value }));
    setError(null);
    setMessage('');
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage('');
    try {
      const updated = await api.patch(`/api/v1/patients/${account.accountId}`, {
        dateOfBirth: profile.dateOfBirth || null,
        gender: profile.gender || null,
        contactEmail: profile.contactEmail || null,
        contactPhone: profile.contactPhone || null,
      });
      setProfile({
        dateOfBirth: toFormValue(updated.dateOfBirth),
        gender: toFormValue(updated.gender),
        contactEmail: toFormValue(updated.contactEmail),
        contactPhone: toFormValue(updated.contactPhone),
      });
      setMessage('Your profile was saved.');
    } catch (requestError) {
      setError(requestError);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Loading label="Loading your profile…" />;
  }

  return (
    <section className="panel">
      <p className="eyebrow">Patient account</p>
      <h1>Your profile</h1>
      <p className="muted">Update permitted profile information. Your account identity cannot be changed here.</p>
      <dl className="identity-list">
        <div><dt>Name</dt><dd>{account.fullName}</dd></div>
        <div><dt>Account email</dt><dd>{account.email}</dd></div>
      </dl>
      <form onSubmit={submit}>
        <label>
          Date of birth
          <input
            name="dateOfBirth"
            onChange={(event) => update('dateOfBirth', event.target.value)}
            type="date"
            value={profile.dateOfBirth}
          />
          <FieldErrors error={error} field="dateOfBirth" />
        </label>
        <label>
          Gender
          <input
            maxLength={80}
            name="gender"
            onChange={(event) => update('gender', event.target.value)}
            value={profile.gender}
          />
          <FieldErrors error={error} field="gender" />
        </label>
        <label>
          Contact email
          <input
            autoComplete="email"
            name="contactEmail"
            onChange={(event) => update('contactEmail', event.target.value)}
            type="email"
            value={profile.contactEmail}
          />
          <FieldErrors error={error} field="contactEmail" />
        </label>
        <label>
          Contact phone
          <input
            autoComplete="tel"
            maxLength={32}
            name="contactPhone"
            onChange={(event) => update('contactPhone', event.target.value)}
            type="tel"
            value={profile.contactPhone}
          />
          <FieldErrors error={error} field="contactPhone" />
        </label>
        <ErrorMessage error={error} />
        <StatusMessage>{message}</StatusMessage>
        <button disabled={saving} type="submit">{saving ? 'Saving…' : 'Save profile'}</button>
      </form>
    </section>
  );
}
