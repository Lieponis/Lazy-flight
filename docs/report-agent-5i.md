# Agent 5 report, stage G5b: screens and texts on universe v3

Branch `universe-v3` only (nothing on main). Commits: a58a06e (step 1), 9c77ac9 (step 2), 002cc68 (steps 3-4), plus this report.
Andy checked these on his phone, using the private test page https://claude.ai/artifact/VEnSv2RLWk5NehrPDgMKaD and its test saves (start dock with little fuel, all three badges, far dock, old save): all "Ok".

## 1. What was built
1. **The UI compiles on v3.** System ids are numbers in `index.ts`, `title.ts`, `titlescene.ts` and `planetpanel.ts`.
2. **Job cards show reach** (Andy chose **A**: one list, a badge on each card).
   - `cardReach(entry)` maps the game's `reach` and `block` to a card state:
     - `far` = `reach === "never"`;
     - `now` = no block;
     - `refuel` = block `not-enough-fuel`;
     - `other` = any other block (cargo, cabin, rank, busy).
   - Sort order: now, refuel, other, far. Inside each group the board keeps its own order.
   - Too-far and refuel cards cannot be accepted (as before, the game's block decides). Rewards always come from `job.reward`.
   - The red "✕ REASON" line is dropped when the badge already says it (fuel, tank). It stays for cargo, cabin and rank, including on too-far cards.
3. **Board message box.** It appears at the top of JOBS when `doNow + afterRefuel = 0`, or when `doNow = 0` and refuel jobs exist. The game's own sentences are shown unchanged; the UI adds a title and one hint (texts in section 2). The old `noJobsHint` was removed.
4. **Texts that use the save layer's warnings** (they live in the UI, mapped from the save constants; no save code changed):
   - the "universe rebuilt" note (`startNotice`);
   - the import confirm, where `warningLines` maps `WARN_OLD_UNIVERSE`, `WARN_OTHER_SEED` and `WARN_TRAVELLING`.

   The note now stays 20 s (tap to close). The toast was re-centred so a long note uses the full width instead of half.
5. **Names on narrow phones** (checked headless at 360×640, 390×844, 844×390 and 1280×800; no page scroll, no overlaps). Checked: status strip, job cards, board box, planet card, WHAT NOW?, Ranks/Explorer, import confirm and toast, using the longest dock name within 400 docks of the start.
   - Fix: the status strip was fitted before the VT323 font loaded, which cut the place too short ("Bree… · B… JR62R-MT37"). It now fits again when fonts load and when MENU shows or hides (`onFontsLoaded` in `dom.ts`).
   - Fix: the install hint covered the first line of a long two- or three-line dock label. It now sits just above the label's real top and follows its size.
6. **Explorer counts** get thousands separators (`formatCount`), and fact values wrap inside the card. Checked with 100,000 systems and 354,321 planets at 360 px.
7. **Free-travel and Explorer lists:** the UI has no list of systems or docks. Free travel is the map tap plus the planet card's FLY HERE, which is Agent 3's map. Explorer shows counts only, so there is nothing to cap in `src/ui`.

## 2. Exact texts (for Agent 6)
- **Badges:**
  - `READY TO FLY`
  - `REFUEL FIRST`
  - `TOO FAR FOR THIS SHIP`
- **Card detail lines:**
  - Refuel: `<reachText> Tap REFUEL at the top.`
  - Far: `<reachText> Bigger tanks in the SHIPYARD reach farther.`
- **Board box titles and hints:**

  | Case | Title | Body | Hint |
  |---|---|---|---|
  | No job doable now, refuel jobs exist | `FUEL UP FIRST` | `Every job you could fly needs more fuel than you have.` | `Tap REFUEL at the top.` |
  | Empty board | `EMPTY BOARD` | game message | `New jobs arrive every 6 hours. Have a coffee.` |
  | Far dock | `WAY OUT IN THE DARK` | game message (+ `remoteMessage` if different) | `Bigger tanks in the SHIPYARD reach farther. This system's own planets are close: MAP, tap a planet, FLY HERE.` |
  | Every job too far | `TOO FAR FOR THIS SHIP` | game message | `Fly somewhere new: MAP, tap a planet, FLY HERE. New star systems pay discovery credits.` |
  | Otherwise | `NOTHING FITS YOUR SHIP` | game message | same as the row above |

- **Universe rebuilt note:**
  `Universe rebuilt: welcome to the new spiral galaxy! Kept: credits, ships, upgrades, paint jobs, ranks, job counts, time. Left behind: your job, any free trip, the explored list.[ Outposts sold back for 26,400 CR.] Your ship waits at the start dock, Breezy Hill Outpost.`
  - The part in brackets appears only if outposts were sold.
  - The dock name is shown only if the ship really is at the start dock; otherwise the sentence ends "…waits at the start dock."
- **Import confirm:**
  - `! This save is from an older universe, so it moves into the new galaxy. Kept: credits, ships, upgrades, paint jobs, ranks, job counts, time. Left behind: your job, any free trip, the explored list. Outposts are sold back for what they cost. The ship starts at the start dock.`
  - When that save was mid-trip: `! The trip it was on is called off, and its fuel comes back.`

## 3. Files touched
- `src/ui/`: `logic.ts`, `jobsmenu.ts`, `savefilelogic.ts`, `statusstrip.ts`, `dom.ts`, `installhint.ts`, `index.ts` (2 lines: system id type, start dock name for the note), `title.ts`, `titlescene.ts`, `planetpanel.ts`, `theme.css`.
- `tests/`: `ui.test.ts`, `ui-names.test.ts`, `ui-savefile.test.ts`.
- `tests/title.test.ts` was left to Agent 3, as his brief asks.

## 4. Test status
- `npm run check` green, with 1,125 tests passing.
- GitHub workflows "Check a branch" and "Check the game layer" are green on `universe-v3`. Nothing is red.

## 5. Known issues
- At a far dock the game's message says "The next dock is 94.7 ly away" even when that system has another dock at 0 ly. The board simply has no jobs to it. This text lives in `src/game`; for the Lead and Agent 4.
- The test page is a private claude.ai page built from the branch at commit af6bda6. It is not the official preview. Agent 3's preview on the game's own address replaces it once it is live.
- The test saves load into storage prefixed `preview-v3:` and never touch the real game. The "three badges" save depends on the real time, because boards change every few hours, so a badge can be missing at times.
- `src/render` still gets the dock short name as `destinationName` (as noted in 5h).

## 6. Suggestions (not built)
- **Suggestion:** one name-shortening rule for menus and 3D labels. Today the UI uses `src/ui/logic.ts` `shortenName` and render has its own helpers. Merge later in one place.
- **Suggestion:** a "code only" form ("JR62R-MT37") for the tightest one-line spots, if Andy likes it.
- **Suggestion:** at a stranded far dock, a rescue option (an emergency tow or fuel) is a game decision for the Lead. The UI only explains the situation.
