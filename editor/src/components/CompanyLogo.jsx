import React, { useEffect, useMemo, useState } from 'react';

const KNOWN_DOMAINS = {
  HENNGE: 'hennge.com',
  Mercari: 'mercari.com',
  'Sony Group Corporation': 'sony.com',
  Sony: 'sony.com',
  'Rakuten Group': 'rakuten.com',
  Rakuten: 'rakuten.com',
  'Preferred Networks': 'preferred.jp',
  'Woven by Toyota': 'woven.toyota',
  'LINE Yahoo': 'lycorp.co.jp',
  Google: 'google.com',
  Microsoft: 'microsoft.com',
  Amazon: 'amazon.com',
  Apple: 'apple.com',
  Citadel: 'citadel.com',
  'Jane Street': 'janestreet.com',
  NVIDIA: 'nvidia.com',
  Tenstorrent: 'tenstorrent.com',
  Datadog: 'datadoghq.com',
  Cloudflare: 'cloudflare.com',
  Stripe: 'stripe.com',
  Salesforce: 'salesforce.com',
  IBM: 'ibm.com',
  KPMG: 'kpmg.com',
  DeNA: 'dena.com',
  CyberAgent: 'cyberagent.co.jp',
  Recruit: 'recruit.co.jp',
  'Mercari Group': 'mercari.com',
  Mirrativ: 'mirrativ.co.jp',
  ABEJA: 'abejainc.com',
  IVRy: 'ivry.jp',
  GEOTRA: 'geotra.jp',
  AICE: 'aice.co.jp',
  enechain: 'enechain.co.jp',
  unerry: 'unerry.co.jp',
  Canary: 'canary-app.jp',
  KIYONO: 'kiyono-co.jp',
  Meltly: 'meltly.co.jp',
  InsightX: 'insightx.co.jp',
  franky: 'franky.inc',
  Nehan: 'nehan.io',
  pluszero: 'plus-zero.co.jp',
  Comici: 'comici.co.jp',
  'Digital Grid': 'digitalgrid.com',
  find: 'findy.co.jp',
  'Prossell Holdings': 'prossell.jp',
  T2: 't2.auto',
  Atilika: 'atilika.com',
};

const FILLED_BRAND_LOGOS = {
  Cloudflare: { src: 'https://cdn.simpleicons.org/cloudflare/white', color: '#f48120', key: 'cloudflare' },
  X: { src: 'https://cdn.simpleicons.org/x/white', color: '#000000', key: 'x' },
  'X Corp.': { src: 'https://cdn.simpleicons.org/x/white', color: '#000000', key: 'x' },
};

function domainFromUrl(url) {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, '');
    return /greenhouse|lever|workday|myworkdayjobs|ashbyhq|gaishishukatsu/.test(domain) ? '' : domain;
  } catch {
    return '';
  }
}

function companyLogoUrls(item) {
  const filled = FILLED_BRAND_LOGOS[item.company];
  if (filled) return [filled.src];
  const domain = item.companyDomain || KNOWN_DOMAINS[item.company] || domainFromUrl(item.url);
  return [
    item.logoUrl,
    domain ? `https://www.google.com/s2/favicons?domain_url=https://${domain}&sz=128` : '',
    // DuckDuckGo icon service as a second favicon source: catches domains Google's
    // service has no icon for, before we fall back to text initials.
    domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : '',
  ].filter((source, index, sources) => source && sources.indexOf(source) === index);
}

export function CompanyLogo({ item, size = 'md' }) {
  const sources = useMemo(
    () => companyLogoUrls(item),
    [item.company, item.companyDomain, item.logoUrl, item.url],
  );
  const sourceKey = sources.join('|');
  const [sourceIndex, setSourceIndex] = useState(0);
  const filledBrand = FILLED_BRAND_LOGOS[item.company];
  const initials = item.company
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .replace(/[^A-Z0-9]/gi, '')
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => setSourceIndex(0), [sourceKey]);

  const src = sources[sourceIndex];
  if (!src) {
    return <span className={`company-logo fallback ${size}`} aria-label={`${item.company} logo`}>{initials}</span>;
  }

  return (
    <span
      className={`company-logo official-logo ${filledBrand ? `filled-logo brand-${filledBrand.key}` : ''} ${size}`}
      style={filledBrand ? { '--logo-background': filledBrand.color } : undefined}
    >
      <img
        src={src}
        alt={`${item.company} logo`}
        loading="lazy"
        onError={() => setSourceIndex(index => index + 1)}
      />
    </span>
  );
}
