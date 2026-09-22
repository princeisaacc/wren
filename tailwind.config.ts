import type { Config } from "tailwindcss";

// Colors come from CSS variables set in globals.css, one set for light and one for dark.
// Change a color there and the whole app follows in both themes.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: v("canvas"),
        card: v("card"),
        soft: v("soft"),
        softer: v("softer"),
        softest: v("softest"),
        line: v("line"),
        ink: v("ink"),
        muted: v("muted"),
        sub: v("sub"),
        tint: v("tint"),
        onbrand: v("onbrand"),
        ondanger: v("ondanger"),
        brand: { DEFAULT: v("brand"), dark: v("brand-dark"), soft: v("brand-soft") },
        danger: { DEFAULT: v("danger"), soft: v("danger-soft"), ink: v("danger-ink") },
      },
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "system-ui", "sans-serif"],
      },
      keyframes: {
        sheet: {
          from: { transform: "translateY(16px)", opacity: "0" },
          to: { transform: "none", opacity: "1" },
        },
        fade: { from: { opacity: "0" }, to: { opacity: "1" } },
        progress: { from: { width: "0%" }, to: { width: "80%" } },
      },
      animation: {
        sheet: "sheet 180ms ease-out",
        fade: "fade 150ms ease-out",
        progress: "progress 4s ease-out forwards",
      },
    },
  },
  plugins: [],
};
export default config;