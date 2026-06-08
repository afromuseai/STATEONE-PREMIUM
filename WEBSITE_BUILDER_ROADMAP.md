# STAGEONE — AI Website Builder Roadmap
## Vision: Full Bolt/Lovable Mode

The goal is to replace the current template-based website generator with a true AI web app
builder engine. The AI writes raw HTML/CSS/JS from scratch and the user can then iterate
on it with natural language commands — exactly like Bolt or Lovable.

---

## Why the Current Approach Is Limited

The current pipeline:
1. AI generates structured JSON (brand, colors, sections, copy)
2. Client-side `buildPreviewHtml()` stamps that JSON into a fixed template
3. The template has hardcoded CSS classes, hardcoded grid layouts, hardcoded section order

No matter how many CSS branches or variant tweaks you add, it will always look templated
because the AI never touches the actual markup. The AI is a content writer, not a web builder.

---

## The New Architecture

```
User enters business idea
        │
        ▼
Phase 1 — Strategic Planner (fast, ~5s)
  Model: llama-4-maverick (WEBSITE_PLANNING)
  Output: brand brief, color system, section strategy, tone, design variant
  Streams: architect "thinking" stages shown to user
        │
        ▼
Phase 2 — Code Generator (quality-first, ~40–70s)
  Model: qwen/qwen3.5-122b-a10b or deepseek (COMPONENT_GENERATION)
  Input: full strategic brief + industry context + variant constraints
  Output: ONE complete self-contained HTML file (inline CSS + inline JS)
  Approach:
    - AI writes the ENTIRE document — no template, no slots to fill
    - Full creative control over layout, animations, typography choices
    - System prompt enforces: semantic HTML5, CSS custom properties,
      smooth scroll, mobile-first, no external dependencies except Google Fonts
  Streams: raw HTML token-by-token to client (SSE)
        │
        ▼
Phase 3 — Live Preview
  Client receives full HTML string, writes it into sandboxed iframe via srcdoc
  No post-processing, no template merging — what AI wrote is what renders
        │
        ▼
Phase 4 — Chat-Based Editing (Bolt/Lovable mode)
  User types: "make the hero darker", "add a pricing section", "change font to serif"
  Model: EXECUTION model (nemotron-49b)
  Approach: send current HTML + user instruction → AI returns FULL updated HTML
  Strategy: full-document rewrite (not diff patching) for simplicity and reliability
  Streams: updated HTML replaces iframe content in real time
```

---

## Milestone Breakdown

### M1 — Server-Side HTML Generation (replaces template)
**What changes:**
- New API route: `POST /api/generate/website-v2`
- Two-phase SSE stream:
  - Phase 1 marker: `data: {"phase":"planning","content":"..."}` — streams architect thinking
  - Phase 2 marker: `data: {"phase":"html","content":"..."}` — streams raw HTML tokens
- System prompt for Phase 2 is a detailed web builder prompt (see Prompt Design below)
- Client accumulates HTML chunks → writes final to `iframe.srcdoc`
- Old route `/api/generate/website` kept as fallback during transition

**Key constraint:** HTML must be 100% self-contained (no `<link>` to external CSS, no `<script src>`).
Only Google Fonts CDN `@import` is allowed. All styles inline in `<style>`. All JS inline in `<script>`.

**Acceptance:** A Futuristic SaaS site and a Luxury Editorial site must look visually distinct
without any template code.

---

### M2 — Chat Edit Panel (the "Bolt bar")
**What changes:**
- New UI panel below the website preview: a text input + send button
- "What would you like to change?" placeholder
- On submit: POST to new route `POST /api/generate/website-edit`
  - Body: `{ currentHtml: string, instruction: string, businessContext: string }`
  - Returns: full updated HTML via SSE stream
- Client streams updated HTML into iframe in real time (token by token)
- Edit history sidebar: list of past instructions, click to revert

**Key design decision:** Full document rewrite (not diff/patch) because:
- Diff patching requires perfect HTML parsing which LLMs are unreliable at
- Full rewrites are simpler, always valid, and models are better at them
- The HTML is typically 300–600 lines — a fast model can stream it in ~15s

**Acceptance:** "make the background dark blue" produces a correct result without
breaking the rest of the page.

---

### M3 — Section-Level Regeneration
**What changes:**
- User can right-click (or click a pencil icon on) any section in the preview
- Options: "Regenerate this section", "Delete section", "Add section above/below"
- For regeneration: extract the section's HTML, send it + instruction to the AI,
  splice the new HTML back into the full document
- Requires a section extraction strategy: sections wrapped in
  `<!-- section:hero -->...<!-- /section:hero -->` HTML comments by the generator

**Acceptance:** Regenerating the pricing section updates only that section.

---

### M4 — Export & Persistence
**What changes:**
- "Download HTML" button → downloads the raw AI-generated HTML file (not template output)
- "Download React Project" → AI converts the monolithic HTML into a multi-file
  Next.js 14 project on the server (new route: `POST /api/generate/to-nextjs`)
- Projects saved to DB store the raw HTML string (new `generatedHtml` column on projects table)
- On project load, the saved HTML renders directly in the iframe

---

### M5 — Advanced Editing Features
- **Visual section reordering**: drag to reorder sections, AI rewrites the document
  with the new order
- **Brand consistency checker**: AI reviews the full HTML and flags inconsistencies
  (wrong font used, color mismatch from the brand system)
- **CRO optimizer**: same as current `optimize` endpoint but operates on raw HTML
- **Multi-page support**: AI generates additional pages (About, Contact, Blog index)
  linked from the nav

---

## Prompt Design (M1 — Phase 2 System Prompt)

The system prompt for the HTML generator must include:
1. **Role**: "You are an expert web designer and frontend engineer."
2. **Output contract**: "Return ONLY the complete HTML document. No explanation, no markdown fences."
3. **Technical constraints**:
   - Single self-contained HTML file
   - Google Fonts via `@import` in `<style>` (only allowed external resource)
   - CSS custom properties in `:root` for the color system
   - CSS animations with `@keyframes` (no GSAP, no libraries)
   - Vanilla JS only (no React, no jQuery)
   - Mobile-first responsive design (`@media` breakpoints)
   - `prefers-reduced-motion` media query respected
4. **Quality bar**:
   - Must include: smooth scroll-reveal animations, sticky nav with blur backdrop,
     hover micro-interactions on cards and buttons, gradient text on key headlines,
     animated background elements (orbs, grid, particles — depending on variant)
   - Sections must have visual separation (alternating background tones, dividers, or spacing)
   - Typography hierarchy must be clear (3+ distinct size levels)
5. **Design variant instructions**: Injected per variant (dark/light, typography style,
   color constraints, layout personality)
6. **Business context**: Brand name, industry, tagline, target audience, tone
7. **Section plan**: From Phase 1 — which sections to include and their copy

---

## Model Strategy

| Phase | Model | Why |
|-------|-------|-----|
| Planning | `meta/llama-4-maverick-17b` | Fast structured reasoning, good at JSON strategy |
| HTML Generation | `qwen/qwen3.5-122b-a10b` | Strong code generation, available on this account |
| Chat Editing | `nvidia/llama-3.3-nemotron-super-49b-v1` | Fast enough for conversational latency, good instruction following |
| Section Regen | `qwen/qwen3.5-122b-a10b` | Same model as generation for style consistency |
| NextJS Export | `qwen/qwen3.5-122b-a10b` | Code transformation task |

---

## What Stays, What Goes

**Stays:**
- The `WebsiteOutput` type (used for the Sections tab / editable fields)
- The Phase 1 strategic planner and its prompts
- The business context injection (industry design systems)
- The tabs UI (Design / Sections / Code / Export)
- The existing `/api/generate/website` route (kept as v1 fallback)

**Goes (eventually):**
- `buildPreviewHtml()` in `website-html-generator.ts` — no longer the primary render path
- `buildCss()` and all the variant CSS branches (replaced by AI-written CSS)
- `enforceVariantColors()` — not needed when AI owns the colors
- All the section builder functions (`hero()`, `features()`, `pricing()`, etc.)

**Migration path:** Run v1 (template) and v2 (AI-generated) in parallel. Add a toggle
in the UI: "Classic" vs "AI Builder". Once v2 is stable, retire v1.

---

## Technical Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| AI generates invalid HTML | Use `DOMParser` on the client to validate before rendering; show error + retry button |
| Generation takes >90s | Show streaming progress bar with token counter; first meaningful chunk appears in <10s |
| AI ignores design variant constraints | System prompt has explicit per-variant CSS rules section; add variant as a strong instruction prefix |
| Full-document rewrites are slow for small edits | For edits that mention a specific section, use section-level regen (M3) instead |
| iframe sandboxing limits | Use `srcdoc` with `sandbox="allow-scripts allow-same-origin"` — sufficient for preview |
| Model hallucinates external CDN links | System prompt explicitly lists what is and isn't allowed; post-process to strip `<script src>` and `<link rel=stylesheet>` |

---

## Implementation Order

1. **M1** — Core AI HTML generation (replaces template). This is the foundation.
2. **M2** — Chat editing bar. This is the "wow" feature that makes it feel like Bolt.
3. **M4** — Export + persistence (save raw HTML to DB).
4. **M3** — Section-level regen (requires section comment markers from M1).
5. **M5** — Advanced features (after core loop is solid).

Each milestone is independently shippable.

---

*Last updated: June 2026*
