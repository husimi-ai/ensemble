import type { Config } from "tailwindcss";

// Utilities map to the CSS variables defined in app/globals.css so the design
// tokens stay in one place. Light theme only.
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        sidebar: "var(--sidebar)",
        elevated: "var(--elevated)",
        subtle: "var(--subtle)",
        muted: "var(--muted)",
        hover: "var(--hover)",
        selected: "var(--selected)",
        scrim: "var(--scrim)",
        bubble: "var(--bubble)",
        accent: "var(--accent)",
        danger: "var(--danger)",
        fg: {
          DEFAULT: "var(--fg)",
          secondary: "var(--fg-secondary)",
          muted: "var(--fg-muted)",
          inverted: "var(--fg-inverted)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
        },
        line: {
          DEFAULT: "var(--border)",
          light: "var(--border-light)",
          heavy: "var(--border-heavy)",
        },
      },
      borderRadius: {
        composer: "var(--radius-composer)",
      },
      maxWidth: {
        thread: "var(--thread-max)",
      },
      boxShadow: {
        card: "var(--shadow-sm)",
        composer: "var(--shadow-md)",
        pop: "var(--shadow-lg)",
      },
      fontFamily: {
        sans: "var(--font-sans)",
      },
      spacing: {
        sidebar: "var(--sidebar-w)",
        header: "var(--header-h)",
      },
    },
  },
  plugins: [],
} satisfies Config;
