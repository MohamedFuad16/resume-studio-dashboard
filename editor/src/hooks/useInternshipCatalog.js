import { useCallback, useEffect, useState } from 'react';
import { internshipApi } from '../api/client.js';

export const CATALOG_EVENT = 'resume-studio:internship-catalog-change';
const EMPTY_META = { target: 200, researchDate: '', lastCheckedDate: '', researchNote: '', count: 0 };
// Module-level cache shared across all mounts. This is intentional and safe: the
// internship catalog is GLOBAL (profile-independent) — matching/ranking is applied
// per-profile downstream (utils/internshipRanking, the tracker), not baked into the
// catalog — so it never needs invalidating on a profile switch. It IS refreshed on an
// explicit CATALOG_EVENT (e.g. after adding a live-researched company).
let catalogSnapshot = null;
let catalogRequest = null;

function normalizeCatalog(items) {
  const seenIds = new Set();
  return (Array.isArray(items) ? items : []).filter(item => {
    if (!item?.id || seenIds.has(item.id)) return false;
    seenIds.add(item.id);
    return true;
  });
}

async function loadCatalog({ force = false } = {}) {
  if (!force && catalogSnapshot) return catalogSnapshot;
  if (!force && catalogRequest) return catalogRequest;
  catalogRequest = internshipApi.list()
    .then(payload => {
      catalogSnapshot = {
        catalog: normalizeCatalog(payload.items),
        meta: { ...EMPTY_META, ...(payload.meta || {}) },
      };
      return catalogSnapshot;
    })
    .finally(() => { catalogRequest = null; });
  return catalogRequest;
}

export function notifyCatalogChange() {
  window.dispatchEvent(new CustomEvent(CATALOG_EVENT));
}

export function useInternshipCatalog() {
  const [state, setState] = useState(() => catalogSnapshot || { catalog: [], meta: EMPTY_META });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async ({ force = true } = {}) => {
    try {
      setError('');
      setState(await loadCatalog({ force }));
    } catch (fetchError) {
      setError(fetchError.message || 'Could not load internships');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh({ force: false });
    const onCatalogChange = () => refresh({ force: true });
    window.addEventListener(CATALOG_EVENT, onCatalogChange);
    return () => window.removeEventListener(CATALOG_EVENT, onCatalogChange);
  }, [refresh]);

  return { catalog: state.catalog, meta: state.meta, loading, error, refresh };
}
