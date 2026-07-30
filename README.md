# Wordle Solver (web)

Lightweight browser port of the Java **WordleSolver** desktop app
(`~/Downloads/WordleSolver`), with the same dictionary and core filters as the
Google Sheet helper.

## Open

```bash
cd wordle-solver
python3 -m http.server 8080
# → http://localhost:8080
```

Or open `index.html` directly (plain `<script>` tags; no build step).

## Features (from the Java app)

| Control | Behavior |
|---------|----------|
| **Enter guess** | Type a 5-letter word; click tiles gray→yellow→green; **Submit** merges filters. Confirmed greens auto-fill. |
| **Guess** (optimal) | Copies the top optimal word into the guess tiles (does not submit) |
| **Reset all** | Top of page — clears filters, history, and guess tiles |
| **Guess history** | Submitted guesses with colored tiles; cleared by **Reset all** |
| **Puzzle greens** | Fixed letters at positions 1–5 |
| **Letter YES / NO / HAS** | May appear / excluded / must appear (click to cycle) |
| **Position exclusion** | Letter is in the word but *not* at a given slot (yellow) |
| **Min unique letters / vowels** | Same as the Java spinners |
| **Score weighting** | Frequency vs position frequency (default 65% / 35%) |
| **Optimal / Guess** | Lowest **expected remaining** after feedback (partition score) |
| **Available words table** | E[left], word, # unique, # unique vowels |
| **Common words only** | Wordle answers + Google 20k 5-letter ∩ dict (~3k); default on |
| **Plurals** | Exclude from main (default) and/or show in a segregated section |

### Guess → filter merge rules

- **Green** → known letter at that position + HAS  
- **Yellow** → HAS + position exclusion at that index  
- **Gray** → NO only if that letter has no green/yellow on the same guess (and is not already HAS/known)

Dictionary: `dictionary.csv` from the Java project (**12,949** five-letter words).

## Tests

```bash
node test/filter.test.js
```

## Files

| File | Role |
|------|------|
| `index.html` / `styles.css` / `app.js` | UI |
| `filter.js` | Pure filter + scoring (shared with tests) |
| `words.js` | Dictionary |
| `test/filter.test.js` | Unit tests |
