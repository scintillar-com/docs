"use client"

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react"

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
    "search.noResults": "No results found.",
    "search.groupDocs": "Documentation",
    "search.groupComponents": "Components",

    // Home
    "home.title": "UI Registry",
    "home.description": "A custom component registry built with shadcn. Browse documentation and components to get started.",
    "home.getStarted": "Get Started",
    "home.browseComponents": "Browse Components",
    "home.openSource": "Open Source",
    "home.builtOnShadcn": "Built on shadcn",
    "home.heroTitle": "Scintillar UI",
    "home.heroDescription": "Web components built for live collaboration with React & Next.",
    "home.heroFeature.collaborative": "Collaborative",
    "home.heroFeature.tested": "Tested",
    "home.heroFeature.accessible": "Accessible",
    "home.prototypingTitle": "Your code. Your repo. Our standards.",
    "home.prototypingDescription": "Stop maintaining the technical scaffolding. Get an audited component registry that drops natively into your workflow and your tests.",
    "home.proto.openSource.title": "You own the code",
    "home.proto.openSource.desc": "Components ship straight into your codebase. Pull from the registry, edit them as you like — or let us handle the heavy lifting.",
    "home.proto.openSource.label.registry": "Registry",
    "home.proto.openSource.label.yours": "your codebase",
    "home.proto.tested.title": "Heavily tested",
    "home.proto.tested.desc": "Every component is audited for accessibility, interactivity and stability. Real test suites, not promises.",
    "home.proto.tested.suite": "Test suite",
    "home.proto.tested.passed": "passed",
    "home.proto.tested.case.renders": "renders the trigger",
    "home.proto.tested.case.opens": "opens on click",
    "home.proto.tested.case.closes": "closes on Escape",
    "home.proto.tested.case.focus": "traps focus when open",
    "home.proto.tested.case.keyboard": "supports keyboard nav",
    "home.proto.tested.case.motion": "respects reduced motion",
    "home.proto.tested.case.axe": "passes axe scan",
    "home.proto.ai.title": "Built for AI agents",
    "home.proto.ai.desc": "We obsess over AIX (AI Experience) the same way the rest of the world obsesses over DevEX. Predictable APIs, machine-readable docs, structured props, and registries that LLMs can navigate.",
    "home.proto.ds.title": "Scintillar Design System",
    "home.proto.ds.desc": "Documents complex realtime workflows, recommends a database & infra stack, and ships a one-line installer for a working collaborative starter — most of the hard problems already solved.",
    "home.proto.ds.cta": "Learn more",
    "home.proto.ds.glow": "Premium",
    "home.dashboardTitle": "Real apps, not toys",
    "home.dashboardDescription": "A complete analytics dashboard — stat cards, sortable tables, charts, activity feed — built entirely with Scintillar components. Drop it into your codebase and own every line.",
    "home.dash.cardTitle": "Analytics Overview",
    "home.dash.range": "Last 7 days",
    "home.dash.tab.overview": "Overview",
    "home.dash.tab.revenue": "Revenue",
    "home.dash.tab.users": "Users",
    "home.dash.chartTitle": "Revenue Over Time",
    "home.dash.activityTitle": "Recent Activity",
    "home.dash.tableTitle": "Recent Transactions",
    "home.dash.col.name": "Name",
    "home.dash.col.email": "Email",
    "home.dash.col.status": "Status",
    "home.dash.col.amount": "Amount",
    "home.socialProofTitle": "What developers are saying",
    "home.installHint": "npx shadcn@latest add",
    "home.showcaseTitle": "Built for real apps",
    "home.showcaseDescription": "Real-world patterns from authentication to collaboration, ready to drop into your project.",
    "home.featuresTitle": "Why Scintillar?",
    "home.featureA11yTitle": "Accessible by Default",
    "home.featureA11yDesc": "WCAG 2.1 AA audited. Keyboard navigation, ARIA attributes, and screen reader support out of the box.",
    "home.featurePreviewTitle": "Interactive Previews",
    "home.featurePreviewDesc": "Zoom, pan, and drag on a live canvas. Tweak props in real time and see exactly how components behave.",
    "home.featureCopyTitle": "Copy & Paste",
    "home.featureCopyDesc": "No black-box dependencies. Copy the source into your project and own it completely.",
    "home.featureTypedTitle": "Fully Typed & Tested",
    "home.featureTypedDesc": "Strict TypeScript, 145+ unit tests, E2E coverage, visual regression, and automated accessibility audits.",
    "home.statsComponents": "Components & Blocks",
    "home.statsOpenSource": "Open-Source",
    "home.statsCollaborative": "Collaborative",
    "home.statsAccessible": "Accessible",
    "home.statsLocalized": "Localized",
    "home.statsCoverage": "Test Coverage",
    "home.statsYoursToKeep": "Yours to Keep",
    "home.codeTitle": "Get started in seconds",
    "home.codeDescription": "Add any component from the registry to your project. You own the code.",
    "home.codeCopied": "Copied!",
    "home.ctaTitle": "Ready to build?",
    "home.ctaDescription": "Start adding components to your project today.",
    "home.viewOnGithub": "View on GitHub",
    "footer.components": "Components",
    "footer.docs": "Documentation",
    "footer.gettingStarted": "Getting Started",
    "footer.accessibility": "Accessibility",
    "footer.community": "Community",
    "footer.legal": "Legal",
    "footer.privacy": "Privacy Policy",
    "footer.terms": "Terms of Service",
    "footer.faq": "FAQ",
    "footer.contact": "Contact",
    "footer.copyright": "Scintillar. All rights reserved.",
    "home.uiClientTitle": "Interested by the shell, not the components?",
    "home.uiClientDescription": "Use @sntlr/ui-client to scaffold a complete component documentation site with interactive previews, accessibility audits, and more.",
    "home.uiClientFeature1Title": "Interactive Preview",
    "home.uiClientFeature1Desc": "Zoom, pan, and drag on a live component canvas.",
    "home.uiClientFeature2Title": "Auto-generated Docs",
    "home.uiClientFeature2Desc": "Props, accessibility, and test documentation out of the box.",
    "home.uiClientFeature3Title": "Accessible & i18n",
    "home.uiClientFeature3Desc": "WCAG 2.1 AA compliant with built-in language support.",
    "home.uiClientLearnMore": "Learn more",

    // Hero — Chart
    "hero.chart.title": "Weekly Revenue",
    "hero.chart.range": "7d",
    "hero.chart.day.mon": "Mon",
    "hero.chart.day.tue": "Tue",
    "hero.chart.day.wed": "Wed",
    "hero.chart.day.thu": "Thu",
    "hero.chart.day.fri": "Fri",
    "hero.chart.day.sat": "Sat",
    "hero.chart.day.sun": "Sun",

    // Hero — Notifications
    "hero.notifications.title": "Notifications",
    "hero.notifications.markAllRead": "Mark all as read",
    "hero.notifications.settings": "Notification settings",
    "hero.notifications.settingsAria": "Settings",
    "hero.notifications.searchPlaceholder": "Search...",
    "hero.notifications.dismiss": "Dismiss notification",
    "hero.notifications.markRead": "Mark as read",
    "hero.notifications.markUnread": "Mark as unread",
    "hero.notifications.delete": "Delete",
    "hero.notifications.empty": "No notifications",

    // Hero — Cursors
    "hero.cursors.title": "Live Cursors",
    "hero.cursors.badge": "collaborative",
    "hero.cursors.you": "You",
    "hero.display.group": "Label style",
    "hero.display.name": "Show names",
    "hero.display.avatar": "Show avatars",

    // Hero — Data Table
    "hero.dataTable.searchPlaceholder": "Search invoices...",
    "hero.dataTable.col.invoice": "Invoice",
    "hero.dataTable.col.status": "Status",
    "hero.dataTable.col.method": "Method",
    "hero.dataTable.col.amount": "Amount",
    "hero.dataTable.status.paid": "Paid",
    "hero.dataTable.status.pending": "Pending",
    "hero.dataTable.status.overdue": "Overdue",
    "hero.dataTable.method.card": "Card",
    "hero.dataTable.method.paypal": "PayPal",
    "hero.dataTable.method.bank": "Bank",
    "hero.dataTable.filter.status": "Status",
    "hero.dataTable.filter.method": "Method",
    "hero.dataTable.agg.sum": "Sum",
    "hero.dataTable.agg.avg": "Avg",
    "hero.dataTable.agg.max": "Max",
    "hero.dataTable.columns": "Columns",
    "hero.dataTable.rowsPerPage": "Rows per page",

    // Hero — Profile
    "hero.profile.defaultName": "Jane Doe",
    "hero.profile.defaultBio": "Product designer at Scintillar. Building beautiful and accessible UIs.",
    "hero.profile.title": "Profile",
    "hero.profile.description": "Manage your public profile information.",
    "hero.profile.cancel": "Cancel",
    "hero.profile.save": "Save",
    "hero.profile.uploadHint": "Click to upload",
    "hero.profile.avatarAlt": "Avatar",
    "hero.profile.nameLabel": "Name",
    "hero.profile.namePlaceholder": "Your name",
    "hero.profile.emailLabel": "Email",
    "hero.profile.bioLabel": "Bio",
    "hero.profile.bioPlaceholder": "Tell us about yourself",

    // Hero — WYSIWYG (toolbar aria + author name)
    "hero.wysiwyg.aria.bold": "Bold",
    "hero.wysiwyg.aria.italic": "Italic",
    "hero.wysiwyg.aria.underline": "Underline",
    "hero.wysiwyg.aria.heading": "Heading",
    "hero.wysiwyg.aria.list": "List",
    "hero.wysiwyg.aria.quote": "Quote",
    "hero.wysiwyg.aria.alignLeft": "Align left",
    "hero.wysiwyg.aria.alignCenter": "Align center",
    "hero.wysiwyg.aria.alignRight": "Align right",
    "hero.wysiwyg.author": "Edith",

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
    "themePanel.primaryHex": "Primary color (hex)",
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
    "search.noResults": "Aucun résultat trouvé.",
    "search.groupDocs": "Documentation",
    "search.groupComponents": "Composants",

    // Home
    "home.title": "UI Registry",
    "home.description": "Un registre de composants personnalisé construit avec shadcn. Parcourez la documentation et les composants pour commencer.",
    "home.getStarted": "Commencer",
    "home.browseComponents": "Parcourir les composants",
    "home.openSource": "Open Source",
    "home.builtOnShadcn": "Basé sur shadcn",
    "home.heroTitle": "Scintillar UI",
    "home.heroDescription": "Composants web pensés pour la collaboration en direct pour React & Next.",
    "home.heroFeature.collaborative": "Collaboratifs",
    "home.heroFeature.tested": "Testés",
    "home.heroFeature.accessible": "Accessibles",
    "home.prototypingTitle": "Votre code. Votre dépôt. Nos standards.",
    "home.prototypingDescription": "Libérez-vous de la maintenance du cadre technique. Profitez d'un registre de composants audités qui s'intègrent nativement dans votre workflow et vos tests.",
    "home.proto.openSource.title": "Le code vous appartient",
    "home.proto.openSource.desc": "Les composants atterrissent directement dans votre dépôt. Récupérez-les depuis le registre, modifiez-les comme vous voulez — ou laissez-nous faire le gros du travail.",
    "home.proto.openSource.label.registry": "Registre",
    "home.proto.openSource.label.yours": "votre dépôt",
    "home.proto.tested.title": "Hautement testés",
    "home.proto.tested.desc": "Chaque composant est audité pour l'accessibilité, l'interactivité et la stabilité. De vrais tests, pas des promesses.",
    "home.proto.tested.suite": "Suite de tests",
    "home.proto.tested.passed": "réussis",
    "home.proto.tested.case.renders": "rendu du trigger",
    "home.proto.tested.case.opens": "ouverture au clic",
    "home.proto.tested.case.closes": "fermeture avec Échap",
    "home.proto.tested.case.focus": "piège le focus à l'ouverture",
    "home.proto.tested.case.keyboard": "navigation au clavier",
    "home.proto.tested.case.motion": "respect du prefers-reduced-motion",
    "home.proto.tested.case.axe": "audit axe réussi",
    "home.proto.ai.title": "Conçus pour les agents IA",
    "home.proto.ai.desc": "Nous nous obsédons pour l'AIX (AI Experience) autant que le reste du monde s'obsède pour la DevEX. APIs prévisibles, docs lisibles par machine, props structurées, et un registre que les LLM peuvent naviguer.",
    "home.proto.ds.title": "Scintillar Design System",
    "home.proto.ds.desc": "Documente les workflows temps-réel complexes, recommande une stack base de données & infra, et installe en une ligne un starter collaboratif fonctionnel — la plupart des problèmes durs déjà résolus.",
    "home.proto.ds.cta": "En savoir plus",
    "home.proto.ds.glow": "Premium",
    "home.dashboardTitle": "De vraies applis, pas des jouets",
    "home.dashboardDescription": "Un tableau de bord analytique complet — cartes de stats, tableaux triables, graphiques, fil d'activité — construit entièrement avec les composants Scintillar. Intégrez-le à votre dépôt et appropriez-vous chaque ligne.",
    "home.dash.cardTitle": "Vue d'ensemble analytique",
    "home.dash.range": "7 derniers jours",
    "home.dash.tab.overview": "Vue d'ensemble",
    "home.dash.tab.revenue": "Revenus",
    "home.dash.tab.users": "Utilisateurs",
    "home.dash.chartTitle": "Évolution des revenus",
    "home.dash.activityTitle": "Activité récente",
    "home.dash.tableTitle": "Transactions récentes",
    "home.dash.col.name": "Nom",
    "home.dash.col.email": "Courriel",
    "home.dash.col.status": "Statut",
    "home.dash.col.amount": "Montant",
    "home.socialProofTitle": "Ce que les développeurs en disent",
    "home.installHint": "npx shadcn@latest add",
    "home.showcaseTitle": "Conçu pour de vrais projets",
    "home.showcaseDescription": "Des scénarios concrets, de l'authentification à la collaboration, prêts à intégrer dans votre projet.",
    "home.featuresTitle": "Pourquoi Scintillar ?",
    "home.featureA11yTitle": "Accessible par défaut",
    "home.featureA11yDesc": "Audité WCAG 2.1 AA. Navigation clavier, attributs ARIA et support lecteur d'écran inclus.",
    "home.featurePreviewTitle": "Aperçus interactifs",
    "home.featurePreviewDesc": "Zoomez, glissez et manipulez sur un canevas interactif. Modifiez les props en temps réel.",
    "home.featureCopyTitle": "Copier-coller",
    "home.featureCopyDesc": "Pas de dépendance opaque. Copiez le code dans votre projet et appropriez-vous-le.",
    "home.featureTypedTitle": "Typé et testé",
    "home.featureTypedDesc": "TypeScript strict, plus de 145 tests unitaires, couverture E2E, régression visuelle et audits d'accessibilité automatisés.",
    "home.statsComponents": "Composants et blocs",
    "home.statsOpenSource": "Open-source",
    "home.statsCollaborative": "Collaboratif",
    "home.statsAccessible": "Accessible",
    "home.statsLocalized": "Localisé",
    "home.statsCoverage": "Couverture de tests",
    "home.statsYoursToKeep": "Le code vous appartient",
    "home.codeTitle": "Démarrez en quelques secondes",
    "home.codeDescription": "Ajoutez n'importe quel composant du registre à votre projet. Le code vous appartient.",
    "home.codeCopied": "Copié !",
    "home.ctaTitle": "Prêt à construire ?",
    "home.ctaDescription": "Commencez à ajouter des composants à votre projet dès aujourd'hui.",
    "home.viewOnGithub": "Voir sur GitHub",
    "footer.components": "Composants",
    "footer.docs": "Documentation",
    "footer.gettingStarted": "Commencer",
    "footer.accessibility": "Accessibilité",
    "footer.community": "Communauté",
    "footer.legal": "Légal",
    "footer.privacy": "Politique de confidentialité",
    "footer.terms": "Conditions d'utilisation",
    "footer.faq": "FAQ",
    "footer.contact": "Contact",
    "footer.copyright": "Scintillar. Tous droits réservés.",
    "home.uiClientTitle": "Intéressé par le shell, pas les composants ?",
    "home.uiClientDescription": "Utilisez @sntlr/ui-client pour générer un site de documentation de composants complet avec aperçus interactifs, audits d'accessibilité et plus encore.",
    "home.uiClientFeature1Title": "Aperçu interactif",
    "home.uiClientFeature1Desc": "Zoomez, glissez et manipulez sur un canevas de composants.",
    "home.uiClientFeature2Title": "Docs auto-générées",
    "home.uiClientFeature2Desc": "Documentation des props, de l'accessibilité et des tests incluse.",
    "home.uiClientFeature3Title": "Accessible et i18n",
    "home.uiClientFeature3Desc": "Conforme WCAG 2.1 AA avec support multilingue intégré.",
    "home.uiClientLearnMore": "En savoir plus",

    // Hero — Chart
    "hero.chart.title": "Revenus hebdomadaires",
    "hero.chart.range": "7 j",
    "hero.chart.day.mon": "Lun",
    "hero.chart.day.tue": "Mar",
    "hero.chart.day.wed": "Mer",
    "hero.chart.day.thu": "Jeu",
    "hero.chart.day.fri": "Ven",
    "hero.chart.day.sat": "Sam",
    "hero.chart.day.sun": "Dim",

    // Hero — Notifications
    "hero.notifications.title": "Notifications",
    "hero.notifications.markAllRead": "Tout marquer comme lu",
    "hero.notifications.settings": "Paramètres des notifications",
    "hero.notifications.settingsAria": "Paramètres",
    "hero.notifications.searchPlaceholder": "Rechercher...",
    "hero.notifications.dismiss": "Ignorer la notification",
    "hero.notifications.markRead": "Marquer comme lu",
    "hero.notifications.markUnread": "Marquer comme non lu",
    "hero.notifications.delete": "Supprimer",
    "hero.notifications.empty": "Aucune notification",

    // Hero — Cursors
    "hero.cursors.title": "Curseurs en direct",
    "hero.cursors.badge": "collaboratif",
    "hero.cursors.you": "Vous",
    "hero.display.group": "Style d'étiquette",
    "hero.display.name": "Afficher les noms",
    "hero.display.avatar": "Afficher les avatars",

    // Hero — Data Table
    "hero.dataTable.searchPlaceholder": "Rechercher des factures...",
    "hero.dataTable.col.invoice": "Facture",
    "hero.dataTable.col.status": "Statut",
    "hero.dataTable.col.method": "Méthode",
    "hero.dataTable.col.amount": "Montant",
    "hero.dataTable.status.paid": "Payée",
    "hero.dataTable.status.pending": "En attente",
    "hero.dataTable.status.overdue": "En retard",
    "hero.dataTable.method.card": "Carte",
    "hero.dataTable.method.paypal": "PayPal",
    "hero.dataTable.method.bank": "Virement",
    "hero.dataTable.filter.status": "Statut",
    "hero.dataTable.filter.method": "Méthode",
    "hero.dataTable.agg.sum": "Somme",
    "hero.dataTable.agg.avg": "Moy.",
    "hero.dataTable.agg.max": "Max",
    "hero.dataTable.columns": "Colonnes",
    "hero.dataTable.rowsPerPage": "Lignes par page",

    // Hero — Profile
    "hero.profile.defaultName": "Jeanne Dupont",
    "hero.profile.defaultBio": "Designer produit chez Scintillar. Conçoit des interfaces belles et accessibles.",
    "hero.profile.title": "Profil",
    "hero.profile.description": "Gérez vos informations de profil public.",
    "hero.profile.cancel": "Annuler",
    "hero.profile.save": "Enregistrer",
    "hero.profile.uploadHint": "Cliquez pour téléverser",
    "hero.profile.avatarAlt": "Avatar",
    "hero.profile.nameLabel": "Nom",
    "hero.profile.namePlaceholder": "Votre nom",
    "hero.profile.emailLabel": "Courriel",
    "hero.profile.bioLabel": "Bio",
    "hero.profile.bioPlaceholder": "Parlez-nous de vous",

    // Hero — WYSIWYG (toolbar aria + author name)
    "hero.wysiwyg.aria.bold": "Gras",
    "hero.wysiwyg.aria.italic": "Italique",
    "hero.wysiwyg.aria.underline": "Souligné",
    "hero.wysiwyg.aria.heading": "Titre",
    "hero.wysiwyg.aria.list": "Liste",
    "hero.wysiwyg.aria.quote": "Citation",
    "hero.wysiwyg.aria.alignLeft": "Aligner à gauche",
    "hero.wysiwyg.aria.alignCenter": "Centrer",
    "hero.wysiwyg.aria.alignRight": "Aligner à droite",
    "hero.wysiwyg.author": "Édith",

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
    "themePanel.primaryHex": "Couleur primaire (hexadécimal)",
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
  },
} as const

type TranslationKey = keyof typeof translations.en

type Dictionary = Record<string, string>

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey | (string & {})) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

/** Merge the shell's base translations with any extras a registry provides. */
function mergeDicts(
  extra?: Record<string, Dictionary>,
): { en: Dictionary; fr: Dictionary } {
  return {
    en: { ...translations.en, ...(extra?.en ?? {}) },
    fr: { ...translations.fr, ...(extra?.fr ?? {}) },
  }
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

  const merged = mergeDicts(extraTranslations)

  const t = useCallback(
    (key: TranslationKey | (string & {})) => {
      const k = key as string
      const dict = merged[locale as keyof typeof merged]
      return dict?.[k] ?? merged.en[k] ?? k
    },
    [locale, merged]
  )

  return (
    <I18nContext.Provider value={{ locale, setLocale: changeLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useLocale() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useLocale must be used within I18nProvider")
  return { locale: ctx.locale, setLocale: ctx.setLocale }
}

export function useTranslations() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useTranslations must be used within I18nProvider")
  return ctx.t
}
