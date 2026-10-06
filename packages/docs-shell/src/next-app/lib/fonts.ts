import localFont from "next/font/local"

/**
 * The shell's fonts, self-hosted so `next build` never touches the network.
 * `next/font/google` downloads at build time, and a bad Google Fonts
 * response failed whole consumer builds ("An error occurred in next/font").
 *
 * Files in `next-app/fonts/` are the Google Fonts latin-subset variable
 * woff2s (Space Grotesk 300-700, JetBrains Mono 100-800), both under the
 * SIL Open Font License 1.1 (licence texts ship next to them). The CSS
 * variables and declared weights match the previous `next/font/google`
 * setup: `--font-sans` with the full range, `--font-mono` at 400 and 700.
 *
 * Shared by the (shell) and (preview) root layouts. next/font calls must be
 * module-level consts, and defining them once keeps a single @font-face per
 * family across both layouts.
 */
export const fontSans = localFont({
  src: "../fonts/space-grotesk-latin-wght.woff2",
  weight: "300 700",
  style: "normal",
  display: "swap",
  variable: "--font-sans",
  fallback: ["system-ui", "sans-serif"],
})

export const fontMono = localFont({
  src: [
    { path: "../fonts/jetbrains-mono-latin-wght.woff2", weight: "400", style: "normal" },
    { path: "../fonts/jetbrains-mono-latin-wght.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-mono",
  fallback: ["ui-monospace", "monospace"],
  // The metric-adjusted fallback is Arial-based, wrong for a monospace face.
  adjustFontFallback: false,
})
