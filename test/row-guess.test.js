/**
 * Row Guess uses the same shipped fillGuessFromOptimal helper as Optimal Guess.
 * Run: node test/row-guess.test.js
 */
"use strict";

var path = require("path");
var assert = require("assert");
var fs = require("fs");

var root = path.join(__dirname, "..");
var filter = require(path.join(root, "filter.js"));
var appSrc = fs.readFileSync(path.join(root, "app.js"), "utf8");

var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("PASS  " + name);
  } catch (e) {
    failed++;
    console.error("FAIL  " + name);
    console.error("      " + (e && e.stack ? e.stack : e));
  }
}

// (a) fill CRANE with empty known
test("(a) fillGuessFromOptimal CRANE + empty known → CRANE", function () {
  var tiles = filter.fillGuessFromOptimal("CRANE", ["", "", "", "", ""]);
  assert.deepStrictEqual(tiles, ["C", "R", "A", "N", "E"]);
  assert.strictEqual(tiles.join(""), "CRANE");
});

// (b) fill CRANE with known D,,,,H
test("(b) fill CRANE + known D,,,,H → D/H locked, free from CRANE", function () {
  var tiles = filter.fillGuessFromOptimal("CRANE", ["D", "", "", "", "H"]);
  assert.strictEqual(tiles[0], "D");
  assert.strictEqual(tiles[4], "H");
  assert.strictEqual(tiles[1], "R");
  assert.strictEqual(tiles[2], "A");
  assert.strictEqual(tiles[3], "N");
  assert.deepStrictEqual(tiles, ["D", "R", "A", "N", "H"]);
});

test("app.js wires row Guess button and fillGuessFromWord", function () {
  assert.ok(
    appSrc.indexOf("btn-row-guess") !== -1,
    "row guess button class present"
  );
  assert.ok(
    appSrc.indexOf("data-guess-word") !== -1,
    "data-guess-word on row buttons"
  );
  assert.ok(
    appSrc.indexOf("function fillGuessFromWord") !== -1,
    "fillGuessFromWord function"
  );
  assert.ok(
    appSrc.indexOf("filter.fillGuessFromOptimal") !== -1,
    "uses shipped fillGuessFromOptimal"
  );
  assert.ok(
    appSrc.indexOf('btn-row-guess') !== -1 &&
      appSrc.indexOf("fillGuessFromWord(btn.getAttribute") !== -1,
    "click handler calls fillGuessFromWord with row word"
  );
});

console.log("");
console.log(passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);
