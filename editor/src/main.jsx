import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import AuthGate from './auth/AuthGate.jsx';
import LegalPage from './components/LegalPage.jsx';
import { useHashRoute } from './hooks/useHashRoute.js';

// Terms and Privacy sit above AuthGate: they are public documents linked from the
// login page, so they must render whether or not anyone is signed in.
const LEGAL_ROUTES = ['terms', 'privacy'];

function Root() {
  const route = useHashRoute();

  if (LEGAL_ROUTES.includes(route)) return <LegalPage doc={route} />;

  return (
    <AuthGate>
      <App />
    </AuthGate>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
