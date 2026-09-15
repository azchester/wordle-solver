# Wordle Solver

A browser helper that ranks the next Wordle guess from letter constraints and remaining possible answers.

## Language

**Remaining answers**:
Words that still satisfy every letter and position constraint — the possible solutions.
_Avoid_: remaining words, remaining guesses

**Hard mode**:
A ranking rule that the next guess must be a remaining answer, so it uses every HAS letter and every known green. Default on.
_Avoid_: strict mode, solve-only

**Probe**:
A valid Wordle guess chosen to split remaining answers. It must not use NO letters, and it need not use HAS letters or known greens.
_Avoid_: easy-mode guess, explorer, wildcard

**Known green**:
A letter fixed to a position from a green tile or the puzzle row.

**HAS**:
A letter that must appear at least once (yellow or green).

**NO**:
A letter known to be absent from the solution (gray, and not still in play from a duplicate).
_Avoid_: excluded letter (except when talking about the excludes list)

**YES**:
A letter that may still appear; neither required nor ruled out.
