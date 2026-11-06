# Design System — Paneles CRM (Monday-inspired)

<!-- impeccable:design-schema 1 -->

## World

Operate surfaces for gestor, concesionaria, admin y perito. Identidad visual alineada a **monday.com CRM**: tema claro, dual-rail mental (sidebar de workspace + contenido board), tablas densas, pills de estado en color, mucho aire blanco.

Las páginas públicas (landing, directorios) **no** usan este sistema.

## Palette

| Token | Value | Uso |
|---|---|---|
| `--mon-bg` | `#F6F7FB` | Fondo de página |
| `--mon-surface` | `#FFFFFF` | Cards, sidebar, topbar |
| `--mon-border` | `#E6E9EF` | Bordes finos |
| `--mon-text` | `#323338` | Texto principal |
| `--mon-muted` | `#676879` | Secundario |
| `--mon-primary` | `#0073EA` | CTA, activo, links |
| `--mon-primary-soft` | `#E5F4FF` | Item activo en nav |
| `--mon-teal` | `#00C875` | Éxito / completado |
| `--mon-orange` | `#FDAB3D` | Estado “contactado” |
| `--mon-red` | `#E2445C` | Alerta / prioridad alta |
| `--mon-purple` | `#A25DDC` | Acento secundario |

## Typography

- UI: `Figtree`, fallback `system-ui`
- Escala Operate: 12 / 14 / 16 / 20 / 28
- Títulos de board: 24–28px weight 700
- Celdas de tabla: 14px

## Layout

- Topbar fija ~48–56px con búsqueda centrada
- Sidebar workspace ~250px, fondo blanco, item activo soft blue
- Contenido: padding 24px, cards radius 8–12px, sombra muy suave
- Mobile &lt;992px: sidebar drawer, topbar full-bleed, tablas scroll-X o cards

## Components

- Primary button: fill `#0073EA`, radius 8px, texto blanco
- Secondary: borde `#C5C7D0`, fondo blanco
- Status pill: fondo sólido saturado, texto blanco, radius 4px
- Board group: chevron + color bar + título
- Empty states: ilustración simple + 1–2 CTAs

## Mapping producto ↔ Monday

| Monday | Panel nuestro |
|---|---|
| Home | Dashboard / Inicio |
| Leads | Embudo (leads nuevos / pipeline) |
| Contactos | Clientes |
| Acuerdos | Embudo de trámites / deals |
| Panel de ventas | Finanzas + KPIs dashboard |

## Anti-reference

No conservar el shell Datta Able negro/blanco previo en paneles autenticados.
