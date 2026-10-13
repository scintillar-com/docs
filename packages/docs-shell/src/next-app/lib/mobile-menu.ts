/**
 * `mobileMenu.tools` from the site config, inlined at build time: when on,
 * the mobile menu carries search, language and theme above its nav, and the
 * shell's header drops them below `md`.
 */
export const MOBILE_MENU_TOOLS = process.env.NEXT_PUBLIC_SHELL_MOBILE_TOOLS === "1"
