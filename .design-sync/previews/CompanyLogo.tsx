// CompanyLogo resolves a logo for an internship listing, falling back to a
// lettermark when no image loads. Unauthored it got no `item`, so there was
// nothing to resolve. Items below mirror real catalog entries.
import { CompanyLogo } from 'resume-editor';

const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 16 };

export const Companies = () => (
  <div style={row}>
    <CompanyLogo item={{ company: 'HENNGE', companyDomain: 'hennge.com' }} />
    <CompanyLogo item={{ company: 'Rakuten Group', companyDomain: 'rakuten.co.jp' }} />
    <CompanyLogo item={{ company: 'Mercari', companyDomain: 'mercari.com' }} />
    <CompanyLogo item={{ company: 'Sony', companyDomain: 'sony.com' }} />
  </div>
);

export const Sizes = () => (
  <div style={row}>
    <CompanyLogo item={{ company: 'HENNGE', companyDomain: 'hennge.com' }} size="sm" />
    <CompanyLogo item={{ company: 'HENNGE', companyDomain: 'hennge.com' }} size="md" />
    <CompanyLogo item={{ company: 'HENNGE', companyDomain: 'hennge.com' }} size="lg" />
  </div>
);

// No domain to resolve — the lettermark fallback. This is the common case for
// live-researched companies.
export const Fallback = () => (
  <div style={row}>
    <CompanyLogo item={{ company: 'InsightX' }} />
    <CompanyLogo item={{ company: 'Canary' }} />
    <CompanyLogo item={{ company: 'Atilika' }} />
  </div>
);
