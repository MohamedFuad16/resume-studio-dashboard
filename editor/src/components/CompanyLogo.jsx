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

// Direct icon URLs for companies whose domain has no DuckDuckGo favicon (DDG 404s →
// the chip degraded to text initials). enechain's own /favicon.ico is a 78-byte stub;
// their real icon is the PNG their site's <link rel="icon"> points at.
const KNOWN_LOGOS = {
  enechain: 'https://storage.googleapis.com/production-os-assets/assets/a058f38d-b463-4042-a7f7-ea4984d54758',
  M3: 'https://m3.com/favicon.ico',
};
const KNOWN_LOGOS_LC = Object.fromEntries(Object.entries(KNOWN_LOGOS).map(([k, v]) => [k.toLowerCase(), v]));
function knownLogo(company) {
  return KNOWN_LOGOS[company] || KNOWN_LOGOS_LC[String(company || '').trim().toLowerCase()] || '';
}

// Job boards / ATS hosts: their favicon is never the company's logo. Applied to BOTH
// `item.url` and `item.companyDomain` — live-researched items derive companyDomain from
// the posting's sourceUrl, so an enechain job found on herp.careers used to render the
// HERP favicon (the "wrong logo" bug).
const JOB_BOARD_DOMAINS = /greenhouse|lever\.co|workday|myworkdayjobs|ashbyhq|gaishishukatsu|herp\.careers|01intern|wantedly|onecareer|indeed\.|linkedin|talentio|hrmos|mynavi|rikunabi/;

function domainFromUrl(url) {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, '');
    return JOB_BOARD_DOMAINS.test(domain) ? '' : domain;
  } catch {
    return '';
  }
}

// Case-insensitive KNOWN_DOMAINS lookup: the live-search intro passes the raw query
// (e.g. lowercase "google") which would otherwise miss the "Google" key.
const KNOWN_DOMAINS_LC = Object.fromEntries(Object.entries(KNOWN_DOMAINS).map(([k, v]) => [k.toLowerCase(), v]));
function knownDomain(company) {
  return KNOWN_DOMAINS[company] || KNOWN_DOMAINS_LC[String(company || '').trim().toLowerCase()] || '';
}

// High-resolution favicon (Google s2 at 128px → ~114px PNG, crisp on the chip)
// vs DuckDuckGo's /ip3/ which is a blurry 32px. Google serves a generic GLOBE at
// HTTP 200 for domains with no favicon (so onError never advances) — so it is
// only trusted FIRST for CURATED known domains, which all have a real favicon.
const hiResFavicon = domain => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
const ddgFavicon = domain => `https://icons.duckduckgo.com/ip3/${domain}.ico`;

function companyLogoUrls(item) {
  const filled = FILLED_BRAND_LOGOS[item.company];
  if (filled) return [filled.src];
  // Curated domain first: live-researched items carry a companyDomain derived from the
  // posting URL, which can be a job board — never let it shadow a known-correct domain.
  const safeCompanyDomain = item.companyDomain && !JOB_BOARD_DOMAINS.test(item.companyDomain) ? item.companyDomain : '';
  const curated = knownDomain(item.company);
  const domain = curated || safeCompanyDomain || domainFromUrl(item.url);
  // For a curated domain we KNOW there's a real favicon → high-res Google first
  // (no globe risk), then DDG as a fallback. For uncertain (live-research) domains,
  // DDG first (clean 404 → next source) so a Google globe can never stick, then
  // high-res as a second try. Order ends: logoUrl → initials.
  const faviconChain = domain
    ? (curated ? [hiResFavicon(domain), ddgFavicon(domain)] : [ddgFavicon(domain), hiResFavicon(domain)])
    : [];
  return [
    knownLogo(item.company),
    ...faviconChain,
    item.logoUrl,
  ].filter((source, index, sources) => source && sources.indexOf(source) === index);
}

export function CompanyLogo({ item, size = 'md' }) {
  // Depend on the exact fields companyLogoUrls reads — `item` itself is a fresh
  // object on most parent renders, so it would defeat the memo.
  const { company, companyDomain, logoUrl, url } = item;
  const sources = useMemo(
    () => companyLogoUrls({ company, companyDomain, logoUrl, url }),
    [company, companyDomain, logoUrl, url],
  );
  const sourceKey = sources.join('|');
  const [sourceIndex, setSourceIndex] = useState(0);
  // Restart the fallback chain when the source list itself changes — adjusted
  // DURING render (React's "information from previous renders" pattern), not in
  // an effect: the effect version painted one frame of the stale logo first.
  const [prevSourceKey, setPrevSourceKey] = useState(sourceKey);
  if (prevSourceKey !== sourceKey) {
    setPrevSourceKey(sourceKey);
    setSourceIndex(0);
  }
  const filledBrand = FILLED_BRAND_LOGOS[item.company];
  const initials = item.company
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .replace(/[^A-Z0-9]/gi, '')
    .slice(0, 2)
    .toUpperCase();

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
