import { useEffect, useState } from 'react';
import { AuthProvider } from './app/AuthContext.jsx';
import { useAuth } from './app/useAuth.js';
import { isRouteAllowed, matchRoute, useRoute } from './app/useRoute.js';
import { ErrorMessage, Loading } from './components/Feedback.jsx';
import { AdminDashboardPage } from './features/admin/AdminDashboardPage.jsx';
import { DoctorProfilePage } from './features/admin/DoctorProfilePage.jsx';
import { StaffAppointmentsPage } from './features/admin/StaffAppointmentsPage.jsx';
import { AvailabilityPage } from './features/availability/AvailabilityPage.jsx';
import { AuthPage } from './features/auth/AuthPage.jsx';
import { BeneficiariesPage } from './features/beneficiaries/BeneficiariesPage.jsx';
import { DepartmentsPage } from './features/departments/DepartmentsPage.jsx';
import { DiscoveryPage } from './features/doctors/DiscoveryPage.jsx';
import { DoctorAppointmentsPage } from './features/appointments/DoctorAppointmentsPage.jsx';
import { PatientAppointmentsPage } from './features/appointments/PatientAppointmentsPage.jsx';
import { PatientProfilePage } from './features/patients/PatientProfilePage.jsx';
import './App.css';

const NAVIGATION = Object.freeze({
  PATIENT: [
    { path: '/profile', label: 'My profile' },
    { path: '/beneficiaries', label: 'Beneficiaries' },
    { path: '/discover', label: 'Find a doctor' },
    { path: '/departments', label: 'Departments' },
    { path: '/appointments', label: 'Appointments' },
  ],
  DOCTOR: [
    { path: '/doctor/profile', label: 'Professional profile' },
    { path: '/doctor/schedule', label: 'Availability' },
    { path: '/doctor/appointments', label: 'Worklist' },
    { path: '/departments', label: 'Departments' },
  ],
  STAFF: [
    { path: '/admin', label: 'Dashboard' },
    { path: '/departments', label: 'Departments' },
    { path: '/doctor/schedule', label: 'Availability' },
    { path: '/appointments', label: 'Appointments' },
  ],
});

function NavigationButton({ path, label, active, onNavigate }) {
  return (
    <button
      aria-current={active ? 'page' : undefined}
      className={`nav-link${active ? ' active' : ''}`}
      onClick={() => onNavigate(path)}
      type="button"
    >
      {label}
    </button>
  );
}

function HomePage({ account, navigate }) {
  if (!account) {
    return (
      <section className="hero-panel">
        <p className="eyebrow">Care, connected</p>
        <h1>Hospital care made easier to manage.</h1>
        <p className="hero-copy">A secure place to manage patient profiles, explore doctors and departments, and coordinate appointments for yourself and your family.</p>
        <div className="button-row">
          <button onClick={() => navigate('/login')} type="button">Sign in</button>
          <button className="button-secondary" onClick={() => navigate('/register')} type="button">Create patient account</button>
        </div>
        <button className="link-button" onClick={() => navigate('/departments')} type="button">Browse departments</button>
      </section>
    );
  }

  const firstLink = NAVIGATION[account.role]?.[0];
  return (
    <section className="hero-panel">
      <p className="eyebrow">{account.role.toLowerCase()} workspace</p>
      <h1>Welcome, {account.fullName}</h1>
      <p className="hero-copy">Choose a workspace to continue. Access to every protected action is checked by the hospital API.</p>
      <div className="button-row">
        {firstLink && <button onClick={() => navigate(firstLink.path)} type="button">Open {firstLink.label}</button>}
        {account.role === 'PATIENT' && <button className="button-secondary" onClick={() => navigate('/appointments')} type="button">Manage appointments</button>}
      </div>
    </section>
  );
}

function ProtectedMessage({ message, action, navigate }) {
  return (
    <section className="panel">
      <h1>{message}</h1>
      <p className="muted">Frontend access controls improve navigation only. The API remains authoritative for all protected data and actions.</p>
      {action && <button onClick={() => navigate(action.path)} type="button">{action.label}</button>}
    </section>
  );
}

function RouteContent({ route, account, navigate }) {
  if (route.page === 'home') {
    return <HomePage account={account} navigate={navigate} />;
  }
  if (route.page === 'login' || route.page === 'register') {
    return <AuthPage mode={route.page} navigate={navigate} />;
  }
  if (!account && route.roles) {
    return (
      <ProtectedMessage
        action={{ label: 'Sign in', path: '/login' }}
        message="Sign in to continue"
        navigate={navigate}
      />
    );
  }
  if (!isRouteAllowed(route, account)) {
    return <ProtectedMessage message="This workspace is not available for your role" navigate={navigate} />;
  }
  switch (route.page) {
    case 'profile':
      return <PatientProfilePage />;
    case 'beneficiaries':
      return <BeneficiariesPage />;
    case 'discover':
      return <DiscoveryPage />;
    case 'departments':
      return <DepartmentsPage />;
    case 'appointments':
      return account?.role === 'STAFF' ? <StaffAppointmentsPage /> : <PatientAppointmentsPage />;
    case 'doctor-profile':
      return <DoctorProfilePage />;
    case 'schedule':
      return <AvailabilityPage />;
    case 'doctor-appointments':
      return <DoctorAppointmentsPage />;
    case 'admin':
      return <AdminDashboardPage navigate={navigate} />;
    default:
      return <ProtectedMessage message="Page not found" navigate={navigate} />;
  }
}

function Application() {
  const { account, status, error, logout, restore } = useAuth();
  const { path, navigate } = useRoute();
  const [logoutError, setLogoutError] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const route = matchRoute(path);

  useEffect(() => {
    if (account && (route.page === 'login' || route.page === 'register')) {
      navigate('/', { replace: true });
    }
  }, [account, route.page, navigate]);

  async function signOut() {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
      navigate('/', { replace: true });
    } catch (requestError) {
      setLogoutError(requestError);
    } finally {
      setLoggingOut(false);
    }
  }

  if (status === 'loading') {
    return <main className="loading-screen"><Loading label="Restoring your secure session…" /></main>;
  }
  if (status === 'error') {
    return (
      <main className="loading-screen">
        <h1>Session could not be restored</h1>
        <ErrorMessage error={error} />
        <button onClick={restore} type="button">Try again</button>
      </main>
    );
  }

  const navigation = account ? NAVIGATION[account.role] ?? [] : [];
  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => navigate('/')} type="button">
          <span className="brand-mark" aria-hidden="true">H</span>
          <span>HMS <small>Hospital Management</small></span>
        </button>
        <div className="account-actions">
          {account ? (
            <>
              <span className="account-summary">{account.fullName} <small>{account.role.toLowerCase()}</small></span>
              <button className="button-secondary" disabled={loggingOut} onClick={signOut} type="button">
                {loggingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </>
          ) : (
            <>
              <button className="link-button" onClick={() => navigate('/login')} type="button">Sign in</button>
              <button onClick={() => navigate('/register')} type="button">Create account</button>
            </>
          )}
        </div>
      </header>
      {account && (
        <nav className="primary-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <NavigationButton
              active={path === item.path}
              key={item.path}
              label={item.label}
              onNavigate={navigate}
              path={item.path}
            />
          ))}
        </nav>
      )}
      <main className="main-content">
        {logoutError && <ErrorMessage error={logoutError} />}
        <RouteContent account={account} navigate={navigate} route={route} />
      </main>
      <footer className="site-footer">
        <span>Hospital Management System</span>
        <span>Private, role-scoped access · Your care information stays protected</span>
      </footer>
    </div>
  );
}

export default function App({ client }) {
  return (
    <AuthProvider client={client}>
      <Application />
    </AuthProvider>
  );
}
