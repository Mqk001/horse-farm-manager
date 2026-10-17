# Five separate usability tasks

Implemented in the requested order. All changes are local, pending push/deployment; prior security, resilience, caching and optimistic-task changes were preserved.

## Usefulness

The preceding performance batch produced useful request/query reuse and a production-client pooling safeguard. Icons were already inline. This batch's largest practical benefits are directory search and protection against accidental data loss. Layout fixes address observed async insertion points. Transitions are visual polish; breadcrumbs help the horse/edit hierarchy rather than make the backend faster.

## 1. Layout stability

Sources and fixes:
- Google sign-in availability arrives after initial login/signup render. Previously inserting the button grew the vertically centered card and moved the existing fields. `GoogleSignIn.tsx` now reserves a six-rem provider region, renders a button-sized loading skeleton, and provides a same-region unavailable message if the provider is disabled/unreachable.
- `app/loading.tsx` previously mounted its skeleton after a 250 ms delay into an empty shell. Its skeleton now exists from the first render with reserved height; only visibility changes after the delay. This retains the anti-flash delay without a second layout insertion.
- The farm picker previously re-centered as its async list appeared. Its card is now top-anchored, with farm-row skeletons while loading.
- A stable scrollbar gutter avoids horizontal movement when pages gain a scrollbar. Search loading text/recent-search rows added in task 2 also reserve space.
- No unsized external images/embeds were found in the app UI: profile initials and SVG icons already reserve dimensions. Existing next/font output already self-hosts fonts with font-display:swap and metric-adjusted fallback (including ascent/descent overrides and size-adjust); this was retained.

Verification: `tests/stable-layout.mjs` delays Google availability at 390 px and 1440 px widths and verifies that the login card height/top and email field top remain unchanged. It waits for font/intentional route animation completion to isolate async layout behavior. This is targeted layout verification, not a claim of a zero site-wide field CLS score. A variable-length farm list cannot be sized exactly before its data is known; anchoring its heading limits the movement rather than claiming all list changes are eliminated.

## 2. Horse-directory search

Changed files: `app/horses/page.tsx`, `components/HorseSearchFilters.tsx`, `components/SearchHighlight.tsx`, `lib/horse-search.ts`.

Flow:
1. Search stays at the top of the horse directory. `/` or Cmd/Ctrl+K focuses it when the user is not editing another control.
2. Typing waits 300 ms before a server navigation; Enter searches immediately. Existing results stay usable while a reserved status area says Searching.
3. Ranking prefers exact names, name prefixes, name substrings and breed matches before approximate multiword matches. Normalization handles case/common accents. Bounded edit distance supports adjacent-letter transpositions and small typos in longer words; short terms do not fuzzy-match arbitrary words. Inputs are capped at 100 characters/five matching terms, and fuzzy comparison lengths/word counts are bounded.
4. Matches are highlighted as escaped React text/mark elements, with no raw HTML. Status/care filters and explicit sorting still apply.
5. No-result guidance suggests shorter names, breeds and clearing restrictive filters. Clear filters performs a full directory reset, avoiding a race between an older search response and client state.
6. Up to five recent searches appear in an inline, horizontally scrollable row, never a popup covering filters. They are stored only in the current tab's sessionStorage, keyed by user ID plus farm ID. Storage failure does not stop search. Suggestions/results are ordinary keyboard-accessible buttons/links; down-arrow moves from the input to recents/results, Escape releases focus, Tab/Enter work normally, and recents support arrow movement.
7. Query/filter state remains in the URL; back navigation restores the searched directory. Farm authorization/filtering remains server-side. Search does not become a cross-farm/global search engine or change the existing directory's all-farm-horses query into a paginated backend.

Verification: `tests/horse-search.ts` covers relevance, typos, accents, multiword matching, short-query false positives, bounded input and literal markup. `tests/horse-search-browser.mjs` covers one debounced request for rapid typing, loading feedback, typo result/highlight, keyboard opening, back, recent searches, no-result guidance, foreign-farm exclusion and reset. The reset regression was repeated after fixing an intermittent navigation race.

## 3. Route transitions

`components/RouteTransition.tsx` wraps route content in the root layout, leaving navigation outside it. A pathname-keyed, 140 ms opacity/5 px transform reveal runs when the new view appears. Query/filter edits do not remount/animate the page. There is no exit wait, pointer-blocking overlay or custom scroll manipulation. Next's normal navigation/back/scroll handling remains responsible. CSS disables the route animation entirely under prefers-reduced-motion.

Verification: `tests/page-transitions.mjs` checks the animation, available pointer interaction, normal page scroll reset/back navigation, and no animation under reduced motion. This does not speed up server responses; existing loading/recovery feedback remains.

## 4. Destructive actions and undo

- Permanent horse deletion: replaced the custom overlay with the shared native dialog (focus trap, Escape/backdrop handling, restored trigger focus). It names the horse and all affected history, requires typing the exact name, and uses a red `Delete <name>` button. In-flight guarding prevents duplicate requests; failure retains the dialog/name and displays an error. Success reconciles with the directory. Existing manager/farm checks remain authoritative.
- Member removal/role changes: existing named consequence confirmations were retained. Confirm buttons now name the person and action, with destructive styling for removal/demotion. Protected self/owner/foreign access rules remain server-side.
- Unsaved horse edits/new profiles: Cancel asks Keep editing or Discard changes when dirty. Browser/tab unload protection is installed for dirty forms. Edit-page breadcrumb links use the same discard guard. Ordinary explicit profile saving does not add a redundant confirmation prompt; this change does not introduce profile-edit version/conflict detection.
- Completed-work dismissal: records are preserved. A scoped, fixed-position Undo notice is available for 30 seconds after confirmed dismissal. `restoreDismissedTask` rechecks the current active manager inside a farm-locked transaction and restores only the matching farm/care record's dismissedAt. It invalidates the revision/read views. The 30 seconds is the UI offer duration, not a server authorization token; the server always checks permissions. Failed Undo leaves an error rather than pretending success.
- Task completion/unassignment remain low-friction actions with the previous optimistic rollback/duplicate protection; they do not delete historical records. Farm switching does not delete a farm. No bulk destructive UI exists.
- Operational seed: now requires `SEED_ALLOW_RESET=true` before destructive seed work, in addition to its existing supplied-password checks. The seed was not executed.

Verification: `tests/destructive-actions.mjs` covers Keep editing/discard, typed named deletion, Escape cancel/focus return, deletion rejection and success, named member confirmation/cancel, persisted dismissal/Undo, and authenticated staff/foreign-manager restore denial. All fixtures use a disposable local database.

## 5. Breadcrumbs

`components/Breadcrumbs.tsx` is used only for:
- Horse profile: Horses → actual horse name.
- Edit horse: Horses → actual horse name → Edit profile.

The old directory back link is replaced, avoiding duplicate navigation. Ancestors link to real directory/profile routes, with names obtained from existing farm-scoped profile reads; the current item is a non-linked span with aria-current=page. Navigation is labelled Breadcrumb and uses an ordered list; separators are hidden from assistive technology. Long names truncate without removing their full accessible text/title. Edit navigation respects unsaved changes. Dashboard, Care, Team, directory and new-horse page do not get unnecessary breadcrumbs.

Verification: `tests/breadcrumbs.mjs` checks the hierarchy/current page, working ancestors, phone-width long-name truncation/full labels, unsaved changes and absence on the shallow directory.

## Combined verification

Production build and TypeScript pass. The final browser suites cover these features with disposable local accounts, without real provider calls or production changes. Prior optimistic-update, client-cache, farm-task/history and team-access regressions are also checked where these changes intersect. Git diff whitespace checks pass. No new dependencies or schema migrations were introduced.
