---
name: Website variant differentiation
description: Root cause and fix for all AI-generated websites looking identical regardless of design variant
---

## Root Cause
`buildPreviewHtml` in `website-html-generator.ts` is the ONLY rendering path — it's a fixed template that had only 3 CSS branches (`isGlass`, `isLux`, `isBrutalist`) for 9 design variants, so Futuristic/Startup Modern/Premium SaaS/Cinematic Dark all rendered identically.

A second problem: the AI sometimes ignores color constraints and generates a light palette for a dark variant (e.g., Futuristic with white background), making it look like Clean Pro.

## Fix (applied)
1. **`enforceVariantColors(palette, dv)`** — called once in `buildPreviewHtml`, overrides background/surface/text/border based on design variant BEFORE any CSS or HTML is generated. Dark variants get forced dark BGs, light variants get forced light BGs.
2. **Variant CSS blocks** — added distinct CSS for Futuristic (tech grid, neon glow, glowing cards), Cinematic Dark (full-height hero, wide letter-spacing, film aesthetic), Startup Modern (oversized grid stats panel), Luxury Editorial (italic editorial, no stats, transparent CTA button), Glassmorphism (centered hero).
3. **Hero layout branching** — 5 distinct layouts: Futuristic (grid bg overlay), Cinematic Dark (full-height, overline + divider instead of badge), Luxury Editorial (no badge/stats/trusted — pure copy), Startup Modern (stats as grid panel), Split (Premium SaaS/Enterprise Minimal/Clean Pro with product image), Default (centered with orbs).
4. **`buildPreviewHtml`** — enforces colors once, passes modified `we: WebsiteOutput` to ALL section builders (nav, hero, features, etc.) so every section sees the correct colors.

**Why:** The AI model generating website JSON doesn't reliably follow color constraints for each variant. Color enforcement at the rendering layer is the reliable solution.

**How to apply:** If adding a new design variant, add its forced background in `DARK_BG` (or add a new condition in `enforceVariantColors`), add its CSS block in `buildCss`, and add a hero layout branch in `hero()`.
