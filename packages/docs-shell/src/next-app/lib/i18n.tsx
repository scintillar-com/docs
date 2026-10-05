"use client"

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react"

/**
 * `useLayoutEffect` runs synchronously after DOM commit and *before* paint, so
 * it lets us swap the locale post-hydration without ever flashing the default
 * content. On the server it warns, so we fall back to `useEffect` there — the
 * fallback never actually runs because Next.js doesn't execute effects during
 * SSR, but using it satisfies React's "isomorphic" contract.
 */
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect

/**
 * Locale code. The shell ships translations for `"en"` and `"fr"` in its
 * base table; registries can add more via `extraTranslations` on their
 * shell config. The type is widened to `string` so arbitrary registry-
 * supplied locales type-check.
 */
export type Locale = string

const translations = {
  en: {
    // Header
    "header.search": "Search...",

    // Sidebar
    "sidebar.documentation": "Documentation",
    "sidebar.components": "Components",
    "sidebar.blocks": "Blocks",
    "sidebar.base": "Base",

    // Search
    "search.placeholder": "Search documentation and components...",
    "search.placeholderDocs": "Search the documentation...",
    "search.noResults": "No results found.",
    "search.groupDocs": "Documentation",
    "search.groupComponents": "Components",
    "search.filter": "Filter results",
    "search.all": "All",

    // Docs-only homepage
    "home.startReading": "Start reading",
    "home.pages": "Pages",

    // Component page
    "component.subtitle": "Install this component.",
    "component.installation": "Installation",
    "component.source": "Source",
    "component.propsBehavior": "Props & Behavior",
    "component.docsPlaceholder": "Documentation for this component has not been written yet.",
    "component.guidelinesPlaceholder": "Usage guidelines for this component have not been written yet.",
    "component.a11yPlaceholder": "Accessibility documentation for this component has not been written yet.",

    // Tabs
    "tabs.install": "Install",
    "tabs.documentation": "Documentation",
    "tabs.guidelines": "Guidelines",
    "tabs.accessibility": "Accessibility",
    "tabs.tests": "Tests",
    "component.testsPlaceholder": "No functional tests have been written for this component yet.",
    "tests.health": "Health",
    "tests.propsDocs": "Props documented",
    "tests.a11yDocs": "Accessibility documented",
    "tests.preview": "Preview available",
    "tests.unit": "Unit Tests",
    "tests.interaction": "Interaction Tests",
    "tests.visual": "Visual Regression",
    "tests.accessibility": "Accessibility Audit",
    "tests.performance": "Performance",
    "tests.tests": "Tests",

    // TOC
    "toc.title": "On this page",

    // Controls
    "controls.title": "Controls",

    // Preview
    "preview.noPreview": "No preview available",

    // Accessibility
    "a11y.skipToContent": "Skip to content",
    "a11y.loading": "Loading...",
    "a11y.keyboard": "Keyboard Interactions",
    "a11y.focus": "Focus Management",
    "a11y.focusVisible": "Focus visible",
    "a11y.noFocusVisible": "No focus visible",
    "a11y.focusTrapped": "Focus trapped",
    "a11y.noFocusTrap": "No focus trap",
    "a11y.screenReader": "Screen Reader",
    "a11y.colorMotion": "Color & Motion",
    "a11y.text": "Text",
    "a11y.ui": "UI",
    "a11y.motionLabel": "Motion",
    "a11y.noKeyboard": "This component has no keyboard interactions.",
    "a11y.devChecklist": "Developer Checklist",
    "a11y.checklistComplete": "All checks passed!",
    "a11y.checklistCompleteDesc": "You've verified all accessibility requirements for this component.",
    "a11y.checklistDismiss": "Show checklist",
    "a11y.element": "Element",
    "a11y.role": "Role",
    "a11y.key": "Key",
    "a11y.action": "Action",

    // Settings
    "settings.title": "Settings",
    "settings.theme": "Theme",
    "settings.light": "Light",
    "settings.dark": "Dark",
    "settings.system": "System",
    "settings.language": "Language",

    // Theme panel (opt-in via `themePanel` in the registry config)
    "themePanel.trigger": "Theme settings",
    "themePanel.title": "Theme",
    "themePanel.description": "Changes apply to this site and its previews, and are saved in this browser.",
    "themePanel.mode": "Mode",
    "themePanel.primary": "Primary color",
    "themePanel.primarySwatch": "Pick the primary color",
    "themePanel.primaryInvalid": "Enter a hex color such as #3b82f6.",
    "themePanel.resetPrimary": "Reset primary color",
    "themePanel.tint": "Surface tint",
    "themePanel.resetTint": "Reset surface tint",
    "themePanel.reset": "Reset",
    "themePanel.resetAll": "Reset all",
    "themePanel.copyCss": "Copy CSS",
    "themePanel.copied": "CSS copied to the clipboard.",
    "themePanel.copyFailed": "Couldn't copy. Select the CSS below and copy it yourself.",
    "themePanel.cssLabel": "Theme CSS",

    // Versions (only shown on sites built with `versions`)
    "versions.label": "Version",
    "versions.latest": "Latest",
    "versions.banner": "You're viewing {version}; the latest is {latest}.",
    "versions.unreleased": "You're viewing {label}, which isn't released yet; the latest release is {latest}.",
    "versions.goToLatest": "Go to latest",

    // Releases page (versioned builds with a changelog)
    "releases.title": "Releases",
    "releases.description": "Release notes for every version, newest first.",
    "releases.latest": "Latest",
    "releases.viewing": "Viewing",
    "releases.viewDocs": "{version} docs",
    "releases.noNotes": "No release notes.",
    "releases.empty": "No releases yet.",
    "releases.jumpTo": "Releases",
    "releases.bump.major": "Major",
    "releases.bump.minor": "Minor",
    "releases.bump.patch": "Patch",

    // Changes tab (versioned builds)
    "tabs.changes": "Changes",
    "changes.from": "Compare",
    "changes.to": "with",
    "changes.fromLabel": "Older version",
    "changes.toLabel": "Newer version",
    "changes.nothing": "(nothing)",
    "changes.unchangedSince": "Unchanged since {version}.",
    "changes.identical": "No differences between {from} and {to}.",
    "changes.addedIn": "Added in {version}.",
    "changes.addedUnreleased": "Not in any release yet.",
    "changes.removedIn": "Not part of {version}.",
    "changes.missing": "Not part of either version.",
    "changes.summary": "{files} file(s) changed: {additions} addition(s), {deletions} deletion(s).",
    "changes.metadata": "Registry item metadata",
    "changes.file.added": "Added",
    "changes.file.removed": "Removed",
    "changes.line.add": "Added:",
    "changes.line.remove": "Removed:",
    "changes.noHistoryTitle": "No history",
    "changes.noHistory": "No version history is available for this component.",
  },
  fr: {
    // Header
    "header.search": "Rechercher...",

    // Sidebar
    "sidebar.documentation": "Documentation",
    "sidebar.components": "Composants",
    "sidebar.blocks": "Blocs",
    "sidebar.base": "Base",

    // Search
    "search.placeholder": "Rechercher dans la documentation et les composants...",
    "search.placeholderDocs": "Rechercher dans la documentation...",
    "search.noResults": "Aucun résultat trouvé.",
    "search.groupDocs": "Documentation",
    "search.groupComponents": "Composants",
    "search.filter": "Filtrer les résultats",
    "search.all": "Tout",

    // Page d'accueil (documentation seule)
    "home.startReading": "Commencer la lecture",
    "home.pages": "Pages",

    // Component page
    "component.subtitle": "Installez ce composant.",
    "component.installation": "Installation",
    "component.source": "Source",
    "component.propsBehavior": "Props et comportement",
    "component.docsPlaceholder": "La documentation de ce composant n'a pas encore été rédigée.",
    "component.guidelinesPlaceholder": "Les directives d'utilisation de ce composant n'ont pas encore été rédigées.",
    "component.a11yPlaceholder": "La documentation d'accessibilité de ce composant n'a pas encore été rédigée.",

    // Tabs
    "tabs.install": "Installer",
    "tabs.documentation": "Documentation",
    "tabs.guidelines": "Directives",
    "tabs.accessibility": "Accessibilité",
    "tabs.tests": "Tests",
    "component.testsPlaceholder": "Aucun test fonctionnel n'a été écrit pour ce composant.",
    "tests.health": "Santé",
    "tests.propsDocs": "Props documentés",
    "tests.a11yDocs": "Accessibilité documentée",
    "tests.preview": "Aperçu disponible",
    "tests.unit": "Tests unitaires",
    "tests.interaction": "Tests d'interaction",
    "tests.visual": "Régression visuelle",
    "tests.accessibility": "Audit d'accessibilité",
    "tests.performance": "Performance",
    "tests.tests": "Tests",

    // TOC
    "toc.title": "Sur cette page",

    // Controls
    "controls.title": "Contrôles",

    // Preview
    "preview.noPreview": "Aucun aperçu disponible",

    // Accessibility
    "a11y.skipToContent": "Aller au contenu",
    "a11y.loading": "Chargement...",
    "a11y.keyboard": "Interactions clavier",
    "a11y.focus": "Gestion du focus",
    "a11y.focusVisible": "Focus visible",
    "a11y.noFocusVisible": "Pas de focus visible",
    "a11y.focusTrapped": "Focus piégé",
    "a11y.noFocusTrap": "Pas de piège à focus",
    "a11y.screenReader": "Lecteur d'écran",
    "a11y.colorMotion": "Couleur et mouvement",
    "a11y.text": "Texte",
    "a11y.ui": "UI",
    "a11y.motionLabel": "Mouvement",
    "a11y.noKeyboard": "Ce composant n'a pas d'interactions clavier.",
    "a11y.devChecklist": "Liste de vérification développeur",
    "a11y.checklistComplete": "Toutes les vérifications sont passées !",
    "a11y.checklistCompleteDesc": "Vous avez vérifié toutes les exigences d'accessibilité pour ce composant.",
    "a11y.checklistDismiss": "Afficher la liste",
    "a11y.element": "Élément",
    "a11y.role": "Rôle",
    "a11y.key": "Touche",
    "a11y.action": "Action",

    // Settings
    "settings.title": "Paramètres",
    "settings.theme": "Thème",
    "settings.light": "Clair",
    "settings.dark": "Sombre",
    "settings.system": "Système",
    "settings.language": "Langue",

    // Theme panel (opt-in via `themePanel` in the registry config)
    "themePanel.trigger": "Réglages du thème",
    "themePanel.title": "Thème",
    "themePanel.description": "Les changements s'appliquent à ce site et à ses aperçus, et sont enregistrés dans ce navigateur.",
    "themePanel.mode": "Mode",
    "themePanel.primary": "Couleur primaire",
    "themePanel.primarySwatch": "Choisir la couleur primaire",
    "themePanel.primaryInvalid": "Saisissez une couleur hexadécimale, par exemple #3b82f6.",
    "themePanel.resetPrimary": "Réinitialiser la couleur primaire",
    "themePanel.tint": "Teinte des surfaces",
    "themePanel.resetTint": "Réinitialiser la teinte des surfaces",
    "themePanel.reset": "Réinitialiser",
    "themePanel.resetAll": "Tout réinitialiser",
    "themePanel.copyCss": "Copier le CSS",
    "themePanel.copied": "CSS copié dans le presse-papiers.",
    "themePanel.copyFailed": "Copie impossible. Sélectionnez le CSS ci-dessous et copiez-le vous-même.",
    "themePanel.cssLabel": "CSS du thème",

    // Versions
    "versions.label": "Version",
    "versions.latest": "Dernière",
    "versions.banner": "Vous consultez la {version} ; la plus récente est la {latest}.",
    "versions.unreleased": "Vous consultez {label}, pas encore publiée ; la dernière version publiée est la {latest}.",
    "versions.goToLatest": "Voir la dernière version",

    // Page des versions
    "releases.title": "Versions",
    "releases.description": "Notes de version de chaque version, de la plus récente à la plus ancienne.",
    "releases.latest": "Dernière",
    "releases.viewing": "Consultée",
    "releases.viewDocs": "Documentation {version}",
    "releases.noNotes": "Aucune note de version.",
    "releases.empty": "Aucune version publiée pour l'instant.",
    "releases.jumpTo": "Versions",
    "releases.bump.major": "Majeure",
    "releases.bump.minor": "Mineure",
    "releases.bump.patch": "Correctif",

    // Onglet Modifications
    "tabs.changes": "Modifications",
    "changes.from": "Comparer",
    "changes.to": "avec",
    "changes.fromLabel": "Version la plus ancienne",
    "changes.toLabel": "Version la plus récente",
    "changes.nothing": "(rien)",
    "changes.unchangedSince": "Inchangé depuis la {version}.",
    "changes.identical": "Aucune différence entre la {from} et la {to}.",
    "changes.addedIn": "Ajouté dans la {version}.",
    "changes.addedUnreleased": "Pas encore publié dans une version.",
    "changes.removedIn": "Absent de la {version}.",
    "changes.missing": "Absent des deux versions.",
    "changes.summary": "{files} fichier(s) modifié(s) : {additions} ajout(s), {deletions} suppression(s).",
    "changes.metadata": "Métadonnées de l'élément du registre",
    "changes.file.added": "Ajouté",
    "changes.file.removed": "Supprimé",
    "changes.line.add": "Ajouté :",
    "changes.line.remove": "Supprimé :",
    "changes.noHistoryTitle": "Aucun historique",
    "changes.noHistory": "Aucun historique de versions n'est disponible pour ce composant.",
  },
} as const

type TranslationKey = keyof typeof translations.en

type Dictionary = Record<string, string>

interface I18nContextValue {
  locale: Locale
  /** The site's default locale (from the config), whatever is active. */
  defaultLocale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey | (string & {})) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

/** Merge the shell's base translations with any extras a registry provides. */
/**
 * Built-in dictionaries overlaid with `extraTranslations`, for every locale
 * either side knows about. A locale the shell doesn't ship (e.g. `es`) gets
 * just its extra keys; `t()` falls back to English for the rest.
 */
export function mergeDicts(extra?: Record<string, Dictionary>): Record<string, Dictionary> {
  const builtIn: Record<string, Dictionary> = translations
  const locales = new Set([...Object.keys(builtIn), ...Object.keys(extra ?? {})])
  const merged: Record<string, Dictionary> = {}
  for (const loc of locales) merged[loc] = { ...(builtIn[loc] ?? {}), ...(extra?.[loc] ?? {}) }
  return merged
}

export function I18nProvider({
  children,
  extraTranslations,
  defaultLocale = "en",
  availableLocales,
}: {
  children: ReactNode
  extraTranslations?: Record<string, Dictionary>
  /** Initial locale (SSR-safe). Comes from registry config. */
  defaultLocale?: Locale
  /** Whitelist of valid locales for persistence restore. */
  availableLocales?: Locale[]
}) {
  // Always start with the default locale on both server and first client render
  // so the SSR HTML and the first hydration commit are identical. Reading from
  // localStorage in the initializer would cause a hydration mismatch when the
  // user has a non-default locale, and React would discard the mismatched
  // subtree — which restarts every CSS animation in the page (including the
  // bento-enter cards). We pull the persisted locale in a layout effect so the
  // locale swap happens before the first paint, with no visible flash.
  const [locale, setLocale] = useState<Locale>(defaultLocale)

  useIsomorphicLayoutEffect(() => {
    const stored = (typeof window !== "undefined" ? localStorage.getItem("locale") : null)
    if (stored && stored !== locale) {
      // Accept any persisted locale that's in the registry's whitelist, or
      // (backwards-compat) the legacy hard-coded en/fr when no whitelist.
      const allow = availableLocales && availableLocales.length > 0
        ? availableLocales
        : ["en", "fr"]
      if (allow.includes(stored)) setLocale(stored)
    }
    // Run once on mount; `locale` is the value at first commit and never
    // changes between renders here, so omitting it is safe.
  }, [locale, availableLocales])

  const changeLocale = useCallback((l: Locale) => {
    setLocale(l)
    localStorage.setItem("locale", l)
  }, [])

  const merged = useMemo(() => mergeDicts(extraTranslations), [extraTranslations])

  const t = useCallback(
    (key: TranslationKey | (string & {})) => {
      const k = key as string
      return merged[locale]?.[k] ?? merged.en[k] ?? k
    },
    [locale, merged]
  )

  return (
    <I18nContext.Provider value={{ locale, defaultLocale, setLocale: changeLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useLocale() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useLocale must be used within I18nProvider")
  return { locale: ctx.locale, defaultLocale: ctx.defaultLocale, setLocale: ctx.setLocale }
}

export function useTranslations() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useTranslations must be used within I18nProvider")
  return ctx.t
}
