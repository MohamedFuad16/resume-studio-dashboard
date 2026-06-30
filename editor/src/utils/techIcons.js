/**
 * techIcons — pure icon-resolution helpers for project technologies.
 *
 * Every tech name (known OR unknown / future) resolves to a usable icon source.
 * Known names map through a curated alias table; unknown names derive a best-guess
 * Simple Icons slug. A generic inline-SVG `fallbackSrc` is always provided so the
 * consumer can recover when a remote icon 404s:
 *
 *   <img
 *     src={icon.src}
 *     alt={icon.label}
 *     onError={e => { e.currentTarget.src = icon.fallbackSrc; }}
 *   />
 *
 * No JSX, no CSS — data only.
 */

/** Base URL for the Simple Icons CDN (monochrome brand glyphs). */
const SIMPLEICONS_CDN = 'https://cdn.simpleicons.org';

/**
 * Curated alias table. Keys are normalized names (lowercase, single-spaced).
 * Each entry provides EITHER a Simple Icons `slug` OR a local `asset` path
 * (under `editor/public`), plus a human `label`.
 */
const TECH_ICON_ALIASES = {
  // Languages
  'typescript': { slug: 'typescript', label: 'TypeScript' },
  'ts': { slug: 'typescript', label: 'TypeScript' },
  'javascript': { slug: 'javascript', label: 'JavaScript' },
  'js': { slug: 'javascript', label: 'JavaScript' },
  'python': { slug: 'python', label: 'Python' },
  'go': { slug: 'go', label: 'Go' },
  'golang': { slug: 'go', label: 'Go' },
  'java': { slug: 'openjdk', label: 'Java' },
  'c': { slug: 'c', label: 'C' },
  'cpp': { slug: 'cplusplus', label: 'C++' },
  'c++': { slug: 'cplusplus', label: 'C++' },
  'ruby': { slug: 'ruby', label: 'Ruby' },
  'zig': { slug: 'zig', label: 'Zig' },
  'kotlin': { slug: 'kotlin', label: 'Kotlin' },
  'php': { slug: 'php', label: 'PHP' },
  'rust': { slug: 'rust', label: 'Rust' },
  'swift': { slug: 'swift', label: 'Swift' },
  'swiftui': { slug: 'swift', label: 'SwiftUI' },
  'html': { slug: 'html5', label: 'HTML5' },
  'html5': { slug: 'html5', label: 'HTML5' },
  'css': { slug: 'css3', label: 'CSS3' },
  'css3': { slug: 'css3', label: 'CSS3' },

  // Frameworks & UI
  'react': { slug: 'react', label: 'React' },
  'react 19': { slug: 'react', label: 'React 19' },
  'tailwind': { slug: 'tailwindcss', label: 'Tailwind CSS' },
  'tailwindcss': { slug: 'tailwindcss', label: 'Tailwind CSS' },
  'tailwind css': { slug: 'tailwindcss', label: 'Tailwind CSS' },
  'vite': { asset: '/brand/vite.svg', label: 'Vite' },
  'pwa': { slug: 'pwa', label: 'PWA' },
  'appkit': { slug: 'apple', label: 'Apple / AppKit' },
  'macos menu bar': { slug: 'apple', label: 'Apple / macOS' },

  // Runtime & servers
  'node': { slug: 'nodedotjs', label: 'Node.js' },
  'nodejs': { slug: 'nodedotjs', label: 'Node.js' },
  'node.js': { slug: 'nodedotjs', label: 'Node.js' },
  'express': { slug: 'express', label: 'Express' },

  // Cloud / AWS
  'aws': { slug: 'amazonwebservices', label: 'AWS' },
  'amazon web services': { slug: 'amazonwebservices', label: 'AWS' },
  'amplify': { asset: '/brand/aws-amplify.svg', label: 'AWS Amplify' },
  'aws amplify': { asset: '/brand/aws-amplify.svg', label: 'AWS Amplify' },
  'cognito': { asset: '/brand/amazon-cognito.svg', label: 'Amazon Cognito' },
  'amazon cognito': { asset: '/brand/amazon-cognito.svg', label: 'Amazon Cognito' },
  'ses': { slug: 'amazonsimpleemailservice', label: 'Amazon SES' },
  'amazon ses': { slug: 'amazonsimpleemailservice', label: 'Amazon SES' },
  'docker': { slug: 'docker', label: 'Docker' },

  // Databases & storage
  'sqlite': { slug: 'sqlite', label: 'SQLite' },
  'mysql': { slug: 'mysql', label: 'MySQL' },
  'postgres': { slug: 'postgresql', label: 'PostgreSQL' },
  'postgresql': { slug: 'postgresql', label: 'PostgreSQL' },
  'dexie': { slug: 'sqlite', label: 'Dexie' },
  'indexeddb': { slug: 'sqlite', label: 'IndexedDB' },
  'dexie/indexeddb': { slug: 'sqlite', label: 'Dexie / IndexedDB' },
  'opfs': { slug: 'files', label: 'OPFS' },

  // APIs & AI
  'openai': { slug: 'openai', label: 'OpenAI' },
  'anthropic': { slug: 'anthropic', label: 'Anthropic' },
  'openrouter': { slug: 'openrouter', label: 'OpenRouter' },
  'deepgram': { slug: 'deepgram', label: 'Deepgram' },
  'webrtc': { slug: 'webrtc', label: 'WebRTC' },

  // Tooling
  'figma': { slug: 'figma', label: 'Figma' },
  'git': { slug: 'git', label: 'Git' },
  'github': { slug: 'github', label: 'GitHub' },
};

/**
 * Generic fallback glyph: a soft "code chip" (`</>`) rendered as an inline
 * data-URI SVG so it works with zero network access and never 404s.
 */
const FALLBACK_SVG = [
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'>",
  "<rect x='2' y='3' width='20' height='18' rx='4' fill='#e8eefc'/>",
  "<path d='M9.5 9 6.5 12l3 3M14.5 9l3 3-3 3' stroke='#0a57ff' ",
  "stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/>",
  '</svg>',
].join('');

/** Always-available inline fallback icon source (data URI). */
export const TECH_ICON_FALLBACK_SRC = `data:image/svg+xml,${encodeURIComponent(FALLBACK_SVG)}`;

/**
 * Normalize a raw tech name for alias lookup: lowercase, trim, collapse
 * internal whitespace to a single space.
 * @param {string} name
 * @returns {string}
 */
function normalizeName(name) {
  return String(name == null ? '' : name)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Derive a best-guess Simple Icons slug for an unknown name by stripping
 * everything that is not a letter or digit (e.g. "Some New Tech!" -> "somenewtech").
 * @param {string} normalized — a value produced by {@link normalizeName}
 * @returns {string}
 */
function deriveSlug(normalized) {
  return normalized.replace(/[^a-z0-9]+/g, '');
}

/**
 * Resolve a single tech name to a usable icon descriptor. NEVER returns null:
 * unknown names fall back to a derived Simple Icons slug, and `fallbackSrc` is
 * always present for `onError` recovery.
 *
 * @param {string} name — a tech name, e.g. "React", "Tailwind CSS", "Some New Tech".
 * @returns {{ slug: string, src: string, fallbackSrc: string, label: string, key: string }}
 *   - `slug`: resolved Simple Icons slug (empty string for asset-backed brands).
 *   - `src`: primary icon URL (local asset or Simple Icons CDN).
 *   - `fallbackSrc`: inline data-URI SVG to swap in via `onError`.
 *   - `label`: human-readable label.
 *   - `key`: stable de-dup key (the `src`).
 */
export function resolveTechIcon(name) {
  const normalized = normalizeName(name);
  const original = String(name == null ? '' : name).trim();

  // 1) exact alias match, then 2) longest substring alias match (faithful to
  // the previous inline behavior, but specificity-first to limit false hits).
  let match = TECH_ICON_ALIASES[normalized];
  if (!match && normalized) {
    const entry = Object.entries(TECH_ICON_ALIASES)
      .filter(([key]) => normalized.includes(key))
      .sort((a, b) => b[0].length - a[0].length)[0];
    match = entry ? entry[1] : null;
  }

  if (match) {
    const src = match.asset || `${SIMPLEICONS_CDN}/${match.slug}`;
    return {
      slug: match.slug || '',
      src,
      fallbackSrc: TECH_ICON_FALLBACK_SRC,
      label: match.label || original || normalized,
      key: src,
    };
  }

  // Unknown / future tech: derive a slug and let the CDN try; `fallbackSrc`
  // covers the 404 case.
  const slug = deriveSlug(normalized);
  const src = slug ? `${SIMPLEICONS_CDN}/${slug}` : TECH_ICON_FALLBACK_SRC;
  return {
    slug,
    src,
    fallbackSrc: TECH_ICON_FALLBACK_SRC,
    label: original || normalized || 'Tech',
    key: src,
  };
}

/**
 * Resolve a list of tech names to de-duplicated icon descriptors.
 *
 * Accepts either an array of names OR a single string separated by commas or
 * the middot (`·`) — mirroring the previous inline `projectTechnologies`
 * splitting. Order is preserved; duplicates (same resolved `src`) are dropped.
 * Does NOT slice — callers cap the count for presentation
 * (e.g. `resolveTechList(project.tech).slice(0, 6)`).
 *
 * @param {string|string[]} namesOrString
 * @returns {Array<{ slug: string, src: string, fallbackSrc: string, label: string, key: string }>}
 */
export function resolveTechList(namesOrString) {
  const names = Array.isArray(namesOrString)
    ? namesOrString
    : String(namesOrString == null ? '' : namesOrString).split(/[,·]/);

  const seen = new Set();
  const out = [];
  for (const raw of names) {
    const value = String(raw == null ? '' : raw).trim();
    if (!value) continue;
    const icon = resolveTechIcon(value);
    if (seen.has(icon.key)) continue;
    seen.add(icon.key);
    out.push(icon);
  }
  return out;
}

export default resolveTechIcon;
