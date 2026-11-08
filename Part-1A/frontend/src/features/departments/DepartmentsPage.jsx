import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../app/useAuth.js';
import { ErrorMessage, FieldErrors, Loading, StatusMessage } from '../../components/Feedback.jsx';

const EMPTY_FORM = { name: '', description: '' };

function parseDoctorIds(value) {
  if (!value.trim()) {
    return [];
  }
  return value.split(',').map((id) => Number(id.trim()));
}

export function DepartmentsPage() {
  const { account } = useAuth();
  const isStaff = account.role === 'STAFF';
  const [departments, setDepartments] = useState([]);
  const [values, setValues] = useState(EMPTY_FORM);
  const [edits, setEdits] = useState({});
  const [doctorLists, setDoctorLists] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [canManage, setCanManage] = useState(isStaff);

  async function load() {
    try {
      const items = await api.get('/api/v1/departments');
      setDepartments(items);
      setEdits(Object.fromEntries(items.map((item) => [
        item.id,
        { name: item.name, description: item.description ?? '' },
      ])));
      setDoctorLists(Object.fromEntries(items.map((item) => [
        item.id,
        item.doctors.map((doctor) => doctor.accountId).join(', '),
      ])));
      setError(null);
    } catch (requestError) {
      if (requestError.code === 'FORBIDDEN') {
        setCanManage(false);
      }
      setError(requestError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.resolve().then(load);
  }, []);

  async function createDepartment(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage('');
    try {
      await api.post('/api/v1/departments', {
        name: values.name,
        description: values.description || null,
      });
      setValues(EMPTY_FORM);
      setMessage('Department created.');
      await load();
    } catch (requestError) {
      if (requestError.code === 'FORBIDDEN') {
        setCanManage(false);
      }
      setError(requestError);
    } finally {
      setSaving(false);
    }
  }

  async function saveDepartment(departmentId) {
    setSaving(true);
    setError(null);
    setMessage('');
    try {
      await api.patch(`/api/v1/departments/${departmentId}`, edits[departmentId]);
      const doctorAccountIds = parseDoctorIds(doctorLists[departmentId] ?? '');
      if (doctorAccountIds.some((id) => !Number.isSafeInteger(id) || id < 1)) {
        throw new Error('Enter comma-separated positive doctor account IDs.');
      }
      await api.put(`/api/v1/departments/${departmentId}/doctors`, { doctorAccountIds });
      setMessage('Department changes saved.');
      await load();
    } catch (requestError) {
      if (requestError.code === 'FORBIDDEN') {
        setCanManage(false);
      }
      setError(requestError);
      await load();
    } finally {
      setSaving(false);
    }
  }

  function updateForm(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setError(null);
    setMessage('');
  }

  function updateDepartment(departmentId, field, value) {
    setEdits((current) => ({
      ...current,
      [departmentId]: { ...current[departmentId], [field]: value },
    }));
    setError(null);
    setMessage('');
  }

  return (
    <section className="panel">
      <p className="eyebrow">Hospital directory</p>
      <h1>Departments</h1>
      <p className="muted">Browse hospital departments and their associated professional teams.</p>
      <ErrorMessage error={error} />
      {loading ? <Loading label="Loading departments…" /> : departments.length === 0 ? (
        <p className="empty-state">No departments are currently listed.</p>
      ) : (
        <ul className="record-list">
          {departments.map((department) => (
            <li className="record-card" key={department.id}>
              {isStaff && canManage ? (
                <>
                  <label>
                    Department name
                    <input
                      onChange={(event) => updateDepartment(department.id, 'name', event.target.value)}
                      value={edits[department.id]?.name ?? ''}
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      onChange={(event) => updateDepartment(department.id, 'description', event.target.value)}
                      value={edits[department.id]?.description ?? ''}
                    />
                  </label>
                  <label>
                    Doctor account IDs
                    <input
                      aria-describedby={`doctor-association-${department.id}`}
                      onChange={(event) => setDoctorLists((current) => ({
                        ...current,
                        [department.id]: event.target.value,
                      }))}
                      value={doctorLists[department.id] ?? ''}
                    />
                    <small id={`doctor-association-${department.id}`}>
                      Enter comma-separated existing doctor account IDs. Updates are validated by the server.
                    </small>
                  </label>
                  <button disabled={saving} onClick={() => saveDepartment(department.id)} type="button">
                    Save department
                  </button>
                </>
              ) : (
                <>
                  <h2>{department.name}</h2>
                  {department.description && <p>{department.description}</p>}
                </>
              )}
              <p><strong>Doctors:</strong> {department.doctors.map((doctor) => doctor.professionalName).join(', ') || 'No doctors assigned'}</p>
            </li>
          ))}
        </ul>
      )}
      {isStaff && canManage && (
        <div className="subsection">
          <h2>Create a department</h2>
          <form onSubmit={createDepartment}>
            <label>
              Name
              <input
                maxLength={120}
                onChange={(event) => updateForm('name', event.target.value)}
                required
                value={values.name}
              />
              <FieldErrors error={error} field="name" />
            </label>
            <label>
              Description
              <textarea
                maxLength={1000}
                onChange={(event) => updateForm('description', event.target.value)}
                value={values.description}
              />
              <FieldErrors error={error} field="description" />
            </label>
            <button disabled={saving} type="submit">{saving ? 'Saving…' : 'Create department'}</button>
          </form>
        </div>
      )}
      <StatusMessage>{message}</StatusMessage>
    </section>
  );
}
