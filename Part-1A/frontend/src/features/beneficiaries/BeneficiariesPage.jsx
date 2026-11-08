import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { ErrorMessage, FieldErrors, Loading, StatusMessage } from '../../components/Feedback.jsx';

const RELATIONSHIPS = [
  'spouse',
  'parent',
  'child',
  'sibling',
  'other relative',
  'legal guardian',
  'other',
];

const EMPTY_BENEFICIARY = {
  fullName: '',
  dateOfBirth: '',
  relationship: 'child',
  relationshipDescription: '',
  gender: '',
  contactEmail: '',
  contactPhone: '',
};

function beneficiaryIsStatusOnly(beneficiary) {
  return beneficiary.authorizationStatus === 'PENDING_AUTHORIZATION'
    || beneficiary.authorizationStatus === 'REJECTED';
}

function displayStatus(beneficiary) {
  if (beneficiary.authorizationStatus === 'PENDING_AUTHORIZATION') {
    return 'Authorization review pending';
  }
  if (beneficiary.authorizationStatus === 'REJECTED') {
    return 'Authorization not approved';
  }
  if (beneficiary.authorizationStatus === 'AUTHORIZED') {
    return 'Authorized';
  }
  return 'Minor beneficiary';
}

export function BeneficiariesPage() {
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [values, setValues] = useState(EMPTY_BENEFICIARY);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  async function load() {
    try {
      setBeneficiaries(await api.get('/api/v1/beneficiaries'));
      setError(null);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.resolve().then(load);
  }, []);

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setError(null);
    setMessage('');
  }

  async function editBeneficiary(beneficiaryId) {
    setError(null);
    setMessage('');
    try {
      const item = await api.get(`/api/v1/beneficiaries/${beneficiaryId}`);
      setEditing(item.id);
      setValues({
        fullName: item.fullName,
        dateOfBirth: item.dateOfBirth,
        relationship: item.relationship,
        relationshipDescription: item.relationshipDescription ?? '',
        gender: item.gender ?? '',
        contactEmail: item.contactEmail ?? '',
        contactPhone: item.contactPhone ?? '',
      });
    } catch (requestError) {
      setError(requestError);
    }
  }

  function cancelEdit() {
    setEditing(null);
    setValues(EMPTY_BENEFICIARY);
    setError(null);
    setMessage('');
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage('');
    const body = {
      ...values,
      relationshipDescription: values.relationship === 'other'
        ? values.relationshipDescription
        : null,
      gender: values.gender || null,
      contactEmail: values.contactEmail || null,
      contactPhone: values.contactPhone || null,
    };
    try {
      if (editing) {
        await api.patch(`/api/v1/beneficiaries/${editing}`, body);
        setMessage('Beneficiary profile updated.');
      } else {
        await api.post('/api/v1/beneficiaries', body);
        setMessage('Beneficiary profile created.');
      }
      setValues(EMPTY_BENEFICIARY);
      setEditing(null);
      await load();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <p className="eyebrow">Family and caregivers</p>
        <h1>Beneficiaries</h1>
        <p className="muted">Manage profiles for people you are authorized to support. Adult profiles remain private until authorization is approved.</p>
        {loading ? <Loading label="Loading beneficiaries…" /> : (
          beneficiaries.length === 0
            ? <p className="empty-state">No beneficiaries have been added.</p>
            : (
              <ul className="record-list">
                {beneficiaries.map((item) => {
                  const statusOnly = beneficiaryIsStatusOnly(item);
                  return (
                    <li key={item.id ?? item.beneficiaryId} className="record-card">
                      {statusOnly ? (
                        <>
                          <h2>Adult beneficiary</h2>
                          <p>{displayStatus(item)}</p>
                          <p className="muted">
                            {item.authorizationStatus === 'PENDING_AUTHORIZATION'
                              ? 'Protected details and appointments are unavailable until hospital staff complete the review.'
                              : 'Protected details and appointments are not available for this beneficiary.'}
                          </p>
                        </>
                      ) : (
                        <>
                          <h2>{item.fullName}</h2>
                          <p>{displayStatus(item)} · {item.relationship}</p>
                          {item.dateOfBirth && <p>Date of birth: {item.dateOfBirth}</p>}
                          {item.authorizationStatus === 'AUTHORIZED' && (
                            <p className="muted">Authorization is approved; this profile can be managed.</p>
                          )}
                          <button
                            className="button-secondary"
                            onClick={() => editBeneficiary(item.id)}
                            type="button"
                          >
                            Edit profile
                          </button>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )
        )}
      </section>

      <section className="panel">
        <h2>{editing ? 'Update beneficiary' : 'Add a beneficiary'}</h2>
        <form onSubmit={submit}>
          <label>
            Full name
            <input
              maxLength={120}
              name="fullName"
              onChange={(event) => update('fullName', event.target.value)}
              required
              value={values.fullName}
            />
            <FieldErrors error={error} field="fullName" />
          </label>
          <label>
            Date of birth
            <input
              name="dateOfBirth"
              onChange={(event) => update('dateOfBirth', event.target.value)}
              required
              type="date"
              value={values.dateOfBirth}
            />
            <FieldErrors error={error} field="dateOfBirth" />
          </label>
          <label>
            Relationship
            <select
              name="relationship"
              onChange={(event) => update('relationship', event.target.value)}
              value={values.relationship}
            >
              {RELATIONSHIPS.map((relationship) => (
                <option key={relationship} value={relationship}>{relationship}</option>
              ))}
            </select>
            <FieldErrors error={error} field="relationship" />
          </label>
          {values.relationship === 'other' && (
            <label>
              Relationship description
              <input
                maxLength={120}
                name="relationshipDescription"
                onChange={(event) => update('relationshipDescription', event.target.value)}
                required
                value={values.relationshipDescription}
              />
              <FieldErrors error={error} field="relationshipDescription" />
            </label>
          )}
          <label>
            Gender (optional)
            <input
              maxLength={80}
              name="gender"
              onChange={(event) => update('gender', event.target.value)}
              value={values.gender}
            />
            <FieldErrors error={error} field="gender" />
          </label>
          <label>
            Contact email (optional)
            <input
              name="contactEmail"
              onChange={(event) => update('contactEmail', event.target.value)}
              type="email"
              value={values.contactEmail}
            />
            <FieldErrors error={error} field="contactEmail" />
          </label>
          <label>
            Contact phone (optional)
            <input
              maxLength={32}
              name="contactPhone"
              onChange={(event) => update('contactPhone', event.target.value)}
              type="tel"
              value={values.contactPhone}
            />
            <FieldErrors error={error} field="contactPhone" />
          </label>
          <ErrorMessage error={error} />
          <StatusMessage>{message}</StatusMessage>
          <div className="button-row">
            <button disabled={saving} type="submit">
              {saving ? 'Saving…' : editing ? 'Save beneficiary' : 'Add beneficiary'}
            </button>
            {editing && <button className="button-secondary" onClick={cancelEdit} type="button">Cancel edit</button>}
          </div>
        </form>
      </section>
    </div>
  );
}
