# GaFi UX Revision Sprint 2 — Implementation Plan

## Context

Post-defense UX iteration on GaFi. Intentionally **reverses two panel revisions**: the expense over-budget *soft warning* becomes a **hard block** (Custom Mode), and the map location "Dorm" is renamed back to **"Home"** (GameScreen.js:114-116 comment documents the original rename — call out the reversal in the changelog). The sprint also merges the UserType screen into Sign-Up, derives a `firstName` app-wide with **no DB migration**, converts the forced linear tutorial into free-roam contextual Koin intros, unlocks Custom Mode immediately for employees, adds a task-aware Story-Mode expense warning with a Failed-day modal, a low-budget toast, HUD icon polish, a personalized Koin AI greeting, and a cartoon TTS voice.

**User decisions locked in (from Q&A):**
1. Hard block = **Custom Mode only**. Story Mode instead evaluates the proposed expense against the active daily task's win/loss rules → Koin warning *"If you proceed you will fail this current day."* If the user proceeds and fails: **"Failed" modal with "Restart Day" / "Return to Main Menu"** — no auto-restart.
2. Student Custom-Mode gate stays **all 3 story levels** (`story_level_3_completed`); employees bypass entirely.
3. Google sign-up fallback: Student/Employee picker on **GetStartedScreen**, rendered **only when `userInfo.userType` is null**.
4. Tutorial gate on Story Mode is **dropped** — Story unlocked from start; one-time prompt on first Story press: *"Would you like to play the Tutorial first to learn the controls?"* (Yes → tutorial / Skip).

**Verified facts the plan relies on:**
- Only greeting in GameScreen is the **main menu** `Hi, {name}` (GameScreen.js:6863-6865) — per requirement it STAYS (greetings allowed in Onboarding/Main Menu). Story HUD and `LEVEL_INTRO_SCRIPTS` (915-950) contain no name greeting → nothing to remove in Story gameplay.
- There is **no per-day pass/fail today** — days only report and advance (`handleEndDay` 2393); fail exists only at level end. The day-fail concept is new.
- Day-task rules already have a pure evaluator: `evaluateDailyTaskRule` in `src/utils/storyDailyTaskEvaluator.js:44`.
- Story expenses log through exactly 3 paths in GameScreen: `handleSubmitExpense` (~3798), notebook inline handler (~8126), `confirmTravel` transport (~3007/3100).
- `AuthContext` exposes `user: userInfo` alias — GameScreen's `user?.userType` is `userInfo.userType`.
- Key GameScreen internals (verified): `dailyTaskRuntimeByDayRef` :822, `CATEGORY_BUDGET_MAP` :1092, `buildEmptyDailyRuntime` :1106, `getActiveStoryDay` :1138, `persistDailyTaskState` :1149, `applyInGameDayStart` :2231.

**Implementation order matters**: Phase 1 (`firstName`, `persistUserType`) is consumed by later phases.

---

## Phase 1 — Identity plumbing + SignUpScreen overhaul (R1, R2)

### 1.1 `src/context/AuthContext.js`

**(a) `buildUserInfo` (lines 29-41)** — add derived `firstName` + `user_type` metadata fallback:

```js
const deriveFirstName = (value) => {
  const trimmed = (value || '').trim();
  return trimmed ? trimmed.split(/\s+/)[0] : null;
};
const VALID_USER_TYPES = ['student', 'employee'];

const buildUserInfo = (user, profileData) => {
  const fullName = profileData?.full_name || user.user_metadata?.full_name
    || user.user_metadata?.name || user.email?.split('@')[0] || 'User';
  return {
    ...user,
    name: fullName,
    firstName: deriveFirstName(fullName) || 'there',
    username: profileData?.username || user.user_metadata?.username || null,
    // Metadata fallback closes the first-session gap: on the very first login the
    // profiles row may not exist yet (syncProfileFromMetadata inserts AFTER this
    // runs) and BudgetGoalsScreen needs userType for its presets.
    userType: profileData?.user_type
      || (VALID_USER_TYPES.includes(user.user_metadata?.user_type)
            ? user.user_metadata.user_type : null),
    avatarUrl: resolveAvatar(user, profileData),
    email: user.email,
  };
};
```
`firstName` flows automatically through `applySession` (197, 213), `checkLoginStatus` (566), and the AsyncStorage `userInfo` persists.

**(b) `register` (585-648)** — add 5th param `userType`, thread into signUp metadata (~604-614):
```js
const register = async (name, email, password, username = null, userType = null) => {
  const safeUserType = VALID_USER_TYPES.includes(userType) ? userType : null;
  const { data, error: signUpError } = await supabase.auth.signUp({
    email, password,
    options: {
      emailRedirectTo: redirectUrl,
      data: {
        full_name: name,
        username: finalUsername,
        ...(safeUserType ? { user_type: safeUserType } : {}),
      },
    },
  });
```

**(c) `syncProfileFromMetadata` (82-157)** — persist `user_type` on both paths:
- INSERT path: in `fullPayload` (107-113) add `...(metaUserType ? { user_type: metaUserType } : {})` where `metaUserType = VALID_USER_TYPES.includes(meta.user_type) ? meta.user_type : null`. Keep it in the minimal-retry payload too (only `avatar_url` is drift-prone). Conditional spread avoids tripping the `CHECK (user_type IN ('student','employee'))`.
- UPDATE/backfill path (~143): `if (!profileData.user_type && metaUserType) patch.user_type = metaUserType;`

**(d) New `persistUserType` helper** (below `setUserType`, after line 933) — DB write **WITHOUT the `email` column** (`profiles.email` is UNIQUE; the deleted UserTypeScreen upsert included it — the 23505 hazard, do not copy):
```js
const persistUserType = async (userType) => {
  if (!VALID_USER_TYPES.includes(userType)) return { success: false, error: 'Invalid user type' };
  try {
    if (userInfo?.id) {
      const { error } = await supabase.from('profiles').upsert(
        { id: userInfo.id, user_type: userType, updated_at: new Date().toISOString() },
        { onConflict: 'id' },
      );
      if (error) console.warn('persistUserType DB write failed:', error.code, error.message);
    }
    await AsyncStorage.setItem('userType', userType); // legacy key kept in sync
    return await setUserType(userType);               // existing in-memory update
  } catch (e) { return { success: false, error: e.message }; }
};
```
Add `persistUserType,` to `contextValue` (~1007).

### 1.2 New shared component `src/components/onboarding/UserTypeCards.js`
Extract once, used by SignUpScreen AND GetStartedScreen. Lift from UserTypeScreen.js: `userTypes` array (33-50 — student `school-outline` #4CAF50 / employee `briefcase-outline` #2196F3), card JSX (126-159), styles `optionCard/optionCardSelected/iconContainer/optionTitle/optionSubtitle/radioOuter/radioInner` (235-287). Props: `{ selectedType, onSelect, compact }` — `compact` = side-by-side half-width cards (icon 28, subtitle hidden) for the dense SignUp form; default = full-width rows for GetStarted. Theme via `useTheme()`.

### 1.3 `src/screens/auth/SignUpScreen.js` overhaul
- Imports: `UserTypeCards`, `detectUserTypeFromEmail` from `../../utils/emailUserType`.
- State (after line 39):
```js
const [selectedUserType, setSelectedUserType] = useState(null); // 'student' | 'employee'
const [userTypeTouched, setUserTypeTouched] = useState(false);  // manual pick freezes auto-detect
```
- **Live auto-detect** (near the username debounce effect ~89). Re-detect on every email change until user taps a card; manual tap wins; a null detection never clears an existing selection (no jumpy UI mid-typing):
```js
React.useEffect(() => {
  if (userTypeTouched) return;
  const detected = detectUserTypeFromEmail(email);
  if (detected) setSelectedUserType(detected);
}, [email, userTypeTouched]);
```
- `validateForm` (~119): `if (!selectedUserType) newErrors.userType = 'Tell us if you are a student or an employee';`
- JSX between email error (471) and password input (473):
```jsx
<Text style={styles.sectionLabel}>I am a…</Text>
<UserTypeCards
  compact
  selectedType={selectedUserType}
  onSelect={(t) => { setSelectedUserType(t); setUserTypeTouched(true); setErrors({ ...errors, userType: null }); }}
/>
{!userTypeTouched && detectUserTypeFromEmail(email) === selectedUserType && selectedUserType && (
  <Text style={[styles.hintText, styles.successText]}>
    ✨ Detected "{selectedUserType === 'student' ? 'Student' : 'Employee'}" from your school email — tap the other card if that's wrong.
  </Text>
)}
{errors.userType && <Text style={styles.errorText}>{errors.userType}</Text>}
```
(`sectionLabel` = new small themed style; `hintText/successText/errorText` exist at 303-320.)
- `handleSignUp` register call (194-199): append `selectedUserType` as 5th arg.

### 1.4 Delete UserTypeScreen + navigation removal
- **Delete** `src/screens/onboarding/UserTypeScreen.js`.
- `src/navigation/OnboardingNavigator.js`: remove import (6) + `<Stack.Screen name="UserType" …/>` (19). Final order: `GetStarted → BudgetGoals`.
- `src/screens/onboarding/GetStartedScreen.js:21`: `navigate('UserType')` → `navigate('BudgetGoals')`.
- Only 2 `'UserType'` route references exist (verified) — re-grep after deletion.

### 1.5 `GetStartedScreen.js` — greeting + Google-fallback picker
- Hooks: `const { userInfo, persistUserType } = useAuth();` `const needsTypePick = !userInfo?.userType;` `const [selectedType, setSelectedType] = useState(() => detectUserTypeFromEmail(userInfo?.email) || null);`
- Greeting (replace static title 66-69): `Hi {userInfo?.firstName || userInfo?.name?.split(' ')[0] || 'there'}! 👋` + subtitle "Welcome to GaFI — your gamified finance companion". (Fallback chain matters: pre-sprint cached `userInfo` lacks `firstName`.)
- Fallback picker: `<UserTypeCards selectedType={selectedType} onSelect={setSelectedType} />` between features grid and CTA, **only when `needsTypePick`**; wrap content in ScrollView when picker visible (overflow on ~640dp screens).
- `handleGetStarted` (15-25): if `needsTypePick` and nothing selected → `toast.error('Pick one', …); return;` else `await persistUserType(selectedType)`. Then existing AsyncStorage/`global.setHasOnboarded(false)` lines, `navigate('BudgetGoals')`.

### 1.6 `BudgetGoalsScreen.js` greeting (header 222-231; `useAuth` already at 67)
```jsx
<Text style={[styles.title, { color: theme.colors.text }]}>
  {userInfo?.firstName ? `${userInfo.firstName}, set your budget` : 'Set Your Budget'}
</Text>
```
No other change — `isEmployee` presets (76-77) now guaranteed a `userType` by 1.1(a)/1.5.

### 1.7 Outlook deliverability — Supabase config checklist (no code)
1. Dashboard → Authentication → Emails → **SMTP Settings**: replace built-in sender with real ESP (Resend/SendGrid/Postmark). Built-in `supabase.io` sender is rate-limited (~2/hr) and widely junk-foldered by Microsoft.
2. Sending domain DNS: **SPF** include for ESP, **DKIM** CNAMEs, **DMARC** record (`p=none` → `p=quarantine` after monitoring).
3. From-address must match the authenticated domain.
4. Auth → Rate Limits: raise email limits for launch volume.
5. Auth → Email Templates: rewrite confirm-signup subject/body (no all-caps/exclamations; include plain-text part).
6. Auth → URL Configuration: `gafi://` redirect + site URL allow-listed (register() already passes `emailRedirectTo`).
7. Validate: mail-tester.com + real `@outlook.com` and `@live.mcl.edu.ph` mailboxes; Microsoft SNDS if volume grows.

---

## Phase 2 — Budget constraints: Custom hard block, Story task-aware warning, low-budget toast (R5)

### 2.1 New pure util `src/utils/storyExpenseGuard.js`
Reuses `evaluateDailyTaskRule` (`src/utils/storyDailyTaskEvaluator.js:44`). Two exports:
- `simulateExpense(dayState, { category, amount }, categoryBudgetMap)` — deep-clones the day runtime and applies **exactly** the mutation the three log paths perform (`expenseCount`, `expenseTotal`, `categoryCounts`, `categoryTotals`, `expenseEntries` push, `needsAfterTravelCount` when travel already happened and category maps to needs).
- `getTasksBrokenByExpense({ dayConfig, dayState, evalContext, expense, categoryBudgetMap })` — returns tasks where `evaluateDailyTaskRule(task.validationLogic, ctxBefore) === true` and `=== false` after simulation. `ctxAfter.weeklySpending += expense.amount` (so `level_savings_rate_min` sees the new spend). Rules an expense can break (from storyDailyTasks.js): `expense_count max:0 wants`, `spending_ratio_max`, `max_single_category_ratio`, `day_spending_pct_weekly_budget_max`, `level_savings_rate_min`. Evaluate **against rules directly, not sticky completion flags** (`dailyTaskCompletion` is monotonic — GameScreen:1621).

### 2.2 GameScreen — pre-log guard + Failed modal + Restart Day
- New state (~838): `failedDayInfo` (`{ day, brokenTaskIds }`) + `showDayFailedModal`.
- New `confirmStoryExpenseAgainstTasks({ category, amount })` callback (~1686): no-op unless `gameMode === 'story'`; builds `evalContext` the same way `evaluateActiveStoryDayTasks` does (weeklyBudget/weeklySpending/dailyBudget/needs-wants categories/goal maps); reads day state from `dailyTaskRuntimeByDayRef.current`; if `getTasksBrokenByExpense` returns any → Koin-style `confirm()`:
  - title `'Koin says: hold on! ⚠️'`, message lists broken task `requiredAppAction`s + **"If you proceed you will fail this current day."**, confirmLabel `'Proceed anyway'`.
  - On proceed → `setFailedDayInfo({ day, brokenTaskIds })` and return true.
- **Insertion points (before state capture / modal close, so Cancel keeps modal open):**
  1. `handleSubmitExpense` after user-id check (~3811)
  2. Notebook handler after amount validation (~8132)
  3. `confirmTravel` after input validation (~3035) — guard only when transport cost > 0 (`fareAmount`/`fuelAmount`); ₱0 "No Spend Today" path unguarded.
- **Failed modal trigger** — effect (~1772): when story mode + `failedDayInfo` matches active day → `setShowDayFailedModal(true)` + `VoiceOverService.speak(…)`. **No auto-restart.** Persist `failedDay` inside the existing daily-task AsyncStorage payload (`persistDailyTaskState` 1149-1162 / hydrate 1164-1193 gain a third field) so quitting + resuming re-raises the modal. Guard `handleEndDay` (2393): `if (failedDayInfo) { setShowDayFailedModal(true); return; }`.
- **Failed modal JSX** — new `<Modal transparent>` near the Level Complete modal, Koin image + dark card, title `Day N Failed`, exactly two buttons, no backdrop dismiss:
  - **Restart Day** → `restartActiveStoryDay()`
  - **Return to Main Menu** → close modal, `setGameMode(null); setShowMainMenu(true);` (failedDay stays persisted → re-prompt on resume).
- **New `restartActiveStoryDay()`** (~after `handleStartNextDay`): (1) best-effort delete this day's logged expense rows by `dbId` (`supabase.from('expenses').delete().in('id', dbIds).eq('user_id', …)` — same as handleDeleteExpense); (2) reverse live budget mirrors entry-by-entry (weeklySpending, budgetCategories needs/wants spent, categorySpending, todaySpending, level-2 goal-allocation refunds matched goal-name→id); (3) reset that day's runtime to `buildEmptyDailyRuntime()` and delete the day's task `conditionKey`s from `dailyTaskCompletion` (the one sanctioned monotonicity break); (4) clear fail state, `dailyTaskAnnouncedDayRef.current = null`, `await applyInGameDayStart(new Date().toISOString())`; (5) fire-and-forget `updateStorySessionSpending` reconciliation + `logActivity('day_restarted')` — compute deltas from captured locals, not stale state.

### 2.3 Custom Mode HARD block [REVERSAL]
**`src/screens/main/ExpenseScreen.js` 571-595** — keep the `remaining` math (573-582), replace the `confirm` soft-warning block with a hard block:
```js
if (amountCheck.sanitized > remaining) {
  toast.error(
    'Over budget — blocked',
    remaining > 0
      ? `This ₱${amountCheck.sanitized.toLocaleString('en-PH', { minimumFractionDigits: 2 })} expense exceeds your remaining monthly budget of ₱${remaining.toLocaleString('en-PH', { minimumFractionDigits: 2 })}.`
      : 'Your monthly budget is fully spent. Raise your budget to log more.'
  );
  return;
}
```
Check remaining `confirm` usages before removing the import (delete flow still uses it — keep).

**`src/screens/main/CustomModeDashboard.js` `handleSubmitExpense` (549)** — insert after amount/user checks (~558), before `setIsSubmitting(true)`; component-scope `remaining` (321-324, subtracts expenses + goal contributions + saved, clamped ≥0) is in closure scope:
```js
if (amount > remaining) {
  toast.error('Over budget — blocked',
    remaining > 0
      ? `Only ₱${remaining.toLocaleString('en-PH', { minimumFractionDigits: 2 })} spendable money is left this month.`
      : 'No spendable money left this month. Adjust your budget or goals first.');
  return;
}
```
Note in PR: the two screens intentionally use their own displayed "remaining" definitions as the block threshold — self-consistent per screen.

### 2.4 Low-budget warning toast
- `src/services/NotificationService.js` `checkBudgetThresholds` (57-138): **return the alerts array** (`return alerts;` end of try; `return [];` on opt-out early return + catch). Thresholds stay `WARNING .85 / CRITICAL .95 / EXCEEDED 1.0`; preference `PREF_KEYS.BUDGET_ALERTS` already respected inside.
- `src/context/DataContext.js` (~494): consume the return in the custom-mode branch — pick highest-severity alert; `budget_warning` → `toast.info`, critical/exceeded → `toast.error('Budget alert', top.message)`. Opt-out users get `[]` → no toast, consistent with NotificationSettings.

---

## Phase 3 — Free-roam contextual tutorial (R3)

**Keep:** `gameMode==='tutorial'` practice sandbox (no DB saves, "Nice practice!" toasts), `KoinTutorialOverlay` as dialogue renderer, `TutorialContext` as state host, `APP_TOUR` phase + AppTourManager, VoiceOver narration.
**Delete both linear rails:** GameScreen `TUTORIAL_STEPS` (632-761) + `tutorialStep`/`tutorialConditions`/`markTutorialCondition`/`isTutorialStepComplete` (570-629) + all `markTutorialCondition` call sites (2941, 2958, 3061-3062, 3317-3323, 3841-3842, 8162 — keep surrounding practice toasts) + per-step `saveTutorialProgress` (613); TutorialContext `GAME_TUTORIAL_STEPS` (34-191) + `completedConditions`/`markConditionComplete` (380-401). Keep start (775) + completion (793) `saveTutorialProgress` writes so `tutorial_progress` table stays compatible. **All rail reads must go in the same commit** (606, 624, 1826-1830 voice effect, 7488 hint box, 8947-8950 travel-modal hint) or render crashes.

### 3.1 `TutorialContext.js` — contextual API
Add `CONTEXTUAL` to `TUTORIAL_PHASE`. New: `activeIntro` state; actions `enterTutorialMode()` (phase→CONTEXTUAL), `showKoinIntro({ id, koinDialogue })` (sets activeIntro, `conditionKey: null`, `nextAlwaysEnabled: true`, resets dialogue page, KOIN_STATE.SPEAKING), `dismissIntro()`, `exitTutorialMode()` (→IDLE). `getCurrentStep` returns `activeIntro` in CONTEXTUAL; `advanceToNextStep` in CONTEXTUAL = `dismissIntro()` (existing last-page button closes the intro). Export in context value; delete `GAME_TUTORIAL_STEPS`.

### 3.2 `KoinTutorialOverlay.js`
- `isActive` (55-56): add `|| (tutorialPhase === TUTORIAL_PHASE.CONTEXTUAL && !!step)`.
- **Hide Skip-Tutorial button + progress bar/`x / y` counter in CONTEXTUAL** (progress math divides by `steps.length === 0` — guard required; Skip stays for APP_TOUR).
- Last-page button label → "Got it!" when CONTEXTUAL. WAITING/CELEBRATING never fire (conditionKey null) — no other changes; SPEAKING scrim = short-blocking per intro.

### 3.3 GameScreen — `TUTORIAL_INTROS` trigger map + seen-set
Replace deleted `TUTORIAL_STEPS` (~632) with map keyed by **map id**:
```js
const TUTORIAL_INTROS = {
  dorm:    { pages: ["Hi! I'm Koin, your financial buddy! Welcome to your Home! 🏠",
                     "Roam freely — tap anywhere to walk. Check the Closet 👔 to change outfits, and the Notebook 📓 to practice logging an expense.",
                     "When you're ready, head to the Exit Door 🚪. Nothing here is saved — it's all practice!"] },
  school:  { pages: ["Welcome to the School Campus! 🏫", "Approach the Librarian or Canteen staff and try logging a practice expense!"] },
  office:  { pages: ["Welcome to the Office! 🏢", "Approach the staff and log a practice expense — try the Pantry!"] },
  mall_1f: { pages: ["Welcome to the Mall! 🏬", "1st floor: Clothing 👕, Electronics 📱, Grocery 🛒. Ride the Escalator to explore more!"] },
  mall_2f: { pages: ["Mall — 2nd Floor! 🍕 Food Court and Cafe up here. Log a practice expense if you're hungry!"] },
  mall_3f: { pages: ["Mall — 3rd Floor! 🎮 Entertainment Hub and Gym. Every visit is practice for tracking expenses!"] },
};
```
Seen-set: `tutorialIntrosSeenRef` (Set) hydrated once per user from AsyncStorage `tutorialIntrosSeen_${user.id}` (+ `introsHydrated` flag). `maybeShowTutorialIntro(key)` (useCallback): only in tutorial mode + hydrated + not seen → add to set, persist, `showKoinIntro({ id: key, koinDialogue: intro.pages })`, `VoiceOverService.speak(intro.pages.join(' '))`, `logActivity`.

**Trigger insertion points:**
1. `startTutorial` (764-777): body becomes hide-menu + `setGameMode('tutorial')` + `setCurrentMapId('dorm')` + `enterTutorialMode()` + `maybeShowTutorialIntro('dorm')` + start-write `saveTutorialProgress`. Menu-launched replay clears the seen-set first (`startTutorial({ replay: true })`).
2. `travelToMap` after `commitCurrentLocation` (~3237): `if (gameMode === 'tutorial') maybeShowTutorialIntro(mapId);`
3. `changeFloor` after `commitCurrentLocation` (~3299): same with `floorId`.
4. Per-location intros (closet/notebook) not needed v1 — map intros mention them; `TUTORIAL_INTROS` keys extensible later.

**Tutorial header** (7448-7490): keep slim header; step hint (7481-7489) → static `💡 Free roam! Koin pops up the first time you visit each place. Exit anytime.`; add **"End Tutorial"** button → `endTutorial()`. Rework `endTutorial` (780-795): keep persistence; replace phase-transition effect (797-807) with direct call; after completion offer app tour via `confirm('Quick app tour?')` → `startAppTour()` or `exitTutorialMode()`. Travel-modal hint (8947-8950) → static free-roam copy.

### 3.4 Story gate removal + one-time prompt
`handleStoryMode` (5653-5687): delete the `!tutorialCompleted` block (5654-5665), insert:
```js
const promptKey = `storyTutorialPromptSeen_${user?.id}`;
if ((await AsyncStorage.getItem(promptKey)) !== 'true') {
  await AsyncStorage.setItem(promptKey, 'true'); // one-time, regardless of answer
  const playTutorial = await confirm({
    title: 'Learn the controls first? 🎓',
    message: 'Would you like to play the Tutorial first to learn the controls?',
    confirmLabel: 'Play tutorial', cancelLabel: 'Skip', icon: 'school',
  });
  if (playTutorial) { startTutorial(); return; }
}
```
Main-menu Story button (6869-6887): remove lock styling/lock icon/conditional colors — always `book` + `#F5DEB3`. `tutorialCompleted` state survives only for endTutorial persistence.

---

## Phase 4 — Employee Custom-Mode bypass (R4)

`GameScreen.js`:
1. After `profileUserType` (:472): `const isEmployeeUser = profileUserType === 'employee';`
2. New effect (~1988): `useEffect(() => { if (isEmployeeUser) setCustomModeUnlocked(true); }, [isEmployeeUser]);` — covers no-`user_levels`-row accounts + async-arriving userType.
3. Hydrate block (2003-2015) unchanged; **do NOT write `customModeUnlocked_<id>` AsyncStorage from the bypass path** — derived bypass means a type change back to student falls back to the earned gate automatically.
4. Locked toast (6900) copy unchanged — employees never hit the locked branch. Live-unlock (2585-2587) unchanged.

---

## Phase 5 — UI polish (R5 remainder)

### 5.1 Dorm → Home sweep [REVERSAL]
| Location | Change |
|---|---|
| `GameScreen.js:116` | `name: 'Dorm'` → `name: 'Home'`; update comment (id stays `'dorm'` — sessions/travel links unaffected) |
| `src/services/AchievementService.js:140` | `'Returned to your Home/Dorm'` → `'Returned to your Home'` |
| `src/screens/main/AchievementDashboard.js:178` | `'Visit your Home/Dorm'` → `'Visit your Home'` |
| `TutorialContext.js` / `levels.json` / `storyDailyTasks.js` | verified — no user-facing "Dorm" strings |
| Comment-only hits (`CollisionSystem.js:113`, GameScreen 7097/7179) | optional |

### 5.2 HUD header icon split + sizing (GameScreen 7493-7550) — one icon, one job
- **Exit** `exit-outline` size 18 (bump tutorial-header exit 7466 from 16 → 18 for consistency).
- **History** `time-outline` size 18 — always `openDayReportHistory()`; keep `hasUnreadReport` badge. Kills the dual-purpose calendar (7513-7526).
- **Expenses** `receipt-outline` size 18 (unchanged).
- **Tasks/Day** (story only): tasks incomplete → `clipboard-outline` (replaces `list`, distinct from receipt) opens tasks; all done → `moon` → `handleEndDay()`. Move the end-day alert styling onto this button.
- Spacing: `headerLeftControls` gets `gap: Math.round(screenWidth * 0.02)`, trim per-button margins, standardize hit targets to `screenWidth * 0.09`.

### 5.3 Main-menu greeting uses firstName (6863-6865)
`Hi, {user?.firstName || user?.name || user?.email?.split('@')[0] || 'Player'}! 👋` — stays (Main Menu allowed). Nothing to remove in Story gameplay (verified).

---

## Phase 6 — Koin AI greeting + cartoon voice (R6)

### 6.1 `src/components/ChatModal.js`
1. `getFinancialContext` :555 → `userName: userInfo?.firstName || userInfo?.name?.split(' ')[0] || userInfo?.full_name?.split(' ')[0] || userInfo?.email?.split('@')[0] || 'there',`
2. `getContextualWelcome` (582-608): build `const hi = \`Hi ${financial.userName}! \`;` and prefix **all** templates; remove the now-redundant mid-string `Hey ${financial.userName},` in the Profile template. Default fallback already greets — keep.
3. `buildSystemPrompt` — append to RESPONSE GUIDELINES (after item 11, ~763):
```
12. Greet the user by first name ("${financial.userName}") in your FIRST substantive reply of a conversation, then use the name only occasionally — never in every message.
```

### 6.2 `src/services/VoiceOverService.js` (65-71) — cartoon Koin, platform-tuned
```js
import { Platform } from 'react-native';
// Cartoon-Koin voice. rate 1.0 is normal on both platforms, but engines differ:
// Android TTS stays intelligible to ~1.3x; iOS AVSpeechSynthesizer chipmunks sooner.
const KOIN_VOICE = Platform.select({
  android: { rate: 1.2, pitch: 1.45 },
  ios:     { rate: 1.1, pitch: 1.5 },
  default: { rate: 1.1, pitch: 1.4 },
});
Speech.speak(cleaned, { language: 'en-US', ...KOIN_VOICE, ...options }); // callers can still override
```

---

## Risks / regressions to watch

1. **BudgetGoals userType timing (highest risk):** presets read `userInfo.userType` :76. Email flow fixed by the metadata fallback (1.1a); Google flow by the GetStarted picker (1.5). Test both cold paths (fresh install, first login after verification).
2. **profiles.email UNIQUE (23505):** never include `email` in client upserts — `persistUserType`/`syncProfileFromMetadata` omit it; deleted UserTypeScreen was the last offender.
3. **Rail excision completeness:** all `TUTORIAL_STEPS`/`tutorialStep` reads must be removed in one commit (list in Phase 3 header) or render crashes.
4. **KoinTutorialOverlay divide-by-zero** in CONTEXTUAL (`steps.length === 0`) — hide progress UI (3.2).
5. **Sticky-completion vs re-fail:** guard evaluates rules directly (closes the "complete early, then splurge" loophole for the warning); `checkLevelCompletion` still trusts sticky flags; Restart Day un-completes the day's tasks — verify `persistDailyTaskState` round-trips.
6. **Restart Day integrity:** DB deletes best-effort (sync-failed rows lack `dbId`); level-2 allocation refunds map goal *name* → id; compute session-reconciliation deltas from captured locals, not stale state.
7. **Employee bypass cache:** never persist the bypass to `customModeUnlocked_<id>`.
8. **firstName cache gap:** pre-sprint cached `userInfo` lacks `firstName` — every greeting call site uses a fallback chain.
9. **Hard-block UX:** users can't log real overspend in Custom Mode (explicit decision) — toast includes the "raise your budget" hint so they aren't dead-ended.
10. **Dorm→Home reversal** contradicts panel note at GameScreen 114-115 — changelog it.

## Suggested ticket order
1. AuthContext (1.1) → 2. UserTypeCards + SignUp (1.2-1.3) → 3. Nav removal + GetStarted + BudgetGoals + Outlook checklist (1.4-1.7) → 4. Custom hard block + low-budget toast (2.3-2.4, small/independent) → 5. Story guard + Failed modal + Restart Day (2.1-2.2, largest ticket) → 6. Tutorial rework (3.1-3.4) → 7. Employee bypass (4) → 8. Polish sweep (5) → 9. Koin AI + voice (6).

## Verification

1. **Email signup flow:** fresh account with `…@live.mcl.edu.ph` → type auto-selects Student while typing email; manual tap overrides; submit → verify → login → GetStarted greets "Hi [First]!" with NO picker → BudgetGoals shows "[First], set your budget" + student presets. Repeat with `@mcl.edu.ph` (employee) → employee presets + Custom Mode immediately unlocked in game menu.
2. **Google signup:** sign in with Google (gmail) → GetStarted shows fallback picker (userType null); pick Employee → check Supabase `profiles.user_type = 'employee'` (no 23505 in logs); BudgetGoals employee presets.
3. **Hard block:** set small monthly budget, log expense > remaining in ExpenseScreen → blocked toast, expense NOT saved (check list + DB). Same in CustomModeDashboard quick-add. Log expense crossing 85%/95% → low-budget toast appears (and not when Budget Alerts pref is off).
4. **Story guard:** start a story day with a wants-cap task (e.g. L3 D7) → log a wants expense → Koin warning appears; Cancel keeps modal open + nothing logged; Proceed → expense logs → Failed modal (Restart Day / Return to Main Menu). Restart Day → day runtime reset, expenses removed from DB, budget mirrors restored, Koin day intro replays. Return to Main Menu → re-enter story → Failed modal re-raises.
5. **Tutorial:** new user taps Story Mode → one-time "Play tutorial first?" prompt (never again after). Tutorial: free roam, Koin intro fires once on first entry to each map (dorm/school/mall floors), no forced steps, End Tutorial works, app-tour offer appears. Story button never shows lock.
6. **Polish:** map header shows "Home"; HUD icons unique + evenly spaced; main-menu greeting uses first name only.
7. **Koin AI + voice:** open chat → first message "Hi [First]! …"; first LLM reply also greets by name. Enable voice-over in Settings → Koin voice noticeably higher/faster on device (dev-client build — expo-speech already present per memory).
8. Run `npx expo start` on dev client for all of the above; grep `UserType` to confirm no dangling route references.