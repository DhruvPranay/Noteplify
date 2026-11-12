/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        surface: token("surface"),
        "surface-2": token("surface-2"),
        ink: token("ink"),
        "ink-2": token("ink-2"),
        muted: token("muted"),
        line: token("line"),
        brand: token("brand"),
        "brand-ink": token("brand-ink"),
        "brand-soft": token("brand-soft"),
        good: token("good"),
        warn: token("warn"),
        bad: token("bad"),
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ['"Inter Tight"', "Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        card: "var(--shadow-card)",
        device: "var(--shadow-device)",
        glow: "0 10px 40px -12px rgb(124 58 237 / 0.55)",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.3, 1.25, 0.4, 1)",
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        "fade-in": { from: { opacity: 0, transform: "translateY(6px)" }, to: { opacity: 1, transform: "none" } },
        "page-in": {
          from: { opacity: 0, transform: "translateY(14px)", filter: "blur(6px)" },
          to: { opacity: 1, transform: "none", filter: "none" },
        },
      },
      animation: {
        "fade-in": "fade-in .35s cubic-bezier(0.16, 1, 0.3, 1) both",
        "page-in": "page-in .6s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};
