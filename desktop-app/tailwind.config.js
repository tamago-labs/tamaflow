/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{ts,tsx,js,jsx,html}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#1A1AE8',
          teal: '#3EC4C0',
          navy: '#0a0a5c',
          muted: '#9999bb',
          light: '#f7f7fc',
          border: '#e0e0f0',
          ok: '#0a8463',
          err: '#cc0000',
          errBg: '#fff0f0',
          errBorder: '#ffcccc',
          errDark: '#660000',
          tealAccent: '#085041'
        }
      },
      fontFamily: {
        sans: ["'DM Sans'", 'sans-serif'],
        mono: ["'Space Mono'", 'monospace']
      },
      letterSpacing: {
        wider2: '0.14em',
        wider3: '0.18em',
        wide2: '0.1em'
      }
    }
  },
  plugins: []
}
