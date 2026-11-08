import { useCallback, useEffect, useState } from 'react';

export function useRoute() {
  const [path, setPath] = useState(() => globalThis.location?.pathname ?? '/');

  useEffect(() => {
    const updatePath = () => setPath(globalThis.location.pathname);
    globalThis.addEventListener('popstate', updatePath);
    return () => globalThis.removeEventListener('popstate', updatePath);
  }, []);

  const navigate = useCallback((nextPath, { replace = false } = {}) => {
    if (replace) {
      globalThis.history.replaceState({}, '', nextPath);
    } else {
      globalThis.history.pushState({}, '', nextPath);
    }
    setPath(nextPath);
  }, []);

  return { path, navigate };
}

export function matchRoute(path) {
  const routes = [
    { path: '/', page: 'home' },
    { path: '/login', page: 'login' },
    { path: '/register', page: 'register' },
    { path: '/profile', page: 'profile', roles: ['PATIENT'] },
    { path: '/beneficiaries', page: 'beneficiaries', roles: ['PATIENT'] },
    { path: '/discover', page: 'discover', roles: ['PATIENT'] },
    { path: '/departments', page: 'departments' },
    { path: '/appointments', page: 'appointments', roles: ['PATIENT', 'STAFF'] },
    { path: '/doctor/profile', page: 'doctor-profile', roles: ['DOCTOR'] },
    { path: '/doctor/schedule', page: 'schedule', roles: ['DOCTOR', 'STAFF'] },
    { path: '/doctor/appointments', page: 'doctor-appointments', roles: ['DOCTOR'] },
    { path: '/admin', page: 'admin', roles: ['STAFF'] },
  ];
  return routes.find((route) => route.path === path)
    ?? { path: '/not-found', page: 'not-found' };
}

export function isRouteAllowed(route, account) {
  return !route.roles || route.roles.includes(account?.role);
}
