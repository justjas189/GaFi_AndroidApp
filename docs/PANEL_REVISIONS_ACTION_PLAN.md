# GaFi Panel Revisions — Final Sprint Backlog

> Post-defense revision plan for **GaFi: Gamified Money Manager**.
> Source: panel feedback from the thesis defense. Each item lists the problem, the technical solution, affected files, and edge cases to watch.

---

## Priority Overview

| # | Revision | Domain | Priority |
|---|----------|--------|----------|
| 1 | Custom Mode: user budgets the money (no auto 4-week split) | Core money logic | **P0** |
| 2 | Story Mode: leftover money carries to next level | Core money logic | **P0** |
| 3 | Validation + proper calculations on money entry | Bug fix | **P0** |
| 4 | Insufficient-funds warning | Bug fix / UX | **P0** |
| 5 | Password requires uppercase | Auth | **P1** |
| 6 | Auto-detect user type via outlook email | Auth / Onboarding | **P1** |
| 7 | Show user's name on top after sign-in | UI/UX | **P2** |
| 8 | Date **and day** on transactions | UI/UX | **P2** |
| 9 | Rename "Home" button | UI/UX | **P2** |
| 10 | Icon spacing on main choices | UI/UX | **P2** |
| 11 | Voice over (Story Mode narration) | New feature | **P3** |

**Rationale:** money-correctness items first (they are what a panel re-checks), auth second, visual polish third, and the one item needing a native rebuild (voice over) last so JS-only iteration stays fast.

---

## P0 — Money-Logic Correctness

### - [x] 1. Custom Mode: stop auto-dividing money into 4 weeks
- **The Problem:** The app derives `weekly = monthly / 4` and presents that as the plan. The panel wants the **user** to allocate their own money.
- **Technical Solution:** Remove the four `monthly / 4` derivations in `BudgetDatabaseService_NEW.js`; drop the derived weekly target from the Custom Mode dashboard; lean on the existing `budget_categories` allocation flow so users assign amounts per category themselves (reuses `BudgetService.addBudgetCategory`).
- **Files Affected:** `src/services/BudgetDatabaseService_NEW.js`, `src/screens/main/CustomModeDashboard.js`, `src/context/DataContext.js`, `src/screens/onboarding/BudgetGoalsScreen.js`.
- **Edge Cases:** Keep the `budgets.weekly` column (write NULL — no destructive migration). Story Mode's own `/4` is intentional level design — untouched. Prediction pipeline verified safe (consumes expenses + monthly only). Check Koin's financial prompt payload for stale weekly references.

### - [x] 2. Story Mode: leftover money carries into the next level
- **The Problem:** Money left over in Level 1 (`weeklyBudget − totalSpent`) evaporates on completion; the panel wants it added to the next level.
- **Technical Solution:** Write an explicit `leftover` into `results_data` (JSONB on `story_mode_sessions` — **no schema migration needed**) at level completion. Add `getLastPassedStorySession(level)` to `GameDatabaseService`. When starting level N>1, budget = `monthly/4 + leftover(N−1)`; show "+₱X carried over" in the level intro.
- **Files Affected:** `src/screens/main/GameScreen.js` (level results + `startStoryLevel`), `src/services/GameDatabaseService.js`.
- **Edge Cases:** Replays use the *latest passed* session of the previous level; failed levels carry nothing; Level 1's 50/30/20 split and Level 2 goal targets now compute from the boosted total; game money never converts to the real Custom Mode budget.

### - [x] 3. Validation + proper calculations on money entry
- **The Problem:** The expense form accepts `"abc"`, `0`, and negatives — `parseFloat("abc")` = `NaN` and poisons totals, charts, and predictions.
- **Technical Solution:** Central `validateAmount` helper in `ValidationUtils.js` (positive finite number, sane cap, 2-decimal rounding), applied to the expense form, goal allocations, and story-mode purchases. Numeric keyboard + inline errors.
- **Files Affected:** `src/utils/ValidationUtils.js`, `src/screens/main/ExpenseScreen.js`, `src/screens/main/CustomModeDashboard.js`.
- **Edge Cases:** comma decimals ("1,000.50"), leading zeros, extremely large values breaking chart axes.

### - [x] 4. Insufficient-funds warning on expense entry
- **The Problem:** Logging an expense larger than the remaining budget is silent. (Wallet withdrawals and story purchases already warn.)
- **Technical Solution:** On save, compute `remaining = monthly budget − current-month spend` (both already in `DataContext`); if exceeded, show a confirm dialog — "This exceeds your remaining budget (₱X). Log anyway?" Warn, don't block: real spending still needs recording.
- **Files Affected:** `src/screens/main/ExpenseScreen.js`, small helper in `src/context/DataContext.js`.
- **Edge Cases:** no budget configured → skip the warning; already-negative remaining → warn with correct wording.

---

## P1 — Auth & Accounts

### - [x] 5. Password must require an uppercase letter
- **The Problem:** The sign-up regex accepts any-case letters; the reset flow has no strength check at all.
- **Technical Solution:** `ValidationUtils.validatePassword` **already enforces uppercase + lowercase + digit + min length** — wire it into both the sign-up and reset screens (one source of truth) and update the on-screen password rules text.
- **Files Affected:** `src/screens/auth/SignUpScreen.js`, `src/screens/auth/VerifyResetCodeScreen.js`, `src/utils/ValidationUtils.js`.
- **Edge Cases:** existing accounts unaffected (applies to new set/reset only); optionally raise the Supabase Auth minimum length to match.

### - [x] 6. Auto-detect user type from outlook/school email
- **The Problem:** User type is fully manual; the panel wants automatic filtering for student/teacher based on outlook email.
- **Technical Solution:** New `src/utils/emailUserType.js` with a configurable domain → type map (school outlook domain → `student`). On the user-type screen, pre-select the detected type with a "detected from your email" note; the user can still override. Save path unchanged (`profiles.user_type`).
- **Files Affected:** `src/utils/emailUserType.js` (new), `src/screens/onboarding/UserTypeScreen.js`, `src/context/AuthContext.js`.
- **Edge Cases:** Gmail / Google sign-in emails → no detection, manual flow stays. ⚠️ The app's types are `student`/`employee` — the panel said "teacher". A true third type needs a `profiles` CHECK-constraint migration **and** a decision on which Story Mode map set teachers get. Confirm with the adviser before widening scope; until then "teacher" maps to `employee`.

---

## P2 — UI/UX Polish

### - [x] 7. Show user's name on top after sign-in
- **The Problem:** The landing screen (game main menu) never greets the user.
- **Technical Solution:** Add "Hi, {name}! 👋" to the main-menu header with fallback chain: auth name → `profiles.full_name` → username → email prefix.
- **Files Affected:** `src/screens/main/GameScreen.js` (renderMainMenu + menuStyles).
- **Edge Cases:** long names truncate; placement must not cover the baked-in logo band at the top of the menu background; fresh Google accounts can have null names.

### - [x] 8. Date **and day** on transactions
- **The Problem:** Transaction rows and the date picker show "Jul 10, 2026" with no weekday. (Group headers already show it.)
- **Technical Solution:** Add `weekday: 'short'` to row-level date formats → "Thu, Jul 10, 2026". Sweep `toLocaleDateString` uses in the expense list, savings logs, and the story notebook.
- **Files Affected:** `src/screens/main/ExpenseScreen.js`, `src/screens/main/CustomModeDashboard.js`, `src/screens/main/GameScreen.js`.
- **Edge Cases:** narrow rows — short weekday + ellipsize; keep one shared format helper.

### - [x] 9. Rename "Home"
- **The Problem:** The dorm map displays as "Home" and the exit buttons are icon-only home glyphs — ambiguous with the app's home.
- **Technical Solution:** Map display name → **"Dorm"** (internal id `dorm` unchanged, so saved sessions are safe); exit buttons get a visible **"Menu"** label.
- **Files Affected:** `src/screens/main/GameScreen.js`; check tutorial copy and Koin prompt references in `src/components/ChatModal.js`.
- **Edge Cases:** the asset folder `assets/Game_Graphics/maps/Home/` is a file path, not UI — leave it.

### - [x] 10. Icon spacing on the main choices
- **The Problem:** Icons sit too close to labels on the main-menu mode buttons (Tutorial / Story / Custom).
- **Technical Solution:** Add `marginRight`/`gap` in `menuStyles.menuButtonIcon` / the button row style.
- **Files Affected:** `src/screens/main/GameScreen.js` (menuStyles).
- **Edge Cases:** verify on phone **and** tablet — layout runs through the 600px phone-frame clamp + ResponsiveStage.

---

## P3 — New Feature

### - [x] 11. Voice over (Story Mode narration)
- **The Problem:** No narration anywhere; the panel asked for voice over.
- **Technical Solution:** Add `expo-speech` (device TTS). New `VoiceOverService` (speak/stop/queue + Settings toggle persisted in AsyncStorage). Narrate story dialogue, level intros, and Koin tutorial steps; duck BGM while speaking via the existing AudioContext hooks.
- **Files Affected:** `package.json`, `src/services/VoiceOverService.js` (new), `src/screens/main/SettingsScreen.js`, `src/screens/main/GameScreen.js`, `src/components/KoinTutorialOverlay.js`, `src/context/AudioContext.js`.
- **Edge Cases / Build Risks:** requires a dev-client rebuild (native module); on this Windows setup `npm install` wipes the react-native-audio-api prebuilt binaries — re-fetch them per the documented manual step; device TTS voices vary by phone; stop speech on screen exit to avoid overlap.

---

## Cross-Cutting Risks
- **XGBoost / prediction pipeline:** verified safe — it consumes expenses + monthly budget only; items 1–2 don't touch its inputs.
- **Koin AI assistant:** any budget-shape change (item 1) must be re-checked against the financial payload sent to the mascot.
- **Native rebuild** is only needed for item 11; everything else is JS-only.

## Verification Checklist
- [ ] Weak password (no uppercase) rejected at sign-up **and** reset, with a clear message.
- [ ] School-email sign-up pre-selects the user type; manual override still works.
- [ ] Expense `"abc"` / `0` / `−5` blocked with inline error; oversized expense triggers the warning dialog.
- [ ] Finish Story Level 1 under budget → Level 2 intro shows the carried-over amount and boosted budget.
- [ ] Custom Mode setup shows no auto weekly split; user-entered category allocations drive the dashboard.
- [ ] Transactions read "Thu, Jul 10, 2026" style everywhere.
- [ ] Main menu greets the user by name without covering the logo.
- [ ] Dorm map reads "Dorm"; exit buttons labeled "Menu".
- [ ] Menu button icon spacing verified on phone + tablet.
- [ ] Voice over toggles in Settings; narration plays with BGM ducked; stops on exit.
