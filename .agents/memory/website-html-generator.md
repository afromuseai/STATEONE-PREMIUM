---
name: Website HTML Generator v2
description: Architecture decisions for the class-based CSS website HTML generator
---

The generator (artifacts/stageone/src/lib/website-html-generator.ts) produces self-contained HTML/CSS. Key decisions:

**Why class-based CSS:** Previous version used inline style soup — inconsistent specificity, hard to maintain, poor output quality. Class-based CSS with CSS variables produces consistent, professional results.

**How to apply:** All styling goes through a single `buildCss(w)` function that reads the WebsiteOutput palette/typography. Sections are built by individual functions (nav, hero, features, etc.) using only class names. Never add inline styles except for dynamic values like colors.

**Bento grid:** Feature section uses CSS grid with `grid-column: span N` — first card spans 7/12, subsequent cards span 4-6. Falls back to 1-column on mobile.

**Gradient orbs:** .orb-1, .orb-2, .orb-3 — position:absolute, border-radius:50%, filter:blur(80px), animated with `@keyframes orb`. Always inside a `position:relative;overflow:hidden` parent.

**Design variants:** `w.designVariant` controls border radius, animation style, glassmorphism, brutalist borders. The `isGlass`, `isLux`, `isBrutalist` booleans gate variant-specific CSS blocks.

**Counter animation:** `data-counter="500+"` attribute + IntersectionObserver in buildJs(). Animates from 0 to final value on scroll-into-view.

**howItWorks.subtitle:** The HTML generator expects this field. The backend schema was updated to include it.
