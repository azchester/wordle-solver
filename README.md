# Wordle Solver

A zero-dependency browser app that helps you solve Wordle. Enter guesses with color feedback, tighten letter constraints, and rank remaining candidates by **expected remaining answers** after one more guess.

Open `index.html` locally or serve the folder as static files—no build step, npm install, or backend required.

---

## Features

- **Guess entry** — Type a 5-letter word, click tiles to cycle gray → yellow → green, then submit. Confirmed greens auto-fill on the next guess.
- **Guess history** — Submitted guesses stay visible with their tile colors.
- **Hybrid ranking** — Opening guess maximizes information over the full allowed list; later guesses follow **Hard mode** (on by default).
- **Hard mode** — On: next guess must use every discovered letter and keep greens in place (remaining possible answers only). Off: rank information probes that avoid gray letters but need not reuse greens or yellows.
- **Letter status board** — Click A–Z to cycle **YES** (may appear) → **NO** (excluded) → **HAS** (must appear).
- **Puzzle greens** — Manually set known letters at positions 1–5.
- **Position exclusions** — Mark yellow-style “in the word, not here” constraints.
- **Answers-only filter** — Prefer the official NYT Wordle answer list (~2.4k words). Turn off to include the full allowed-guess dictionary.
- **Plural handling** — Exclude likely `-s` plurals from the main list, and optionally show them in a separate section.
- **Minimums** — Require a minimum number of unique letters or unique vowels (A/E/I/O/U).
- **Fill optimal** — One click copies the top-ranked word into the guess row (does not submit).

---

## Quick start

```bash
git clone <your-repo-url> wordle-solver
cd wordle-solver
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

You can also open `index.html` directly in a browser. A local static server is recommended if your browser restricts `file://` scripts.

There is no build toolchain and no package manager—just static HTML, CSS, and JavaScript.

---

## How to use

### Typical play loop

1. Play (or simulate) a Wordle guess in the **Enter guess** row.
2. Click each tile until the colors match the game feedback:
   - **Gray** — letter not in the answer
   - **Yellow** — letter in the answer, wrong position
   - **Green** — letter correct in that position
3. Click **Submit guess**. Filters and the remaining-word table update automatically.
4. Review **Optimal guess** and the **Available words** table (`E[left]` lower is better).
5. Click **Guess** next to a word (or the optimal **Guess** button) to load it into the tile row, then color and submit again.
6. Uncheck **Hard mode** to allow an information probe that ignores greens/yellows (confirmed greens unlock on the guess row).
7. Use **Reset all** when starting a new puzzle.

### Manual constraints

You do not have to enter every guess as tiles. You can also:

| Control | Purpose |
|--------|---------|
| **Puzzle (known greens)** | Lock a letter into a fixed slot |
| **Letter status** | Force YES / NO / HAS for any letter |
| **Position exclusion** | Require a HAS letter *not* at a given index |
| **Word list filters** | NYT answers only, exclude plurals, show plurals separately |
| **Hard mode** | On: recommend remaining possible answers only. Off: recommend probes that avoid gray letters |
| **Minimums** | Prefer high-diversity or multi-vowel probes |

### Guess → filter merge rules

When you submit a guess, tile colors merge into constraints as follows:

| Tile | Effect |
|------|--------|
| **Green** | Fixed letter at that position + letter marked HAS |
| **Yellow** | Letter marked HAS + position exclusion at that index |
| **Gray** | Letter is not at that index. If the letter is still in play (green/yellow on this guess, or already HAS / known green), add a **position exclusion** only. Otherwise mark the letter NO. |

This matches standard Wordle multi-letter handling: a gray tile never fully excludes a letter that also scored yellow or green, but it *does* exclude that letter from the gray position (e.g. `CURRY` with green R then gray R → R stays HAS, R forbidden at the gray slot).

Green and yellow copies in a single guess also establish a minimum letter count. For example, `SHEEN` with one green E and one yellow E requires at least two E's in every remaining answer and hard-mode recommendation. Counts carry forward using the highest confirmed minimum, without adding repeated evidence from separate guesses. The letter board displays `HAS ≥2` for two required copies; cycling the letter to YES or NO clears its minimum. Reset all clears every minimum.

---

## How ranking works

The app uses a **hybrid strategy**:

| Stage | Guess pool | Secret / score set |
|-------|------------|--------------------|
| **Opening** (greenfield: no guesses, no letter constraints) | Full allowed dictionary (~14.8k), 5-unique-letter probes | NYT answers (or filtered remaining) |
| **Hard mode on** (default, after first guess or any constraint) | Remaining approved candidates only | Same candidate set |
| **Hard mode off** | Allowed guesses that avoid excluded (gray / NO) letters. Need not reuse HAS letters or known greens. | Remaining possible answers (full constraints) |

Both stages use a **one-ply partition score**:

1. For each candidate guess `g` and every remaining possible answer `a`, compute the Wordle color pattern of `g` vs `a` (including correct handling of duplicate letters).
2. Group remaining answers into buckets by pattern (at most \(3^5 = 243\) patterns).
3. Score by **expected remaining set size** after feedback:

\[
E[\text{left}] = \frac{1}{|S|} \sum_p |bucket_p|^2
\]

Lower `E[left]` means the guess tends to shrink the list more, averaged over equally likely remaining answers.

**Tie-break:** higher **entropy** of the feedback partition (bits of information), then remaining possible answers over equal-score probes, then unique-letter count.

Opening probes that are not official answers are labeled **probe** in the UI. The first open-board ranking is cached so the ~1s full-dictionary scan only runs once per answer set.

With **Hard mode** off, later guesses use the same expected-remaining score, but the guess pool is every allowed word that does not contain a NO letter. Remaining possible answers are always fully scored so a winning candidate is never dropped from the eval budget. Confirmed greens are not locked on the guess row, so you can type a probe as-is.

**Performance note (solve mode):** When the remaining set is very large, only a prioritized subset of guesses (preferring high unique-letter counts) is fully scored against every remaining answer so the UI stays responsive. Unscored rows sort after fully scored ones.

---

## Word lists

| List | Size | Role |
|------|------|------|
| Full dictionary (`words.js`) | **14,857** five-letter words | Prior dictionary plus all official NYT Wordle valid guesses (additive) |
| Answer set (`common-words.js`) | **2,447** | Official NYT Wordle **answer** list plus likely first-time promotions (from `data/wordle-answers.txt`) |
| Source data | `data/wordle-allowed.txt`, `data/wordle-answers.txt`, `data/google-20k.txt` | Full valid-guess list, answer list, frequency list |

The full dictionary remains the union of prior words and the official NYT valid-guess pool (allowed guesses + answers). Scoring and guesses can still use that larger pool when needed.

**NYT answers only** (default on) keeps the main table focused on the official answer list (~2.4k). Turn the toggle off to include the full allowed-guess dictionary (~14.8k) and any local-only extras.

**Plurals** are detected heuristically: five-letter words ending in a single `S`, excluding endings like `-ss`, `-us`, and `-is` (e.g. glass, focus, basis).

---

## Project structure

```text
wordle-solver/
├── index.html          # App shell and controls
├── styles.css          # Layout and tile / status styling
├── app.js              # UI state, event wiring, rendering
├── filter.js           # Pure filter + scoring + applyGuess (shared with tests)
├── words.js            # Full 14,857-word dictionary (prior + NYT guesses)
├── common-words.js     # COMMON_WORDS + COMMON_SET (NYT answers only)
├── data/
│   ├── google-20k.txt       # Frequency list source
│   ├── wordle-allowed.txt   # Full valid-guess list (prior + NYT)
│   └── wordle-answers.txt   # Official answer list source
└── test/
    ├── filter.test.js
    ├── guess.test.js
    ├── guess-ui.test.js
    ├── hard-mode.test.js
    ├── opener.test.js
    ├── row-guess.test.js
    └── word-class.test.js
```

Logic lives in `filter.js` as a small UMD-style module (`window.WordleFilter` in the browser, `module.exports` under Node). The UI in `app.js` only owns presentation and interaction.

---

## Development

### Run the app

```bash
python3 -m http.server 8080
# → http://localhost:8080
```

Any static file server works (`npx serve`, nginx, GitHub Pages, etc.).

### Tests

Tests are plain Node scripts (no test framework required). Run them individually or all at once:

```bash
node test/filter.test.js
node test/guess.test.js
node test/guess-ui.test.js
node test/row-guess.test.js
node test/word-class.test.js
node test/opener.test.js
node test/hard-mode.test.js
```

Or:

```bash
for f in test/*.test.js; do node "$f" || exit 1; done
```

Coverage includes dictionary shape, viability filters, Wordle feedback / `applyGuess` merge rules, hard-mode vs info-probe ranking, word-class toggles (common / plural), and UI-oriented guess helpers.

---

## Browser support

Modern evergreen browsers (Chrome, Firefox, Safari, Edge). The code uses ES5-friendly patterns intentionally so it runs without transpilation.

---

## Privacy

Everything runs **entirely in your browser**. No network calls are made by the app itself (beyond loading its own static assets from the host you serve). Guesses and constraints never leave your machine.

---

## Limitations

- Ranking is **one ply** (looks one guess ahead), not a full multi-step search tree.
- On large remaining sets, scoring may sample a subset of guess words for responsiveness.
- Plural detection is heuristic, not a full morphological analyzer.
- With **NYT answers only** on (default), the candidate table uses the ~2.4k answer list. Turn it off for the full ~14.8k allowed-guess dictionary.

---

## Contributing

Issues and pull requests are welcome. When changing filter or scoring behavior, please:

1. Keep pure logic in `filter.js` (testable without a browser).
2. Add or update a unit test under `test/`.
3. Run the full `test/*.test.js` suite before opening a PR.

---

## License

No license file is currently published in this repository. If you fork or redistribute, check with the maintainer or add an explicit license of your choice (e.g. MIT).
