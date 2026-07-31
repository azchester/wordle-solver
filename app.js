/**
 * UI for Wordle Solver — mirrors Java WordleSolver + spreadsheet YES/NO/HAS.
 */
(function () {
  "use strict";

  var STATUS_CYCLE = ["YES", "NO", "HAS"];
  var TILE_CYCLE = ["gray", "yellow", "green"];
  var MAX_ROWS = 500;
  var filter = window.WordleFilter;
  var words = window.WORDS;
  var commonSet = window.COMMON_SET || null;

  if (!filter || !words) {
    document.body.innerHTML =
      "<p style='padding:2rem;font-family:sans-serif'>Failed to load word list or filter. " +
      "Serve locally: <code>python3 -m http.server 8080</code></p>";
    return;
  }

  var state = filter.defaultConstraints();
  // UI defaults: common words only, plurals out of main list
  state.commonOnly = true;
  state.excludePlurals = true;
  state.requirePlural = false;

  var knownInputs = [];
  var letterButtons = Object.create(null);
  var resultsCache = [];
  var pluralsCache = [];
  var optimalIndex = 0;
  var guessHistory = [];
  var guessTiles = []; // { input, status }
  var pendingTileStatuses = ["gray", "gray", "gray", "gray", "gray"];

  var tbody = document.getElementById("results-body");
  var pluralsBody = document.getElementById("plurals-body");
  var pluralsPanel = document.getElementById("plurals-panel");
  var pluralsEmpty = document.getElementById("plurals-empty");
  var emptyEl = document.getElementById("empty-msg");
  var remainingEl = document.getElementById("remaining-count");
  var removedEl = document.getElementById("removed-count");
  var optimalWordEl = document.getElementById("optimal-word");
  var optimalScoreEl = document.getElementById("optimal-score");
  var leadersEl = document.getElementById("position-leaders");
  var posexListEl = document.getElementById("posex-list");
  var posexLetterSel = document.getElementById("posex-letter");
  var posexPosSel = document.getElementById("posex-position");
  var minUniqueEl = document.getElementById("min-unique");
  var minVowelsEl = document.getElementById("min-vowels");
  var freqWeightEl = document.getElementById("freq-weight");
  var freqLabel = document.getElementById("freq-label");
  var posLabel = document.getElementById("pos-label");
  var historyListEl = document.getElementById("history-list");
  var historyEmptyEl = document.getElementById("history-empty");
  var listModeHint = document.getElementById("list-mode-hint");
  var toggleCommonOnly = document.getElementById("toggle-common-only");
  var toggleExcludePlurals = document.getElementById("toggle-exclude-plurals");
  var toggleShowPlurals = document.getElementById("toggle-show-plurals");

  function normalizeKnownChar(raw) {
    if (!raw) return "";
    return String(raw)
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .charAt(0);
  }

  function readKnownFromInputs() {
    var known = ["", "", "", "", ""];
    for (var i = 0; i < 5; i++) {
      known[i] = normalizeKnownChar(knownInputs[i].value);
      knownInputs[i].value = known[i];
    }
    state.known = known;
  }

  function syncStatusesToLists() {
    var lists = filter.statusesToLists(state.statuses);
    state.contains = lists.contains;
    state.excludes = lists.excludes;
  }

  function renderLetterButton(ch) {
    var btn = letterButtons[ch];
    var st = state.statuses[ch];
    btn.className = "letter-btn status-" + st;
    btn.setAttribute("data-status", st);
    btn.querySelector(".st").textContent = st;
    btn.setAttribute("aria-label", ch + " status " + st);
  }

  function cycleStatus(ch) {
    var cur = state.statuses[ch];
    var idx = STATUS_CYCLE.indexOf(cur);
    var next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    state.statuses[ch] = next;

    // If known green uses this letter, keep it as HAS-equivalent
    if (next === "NO") {
      for (var i = 0; i < 5; i++) {
        if (state.known[i] === ch) {
          knownInputs[i].value = "";
          state.known[i] = "";
        }
      }
      // drop position exclusions for this letter
      state.positionExclusions = state.positionExclusions.filter(function (pe) {
        return pe.letter !== ch;
      });
    }

    renderLetterButton(ch);
    refreshPosexLetterOptions();
    refresh();
  }

  function refreshPosexLetterOptions() {
    var hasLetters = filter.LETTERS.filter(function (L) {
      return state.statuses[L] === "HAS";
    });
    // Also allow known greens for yellow-style wrong-position on other slots? Java only uses contains.
    posexLetterSel.innerHTML = "";
    if (hasLetters.length === 0) {
      var opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "— mark HAS first —";
      posexLetterSel.appendChild(opt);
      document.getElementById("posex-add").disabled = true;
    } else {
      document.getElementById("posex-add").disabled = false;
      hasLetters.forEach(function (L) {
        var o = document.createElement("option");
        o.value = L;
        o.textContent = L;
        posexLetterSel.appendChild(o);
      });
    }

    // Positions that are not already green-filled
    var curPos = posexPosSel.value;
    posexPosSel.innerHTML = "";
    for (var i = 0; i < 5; i++) {
      if (state.known[i]) continue;
      var o = document.createElement("option");
      o.value = String(i);
      o.textContent = String(i + 1);
      posexPosSel.appendChild(o);
    }
    if (posexPosSel.querySelector('option[value="' + curPos + '"]')) {
      posexPosSel.value = curPos;
    }
  }

  function renderPosexList() {
    posexListEl.innerHTML = "";
    state.positionExclusions.forEach(function (pe, idx) {
      var li = document.createElement("li");
      li.innerHTML =
        "<span>" +
        pe.letter +
        " ∉ pos " +
        (pe.position + 1) +
        '</span> <button type="button" aria-label="Remove">×</button>';
      li.querySelector("button").addEventListener("click", function () {
        state.positionExclusions.splice(idx, 1);
        renderPosexList();
        refresh();
      });
      posexListEl.appendChild(li);
    });
  }

  function readClassToggles() {
    state.commonOnly = !!(toggleCommonOnly && toggleCommonOnly.checked);
    state.excludePlurals = !!(
      toggleExcludePlurals && toggleExcludePlurals.checked
    );
    state.requirePlural = false;
  }

  function renderResultsTable(targetBody, rows) {
    var fragment = document.createDocumentFragment();
    var limit = Math.min(rows.length, MAX_ROWS);
    for (var i = 0; i < limit; i++) {
      var r = rows[i];
      var tr = document.createElement("tr");
      tr.setAttribute("data-word", r.word);
      tr.innerHTML =
        '<td class="num score">' +
        formatExpected(r.score) +
        '</td><td class="word">' +
        r.word +
        '</td><td class="num">' +
        r.unique +
        '</td><td class="num">' +
        r.uniqueVowels +
        '</td><td class="row-action">' +
        '<button type="button" class="btn btn-row-guess" data-guess-word="' +
        r.word +
        '">Guess</button></td>';
      fragment.appendChild(tr);
    }
    targetBody.innerHTML = "";
    targetBody.appendChild(fragment);
  }

  function refresh() {
    readKnownFromInputs();
    syncStatusesToLists();
    readClassToggles();
    state.minUniqueLetters = Number(minUniqueEl.value) || 0;
    state.minUniqueVowels = Number(minVowelsEl.value) || 0;
    state.frequencyWeight = Number(freqWeightEl.value) / 100;

    // Keep guess tiles in sync with known greens
    if (guessTiles.length === 5) {
      prefillGuessTilesFromKnown();
    }

    // Main list: letter filters + class filters (common / exclude plurals)
    resultsCache = filter.filterScoreWords(words, state, commonSet);
    optimalIndex = 0;

    // Segregated plurals (same letter filters; plurals only; respect common-only)
    var showPlurals = !!(toggleShowPlurals && toggleShowPlurals.checked);
    if (showPlurals) {
      var pluralConstraints = filter.cloneConstraints(state);
      pluralConstraints.excludePlurals = false;
      pluralConstraints.requirePlural = true;
      pluralsCache = filter.filterScoreWords(
        words,
        pluralConstraints,
        commonSet
      );
    } else {
      pluralsCache = [];
    }

    var rem = resultsCache.length;
    var remPlurals = pluralsCache.length;
    // Stats vs full dictionary letter-filter only (no class filters)
    var letterOnly = filter.cloneConstraints(state);
    letterOnly.commonOnly = false;
    letterOnly.excludePlurals = false;
    letterOnly.requirePlural = false;
    var letterMatchCount = filter.filterWords(
      words,
      letterOnly,
      commonSet
    ).length;
    var pctRem = words.length
      ? Math.round((rem / words.length) * 100)
      : 0;
    remainingEl.textContent =
      rem.toLocaleString() +
      " main" +
      (showPlurals ? " + " + remPlurals.toLocaleString() + " plurals" : "") +
      " (" +
      pctRem +
      "% of dict)";
    removedEl.textContent =
      (words.length - letterMatchCount).toLocaleString() +
      " letter-filtered out · " +
      (letterMatchCount - rem - (showPlurals ? remPlurals : 0)).toLocaleString() +
      " class-filtered from main";

    if (listModeHint) {
      var bits = [];
      if (state.commonOnly) bits.push("common only");
      else bits.push("all rarity");
      if (state.excludePlurals) bits.push("plurals excluded from main");
      if (showPlurals) bits.push("plurals shown separately");
      listModeHint.textContent =
        bits.join(" · ") +
        (commonSet
          ? " · " +
            (window.COMMON_WORDS ? window.COMMON_WORDS.length.toLocaleString() : "?") +
            " common words loaded"
          : " · common list missing");
    }

    updateOptimalDisplay();

    var leaders = filter.positionLeaders(resultsCache);
    leadersEl.innerHTML = leaders
      .map(function (L, i) {
        var pct = rem ? Math.round((L.count / rem) * 100) : 0;
        return (
          "<div>" +
          (i + 1) +
          ": " +
          (L.letter || "—") +
          " (" +
          L.count.toLocaleString() +
          " | " +
          pct +
          "% of remaining)</div>"
        );
      })
      .join("");

    renderResultsTable(tbody, resultsCache);

    if (resultsCache.length === 0) {
      emptyEl.hidden = false;
      emptyEl.textContent = "No words match these constraints.";
    } else if (resultsCache.length > MAX_ROWS) {
      emptyEl.hidden = false;
      emptyEl.textContent =
        "Showing top " +
        MAX_ROWS +
        " of " +
        resultsCache.length.toLocaleString() +
        " (lowest expected remaining). Narrow filters to see more.";
    } else {
      emptyEl.hidden = true;
    }

    // Plurals panel
    if (pluralsPanel) {
      pluralsPanel.hidden = !showPlurals;
      if (showPlurals && pluralsBody) {
        renderResultsTable(pluralsBody, pluralsCache);
        if (pluralsEmpty) {
          if (pluralsCache.length === 0) {
            pluralsEmpty.hidden = false;
            pluralsEmpty.textContent = "No plural forms match.";
          } else if (pluralsCache.length > MAX_ROWS) {
            pluralsEmpty.hidden = false;
            pluralsEmpty.textContent =
              "Showing top " +
              MAX_ROWS +
              " of " +
              pluralsCache.length.toLocaleString() +
              " plurals.";
          } else {
            pluralsEmpty.hidden = true;
          }
        }
      }
    }
  }

  function formatExpected(v) {
    if (v == null || isNaN(v)) return "—";
    // Expected remaining: show 2 decimals when fractional
    return (Math.round(v * 100) / 100).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  function updateOptimalDisplay() {
    if (!resultsCache.length) {
      optimalWordEl.textContent = "—";
      optimalScoreEl.textContent = "—";
      return;
    }
    if (optimalIndex >= resultsCache.length) optimalIndex = 0;
    var r = resultsCache[optimalIndex];
    optimalWordEl.textContent = r.word;
    optimalScoreEl.textContent = formatExpected(r.score);
  }

  function applyStateToControls() {
    for (var i = 0; i < 5; i++) {
      knownInputs[i].value = state.known[i] || "";
    }
    for (var j = 0; j < filter.LETTERS.length; j++) {
      renderLetterButton(filter.LETTERS[j]);
    }
    renderPosexList();
    refreshPosexLetterOptions();
  }

  function renderHistory() {
    historyListEl.innerHTML = "";
    guessHistory.forEach(function (entry, idx) {
      var li = document.createElement("li");
      li.className = "history-row";
      li.setAttribute("data-word", entry.word);
      var tilesHtml = entry.tiles
        .map(function (t, i) {
          return (
            '<span class="history-tile tile-' +
            t +
            '">' +
            entry.word.charAt(i) +
            "</span>"
          );
        })
        .join("");
      li.innerHTML =
        '<span class="n">' +
        (idx + 1) +
        '</span><div class="history-tiles">' +
        tilesHtml +
        "</div>";
      historyListEl.appendChild(li);
    });
    if (historyEmptyEl) {
      historyEmptyEl.hidden = guessHistory.length > 0;
    }
  }

  function readGuessLetters() {
    var letters = ["", "", "", "", ""];
    for (var i = 0; i < 5; i++) {
      letters[i] = normalizeKnownChar(guessTiles[i].input.value);
    }
    return letters;
  }

  function paintGuessTile(idx) {
    var tile = guessTiles[idx];
    var st = pendingTileStatuses[idx];
    var locked = !!(state.known && state.known[idx]);
    tile.input.className =
      "guess-tile tile-" + st + (locked ? " locked" : "");
    tile.input.setAttribute("data-tile-status", st);
    tile.input.setAttribute("data-locked", locked ? "1" : "0");
    tile.input.readOnly = locked;
    tile.input.title = locked
      ? "Confirmed green (from puzzle)"
      : "Click to cycle status (" + st + ")";
  }

  /**
   * Apply known greens into guess tiles (known slots always mirror known).
   * Free slots keep whatever the user typed.
   */
  function prefillGuessTilesFromKnown() {
    var known = state.known || ["", "", "", "", ""];
    var merged = filter.prefillGuessFromKnown(readGuessLetters(), known);
    for (var i = 0; i < 5; i++) {
      guessTiles[i].input.value = merged[i];
      // Confirmed greens default their tile status to green for convenience
      if (known[i]) {
        pendingTileStatuses[i] = "green";
      }
      paintGuessTile(i);
    }
  }

  function setGuessLetters(letters, options) {
    options = options || {};
    var resetColors = options.resetColors !== false;
    for (var i = 0; i < 5; i++) {
      guessTiles[i].input.value = letters[i] || "";
      if (resetColors) {
        pendingTileStatuses[i] = state.known && state.known[i] ? "green" : "gray";
      }
      paintGuessTile(i);
    }
  }

  function clearGuessTiles() {
    // Clear free tiles only; known greens stay
    var known = state.known || ["", "", "", "", ""];
    for (var i = 0; i < 5; i++) {
      if (!known[i]) {
        guessTiles[i].input.value = "";
        pendingTileStatuses[i] = "gray";
      } else {
        guessTiles[i].input.value = known[i];
        pendingTileStatuses[i] = "green";
      }
      paintGuessTile(i);
    }
    // focus first free tile
    for (var j = 0; j < 5; j++) {
      if (!known[j]) {
        guessTiles[j].input.focus();
        break;
      }
    }
  }

  /**
   * Fill guess tiles from any five-letter word (optimal panel or table row).
   * Uses shipped fillGuessFromOptimal merge: known greens override positions.
   * Does not submit.
   */
  function fillGuessFromWord(word) {
    word = String(word || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, "");
    if (word.length !== 5) return;
    readKnownFromInputs();
    var letters = filter.fillGuessFromOptimal(word, state.known);
    setGuessLetters(letters, { resetColors: true });
    prefillGuessTilesFromKnown();
  }

  function fillGuessFromOptimalWord() {
    var word = (optimalWordEl.textContent || "").trim().toUpperCase();
    if (!word || word === "—") return;
    fillGuessFromWord(word);
  }

  function readGuessWord() {
    return readGuessLetters().join("");
  }

  function submitGuess() {
    var word = readGuessWord();
    if (word.length !== 5) {
      alert("Enter a full 5-letter guess before submitting.");
      return;
    }
    var result = filter.applyGuess(state, word, pendingTileStatuses.slice());
    state = result.constraints;
    guessHistory.push(result.historyEntry);
    applyStateToControls();
    renderHistory();
    // Reset free tiles; prefill new knowns
    for (var i = 0; i < 5; i++) {
      guessTiles[i].input.value = "";
      pendingTileStatuses[i] = "gray";
    }
    prefillGuessTilesFromKnown();
    refresh();
  }

  function cycleTileStatus(idx) {
    var cur = pendingTileStatuses[idx];
    var i = TILE_CYCLE.indexOf(cur);
    pendingTileStatuses[idx] = TILE_CYCLE[(i + 1) % TILE_CYCLE.length];
    paintGuessTile(idx);
  }

  function initGuessTiles() {
    var row = document.getElementById("guess-tiles");
    for (var i = 0; i < 5; i++) {
      var input = document.createElement("input");
      input.type = "text";
      input.maxLength = 1;
      input.className = "guess-tile tile-gray";
      input.setAttribute("aria-label", "Guess letter " + (i + 1));
      input.setAttribute("data-tile-status", "gray");
      input.autocomplete = "off";
      input.spellcheck = false;
      input.dataset.index = String(i);
      input.addEventListener("input", function (e) {
        var el = e.target;
        var idx = Number(el.dataset.index);
        // Locked known greens cannot be typed over
        if (state.known && state.known[idx]) {
          el.value = state.known[idx];
          return;
        }
        var ch = normalizeKnownChar(el.value);
        el.value = ch;
        if (ch && idx < 4) {
          // skip locked tiles when advancing
          var n = idx + 1;
          while (n < 5 && state.known && state.known[n]) n++;
          if (n < 5) guessTiles[n].input.focus();
        }
      });
      input.addEventListener("keydown", function (e) {
        var el = e.target;
        var idx = Number(el.dataset.index);
        if (state.known && state.known[idx] && e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
          e.preventDefault();
          return;
        }
        if (e.key === "Backspace" && !el.value && idx > 0) {
          var p = idx - 1;
          while (p > 0 && state.known && state.known[p]) p--;
          guessTiles[p].input.focus();
        }
        if (e.key === "Enter") {
          e.preventDefault();
          submitGuess();
        }
        if (e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          if (!(state.known && state.known[idx])) cycleTileStatus(idx);
        }
        if (e.key === "ArrowLeft" && idx > 0) {
          e.preventDefault();
          guessTiles[idx - 1].input.focus();
        }
        if (e.key === "ArrowRight" && idx < 4) {
          e.preventDefault();
          guessTiles[idx + 1].input.focus();
        }
      });
      // Click cycles tile color (gray → yellow → green). Type to enter letters.
      input.addEventListener("click", function (e) {
        var idx = Number(e.target.dataset.index);
        // Still allow color cycling on locked greens (usually already green)
        cycleTileStatus(idx);
      });
      guessTiles.push({ input: input });
      row.appendChild(input);
      paintGuessTile(i);
    }
  }

  function resetAll() {
    state = filter.defaultConstraints();
    state.commonOnly = true;
    state.excludePlurals = true;
    state.requirePlural = false;
    guessHistory = [];
    for (var i = 0; i < 5; i++) knownInputs[i].value = "";
    minUniqueEl.value = "0";
    minVowelsEl.value = "0";
    freqWeightEl.value = "65";
    freqLabel.textContent = "65%";
    posLabel.textContent = "35%";
    if (toggleCommonOnly) toggleCommonOnly.checked = true;
    if (toggleExcludePlurals) toggleExcludePlurals.checked = true;
    if (toggleShowPlurals) toggleShowPlurals.checked = false;
    for (var j = 0; j < filter.LETTERS.length; j++) {
      renderLetterButton(filter.LETTERS[j]);
    }
    renderPosexList();
    refreshPosexLetterOptions();
    renderHistory();
    for (var k = 0; k < 5; k++) {
      guessTiles[k].input.value = "";
      pendingTileStatuses[k] = "gray";
      paintGuessTile(k);
    }
    refresh();
  }

  function initKnown() {
    var row = document.getElementById("known-letters");
    for (var i = 0; i < 5; i++) {
      var input = document.createElement("input");
      input.type = "text";
      input.maxLength = 1;
      input.setAttribute("aria-label", "Known letter position " + (i + 1));
      input.autocomplete = "off";
      input.spellcheck = false;
      input.dataset.index = String(i);
      input.addEventListener("input", function (e) {
        var el = e.target;
        var ch = normalizeKnownChar(el.value);
        el.value = ch;
        if (ch) {
          // green ⇒ HAS (Java moves puzzle letters into contains)
          if (state.statuses[ch] === "NO") {
            state.statuses[ch] = "HAS";
            renderLetterButton(ch);
          } else if (state.statuses[ch] === "YES") {
            state.statuses[ch] = "HAS";
            renderLetterButton(ch);
          }
          var next = knownInputs[Number(el.dataset.index) + 1];
          if (next) next.focus();
        }
        refreshPosexLetterOptions();
        refresh();
      });
      input.addEventListener("keydown", function (e) {
        var el = e.target;
        var idx = Number(el.dataset.index);
        if (e.key === "Backspace" && !el.value && idx > 0) {
          knownInputs[idx - 1].focus();
        }
        if (e.key === "ArrowLeft" && idx > 0) {
          e.preventDefault();
          knownInputs[idx - 1].focus();
        }
        if (e.key === "ArrowRight" && idx < 4) {
          e.preventDefault();
          knownInputs[idx + 1].focus();
        }
      });
      knownInputs.push(input);
      row.appendChild(input);
    }
  }

  function initLetters() {
    var grid = document.getElementById("letter-grid");
    var order = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    for (var i = 0; i < order.length; i++) {
      var ch = order[i];
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "letter-btn status-YES";
      btn.setAttribute("data-letter", ch);
      btn.innerHTML =
        '<span class="ch">' + ch + '</span><span class="st">YES</span>';
      btn.addEventListener(
        "click",
        (function (letter) {
          return function () {
            cycleStatus(letter);
          };
        })(ch)
      );
      letterButtons[ch] = btn;
      grid.appendChild(btn);
      renderLetterButton(ch);
    }
  }

  var THEME_KEY = "wordle-solver-theme";
  var themeToggleBtn = document.getElementById("theme-toggle");
  var themeColorMeta = document.getElementById("theme-color-meta");

  function systemPrefersDark() {
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  }

  /** Stored preference: "light" | "dark" | null (follow system). */
  function getThemePreference() {
    try {
      var pref = localStorage.getItem(THEME_KEY);
      if (pref === "light" || pref === "dark") return pref;
    } catch (e) {
      /* private mode */
    }
    return null;
  }

  function resolveTheme() {
    var pref = getThemePreference();
    if (pref) return pref;
    return systemPrefersDark() ? "dark" : "light";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    if (themeColorMeta) {
      themeColorMeta.content = theme === "light" ? "#eef1f6" : "#0f1419";
    }
    if (themeToggleBtn) {
      var next = theme === "dark" ? "light" : "dark";
      var pref = getThemePreference();
      var label =
        "Switch to " +
        next +
        " mode" +
        (pref ? "" : " (currently following system)");
      themeToggleBtn.setAttribute("aria-label", label);
      themeToggleBtn.title = label;
    }
  }

  function setThemePreference(theme) {
    try {
      if (theme === "light" || theme === "dark") {
        localStorage.setItem(THEME_KEY, theme);
      } else {
        localStorage.removeItem(THEME_KEY);
      }
    } catch (e) {
      /* ignore */
    }
    applyTheme(resolveTheme());
  }

  function toggleTheme() {
    setThemePreference(resolveTheme() === "dark" ? "light" : "dark");
  }

  applyTheme(resolveTheme());
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", toggleTheme);
  }
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var onSystemThemeChange = function () {
      if (!getThemePreference()) applyTheme(resolveTheme());
    };
    if (mq.addEventListener) {
      mq.addEventListener("change", onSystemThemeChange);
    } else if (mq.addListener) {
      mq.addListener(onSystemThemeChange);
    }
  }

  document.getElementById("reset-btn").addEventListener("click", resetAll);
  document.getElementById("guess-submit").addEventListener("click", submitGuess);
  document.getElementById("guess-clear").addEventListener("click", clearGuessTiles);
  document
    .getElementById("fill-optimal-guess")
    .addEventListener("click", fillGuessFromOptimalWord);

  function onRowGuessClick(e) {
    var btn = e.target.closest
      ? e.target.closest("button.btn-row-guess")
      : null;
    if (!btn && e.target.classList && e.target.classList.contains("btn-row-guess")) {
      btn = e.target;
    }
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    fillGuessFromWord(btn.getAttribute("data-guess-word") || "");
  }

  // Per-row Guess buttons (main + plurals tables)
  tbody.addEventListener("click", onRowGuessClick);
  if (pluralsBody) pluralsBody.addEventListener("click", onRowGuessClick);

  if (toggleCommonOnly) {
    toggleCommonOnly.addEventListener("change", refresh);
  }
  if (toggleExcludePlurals) {
    toggleExcludePlurals.addEventListener("change", refresh);
  }
  if (toggleShowPlurals) {
    toggleShowPlurals.addEventListener("change", refresh);
  }
  document.getElementById("posex-add").addEventListener("click", function () {
    var letter = posexLetterSel.value;
    var position = Number(posexPosSel.value);
    if (!letter) return;
    var exists = state.positionExclusions.some(function (pe) {
      return pe.letter === letter && pe.position === position;
    });
    if (!exists) {
      state.positionExclusions.push({ letter: letter, position: position });
      renderPosexList();
      refresh();
    }
  });
  minUniqueEl.addEventListener("change", refresh);
  minUniqueEl.addEventListener("input", refresh);
  minVowelsEl.addEventListener("change", refresh);
  minVowelsEl.addEventListener("input", refresh);
  freqWeightEl.addEventListener("input", function () {
    var v = Number(freqWeightEl.value);
    freqLabel.textContent = v + "%";
    posLabel.textContent = 100 - v + "%";
    refresh();
  });
  document.getElementById("reset-weights").addEventListener("click", function () {
    freqWeightEl.value = "65";
    freqLabel.textContent = "65%";
    posLabel.textContent = "35%";
    refresh();
  });

  initGuessTiles();
  initKnown();
  initLetters();
  refreshPosexLetterOptions();
  renderHistory();
  refresh();

  window.__wordleApp = {
    getState: function () {
      readKnownFromInputs();
      syncStatusesToLists();
      return JSON.parse(JSON.stringify(state));
    },
    getResults: function () {
      return resultsCache.slice();
    },
    getHistory: function () {
      return guessHistory.slice();
    },
    setKnown: function (arr) {
      for (var i = 0; i < 5; i++) {
        knownInputs[i].value = normalizeKnownChar(arr[i] || "");
        var ch = knownInputs[i].value;
        if (ch && state.statuses[ch] !== "HAS") {
          state.statuses[ch] = "HAS";
          renderLetterButton(ch);
        }
      }
      refreshPosexLetterOptions();
      refresh();
      prefillGuessTilesFromKnown();
    },
    getGuessLetters: function () {
      return readGuessLetters();
    },
    fillGuessFromOptimal: function () {
      fillGuessFromOptimalWord();
    },
    /** Fill guess tiles from an arbitrary word (same path as row Guess). */
    fillGuessFromWord: function (word) {
      fillGuessFromWord(word);
    },
    prefillFromKnown: function () {
      prefillGuessTilesFromKnown();
    },
    setStatus: function (ch, status) {
      ch = String(ch).toUpperCase();
      state.statuses[ch] = status;
      renderLetterButton(ch);
      refreshPosexLetterOptions();
      refresh();
    },
    addPositionExclusion: function (letter, position) {
      state.positionExclusions.push({
        letter: String(letter).toUpperCase(),
        position: position | 0,
      });
      renderPosexList();
      refresh();
    },
    setMinUnique: function (n) {
      minUniqueEl.value = String(n);
      refresh();
    },
    setMinVowels: function (n) {
      minVowelsEl.value = String(n);
      refresh();
    },
    setFrequencyWeight: function (w) {
      freqWeightEl.value = String(Math.round(w * 100));
      freqLabel.textContent = freqWeightEl.value + "%";
      posLabel.textContent = 100 - Number(freqWeightEl.value) + "%";
      refresh();
    },
    /**
     * Programmatic guess submit for tests/harnesses.
     * @param {string} word
     * @param {string[]} tiles gray|yellow|green
     */
    submitGuess: function (word, tiles) {
      word = String(word || "").toUpperCase();
      for (var i = 0; i < 5; i++) {
        guessTiles[i].input.value = word.charAt(i) || "";
        pendingTileStatuses[i] = (tiles && tiles[i]) || "gray";
        paintGuessTile(i);
      }
      submitGuess();
    },
    reset: resetAll,
    refresh: refresh,
  };
})();
