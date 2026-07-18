/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // The app's design tokens, exposed as Tailwind utilities.
      //
      // These map to the SAME CSS variables index.css already defines per theme
      // (:root[data-theme="light"|"dark"]), so `bg-panel` or `text-t2` follow the
      // theme switch exactly like the hand-written CSS does. Migrating a
      // component to utilities therefore cannot break theming — which it would
      // instantly if utilities hardcoded hex values.
      colors: {
        bg: 'var(--bg)',
        panel: 'var(--panel)',
        card: 'var(--card)',
        'input-bg': 'var(--input-bg)',
        hover: 'var(--hover)',
        b0: 'var(--b0)',
        b1: 'var(--b1)',
        'b-focus': 'var(--b-focus)',
        t1: 'var(--t1)',
        t2: 'var(--t2)',
        t3: 'var(--t3)',
        blue: 'var(--blue)',
        'blue-dim': 'var(--blue-dim)',
        'blue-glow': 'var(--blue-glow)',
        red: 'var(--red)',
        'red-dim': 'var(--red-dim)',
        green: 'var(--green)',
        amber: 'var(--amber)',
        err: 'var(--err)',
      },
      borderRadius: {
        DEFAULT: 'var(--r)',
      },
      transitionTimingFunction: {
        app: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
  darkMode: 'class',
  corePlugins: {
    // OFF, deliberately, and it must stay off until the migration finishes.
    // index.css ships its own reset and ~8k lines written against browser
    // defaults; preflight would restyle every heading, list, and form control
    // in the app the moment it is enabled. Utilities are purely additive
    // without it, so old CSS and new utility classes can coexist file by file.
    preflight: false,
  },
}
