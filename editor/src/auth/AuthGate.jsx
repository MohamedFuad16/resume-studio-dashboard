// AuthGate — renders the app only when a user is signed in.
//
// While Firebase resolves the persisted session we show a spinner. When no user
// is present we show LoginScreen. Once signed in we run a one-time Firestore seed
// (ensureSeed) so the user always has at least one profile before App mounts and
// starts loading profile data. When auth is unavailable (config stripped in some
// future env, or VITE_AUTH_DISABLED) we fall through to the app unchanged,
// preserving the pre-auth no-login behavior and keeping App's hook order intact.
import { useState, useEffect } from 'react';
import { useAuth } from './useAuth.js';
import { ensureSeed } from '../data/firestoreData.js';
import LoginScreen from '../components/LoginScreen.jsx';
import AppSkeleton from '../components/AppSkeleton.jsx';

// Set while someone is signed in on this browser, so the next visit can show the
// app's outline straight away instead of a spinner. A first visit (no hint) keeps
// the plain spinner, because that visitor is about to see the login screen.
const SIGNED_IN_HINT = 'internship-portal:signed-in';
const hadSession = () => { try { return localStorage.getItem(SIGNED_IN_HINT) === '1'; } catch { return false; } };

function Spinner() {
  return (
    <div className="loading">
      <div className="spinner" />
      <span>Loading…</span>
    </div>
  );
}

export default function AuthGate({ children }) {
  const { authAvailable, user, loading } = useAuth();
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (loading) return;
    try {
      if (user) localStorage.setItem(SIGNED_IN_HINT, '1');
      else localStorage.removeItem(SIGNED_IN_HINT);
    } catch { /* private mode */ }
  }, [loading, user]);

  useEffect(() => {
    if (!authAvailable || !user) return;
    let cancelled = false;
    setSeeding(true);
    ensureSeed(user)
      .catch(() => {}) // non-fatal: App will surface an empty profile list
      .finally(() => { if (!cancelled) { setSeeding(false); setSeeded(true); } });
    return () => { cancelled = true; };
  }, [authAvailable, user]);

  if (!authAvailable) return children;
  if (loading) return hadSession() ? <AppSkeleton /> : <Spinner />;
  if (!user) return <LoginScreen />;
  if (seeding || !seeded) return <AppSkeleton />;
  return children;
}
