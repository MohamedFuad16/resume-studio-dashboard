import { useCallback, useEffect, useMemo, useState } from 'react';
import { internships as seededInternships } from '../data/internships.js';

const API = import.meta.env.VITE_API_BASE_URL || '';
export const CATALOG_EVENT = 'resume-studio:internship-catalog-change';

function combineCatalog(custom) {
  const seenIds = new Set();
  const seenUrls = new Set();
  return [...custom, ...seededInternships].filter(item => {
    if (!item?.id || seenIds.has(item.id) || (item.url && seenUrls.has(item.url))) return false;
    seenIds.add(item.id);
    if (item.url) seenUrls.add(item.url);
    return true;
  });
}

export function notifyCatalogChange() {
  window.dispatchEvent(new CustomEvent(CATALOG_EVENT));
}

export function useInternshipCatalog() {
  const [custom, setCustom] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/internships/custom`);
      if (!response.ok) throw new Error('Could not load custom internships');
      const data = await response.json();
      setCustom(Array.isArray(data) ? data : []);
    } catch {
      setCustom(current => current);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(CATALOG_EVENT, refresh);
    return () => window.removeEventListener(CATALOG_EVENT, refresh);
  }, [refresh]);

  const catalog = useMemo(() => combineCatalog(custom), [custom]);
  return { catalog, customCount: custom.length, loading, refresh };
}
