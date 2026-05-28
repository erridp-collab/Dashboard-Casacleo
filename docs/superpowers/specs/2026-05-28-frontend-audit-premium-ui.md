# Frontend Audit — Premium UI Polish
**Data:** 2026-05-28  
**Approccio:** Layer-by-Layer con checkpoint anti-regressioni  
**Contesto:** App in fase di distribuzione a terzi (MVP → prodotto). Stile target: Clean SaaS moderno con palette burgundy/amber esistente, non AI-generico.

---

## Obiettivo

Portare Alva Host Manager da tool operativo personale a prodotto distribuibile a terzi. Non aggiungere funzionalità — ottimizzare estetica, coerenza visiva e leggibilità di tutto ciò che già esiste.

---

## Layer 1 — Fondazioni globali (`globals.css`)

### 1a · Token colore semantici
Aggiungere variabili CSS semantiche mancanti. Il problema attuale: `bg-white` puro su sfondo `hsl(42 50% 96%)` non ha abbastanza contrasto; le card si perdono nello sfondo.

**Nuovi token da aggiungere:**
```css
--surface-1: 40 60% 99%;      /* #fdfaf7 — bg card, input */
--surface-2: 38 35% 93%;      /* #f0ebe2 — bg section hover, zebra */
--border-subtle: 32 30% 85%;  /* #e0d5c8 — border card warm */
--border-default: 32 25% 80%; /* #d9cfc4 — border input */
--text-primary: 30 60% 8%;    /* #1a1108 — titoli */
--text-secondary: 28 25% 45%; /* #8a7060 — label, subtitle */
--text-tertiary: 28 20% 55%;  /* #a09080 — metadati, placeholder */
--shadow-warm: rgba(80,40,20,0.07); /* shadow tint warm invece di neutral grey */
```

**Modifica background:** `--background: 38 35% 90%` (leggermente più scuro/saturo dell'attuale 42 50% 96% per creare contrasto con le card `--surface-1`).

### 1b · Scala tipografica (da applicare uniformemente in tutte le pagine)

| Ruolo | Classe Tailwind | Note |
|---|---|---|
| Page title | `text-[28px] font-bold tracking-tight` | Una volta per pagina |
| Section header (card title) | `text-lg font-semibold` | In CardHeader |
| Body / label form | `text-sm font-medium` | Testo corrente |
| Subtitle / note | `text-xs` | Date, metadati |
| Micro label | `text-[10px] font-bold uppercase tracking-[.06em]` | Header colonne, badge label |

### 1c · Border radius unificato

| Contesto | Classe | px |
|---|---|---|
| Bottoni sm, badge, input sm | `rounded-lg` | 8px |
| Bottoni md/lg, dropdown | `rounded-xl` | 12px |
| Card, modal | `rounded-2xl` | 16px |
| Pill / dot / avatar | `rounded-full` | — |

**Verifica checkpoint:** nessuna regressione sui layout esistenti prima di procedere.

---

## Layer 2 — Componenti core

### 2a · `components/card.tsx`
- `bg-white` → `bg-surface-1` (token warm)
- `border-zinc-200` → `border-border-subtle` (warm)
- `shadow-sm` → `shadow-[0_1px_3px_var(--shadow-warm),0_4px_16px_rgba(80,40,20,0.04)]`
- Separatore in `CardHeader`: da nulla a `<div className="h-px bg-gradient-to-r from-border-subtle to-transparent mt-4 mb-5" />`
- Font header: `font-semibold` → `font-bold` + `tracking-tight`

### 2b · `components/kpi-card.tsx`
Aggiungere prop `icon?: LucideIcon` opzionale. Layout ridisegnato:

```
┌──────────────────────────────┐
│ MICRO LABEL       [icon 28px]│
│                              │
│ 28px extrabold value         │
│ xs subtitle semantico        │
└──────────────────────────────┘
```

- Value: `text-xl` → `text-[28px] font-extrabold tracking-tight leading-none`
- Dot indicatore stato: rimosso, sostituito da micro-label colorata in cima
- Icon box: `w-7 h-7 rounded-lg` con bg tinted del colore status

### 2c · Sistema bottoni — classi utility in `globals.css`

```css
@layer components {
  .btn-primary   { @apply inline-flex items-center gap-2 rounded-xl bg-sidebar-bg px-4 py-2.5 text-sm font-semibold text-brand shadow-sm transition hover:opacity-90 active:scale-95; }
  .btn-secondary { @apply inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-1 px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-surface-2 active:scale-95; }
  .btn-ghost     { @apply inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-text-secondary underline underline-offset-3 transition hover:text-text-primary; }
  .btn-danger    { @apply inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100 active:scale-95; }
  .btn-sm        { @apply h-8 px-3 text-xs; }
  .btn-md        { @apply h-10 px-4 text-sm; }
  .btn-lg        { @apply h-11 px-5 text-sm; }
}
```

Sostituire tutte le classi inline ad-hoc nelle pagine con queste utility. Nessuna logica cambia, solo presentazione.

### 2d · Form inputs — `globals.css`

```css
@layer components {
  .input-base {
    @apply h-11 w-full rounded-xl border border-border-default bg-surface-1 px-3.5 text-sm text-text-primary
           transition placeholder:text-text-tertiary
           focus:border-sidebar-bg focus:outline-none focus:ring-2 focus:ring-sidebar-bg/10;
  }
  .label-base {
    @apply text-[10px] font-bold uppercase tracking-[.06em] text-text-secondary;
  }
}
```

Applicare `input-base` e `label-base` a tutti i form: `bookings/page.tsx`, `actions/page.tsx`, `finance/page.tsx`, `inventory/page.tsx`.

**Verifica checkpoint:** form funzionano correttamente su mobile e desktop, nessun input rotto.

---

## Layer 3 — Navigazione & Icone

### 3a · `components/top-bar.tsx`
- Logo: aggiungere `div` 26×26 con `bg-brand rounded-[7px]` che contiene `BookOpen` icon `stroke-sidebar-bg` — crea contrasto amber su burgundy
- Nome: separare in 2 righe `Alva Host` (13px bold) / `Manager` (9px uppercase tracking, amber/70)
- Active nav link: da `bg-white/15` a `bg-brand/15 border border-brand/25` — più definito
- Topbar background: `bg-sidebar-bg` → sfumatura leggermente più scura `bg-[#5c1526]` per più profondità

### 3b · `components/bottom-nav.tsx`
- Active indicator: aggiungere `<span>` assoluto `top-0 left-1/2 -translate-x-1/2 w-6 h-[3px] bg-brand rounded-b-sm` sopra l'icona attiva — barra amber invece del fill opaco
- Rimuovere `bg-white/15` dall'item attivo (la barra è sufficiente)
- Label attiva: `text-brand font-bold` (già corretto), inattiva: `text-white/35`

### 3c · `components/action-badges.tsx` — ActionTypeBadge
Layout ridisegnato per ogni tipo azione:

```tsx
// Struttura per ogni badge
<div className="flex items-center gap-2.5">
  <div className={`w-[30px] h-[30px] rounded-lg flex items-center justify-center ${config.iconBg}`}>
    <Icon className={`h-4 w-4 ${config.iconColor}`} />
  </div>
  <span className={`text-xs font-semibold ${config.textColor}`}>{label}</span>
</div>
```

Mappa tipo → config (Lucide icons, NO emoji):

| Tipo | Icon (Lucide) | iconBg | iconColor | borderLeft |
|---|---|---|---|---|
| PULIZIA | `Sparkles` | `bg-emerald-100` | `text-emerald-700` | `border-l-emerald-500` |
| BIANCHERIA | `Layers` | `bg-purple-100` | `text-purple-700` | `border-l-purple-500` |
| LAVATRICI | `WashingMachine` / `Wind` | `bg-orange-100` | `text-orange-700` | `border-l-orange-500` |
| SPESA | `ShoppingCart` | `bg-slate-100` | `text-slate-600` | `border-l-slate-400` |
| MANUTENZIONE | `Wrench` | `bg-amber-100` | `text-amber-700` | `border-l-amber-500` |
| default | `ClipboardList` | `bg-zinc-100` | `text-zinc-600` | `border-l-zinc-300` |

Card azione nel listino: aggiungere `border-l-[3px]` colorato, rimuovere bordo rotondo sinistro (`rounded-xl` → `rounded-r-xl`).  
Azioni FATTO: `opacity-70` + title `line-through`.

### 3d · Page headers — tutte le pagine
Ogni pagina `page.tsx` aggiorna il proprio `<header>`:

```tsx
<header className="flex items-center gap-4">
  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-sidebar-bg">
    <PageIcon className="h-5 w-5 text-brand" />
  </div>
  <div>
    <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Titolo</h1>
    <p className="text-xs text-text-secondary">Sottotitolo contestuale</p>
  </div>
</header>
```

Icone per pagina: Dashboard=`LayoutDashboard`, Bookings=`BedDouble`, Actions=`CheckSquare`, Inventory=`Warehouse`, Finance=`TrendingUp`, Settings=`Settings2`.

**Verifica checkpoint:** navigazione funziona su mobile e desktop, tutti i link attivi si evidenziano correttamente.

---

## Layer 4 — Calendario & Pagine specifiche

### 4a · Calendario — `globals.css` (sezione `.calendar-modern`)

Tre modifiche mirate al CSS esistente, zero cambio libreria:

1. **Oggi — da blu ad amber brand:**
```css
/* BEFORE */
.calendar-modern .fc-daygrid-day.fc-day-today {
  background: rgba(59, 130, 246, 0.08);
}
/* AFTER */
.calendar-modern .fc-daygrid-day.fc-day-today {
  background: rgba(245, 200, 66, 0.15);
  border: 1.5px solid rgba(245, 200, 66, 0.45);
  border-radius: 6px;
}
```

2. **Eventi pill — più premium:**
```css
/* AFTER */
.calendar-modern .fc-event {
  border: 0;
  border-radius: 8px;    /* era 10px, più coerente */
  padding: 0.15rem 0.4rem;
  font-size: 0.72rem;
  font-weight: 700;
  box-shadow: 0 2px 6px rgba(0,0,0,0.18);  /* più definita */
  letter-spacing: 0.02em;
}
```

3. **Legenda — quadratini invece di pill rotondi:**
```css
.calendar-legend-token {
  border-radius: 4px;   /* era 999px */
  min-width: 1.1rem;
  height: 1.1rem;
}
```

In `app/page.tsx` aggiornare il markup della legenda: usare `w-2.5 h-2.5 rounded-[3px]` invece dei token circolari, aggiungere la label testuale completa (non abbreviata) accanto ad ogni voce.

### 4b · Finance — `app/finance/page.tsx`

Aggiornare i `fill`/`stroke` nei componenti Recharts:

| Componente | Prop | Valore attuale | Valore proposto |
|---|---|---|---|
| `Bar` entrate | `fill` | default | `#701a2f` |
| `Bar` uscite | `fill` | default | `#f5c842` |
| `Line` profit | `stroke` | default | `#16a34a` |
| `CartesianGrid` | `stroke` | default | `#e0d5c8` |
| `Tooltip` | `contentStyle` | — | `{ background: '#fdfaf7', border: '1px solid #e0d5c8', borderRadius: 12 }` |

### 4c · Dashboard — `app/page.tsx`

Riorganizzare l'ordine degli elementi: **KPI cards prima, calendario dopo.**

```tsx
// BEFORE: Calendar card → KPI grid
// AFTER:
<section className="space-y-6">
  <header>...</header>
  
  {/* KPI grid — informazioni critiche subito visibili */}
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <KpiCard ... />
  </div>
  
  {/* Calendario — dopo i numeri */}
  <Card>
    <CardHeader title="Calendario" ... />
    <CalendarClient />
    {/* legenda aggiornata */}
  </Card>
</section>
```

**Verifica checkpoint finale:** testare su mobile (iPhone/Android) e desktop, verificare che tutti e 5 i tab del BottomNav portino alla pagina corretta, che i form di bookings/actions/finance/inventory funzionino correttamente, che i toast appaiano.

---

## File toccati (riepilogo)

| File | Layer | Tipo cambio |
|---|---|---|
| `app/globals.css` | 1, 2, 3 | Token, utility classes, calendario CSS |
| `components/card.tsx` | 2 | Styling surface + separator |
| `components/kpi-card.tsx` | 2 | Layout + icon prop + value size |
| `components/top-bar.tsx` | 3 | Logo + active state |
| `components/bottom-nav.tsx` | 3 | Indicator bar |
| `components/action-badges.tsx` | 3 | Lucide icons + border-left layout |
| `app/page.tsx` | 3, 4 | Page header + ordine KPI/calendar + legenda |
| `app/bookings/page.tsx` | 2, 3 | btn-* + input-base + page header |
| `app/actions/page.tsx` | 2, 3 | btn-* + input-base + page header + card azioni |
| `app/finance/page.tsx` | 2, 3, 4 | btn-* + page header + Recharts colors |
| `app/inventory/page.tsx` | 2, 3 | btn-* + input-base + page header |
| `app/settings/page.tsx` | 3 | Page header |

---

## Vincoli & anti-regressioni

- **Nessuna modifica a logica, API, o state management** — solo presentazione
- **Checkpoint dopo ogni layer** prima di iniziare il successivo
- I componenti `skeleton.tsx` e `toast.tsx` NON vanno toccati (già corretti)
- Il componente `sidebar.tsx` è codice morto — può essere rimosso durante questo lavoro
- Tutti i cambi bottoni usano le utility class nuove: mai aggiungere nuove classi inline ad-hoc
- Mobile-first: ogni cambio va verificato a 375px prima che a desktop
