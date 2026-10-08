# Design System Master File: Rook Lite v2

> **Source of Truth:** Defines the global visual design tokens, typography, and component specifications for Rook Lite v2.
> Adheres strictly to **Premium Utilitarian Minimalism & Editorial UI** standards.

---

**Project:** Rook Lite v2  
**Philosophy:** Warm Monochrome + Muted Pastels + Editorial Typography  
**Target:** Local-First, Private Notebook Experience  

---

## 1. Global Tokens

### Color Palette (Warm Monochrome + Spot Pastels)

#### Light Mode
| Role | Hex / Value | CSS Variable | Usage |
|------|-------------|--------------|-------|
| Canvas / App | `#FBFBFA` | `--color-bg-app` | Warm bone reading background |
| Surface (Cards) | `#FFFFFF` | `--color-bg-surface` | Pure white note cards |
| Surface Sunken | `#F5F4F0` | `--color-bg-sunken` | Badges, tags, search fields |
| Surface Hover | `#EFECE6` | `--color-bg-hover` | Hover states |
| Text Primary | `#242426` | `--color-text-primary` | Charcoal reading text |
| Text Secondary | `#5F6368` | `--color-text-secondary` | Metadata, timestamps |
| Text Muted | `#9E9E9E` | `--color-text-muted` | Secondary hints |
| Border Subtle | `#EAE8E3` | `--color-border-subtle` | 1px card and divider borders |
| Border Default | `#DFDCD6` | `--color-border-default` | Active borders, input borders |
| Brand | `#18181B` | `--color-brand` | Confident charcoal interaction |
| On Brand | `#FFFFFF` | `--color-on-brand` | White text on brand buttons |
| Focus | `#18181B` | `--color-focus` | Keyboard focus ring |

#### Dark Mode
| Role | Hex / Value | CSS Variable | Usage |
|------|-------------|--------------|-------|
| Sidebar | `#09090B` | `--color-bg-sidebar` | Pitch obsidian rail |
| Canvas / App | `#121214` | `--color-bg-app` | Matte charcoal canvas |
| Surface (Cards) | `#18181B` | `--color-bg-surface` | Elevated note cards |
| Surface Hover | `#222226` | `--color-bg-hover` | Hover states |
| Text Primary | `#F4F4F5` | `--color-text-primary` | High contrast off-white |
| Text Secondary | `#A1A1AA` | `--color-text-secondary` | Muted metadata |
| Border Subtle | `#1E1E22` | `--color-border-subtle` | Dark mode dividers |
| Brand | `#FFFFFF` | `--color-brand` | Clean white contrast |
| On Brand | `#09090B` | `--color-on-brand` | Dark text on brand |

#### Spot Pastels
| Pastel Name | Light Bg | Light Text | Dark Bg | Dark Text |
|-------------|----------|------------|---------|-----------|
| Pale Blue | `#E1F3FE` | `#1F6C9F` | `#162838` | `#7AC5F8` |
| Pale Green | `#EDF3EC` | `#346538` | `#142B1D` | `#7EE0A2` |
| Pale Yellow | `#FBF3DB` | `#956400` | `#2D2511` | `#F5CE70` |
| Pale Red | `#FDEBEC` | `#9F2F2D` | `#311718` | `#F88587` |
| Pale Purple | `#F5F3FF` | `#6D28D9` | `#241838` | `#C5A5FA` |

---

## 2. Typography

*No third-party webfonts are loaded directly over the network to protect local privacy.*

- **UI & App Sans-Serif:**  
  `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Geist Sans", "Segoe UI", Roboto, sans-serif`
- **Editorial Headings (Serif):**  
  `"Newsreader", "Charter", "Lyon Text", "Iowan Old Style", "Playfair Display", "Times New Roman", "Georgia", "Cambria", serif`
- **Monospace (Code & Keystrokes):**  
  `"SFMono-Regular", ui-monospace, "Geist Mono", "JetBrains Mono", Menlo, Monaco, Consolas, monospace`

---

## 3. Radii & Shadows

- **Border Radius:**
  - `xs`: `4px` (Tags, status chips, kbd badges, inner tab buttons)
  - `sm`: `6px` (Buttons, tab containers, collapse buttons)
  - `md`: `8px` (Note cards, todo items, editor toolbar)
  - `lg`: `10px` (Command palette modal)
  - `full`: `999px` (Avatars, radio toggles)
- **Shadows:**
  - Light mode: Diffused, low-opacity (`rgba(0, 0, 0, 0.02)` to `0.06`).
  - Dark mode: Soft ambient (`rgba(0, 0, 0, 0.25)` to `0.45`).

---

## 4. Component Rules

- **Buttons:** Solid `#18181B` (light) / `#FFFFFF` (dark), crisp `6px` border-radius. Active state responds with physical `transform: scale(0.98)`.
- **Note Cards:** Clean `1px` border, `8px` border radius, generous internal padding (`1.35rem 1.6rem`), subtle diffused hover shadow.
- **Tasks & Lists:** Custom circular SVG-style interactive checkboxes that fill with brand color on check and animate a strike-through across the completed text.
- **Command Palette:** Translucent backdrop with `blur(8px)`, centered `42rem` container, keyboard navigation with monospace `<kbd>` shortcuts.
