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

## Update the Home Screen app

Keep the existing icon installed. In **Settings → App updates**, tap **Check for updates**, then **Update now** when a new version is ready. This refreshes the app files and keeps the saved plan. Update checks do not record income or change settings. Save any form edits before applying an update.

Version 1.1.0 checks on registration, resume/focus and reconnect, with a one-minute throttle for automatic checks. Manual checks bypass that throttle. It waits for installation to finish, reports network/download failures honestly, and only reloads after explicit Update. Applying from another tab does not discard this tab's draft. Settings shows the running app version and a permanent update control; downloaded offline readiness remains correct after reopening. The financial schema stays at version 1.

If an older installed copy has no Settings update control yet, fully close it from the iPhone app switcher, reopen it online, and check the top of Home for the original Update prompt. Allow the download and reopen once more if needed. Do not delete the app or clear website data to get an update. Export a backup from the installation containing the plan before any reinstall or move.

## Features

- One main savings goal with circular progress, remaining balance, scheduled-payday forecasts, and contribution history.
- Weekly, true 14-day biweekly, twice-monthly, and monthly pay schedules. Monthly day 31 recovers after short months instead of drifting to day 28.
- Tithing first, optional expenses, then a customizable savings/spending split. Defaults are editable suggestions; income, goals, and activity start empty.
- Focus or Balanced funding. Side Quests share the savings pool; completed quests return future funding to the main goal. Purchases debit only the selected goal.
- Explicit Apply for budget and what-if previews. Projections simulate goal completion and future reallocation without recording transactions.
- Record actual income: enter earnings, review tithing and the dollar split between your main goal, individual Side Quests, and fun money, then confirm. Nothing is added automatically on a payday.
- Adjustable income percentages with a 50/30/20 shortcut, one-time preview by default, and an explicit option to remember the split. Expected income and paydays remain planning forecasts.
- Settings has direct percentage fields for main-goal savings, every eligible Side Quest, and spending, with tithing/expenses first, live dollar previews, a required 100% total, and explicit Save income split / Save settings actions. Budget uses linked numeric savings/spending fields instead of a savings slider.
- Manual savings adjustments, withdrawals, purchases, whole-entry undo with negative-balance protection, goal editing, archiving, and deletion.
- Fast-food spending estimates and redirection scenarios that never become recorded expenses automatically.
- Light/dark/system appearance, reduced-motion support, safe-area-aware navigation, editable text fields, and interface text selection/double-tap zoom suppression. Pinch accessibility zoom remains available.
- Local storage, JSON backup/restore, previous-save recovery, corrupt-data recovery, startup fallback, and explicit app updates.

To correct an accidental entry, open it under **Recent activity → Activity details → Undo record**. Review every affected goal, then choose **Undo entry** and record the correct amount. The original receipt stays visible as Undone. The button remains in its original location. New records also remember funding/completion and scheduled-payday changes caused by that entry; undo restores those when later edits do not conflict. Older receipts still reverse all their goal contributions, but cannot restore settings that were never recorded in their history.

## Data and financial calculations

This is a **tracking and planning app**. It does not move money, connect to a bank, or verify balances. No financial data is uploaded by the app; the host receives ordinary requests for its static files. There is no cloud sync, login, or bank connection. Different devices have separate plans.

Money is stored in integer cents. Balances are derived from immutable activity entries with soft undo. Tithing is a percentage of the paycheque; expenses are deducted next; savings are a percentage of the remainder. Side Quest percentages refer to the resulting savings pool, not gross pay. A completed quest's excess contribution for a payday goes to the main goal, preserving every cent. Fractional Side Quest cents round down and the main goal receives the remainder.

In **Record income**, destination percentages apply to the money left after tithing and expenses. With $200 earned, 10% tithing, no expenses, and a 50/30/20 split, the receipt is $20 tithing, $90 main goal, $54 Side Quests, and $36 fun. Each Side Quest shows its own amount; completed-goal overflow returns to the main goal. Fun money and tithing are receipt allocations, not separate account balances. Confirmation records goal contributions; it does not move money. Marking an earning as the scheduled payday is optional and advances the schedule only after confirmation.

In **Settings → Your income split**, tithing, expenses, main-goal savings, individual Side Quests and spending share one calculation list. It shows the full pay, tithing percentage/amount, remaining amount, the base used for each percentage, and the accounted-for total. A 60% main / 30% Side Quest / 10% spending plan with $200 income and 10% tithing is $20 tithing, then 60% of the remaining $180 = $108 main, $54 Side Quest, and $18 spending. With tithing set to 0%, 60% of $200 is $120. The income amount is per payday; select Monthly frequency if it represents monthly income. Each Side Quest has its own field; a positive share activates a wishlist or paused goal when the settings are saved. Saving a plan changes future allocation and forecasts without adding transactions or changing existing balances. Exact-cent contributions are protected from floating-point noise when a saved pool share is a repeating fraction, such as one third.

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
- `src/income.ts`: actual-income allocation previews and confirmed income receipts.
- `src/useAppUpdates.ts`: explicit update checks, resume/reconnect discovery, safe activation and current/download-error states.
- `src/storage.ts`: versioned local persistence, stale-tab checks, previous-save backup, and export.
- `src/components/`: UI primitives, forms, Home, Budget, and Settings.
- `src/App.tsx`: screen and sheet composition.
- `tests/model.test.ts`, `tests/income.test.ts`, `tests/undo.test.ts`, and `tests/math-audit.test.ts`: independent financial, calendar, manual-income, undo, and exact-arithmetic audit cases.

## Publish updates

Run `npm run build:pages`, then commit source, lockfile, and the generated `docs/` folder. GitHub Pages is configured to deploy `main` → `/docs`. Source and packaged output should always be committed together. The app offers installed users an Update button, with a backup download first. The app keeps the same `savings.app.v1` data key and schema across these updates. Service-worker cache cleanup only replaces app files. Never clear the financial storage key during an update.

No real user balances, transactions, credentials, or backup files belong in this repository.

## Verification

On October 20, 2026: the production build and 48 calendar/financial/undo tests passed. Isolated Chromium and WebKit browser checks passed creation, income/date persistence, shared funding, preview/Apply isolation, add/remove records, refresh persistence, backup/restore, cold reload and saves with the server unreachable, corrupt-data recovery, text-selection CSS, and responsive widths from 320 to 1280 pixels. The manual-income flow additionally passed exact dollar splits, preview/cancel isolation, invalid-total protection, duplicate-click protection, optional remembered settings, receipt details/undo, legacy backup compatibility, and recording/reopening income offline. Direct split-editor checks additionally cover 60/30/10 previews, exact-cent contributions, 100% validation, unsaved-draft isolation, saved defaults in Record income, multi-quest/wishlist funding, numeric Budget controls, initial setup without goals, and offline plan save/reopen in Chromium and WebKit. The cleanup also passed screenshot/interaction checks in both themes at 320/390/575/1280px, exact decimal and maximum-balance ring fitting, long names and optional expense visibility. A controlled upgrade from the previously published package through the normal Update button preserved the full serialized plan and previous save, verified the downloaded safety backup, survived full browser restarts and an offline cold launch, and retained a new offline entry after reopening in both engines. Update-control checks additionally cover current-version feedback, unreachable-server retries, manual discovery and activation of a real future test package, dirty-form blocking, simulated resume events, cross-tab draft preservation and failed precache recovery in both engines. The previous published package was upgraded through its original prompt with exact current/previous data strings and downloaded backup preserved, followed by full browser restarts, offline cold launch and new offline savings persistence. Version 1.1.1 also passes geometric alignment checks in Chromium/WebKit: arc center, square frame and complete text group agree within 0.01 CSS px across six balances, long names and widths 320/390/430/575/844-landscape/1280; Home/detail rings, goal-title centering, equal mobile navigation columns, icon badges, headers and status rows are checked. No JavaScript page errors were recorded. Test screenshots use synthetic example data, never seeded into the app. Physical iPhone installation, airplane mode, double-tap/long-press gestures, and long-term storage retention still need device acceptance.

Version 1.2.0 keeps Undo record in Activity details and adds an itemized review. Chromium and WebKit checks verify mistaken $1,000 income → cancel/review → undo all affected goals → correct $100, duplicate-click protection, purchase reversal, legacy receipts, negative-balance protection, concurrent-tab receipt identity, empty history and server-unreachable cold launches with persistent undo after full browser restarts. An upgrade from the exact previously published 1.1.1 package preserves the current plan and previous-save strings and verifies the safety backup before restarting offline. Optional undo metadata uses the same schema and storage key. No real user transaction was reversed during testing.

Version 1.2.1 adds the grouped tithing control and explicit percentage bases in Settings and Record income. Its math audit adds an independent exact-integer oracle for 20,000 budgets, tiny/maximum income and capped-quest conservation cases, decimal half-cent regression cases, four scheduled-payday forecasts and weekly-to-monthly spending estimates. A machine-precision error at half-cent boundaries (for example 4.6% of $7.50) now rounds correctly to $0.35. Existing receipts and balances are never recalculated by an update. Chromium/WebKit tests cover changing tithing from 10% to 0% ($108 → $120 for a 60% main share of $200), preview/save/record agreement, grouped controls, invalid split protection, responsive layouts and offline persistence.
