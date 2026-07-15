// Official-source audit performed on 2026-07-02 JST. Retired IDs remain in
// their original dated research files for provenance, but are excluded from
// every runtime catalog path.
import { autoRetiredIds } from './auto-refresh.js';

export const retiredInternshipIds20260702 = new Set([
  // Explicitly expired or closed.
  'mercari-software-engineer-2028',
  'woven-by-toyota-software-engineer-intern-2026',
  'smarthr-software-engineer-intern-2026',
  'rakuten-techcamp-infra-corporate-2026',
  'rakuten-techcamp-commerce-data-2026',
  'rakuten-techcamp-travel-ml-2026',

  // Official posting removed or current official page no longer lists it.
  'global-002',
  'global-043',
  'live-apple-fad4c656ea',
  'soracom-engineer-intern-2027-2028',
  'comici-student-engineer-intern-2026',
  'zozo-software-engineer-intern-2026',
]);

const patches20260702 = new Map([
  [
    'sakana-ai-ml-research-intern-2026',
    {
      role: 'Member of Technical Staff - Research Internship',
      roleJa: 'Member of Technical Staff（リサーチインターン）',
      duration: '4 months',
      deadline: 'Occasional hiring; no fixed date stated',
      deadlineType: 'Occasional hiring / no fixed date',
      url: 'https://sakana.ai/careers/member-of-technical-staff/',
      sourceUrl: 'https://sakana.ai/careers/member-of-technical-staff/',
      verifiedDate: '2026-07-02',
      fitNote: 'English-only Tokyo research internship in nature-inspired foundation AI, autonomous agents, generative AI, and collective intelligence.',
      about: 'Four-month Tokyo research internship developing novel approaches to nature-inspired foundation AI models.',
      aboutJa: '自然界に着想を得た基盤AIモデルの新しいアプローチを研究する、東京開催4か月のリサーチインターンです。',
      techStack: ['Python', 'Generative AI', 'Autonomous agents', 'Open source', 'Foundation models'],
      eligibility: [
        'Strong AI research projects or publications',
        'Ability to write high-quality code',
        'Able to be physically based in Tokyo',
      ],
      eligibilityJa: [
        'AI研究プロジェクトまたは論文実績',
        '高品質なコードを実装できること',
        '東京で勤務できること',
      ],
    },
  ],
]);

export function isRetiredInternshipId(id) {
  // Union of the one-off 2026-07-02 audit and the daily auto-refresh, so every
  // catalog path (seeds, stored live-research, custom) drops both.
  return retiredInternshipIds20260702.has(id) || autoRetiredIds.has(id);
}

export function applyCatalogAudit20260702(items) {
  return items
    .filter(item => !isRetiredInternshipId(item?.id))
    .map(item => ({ ...item, ...(patches20260702.get(item.id) || {}) }));
}
