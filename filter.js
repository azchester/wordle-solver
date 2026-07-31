/**
 * Pure WordleSolver logic ported from the Java desktop app
 * (com.azc.inc.wordlesolver) plus spreadsheet YES/NO/HAS convenience.
 *
 * Filter:
 *  - known[i]: fixed letter at position i (green)
 *  - contains / HAS: letter must appear at least once
 *  - excludes / NO: letter must not appear
 *  - positionExclusions: letter must not be at given index (yellow wrong-slot)
 *  - minUniqueLetters / minUniqueVowels thresholds
 *  - optional strictAvailable: every letter in the word is YES or HAS (spreadsheet)
 *
 * Score (Java updateBestWord):
 *  frequency = sum over unique letters of (count of remaining words containing letter)
 *  positionFrequency = sum over positions of (count of remaining words with that letter at that position)
 *  weightedScore = round(frequency * freqWeight + positionFrequency * (1 - freqWeight))
 */
(function (root) {
  "use strict";

  var VOWELS = { A: true, E: true, I: true, O: true, U: true };
  var LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  function uniqueLetterCount(word) {
    var seen = Object.create(null);
    var n = 0;
    for (var i = 0; i < word.length; i++) {
      var ch = word.charAt(i);
      if (!seen[ch]) {
        seen[ch] = true;
        n++;
      }
    }
    return n;
  }

  /** Unique A/E/I/O/U letters (Java Word.uniqueVowels). Y is not a vowel. */
  function uniqueVowelCount(word) {
    var seen = Object.create(null);
    var n = 0;
    for (var i = 0; i < word.length; i++) {
      var ch = word.charAt(i);
      if (VOWELS[ch] && !seen[ch]) {
        seen[ch] = true;
        n++;
      }
    }
    return n;
  }

  /** Total A/E/I/O/U occurrences (spreadsheet # of vowels column). */
  function vowelOccurrenceCount(word) {
    var n = 0;
    for (var i = 0; i < word.length; i++) {
      if (VOWELS[word.charAt(i)]) n++;
    }
    return n;
  }

  /** @deprecated use uniqueVowelCount; kept as alias for older tests */
  function vowelCount(word) {
    return vowelOccurrenceCount(word);
  }

  function uniqueLetterList(word) {
    var seen = Object.create(null);
    var list = [];
    for (var i = 0; i < word.length; i++) {
      var ch = word.charAt(i);
      if (!seen[ch]) {
        seen[ch] = true;
        list.push(ch);
      }
    }
    return list;
  }

  /**
   * Normalize UI-style YES/NO/HAS statuses into contains/excludes arrays.
   * @param {Object.<string,string>} statuses
   * @returns {{contains: string[], excludes: string[]}}
   */
  function statusesToLists(statuses) {
    var contains = [];
    var excludes = [];
    for (var i = 0; i < LETTERS.length; i++) {
      var L = LETTERS[i];
      var st = statuses[L];
      if (st === "HAS") contains.push(L);
      else if (st === "NO") excludes.push(L);
    }
    return { contains: contains, excludes: excludes };
  }

  /**
   * Default open constraints (Java reset).
   */
  function defaultConstraints() {
    var statuses = Object.create(null);
    for (var i = 0; i < LETTERS.length; i++) {
      statuses[LETTERS[i]] = "YES";
    }
    return {
      statuses: statuses,
      known: ["", "", "", "", ""],
      contains: [],
      excludes: [],
      positionExclusions: [], // { letter: 'A', position: 0 }
      minUniqueLetters: 0,
      minUniqueVowels: 0,
      frequencyWeight: 0.65,
      strictAvailable: true, // spreadsheet-compatible: NO blocks letters not YES/HAS
      // Word-class filters (UI defaults these on; pure API leaves off for full dict)
      commonOnly: false,
      excludePlurals: false,
      requirePlural: false,
    };
  }

  /**
   * Likely regular plural / 3rd-person -s form for 5-letter words.
   * Ends with single S, not SS / US / IS (glass, focus, basis).
   */
  function isLikelyPlural(word) {
    word = String(word || "").toUpperCase();
    if (word.length !== 5) return false;
    if (word.charAt(4) !== "S") return false;
    if (word.charAt(3) === "S") return false; // -SS
    var tail2 = word.slice(3);
    if (tail2 === "US" || tail2 === "IS") return false;
    return true;
  }

  /**
   * @param {string} word
   * @param {Object|null} commonSet map word -> true
   */
  function isCommonWord(word, commonSet) {
    if (!commonSet) return true;
    return !!commonSet[String(word).toUpperCase()];
  }

  /**
   * Class filters: common-only, exclude/require plurals.
   */
  function passesClassFilters(word, constraints, commonSet) {
    var c = constraints || {};
    if (c.commonOnly && !isCommonWord(word, commonSet)) return false;
    var plural = isLikelyPlural(word);
    if (c.requirePlural && !plural) return false;
    if (c.excludePlurals && plural) return false;
    return true;
  }

  /**
   * Resolve contains/excludes from statuses (UI) or explicit lists (Java-style).
   * Statuses win when present so empty default arrays never ignore YES/NO/HAS.
   */
  function resolvedLists(constraints) {
    if (constraints.statuses) {
      return statusesToLists(constraints.statuses);
    }
    return {
      contains: (constraints.contains || []).map(function (c) {
        return String(c).toUpperCase();
      }),
      excludes: (constraints.excludes || []).map(function (c) {
        return String(c).toUpperCase();
      }),
    };
  }

  /**
   * @param {string} word
   * @param {object} constraints
   * @returns {boolean}
   */
  function isViable(word, constraints) {
    var lists = resolvedLists(constraints);
    var known = constraints.known || ["", "", "", "", ""];
    var minU = constraints.minUniqueLetters || 0;
    var minV = constraints.minUniqueVowels || 0;
    var strict =
      constraints.strictAvailable !== undefined
        ? constraints.strictAvailable
        : true;
    var i;
    var ch;

    if (uniqueLetterCount(word) < minU) return false;
    if (uniqueVowelCount(word) < minV) return false;

    for (i = 0; i < 5; i++) {
      var k = known[i];
      if (k && k.length === 1) {
        if (word.charAt(i) !== String(k).toUpperCase()) return false;
      }
    }

    for (i = 0; i < lists.excludes.length; i++) {
      if (word.indexOf(lists.excludes[i]) !== -1) return false;
    }

    for (i = 0; i < lists.contains.length; i++) {
      if (word.indexOf(lists.contains[i]) === -1) return false;
    }

    // Spreadsheet: every letter present must be YES or HAS (not NO / missing)
    if (strict && constraints.statuses) {
      for (i = 0; i < word.length; i++) {
        ch = word.charAt(i);
        var st = constraints.statuses[ch];
        if (st !== "YES" && st !== "HAS") return false;
      }
    }

    var posEx = constraints.positionExclusions || [];
    for (i = 0; i < posEx.length; i++) {
      var pe = posEx[i];
      var letter = String(pe.letter).toUpperCase();
      var pos = pe.position | 0;
      if (pos >= 0 && pos < word.length && word.charAt(pos) === letter) {
        return false;
      }
    }

    return true;
  }

  /**
   * Filter words (no scoring).
   * @param {string[]} words
   * @param {object} constraints
   * @param {Object|null} [commonSet] optional COMMON_SET map
   * @returns {{ word: string, unique: number, uniqueVowels: number, vowels: number, common: boolean, plural: boolean }[]}
   */
  function filterWords(words, constraints, commonSet) {
    var out = [];
    var set =
      commonSet ||
      (constraints && constraints.commonSet) ||
      (typeof globalThis !== "undefined" && globalThis.COMMON_SET) ||
      null;
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (!isViable(w, constraints)) continue;
      if (!passesClassFilters(w, constraints, set)) continue;
      out.push({
        word: w,
        unique: uniqueLetterCount(w),
        uniqueVowels: uniqueVowelCount(w),
        vowels: vowelOccurrenceCount(w),
        common: isCommonWord(w, set),
        plural: isLikelyPlural(w),
      });
    }
    return out;
  }

  /**
   * Wordle feedback for guess vs answer.
   * Returns pattern id in 0..242 (base-3: gray=0, yellow=1, green=2 per position).
   * Duplicate letters: greens first, then yellows up to remaining counts.
   */
  function feedbackId(guess, answer) {
    var marks = [0, 0, 0, 0, 0];
    var counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    var i;
    var idx;
    for (i = 0; i < 5; i++) {
      counts[answer.charCodeAt(i) - 65]++;
    }
    for (i = 0; i < 5; i++) {
      if (guess.charAt(i) === answer.charAt(i)) {
        marks[i] = 2;
        counts[guess.charCodeAt(i) - 65]--;
      }
    }
    for (i = 0; i < 5; i++) {
      if (marks[i] === 2) continue;
      idx = guess.charCodeAt(i) - 65;
      if (counts[idx] > 0) {
        marks[i] = 1;
        counts[idx]--;
      }
    }
    return (
      marks[0] +
      3 * marks[1] +
      9 * marks[2] +
      27 * marks[3] +
      81 * marks[4]
    );
  }

  /**
   * Expected remaining candidates if we guess `guess` against answer set `answers`.
   * E[|S'|] = (1/|S|) * sum_p |bucket_p|^2
   */
  function expectedRemaining(guess, answers) {
    var n = answers.length;
    if (n === 0) return 0;
    var buckets = new Int32Array(243);
    var i;
    for (i = 0; i < n; i++) {
      buckets[feedbackId(guess, answers[i])]++;
    }
    var sumSq = 0;
    for (i = 0; i < 243; i++) {
      var c = buckets[i];
      if (c) sumSq += c * c;
    }
    return sumSq / n;
  }

  /**
   * Entropy of the feedback partition (bits). Higher = more informative.
   */
  function partitionEntropy(guess, answers) {
    var n = answers.length;
    if (n === 0) return 0;
    var buckets = new Int32Array(243);
    var i;
    for (i = 0; i < n; i++) {
      buckets[feedbackId(guess, answers[i])]++;
    }
    var h = 0;
    var inv = 1 / n;
    var log2 = Math.log(2);
    for (i = 0; i < 243; i++) {
      var c = buckets[i];
      if (!c) continue;
      var p = c * inv;
      h -= p * (Math.log(p) / log2);
    }
    return h;
  }

  /**
   * Score remaining words by expected remaining size after the guess
   * (partition / information-theoretic one-ply). Lower score is better.
   *
   * score = E[|remaining|] = sum(bucket^2) / |S|
   * Also attaches entropy (bits) as a tie-break preference.
   *
   * Guesses are always evaluated against the full remaining answer set S.
   * When |S| is large, only a prioritized subset of guesses is fully scored
   * (high unique-letter count first) so the UI stays responsive; unscored
   * words sort after with a worst-case score.
   *
   * @returns {{ word, unique, uniqueVowels, vowels, score, expectedRemaining, entropy }[]}
   */
  function scoreAndSort(filtered) {
    var n = filtered.length;
    if (n === 0) return [];

    var answerWords = new Array(n);
    var i;
    for (i = 0; i < n; i++) {
      answerWords[i] = filtered[i].word;
    }

    // Full O(n^2) when small; otherwise evaluate top prioritized guesses only.
    var FULL_LIMIT = 1800;
    var MAX_GUESS_EVAL = 1000;
    var guessIndices = [];
    if (n <= FULL_LIMIT) {
      for (i = 0; i < n; i++) guessIndices.push(i);
    } else {
      var order = [];
      for (i = 0; i < n; i++) {
        order.push({ i: i, u: filtered[i].unique, w: filtered[i].word });
      }
      order.sort(function (a, b) {
        if (b.u !== a.u) return b.u - a.u;
        if (a.w < b.w) return -1;
        if (a.w > b.w) return 1;
        return 0;
      });
      var take = Math.min(MAX_GUESS_EVAL, n);
      for (i = 0; i < take; i++) guessIndices.push(order[i].i);
    }

    var scoredByIndex = new Array(n);
    var buckets = new Int32Array(243);
    var invN = 1 / n;
    var log2 = Math.log(2);
    var scoredSet = Object.create(null);

    for (var g = 0; g < guessIndices.length; g++) {
      var gi = guessIndices[g];
      var guess = answerWords[gi];
      buckets.fill(0);
      for (i = 0; i < n; i++) {
        buckets[feedbackId(guess, answerWords[i])]++;
      }
      var sumSq = 0;
      var entropy = 0;
      for (i = 0; i < 243; i++) {
        var c = buckets[i];
        if (!c) continue;
        sumSq += c * c;
        var p = c * invN;
        entropy -= p * (Math.log(p) / log2);
      }
      var expected = sumSq * invN;
      var row = filtered[gi];
      scoredByIndex[gi] = {
        word: guess,
        unique: row.unique,
        uniqueVowels: row.uniqueVowels,
        vowels: row.vowels,
        common: row.common,
        plural: row.plural,
        score: expected,
        expectedRemaining: expected,
        entropy: entropy,
      };
      scoredSet[gi] = true;
    }

    // Unscored (large-n only): place after real scores
    for (i = 0; i < n; i++) {
      if (scoredSet[i]) continue;
      row = filtered[i];
      scoredByIndex[i] = {
        word: row.word,
        unique: row.unique,
        uniqueVowels: row.uniqueVowels,
        vowels: row.vowels,
        common: row.common,
        plural: row.plural,
        score: n,
        expectedRemaining: n,
        entropy: 0,
      };
    }

    var scored = scoredByIndex;
    scored.sort(function (a, b) {
      if (a.score !== b.score) return a.score - b.score;
      if (b.entropy !== a.entropy) return b.entropy - a.entropy;
      if (b.unique !== a.unique) return b.unique - a.unique;
      if (a.word < b.word) return -1;
      if (a.word > b.word) return 1;
      return 0;
    });
    return scored;
  }

  /**
   * Filter + partition-score + sort (main entry used by UI).
   * @param {Object|null} [commonSet]
   */
  function filterScoreWords(words, constraints, commonSet) {
    var filtered = filterWords(words, constraints, commonSet);
    return scoreAndSort(filtered);
  }

  /**
   * Deep-ish clone of a constraints object (statuses, known, positionExclusions).
   */
  function cloneConstraints(constraints) {
    var src = constraints || defaultConstraints();
    var statuses = Object.create(null);
    var srcSt = src.statuses || {};
    for (var i = 0; i < LETTERS.length; i++) {
      var L = LETTERS[i];
      statuses[L] = srcSt[L] || "YES";
    }
    var known = (src.known || ["", "", "", "", ""]).slice(0, 5);
    while (known.length < 5) known.push("");
    var posEx = (src.positionExclusions || []).map(function (pe) {
      return { letter: String(pe.letter).toUpperCase(), position: pe.position | 0 };
    });
    return {
      statuses: statuses,
      known: known,
      contains: (src.contains || []).slice(),
      excludes: (src.excludes || []).slice(),
      positionExclusions: posEx,
      minUniqueLetters: src.minUniqueLetters || 0,
      minUniqueVowels: src.minUniqueVowels || 0,
      frequencyWeight:
        src.frequencyWeight === undefined || src.frequencyWeight === null
          ? 0.65
          : src.frequencyWeight,
      strictAvailable:
        src.strictAvailable !== undefined ? src.strictAvailable : true,
      commonOnly: !!src.commonOnly,
      excludePlurals: !!src.excludePlurals,
      requirePlural: !!src.requirePlural,
    };
  }

  function hasPosExclusion(list, letter, position) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].letter === letter && list[i].position === position) return true;
    }
    return false;
  }

  /**
   * Merge one Wordle guess into constraints.
   * tileStatuses[i] is 'green' | 'yellow' | 'gray' (also accepts 'correct'/'present'/'absent').
   *
   * Rules:
   *  - green → known[i]=letter, letter HAS; never demotes prior stronger status to YES
   *  - yellow → letter HAS + position exclusion at i; does not fill known[i]
   *  - gray → letter is not at this index. If the letter is still in play
   *           (green/yellow on this guess, or already HAS/known), add a
   *           position exclusion at i. Otherwise mark letter NO.
   *  - Prior greens and HAS are never cleared by a later gray
   *
   * @param {object} constraints
   * @param {string} guessWord five-letter word
   * @param {string[]} tileStatuses length 5
   * @returns {{ constraints: object, historyEntry: { word: string, tiles: string[] } }}
   */
  function applyGuess(constraints, guessWord, tileStatuses) {
    var word = String(guessWord || "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "");
    if (word.length !== 5) {
      throw new Error("applyGuess requires a five-letter guess, got: " + guessWord);
    }
    if (!tileStatuses || tileStatuses.length !== 5) {
      throw new Error("applyGuess requires 5 tile statuses");
    }

    function normalizeTile(t) {
      t = String(t || "gray").toLowerCase();
      if (t === "correct" || t === "g" || t === "green") return "green";
      if (t === "present" || t === "y" || t === "yellow" || t === "has") return "yellow";
      return "gray";
    }

    var tiles = [];
    var i;
    for (i = 0; i < 5; i++) tiles.push(normalizeTile(tileStatuses[i]));

    var next = cloneConstraints(constraints);

    // Letters that are green or yellow on THIS guess (cannot be fully gray-excluded)
    var requiredOnGuess = Object.create(null);
    for (i = 0; i < 5; i++) {
      if (tiles[i] === "green" || tiles[i] === "yellow") {
        requiredOnGuess[word.charAt(i)] = true;
      }
    }

    // Apply greens and yellows first
    for (i = 0; i < 5; i++) {
      var ch = word.charAt(i);
      var tile = tiles[i];
      if (tile === "green") {
        next.known[i] = ch;
        next.statuses[ch] = "HAS";
      } else if (tile === "yellow") {
        next.statuses[ch] = "HAS";
        // Do not overwrite an existing green at this position
        if (!next.known[i]) {
          // leave known empty
        }
        if (!hasPosExclusion(next.positionExclusions, ch, i)) {
          next.positionExclusions.push({ letter: ch, position: i });
        }
      }
    }

    // Grays: letter is never at this position.
    // If still in play (green/yellow this guess, or prior HAS/known), only
    // exclude the position — do not mark the letter NO (Wordle multi-letter).
    // Otherwise the letter is fully absent → NO and drop its pos exclusions.
    for (i = 0; i < 5; i++) {
      if (tiles[i] !== "gray") continue;
      ch = word.charAt(i);
      var stillInPlay = !!requiredOnGuess[ch] || next.statuses[ch] === "HAS";
      if (!stillInPlay) {
        for (var k = 0; k < 5; k++) {
          if (next.known[k] === ch) {
            stillInPlay = true;
            break;
          }
        }
      }
      if (stillInPlay) {
        if (!hasPosExclusion(next.positionExclusions, ch, i)) {
          next.positionExclusions.push({ letter: ch, position: i });
        }
        continue;
      }
      next.statuses[ch] = "NO";
      next.positionExclusions = next.positionExclusions.filter(function (pe) {
        return pe.letter !== ch;
      });
    }

    // Sync contains/excludes from statuses
    var lists = statusesToLists(next.statuses);
    next.contains = lists.contains;
    next.excludes = lists.excludes;

    return {
      constraints: next,
      historyEntry: { word: word, tiles: tiles.slice() },
    };
  }

  /**
   * Per-position most frequent letter among remaining words (Java stats).
   */
  function positionLeaders(filtered) {
    var counts = [
      Object.create(null),
      Object.create(null),
      Object.create(null),
      Object.create(null),
      Object.create(null),
    ];
    var i;
    var j;
    for (i = 0; i < filtered.length; i++) {
      var w = filtered[i].word;
      for (j = 0; j < 5; j++) {
        var ch = w.charAt(j);
        counts[j][ch] = (counts[j][ch] || 0) + 1;
      }
    }
    var leaders = [];
    for (j = 0; j < 5; j++) {
      var bestL = "";
      var bestN = 0;
      for (i = 0; i < LETTERS.length; i++) {
        var L = LETTERS[i];
        var c = counts[j][L] || 0;
        if (c > bestN) {
          bestN = c;
          bestL = L;
        }
      }
      leaders.push({ letter: bestL, count: bestN });
    }
    return leaders;
  }

  /**
   * Normalize a known[] array to five uppercase letters or "".
   * @param {string[]} known
   * @returns {string[]}
   */
  function lettersFromKnown(known) {
    var out = ["", "", "", "", ""];
    if (!known) return out;
    for (var i = 0; i < 5; i++) {
      var ch = known[i];
      if (ch == null || ch === "") {
        out[i] = "";
      } else {
        out[i] = String(ch)
          .toUpperCase()
          .replace(/[^A-Z]/g, "")
          .charAt(0);
      }
    }
    return out;
  }

  /**
   * Merge known greens into current guess tile letters.
   * Known positions always mirror known; free positions keep current letters.
   * @param {string[]} currentLetters length ≤5
   * @param {string[]} known
   * @returns {string[]} length 5
   */
  function prefillGuessFromKnown(currentLetters, known) {
    var knownLetters = lettersFromKnown(known);
    var out = ["", "", "", "", ""];
    for (var i = 0; i < 5; i++) {
      if (knownLetters[i]) {
        out[i] = knownLetters[i];
      } else if (currentLetters && currentLetters[i]) {
        out[i] = String(currentLetters[i])
          .toUpperCase()
          .replace(/[^A-Z]/g, "")
          .charAt(0);
      } else {
        out[i] = "";
      }
    }
    return out;
  }

  /**
   * Split a five-letter optimal/guess word into tile letters.
   * @param {string} word
   * @returns {string[]} length 5
   */
  function lettersFromWord(word) {
    var w = String(word || "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "");
    var out = ["", "", "", "", ""];
    for (var i = 0; i < 5; i++) {
      out[i] = w.charAt(i) || "";
    }
    return out;
  }

  /**
   * After filling from an optimal word, re-apply known greens so confirmed
   * positions stay correct if they differ (known wins).
   */
  function fillGuessFromOptimal(optimalWord, known) {
    return prefillGuessFromKnown(lettersFromWord(optimalWord), known);
  }

  var api = {
    LETTERS: LETTERS,
    uniqueLetterCount: uniqueLetterCount,
    uniqueVowelCount: uniqueVowelCount,
    vowelOccurrenceCount: vowelOccurrenceCount,
    vowelCount: vowelCount,
    uniqueLetterList: uniqueLetterList,
    statusesToLists: statusesToLists,
    defaultConstraints: defaultConstraints,
    cloneConstraints: cloneConstraints,
    isLikelyPlural: isLikelyPlural,
    isCommonWord: isCommonWord,
    passesClassFilters: passesClassFilters,
    isViable: isViable,
    filterWords: filterWords,
    feedbackId: feedbackId,
    expectedRemaining: expectedRemaining,
    partitionEntropy: partitionEntropy,
    scoreAndSort: scoreAndSort,
    filterScoreWords: filterScoreWords,
    applyGuess: applyGuess,
    positionLeaders: positionLeaders,
    lettersFromKnown: lettersFromKnown,
    prefillGuessFromKnown: prefillGuessFromKnown,
    lettersFromWord: lettersFromWord,
    fillGuessFromOptimal: fillGuessFromOptimal,
  };

  root.WordleFilter = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
