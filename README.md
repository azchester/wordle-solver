# Wordle Solver

A zero-dependency browser app that helps you solve Wordle. Enter guesses with color feedback, tighten letter constraints, and rank remaining candidates by **expected remaining answers** after one more guess.

Open `index.html` locally or serve the folder as static files—no build step, npm install, or backend required.

---

## Features

- **Guess entry** — Type a 5-letter word, click tiles to cycle gray → yellow → green, then submit. Confirmed greens auto-fill on the next guess.
- **Guess history** — Submitted guesses stay visible with their tile colors.
- **Optimal ranking** — Candidates sorted by expected remaining list size (`E[left]`); entropy breaks ties.
- **Letter status board** — Click A–Z to cycle **YES** (may appear) → **NO** (excluded) → **HAS** (must appear).
- **Puzzle greens** — Manually set known letters at positions 1–5.
- **Position exclusions** — Mark yellow-style “in the word, not here” constraints.
- **Common words filter** — Prefer everyday vocabulary (~3k words) over the full dictionary.
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
6. Use **Reset all** when starting a new puzzle.

### Manual constraints

You do not have to enter every guess as tiles. You can also:

| Control | Purpose |
|--------|---------|
| **Puzzle (known greens)** | Lock a letter into a fixed slot |
| **Letter status** | Force YES / NO / HAS for any letter |
| **Position exclusion** | Require a HAS letter *not* at a given index |
| **Word list filters** | Common-only, exclude plurals, show plurals separately |
| **Minimums** | Prefer high-diversity or multi-vowel probes |

### Guess → filter merge rules

When you submit a guess, tile colors merge into constraints as follows:

| Tile | Effect |
|------|--------|
| **Green** | Fixed letter at that position + letter marked HAS |
| **Yellow** | Letter marked HAS + position exclusion at that index |
| **Gray** | Letter is not at that index. If the letter is still in play (green/yellow on this guess, or already HAS / known green), add a **position exclusion** only. Otherwise mark the letter NO. |

This matches standard Wordle multi-letter handling: a gray tile never fully excludes a letter that also scored yellow or green, but it *does* exclude that letter from the gray position (e.g. `CURRY` with green R then gray R → R stays HAS, R forbidden at the gray slot).

---

## How ranking works

The app ranks remaining answers with a **one-ply partition score**:

1. For each candidate guess `g` and every remaining possible answer `a`, compute the Wordle color pattern of `g` vs `a` (including correct handling of duplicate letters).
2. Group remaining answers into buckets by pattern (at most \(3^5 = 243\) patterns).
3. Score by **expected remaining set size** after feedback:

\[
E[\text{left}] = \frac{1}{|S|} \sum_p |bucket_p|^2
\]

Lower `E[left]` means the guess tends to shrink the list more, averaged over equally likely remaining answers.

**Tie-break:** higher **entropy** of the feedback partition (bits of information).

**Performance note:** When the remaining set is very large, only a prioritized subset of guesses (preferring high unique-letter counts) is fully scored against every remaining answer so the UI stays responsive. Unscored rows sort after fully scored ones.

---

## Word lists

| List | Size | Role |
|------|------|------|
| Full dictionary (`words.js`) | **12,949** five-letter words | All candidates the solver can propose or filter |
| Common set (`common-words.js`) | **~3,067** | Intersection of frequent English + Wordle-style answer vocabulary |
| Source data | `data/google-20k.txt`, `data/wordle-answers.txt` | Inputs used to build the common-word set |

**Common words only** (default on) keeps the main table focused on words more likely to be real answers or strong human guesses, while the full dictionary remains available when the toggle is off.

**Plurals** are detected heuristically: five-letter words ending in a single `S`, excluding endings like `-ss`, `-us`, and `-is` (e.g. glass, focus, basis).

---

## Project structure

```text
wordle-solver/
├── index.html          # App shell and controls
├── styles.css          # Layout and tile / status styling
├── app.js              # UI state, event wiring, rendering
├── filter.js           # Pure filter + scoring + applyGuess (shared with tests)
├── words.js            # Full 12,949-word dictionary
├── common-words.js     # COMMON_WORDS + COMMON_SET map
├── data/
│   ├── google-20k.txt      # Frequency list source
│   └── wordle-answers.txt  # Answer-list source
└── test/
    ├── filter.test.js
    ├── guess.test.js
    ├── guess-ui.test.js
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
```

Or:

```bash
for f in test/*.test.js; do node "$f" || exit 1; done
```

Coverage includes dictionary shape, viability filters, Wordle feedback / `applyGuess` merge rules, word-class toggles (common / plural), and UI-oriented guess helpers.

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
- “Common words” is a curated intersection of lists, not a guarantee of official daily-answer eligibility.

---

## Contributing

Issues and pull requests are welcome. When changing filter or scoring behavior, please:

1. Keep pure logic in `filter.js` (testable without a browser).
2. Add or update a unit test under `test/`.
3. Run the full `test/*.test.js` suite before opening a PR.

---

## License

No license file is currently published in this repository. If you fork or redistribute, check with the maintainer or add an explicit license of your choice (e.g. MIT).
