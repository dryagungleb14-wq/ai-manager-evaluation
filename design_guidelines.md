# Design Guidelines: AI Manager Evaluation Service

## Design Approach
**System-Based Approach** using Material Design principles adapted for enterprise B2B productivity tools. This approach prioritizes clarity, efficiency, and data hierarchy over decorative elements, ensuring managers can quickly analyze conversations and extract actionable insights.

## Core Design Principles
1. **Data-First Hierarchy**: Information flows from input → analysis → results with clear visual separation
2. **Professional Trust**: Clean, authoritative design that conveys reliability in business-critical evaluations
3. **Efficient Workflows**: Minimal clicks, clear CTAs, instant visual feedback on processing states
4. **Cognitive Clarity**: Reduce mental load through consistent patterns and predictable interactions

## Color Palette

### Dark Mode (Primary)
- **Background Base**: 220 15% 12% (deep slate)
- **Surface Elevated**: 220 15% 18% (card/panel backgrounds)
- **Surface Accent**: 220 20% 25% (hover states, borders)
- **Primary Brand**: 210 100% 60% (vibrant blue for CTAs, key actions)
- **Success**: 142 70% 50% (checklist passed, positive outcomes)
- **Warning**: 38 92% 55% (uncertain/partial status)
- **Error**: 0 72% 55% (failed items, critical issues)
- **Text Primary**: 220 10% 95% (main content)
- **Text Secondary**: 220 10% 70% (labels, metadata)
- **Text Tertiary**: 220 10% 50% (timestamps, hints)

### Accent Colors
- **Objection Highlight**: 280 60% 60% (purple for flagged objections)
- **Citation Background**: 210 100% 60% with 10% opacity (quote highlights)

## Typography

### Font Stack
- **Primary**: 'Inter', -apple-system, system-ui, sans-serif (excellent Cyrillic support, professional)
- **Monospace**: 'JetBrains Mono', 'Fira Code', monospace (for transcripts, technical data)

### Scale
- **Hero/H1**: text-4xl font-bold (36px) - page titles
- **Section/H2**: text-2xl font-semibold (24px) - report sections
- **Card/H3**: text-lg font-medium (18px) - checklist items
- **Body**: text-base (16px) - main content, transcripts
- **Labels**: text-sm (14px) - form labels, metadata
- **Captions**: text-xs (12px) - timestamps, hints

## Layout System

### Spacing Primitives
Consistent use of Tailwind units: **2, 4, 6, 8, 12, 16, 24** for most layouts
- Component padding: p-6 to p-8
- Section margins: mb-12 to mb-16
- Card gaps: gap-4 to gap-6
- Form spacing: space-y-4

### Grid Structure
- **Main Layout**: Two-column on desktop (70/30 split) - Content | Checklist Selector
- **Results**: Stacked cards with full-width sections
- **Forms**: Single column, max-w-2xl for optimal readability
- **Checklist Items**: List layout with clear separation (border-b dividers)

## Component Library

### Core UI Elements

**File Upload Zone**
- Dashed border (border-dashed border-2) with primary color on hover/dragover
- Large dropzone (min-h-64) with centered icon and text
- Visual feedback: border color changes, background opacity shift on drag

**Transcript Preview**
- Monospace font, line-height-relaxed
- Speaker labels in bold with color coding (Manager/Client distinction)
- Timestamps in muted text on left margin
- Editable textarea with subtle focus ring

**Checklist Panel**
- Fixed right sidebar on desktop (w-80), drawer on mobile
- Sticky header with checklist selector dropdown
- Item cards with type badges (mandatory/recommended/prohibited)
- Visual type indicators: green dot (mandatory), blue (recommended), red (prohibited)

**Report Cards**
- Elevated surface (bg-surface-elevated) with shadow-lg
- Header with icon + title
- Collapsible sections for detailed breakdown
- Status indicators: checkmark (passed), X (failed), question mark (uncertain)

**Evidence Citations**
- Inline quote bubbles with left border-accent
- Timestamp links (clickable if audio available)
- Hover state reveals full context

### Navigation
- Top bar: Logo left, mode toggle (Звонок/Переписка) center, settings/help right
- Tab pills with active state (bg-primary, text-white)
- Breadcrumb for multi-step flows (Upload → Transcribe → Analyze → Results)

### Forms
- Floating labels that shrink on focus/fill
- Input fields: bg-surface-elevated, border-subtle, focus:ring-primary
- Primary buttons: bg-primary, hover:bg-primary-darker, px-8 py-3, rounded-lg
- Secondary buttons: variant="outline" with border-primary

### Data Displays

**Checklist Status Grid**
- Badge components for status (rounded-full, px-3 py-1)
- Progress bars for overall completion (h-2 rounded-full)
- Score visualization: 0-1 scale as percentage with color gradient

**Objection Cards**
- Category tag (small, uppercase, letter-spacing-wide)
- Two-column layout: Client phrase | Manager response
- Handling status badge (handled: green, partial: yellow, unhandled: red)
- Recommendation text in italic, muted color

### Overlays
- Modal dialogs: centered, max-w-lg, backdrop blur-sm
- Toast notifications: top-right, slide-in animation, auto-dismiss 5s
- Progress overlays: full-screen semi-transparent with spinner + status text

## Animations
**Minimal Motion** - Use sparingly:
- Fade-in for new content (duration-200)
- Slide transitions for panels (transform, duration-300)
- Loading spinner: rotate animation for processing states
- No decorative animations - focus on functional feedback

## Images
**No hero images** for this utility application. Focus entirely on functional UI elements. 

**Icons**: Use Heroicons (outline for navigation, solid for status indicators)
- Upload: cloud-arrow-up
- Success: check-circle (solid)
- Error: x-circle (solid)
- Uncertain: question-mark-circle (outline)
- Play audio: play-circle
- Export: arrow-down-tray

## Accessibility & Dark Mode
- Maintain WCAG AA contrast ratios (4.5:1 text, 3:1 UI)
- All interactive elements: min-h-11 for touch targets
- Focus indicators: 2px ring-primary, offset-2
- Skip links for keyboard navigation
- Form inputs with dark backgrounds (bg-surface-elevated) and white text
- Error states with both color and icon indicators

## Key Screen Patterns

**Main Analysis Screen**: Split view - Upload/Input left (2/3 width), Checklist selector right (1/3). Progress bar fixed at top during processing.

**Results View**: Full-width stacked layout - Summary card → Checklist report → Objections report. Each expandable with smooth transitions.

**Checklist Editor**: Modal overlay, full-height, scrollable item list with drag handles for reordering.