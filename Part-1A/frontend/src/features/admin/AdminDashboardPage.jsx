import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { ErrorMessage, Loading, StatusMessage } from '../../components/Feedback.jsx';
import { StaffBookingForm } from './StaffBookingForm.jsx';

const SECTION_ROUTES = Object.freeze({
  patients: '/admin',
  doctors: '/admin',
  departments: '/departments',
  appointments: '/appointments',
  availability: '/doctor/schedule',
});

export function AdminDashboardPage({ navigate }) {
  const [dashboard, setDashboard] = useState(null);
  const [patients, setPatients] = useState(null);
  const [doctorForm, setDoctorForm] = useState({
    email: '',
    password: '',
    professionalName: '',
    professionalSummary: '',
    departmentIds: '',
    specializationIds: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [canViewPatients, setCanViewPatients] = useState(true);
  const [canManageDoctors, setCanManageDoctors] = useState(true);

  useEffect(() => {
    let active = true;
    api.get('/api/v1/admin/dashboard').then(
      (data) => {
        if (active) {
          setDashboard(data);
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

  async function loadPatients() {
    setError(null);
    try {
      const result = await api.get('/api/v1/admin/patients?page=1&pageSize=20');
      setPatients(result.items);
    } catch (requestError) {
      if (requestError.code === 'FORBIDDEN') {
        setCanViewPatients(false);
      }
      setError(requestError);
    }
  }

  async function provisionDoctor(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage('');
    const parseIds = (value) => value.split(',').map((item) => Number(item.trim()));
    try {
      await api.post('/api/v1/doctors', {
        email: doctorForm.email,
        password: doctorForm.password,
        professionalName: doctorForm.professionalName,
        professionalSummary: doctorForm.professionalSummary || null,
        departmentIds: parseIds(doctorForm.departmentIds),
        specializationIds: parseIds(doctorForm.specializationIds),
      });
      setDoctorForm({
        email: '',
        password: '',
        professionalName: '',
        professionalSummary: '',
        departmentIds: '',
        specializationIds: '',
      });
      setMessage('Doctor account provisioned.');
    } catch (requestError) {
      if (requestError.code === 'FORBIDDEN') {
        setCanManageDoctors(false);
      }
      setError(requestError);
    } finally {
      setSaving(false);
    }
  }

  function updateDoctor(field, value) {
    setDoctorForm((current) => ({ ...current, [field]: value }));
    setError(null);
    setMessage('');
  }

  if (loading) {
    return <Loading label="Loading staff dashboard…" />;
  }
  if (!dashboard) {
    return (
      <section className="panel">
        <h1>Staff dashboard</h1>
        <ErrorMessage error={error} />
        <p className="muted">Access is checked by the server for every administrative operation.</p>
      </section>
    );
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <p className="eyebrow">Hospital administration</p>
        <h1>Staff dashboard</h1>
        <p className="muted">Essential operational views only. Each linked API operation applies its own permission checks.</p>
        <ul className="link-list">
          {dashboard.sections.map((section) => (
            <li key={section.key}>
              {SECTION_ROUTES[section.key] ? (
                <button className="link-button" onClick={() => navigate(SECTION_ROUTES[section.key])} type="button">
                  {section.key === 'beneficiaryAuthorization'
                    ? 'Beneficiary authorization (staff review endpoint)'
                    : section.key[0].toUpperCase() + section.key.slice(1)}
                </button>
              ) : <span>{section.key}</span>}
            </li>
          ))}
        </ul>
        {canViewPatients && (
          <button className="button-secondary" onClick={loadPatients} type="button">View patient directory</button>
        )}
        {patients && (
          <div className="subsection" id="patients">
            <h2>Patients</h2>
            {patients.length === 0 ? <p className="empty-state">No patients are registered.</p> : (
              <ul className="record-list">
                {patients.map((patient) => (
                  <li className="record-card" key={patient.patientAccountId}>
                    <h3>{patient.fullName}</h3>
                    <p>Patient account #{patient.patientAccountId}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {canManageDoctors && <section className="panel" id="doctors">
        <h2>Provision a doctor account</h2>
        <p className="muted">Use a work email and a temporary password. Department and specialization IDs must already exist; the API validates authorization and all references.</p>
        <form onSubmit={provisionDoctor}>
          <label>
            Professional name
            <input maxLength={120} onChange={(event) => updateDoctor('professionalName', event.target.value)} required value={doctorForm.professionalName} />
          </label>
          <label>
            Work email
            <input onChange={(event) => updateDoctor('email', event.target.value)} required type="email" value={doctorForm.email} />
          </label>
          <label>
            Initial password
            <input autoComplete="new-password" minLength={12} onChange={(event) => updateDoctor('password', event.target.value)} required type="password" value={doctorForm.password} />
            <small>At least 12 characters. It is sent only to the API and is never displayed after submission.</small>
          </label>
          <label>
            Professional summary
            <textarea maxLength={2000} onChange={(event) => updateDoctor('professionalSummary', event.target.value)} value={doctorForm.professionalSummary} />
          </label>
          <label>
            Department IDs (comma-separated)
            <input onChange={(event) => updateDoctor('departmentIds', event.target.value)} placeholder="1, 2" required value={doctorForm.departmentIds} />
          </label>
          <label>
            Specialization IDs (comma-separated)
            <input onChange={(event) => updateDoctor('specializationIds', event.target.value)} placeholder="1" required value={doctorForm.specializationIds} />
          </label>
          <ErrorMessage error={error} />
          <StatusMessage>{message}</StatusMessage>
          <button disabled={saving} type="submit">{saving ? 'Provisioning…' : 'Provision doctor'}</button>
        </form>
      </section>}
      <section className="panel">
        <h2>Administrative appointment actions</h2>
        <p>Book for a patient or cancel an appointment when the account has the corresponding permission.</p>
        <button onClick={() => navigate('/appointments')} type="button">Open appointment management</button>
        <StaffBookingForm />
      </section>
    </div>
  );
}
