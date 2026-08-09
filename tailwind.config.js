/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    // Streamdown styles its markdown output with Tailwind classes that live only in its own bundle. Without
    // this, any utility we don't also use in src/ is never generated and the class is inert — which silently
    // flattened `#`/`###` headings to body size and left blockquotes with no indent or quote bar.
    // Prescribed by Streamdown's README (shown there in Tailwind v4 `@source` form; this is the v3 equivalent).
    './node_modules/streamdown/dist/*.js',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // The whole app follows the Font setting via --app-font (defined in index.css :root, overridden
      // inline by the setting). Preflight applies fontFamily.sans to <html>, so this themes everything.
      fontFamily: {
        sans: ['var(--app-font)', 'sans-serif'],
      },
      // Role-named type scale. A class says what the text *is*, not how big it is, so a size can be
      // retuned in one place and helper text is distinguishable from a deliberately compact control
      // (density lives on the control's `size` variant instead — see button/input). Values match the
      // stock Tailwind sizes already in use, so naming a role never moves a pixel.
      // tailwind-merge must be taught these keys too, or it files them under text-color (see lib/utils).
      fontSize: {
        display: ["1.5rem", { lineHeight: "2rem" }],      // card titles, page headers
        heading: ["1.25rem", { lineHeight: "1.75rem" }],  // section headers
        title: ["1.125rem", { lineHeight: "1.75rem" }],   // dialog/modal titles
        body: ["1rem", { lineHeight: "1.5rem" }],         // reading copy
        label: ["0.875rem", { lineHeight: "1.25rem" }],   // form controls and their labels
        helper: ["0.875rem", { lineHeight: "1.25rem" }],  // descriptions, hints, inline errors
        meta: ["0.75rem", { lineHeight: "1rem" }],        // counts, timestamps, badges
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        // Deep red for solid destructive chips (button/badge fills) where white text sits on top; the
        // bright --destructive is tuned for ink (text/icons/bars) instead. See index.css.
        "destructive-fill": "hsl(var(--destructive-fill))",
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        // The filled heart on a liked listing. Deliberately one pink across every theme — see index.css.
        like: "hsl(var(--like))",
        overlay: "hsl(var(--overlay))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}