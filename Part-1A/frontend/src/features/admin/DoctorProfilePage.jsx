import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { ErrorMessage, Loading, StatusMessage } from '../../components/Feedback.jsx';

export function DoctorProfilePage() {
  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/api/v1/doctors/me').then(
      (data) => {
        if (active) {
          setProfile(data);
          setSummary(data.professionalSummary ?? '');
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
  }, []);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage('');
    try {
      const result = await api.patch('/api/v1/doctors/me', { professionalSummary: summary || null });
      setProfile(result);
      setSummary(result.professionalSummary ?? '');
      setMessage('Your professional profile was saved.');
    } catch (requestError) {
      setError(requestError);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Loading label="Loading your professional profile…" />;
  }
  if (!profile) {
    return <ErrorMessage error={error} />;
  }

  return (
    <section className="panel">
      <p className="eyebrow">Doctor workspace</p>
      <h1>{profile.professionalName}</h1>
      <p><strong>Specializations:</strong> {profile.specializations.map((item) => item.name).join(', ') || 'Not listed'}</p>
      <p><strong>Departments:</strong> {profile.departments.map((item) => item.name).join(', ') || 'Not listed'}</p>
      <form onSubmit={submit}>
        <label>
          Professional summary
          <textarea
            maxLength={2000}
            onChange={(event) => setSummary(event.target.value)}
            value={summary}
          />
        </label>
        <p className="muted">Only your professional summary can be changed through this profile.</p>
        <ErrorMessage error={error} />
        <StatusMessage>{message}</StatusMessage>
        <button disabled={saving} type="submit">{saving ? 'Saving…' : 'Save professional profile'}</button>
      </form>
    </section>
  );
}
