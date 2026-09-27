## Design system rules

- Use the existing semantic design tokens defined in the application stylesheet.
- Do not introduce new hardcoded colors in component CSS when an existing token can represent the state.
- If a new semantic color is genuinely required, add a design token first instead of hardcoding the value in the component.
- Prefer semantic tokens such as:
  - `--color-brand`
  - `--color-brand-hover`
  - `--color-brand-soft`
  - `--color-ai`
  - `--color-local`
  - `--color-private`
  - `--color-success`
  - `--color-danger`
  - `--color-warning`
  - `--color-info`
  - `--color-focus`
  - `--color-bg-surface`
  - `--color-bg-selected`
  - `--color-text-primary`
  - `--color-text-secondary`
  - `--color-border-default`
  - `--color-border-subtle`

- Existing components may continue using legacy aliases for compatibility:
  - `--accent`
  - `--accent-soft`
  - `--accent-text`
  - `--text`
  - `--text-soft`
  - `--muted`
  - `--surface`
  - `--surface-sunk`
  - `--surface-lift`
  - `--border`
  - `--border-strong`
  - `--button`
  - `--button-hover`
  - `--danger`
  - `--danger-soft`

- New components should prefer the semantic `--color-*` tokens over legacy aliases.

### Color semantics

- Indigo = primary brand and interaction color.
  Use for:
  - primary actions
  - links
  - focus states
  - active navigation
  - selected controls
  - export
  - Markdown-related actions

- Green = positive and local-first semantics.
  Use for:
  - AI
  - local processing
  - privacy
  - connected / ready states
  - success
  - current / Today states where appropriate

- Blue = informational UI only.
  Use `--color-info` rather than treating blue as a second brand color.

- Amber = warning, caution, and attention states.

- Coral / Red = errors, destructive actions, and dangerous states.

- Purple / violet evidence colors are reserved for evidence-related UI.

### Visual balance

Keep the interface predominantly neutral.

Target approximately:

- 75% neutral surfaces and text
- 20% Indigo brand / interaction color
- 5% semantic accent colors

Rules:

- Do not use accent colors decoratively.
- Do not use several semantic colors on the same normal screen unless they communicate real states.
- Do not tint ordinary cards with brand colors.
- Keep note cards and editor surfaces neutral.
- Use subtle surface differences and borders for hierarchy.
- The Rook logo / mascot may use a broader palette than the application UI.

### Light theme

The light theme should use:

- soft neutral application background
- white primary surfaces
- dark slate text
- subtle gray borders
- restrained Indigo interaction states

Avoid making the light theme overly white or washed out.

### Dark theme

The dark theme should use:

- deep navy / slate application background
- slightly lighter surface layers
- soft Indigo interaction states
- clearly readable neutral text
- subtle borders

Do not use:

- pure black backgrounds
- neon colors
- large glowing focus states
- permanently bright outlines around cards or editors

### Component rules

- Preserve existing typography unless the task explicitly requires typography changes.
- Preserve existing spacing unless the task explicitly requires layout changes.
- Preserve existing radii unless the component requires a different semantic shape.
- Do not change component geometry merely to apply a new palette.
- Use neutral cards by default.
- Use semantic colors only when the component state has semantic meaning.
- Focus states must remain clearly visible but subtle.
- Prefer borders and surface contrast over heavy shadows.
- Keep shadows restrained.
- Maintain accessible text/background contrast.
- Explicit user-selected light or dark theme must override the operating-system theme.
- Preserve system-theme support when the user has not made an explicit choice.

### Editor rules

- Editor background should remain neutral.
- Default editor border should use `--color-border-default` or `--color-border-subtle`.
- Focused editor should use `--color-focus`.
- Focus rings must be subtle.
- Do not add blue or Indigo glow effects around the whole editor.
- Do not permanently highlight the editor border with the brand color.

### Sidebar rules

- Sidebar surfaces remain neutral.
- Inactive navigation uses secondary text/icon colors.
- Hover uses neutral hover background.
- Active navigation uses:
  - `--color-bg-selected`
  - `--color-brand`
- Do not make the entire sidebar Indigo.

### Button rules

Primary buttons:

- use `--color-brand`
- hover with `--color-brand-hover`
- text with `--color-on-brand`

Secondary buttons:

- use neutral surfaces
- use neutral borders
- do not use brand backgrounds

Destructive buttons:

- use danger semantic tokens

### Card rules

Normal cards should use:

- `--color-bg-surface`
- `--color-border-subtle`

On hover, increase border emphasis slightly if needed.

Do not tint ordinary cards with Indigo, Green, Amber, or Coral backgrounds.

### Implementation discipline

When modifying styles:

1. Check whether an appropriate token already exists.
2. Use the semantic token if available.
3. If no token exists, determine whether the new value represents a reusable semantic concept.
4. If reusable, add a semantic token.
5. Only use a local hardcoded color when the value is truly component-specific and cannot reasonably become a token.
6. Do not perform unrelated visual redesign while implementing a color change.