// useHashRoute — the app has no router, so the few public pages that need their
// own URL (Terms, Privacy) are addressed by hash. Returns the current hash with
// the leading '#' stripped ('' when there is none).
import { useState, useEffect } from 'react';

export function currentHashRoute() {
  return window.location.hash.replace(/^#/, '');
}

export function useHashRoute() {
  const [route, setRoute] = useState(currentHashRoute);

  useEffect(() => {
    const onChange = () => setRoute(currentHashRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}
