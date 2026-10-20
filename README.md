# Savings

A personal savings planner designed for iPhone, with room for everyday spending and smaller Side Quests.

**[Open Savings](https://maguire-ui.github.io/savings-app/)**

## Install on an iPhone

1. Open the website in Safari.
2. Choose **Share → Add to Home Screen**.
3. Keep **Open as Web App** enabled and tap **Add**.
4. Open Savings from its icon while online once. In Settings, confirm **Ready to use offline**.

The downloaded app can then launch and save changes without reaching its web server. No Xcode, developer signing, or weekly reinstall is required. Offline access must first be prepared on each device. Physical iPhone installation and airplane-mode acceptance are separate from automated browser checks.

Safari and a Home Screen installation can have separate storage. Set up the Home Screen version first, or use Export/Restore Backup to move your plan.

## Features

- One main savings goal with circular progress, remaining balance, scheduled-payday forecasts, and contribution history.
- Weekly, true 14-day biweekly, twice-monthly, and monthly pay schedules. Monthly day 31 recovers after short months instead of drifting to day 28.
- Tithing first, optional expenses, then a customizable savings/spending split. Defaults are editable suggestions; income, goals, and activity start empty.
- Focus or Balanced funding. Side Quests share the savings pool; completed quests return future funding to the main goal. Purchases debit only the selected goal.
- Explicit Apply for budget and what-if previews. Projections simulate goal completion and future reallocation without recording transactions.
- Manual savings, withdrawals, purchases, recorded paydays, undo with negative-balance protection, goal editing, archiving, and deletion.
- Fast-food spending estimates and redirection scenarios that never become recorded expenses automatically.
- Light/dark/system appearance, reduced-motion support, safe-area-aware navigation, editable text fields, and interface text selection/double-tap zoom suppression. Pinch accessibility zoom remains available.
- Local storage, JSON backup/restore, previous-save recovery, corrupt-data recovery, startup fallback, and explicit app updates.

## Data and financial calculations

This is a **tracking and planning app**. It does not move money, connect to a bank, or verify balances. No financial data is uploaded by the app; the host receives ordinary requests for its static files. There is no cloud sync, login, or bank connection. Different devices have separate plans.

Money is stored in integer cents. Balances are derived from immutable activity entries with soft undo. Tithing is a percentage of the paycheque; expenses are deducted next; savings are a percentage of the remainder. Side Quest percentages refer to the resulting savings pool, not gross pay. A completed quest's excess contribution for a payday goes to the main goal, preserving every cent. Fractional Side Quest cents round down and the main goal receives the remainder.

Forecasts start on the first scheduled payday on or after today and do not assume missed paydays were recorded. The Nth contribution lands on the Nth scheduled payday. Forecasts assume the planned income and allocations continue, with no interest or investment growth, and have a 50-year limit. Annual averages use 52/26/24/12 paycheques; actual date forecasts follow the calendar. A particular biweekly year may include 27 paydays.

Backups are unencrypted JSON containing your plan and activity. Store them somewhere private. Device/browser storage can be cleared or evicted; keep an exported backup. Currency changes only change formatting and do not convert existing amounts.

## Development

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Node.js 22.12 or newer is recommended. React + TypeScript + Vite. `vite-plugin-pwa` generates a self-contained service worker with local fonts/icons/assets; no runtime CDN or backend is required.

- `src/model.ts`: financial ledger, validation, schedules, allocations, and forecasts.
- `src/storage.ts`: versioned local persistence, stale-tab checks, previous-save backup, and export.
- `src/components/`: UI primitives, forms, Home, Budget, and Settings.
- `src/App.tsx`: screen and sheet composition.
- `tests/model.test.ts`: independent financial and calendar acceptance cases.

## Publish updates

Run `npm run build:pages`, then commit source, lockfile, and the generated `docs/` folder. GitHub Pages is configured to deploy `main` → `/docs`. Source and packaged output should always be committed together. The app offers installed users an Update button, with a backup download first. Never clear the financial storage key during an update.

No real user balances, transactions, credentials, or backup files belong in this repository.

## Verification

On October 20, 2026: the production build and 16 calendar/financial tests passed. Isolated Chromium and WebKit browser checks passed creation, income/date persistence, shared funding, preview/Apply isolation, add/remove records, refresh persistence, backup/restore, cold reload and saves with the server unreachable, corrupt-data recovery, text-selection CSS, and responsive widths from 320 to 1280 pixels. No JavaScript page errors were recorded. Test screenshots use synthetic example data, never seeded into the app. Physical iPhone installation, airplane mode, double-tap/long-press gestures, and long-term storage retention still need device acceptance.
