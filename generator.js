/* global layouts */

const CURRENT = { puzzles: [] };

function $(id) { return document.getElementById(id); }
function setStatus(msg) { $("status").textContent = msg || ""; }
function readChecked(id) { return !!($(id) && $(id).checked); }

function readNumberOrNull(id) {
  const el = $(id);
  const raw = (el?.value ?? "").toString().trim();
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}

function readIntOrNull(id) {
  const n = readNumberOrNull(id);
  if (n == null) return null;
  return Math.trunc(n);
}

function readRequiredInt(id, minValue) {
  const n = readIntOrNull(id);
  if (n == null) return null;
  if (minValue != null && n < minValue) return null;
  return n;
}

function randInt(minIncl, maxIncl) {
  return Math.floor(Math.random() * (maxIncl - minIncl + 1)) + minIncl;
}

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function withinBounds(x, minB, maxB) {
  if (minB != null && x < minB) return false;
  if (maxB != null && x > maxB) return false;
  return true;
}

function getAllowedKinds() {
  const kinds = [];
  if (readChecked("allowAdd")) kinds.push("add");
  if (readChecked("allowSub")) kinds.push("sub");
  if (readChecked("allowMul")) kinds.push("mul");
  if (readChecked("allowDiv")) kinds.push("div");
  return kinds;
}

function effectiveKinds(allowed, maxAddSub, maxMul, maxDiv) {
  return allowed.filter(k => {
    if ((k === "add" || k === "sub") && maxAddSub == null) return false;
    if (k === "mul" && maxMul == null) return false;
    if (k === "div" && maxDiv == null) return false;
    return true;
  });
}

function formatOp(op) {
  if (!op) return "";
  switch (op.kind) {
    case "add": return `+${op.n}`;
    case "sub": return `-${op.n}`;
    case "mul": return `×${op.n}`;
    case "div": return `÷${op.n}`;
    default: return "";
  }
}

function applyOp(v, op) {
  switch (op.kind) {
    case "add": return v + op.n;
    case "sub": return v - op.n;
    case "mul": return v * op.n;
    case "div": return v / op.n;
    default: return v;
  }
}

/**
 * Alternating types: value, op, value, op...
 */
function buildCellTypes(len) {
  const types = new Array(len);
  types[0] = "value";
  let next = "op";
  for (let i = 1; i < len; i++) {
    types[i] = next;
    next = (next === "op") ? "value" : "op";
  }
  return types;
}

function lastValueIndex(types) {
  for (let i = types.length - 1; i >= 0; i--) {
    if (types[i] === "value") return i;
  }
  return 0;
}

function getDimsFromLayout(layout) {
  const cols = Math.max(...layout.map(p => p[0] + 1));
  const rows = Math.max(...layout.map(p => p[1] + 1));
  return { cols, rows };
}

function makeOp(kind, maxAddSub, maxMul, maxDiv) {
  if (kind === "add") return { kind, n: randInt(1, maxAddSub) };
  if (kind === "sub") return { kind, n: randInt(1, maxAddSub) };
  if (kind === "mul") return { kind, n: randInt(2, maxMul) };
  return { kind, n: randInt(2, maxDiv) }; // div
}

/**
 * True iff b is the immediate inverse of a (same magnitude, opposite operation).
 * +k <-> -k, ×k <-> ÷k
 */
function isInverseOp(a, b) {
  if (!a || !b) return false;
  if (a.n !== b.n) return false;

  return (
    (a.kind === "add" && b.kind === "sub") ||
    (a.kind === "sub" && b.kind === "add") ||
    (a.kind === "mul" && b.kind === "div") ||
    (a.kind === "div" && b.kind === "mul")
  );
}

/**
 * Choose a new op that is NOT the inverse of prevOp.
 * We try several random draws; if it's impossible (constraints too tight),
 * we fall back to any op to avoid infinite loops.
 */
function pickNonInverseOp(prevOp, kinds, maxAddSub, maxMul, maxDiv) {
  const TRIES = 40;

  for (let t = 0; t < TRIES; t++) {
    const candidate = makeOp(pickOne(kinds), maxAddSub, maxMul, maxDiv);
    if (!isInverseOp(prevOp, candidate)) return candidate;
  }

  // fallback (can happen if only one magnitude/op option exists)
  return makeOp(pickOne(kinds), maxAddSub, maxMul, maxDiv);
}

/**
 * Generates a puzzle and trims the layout so it ends on a VALUE cell,
 * removing your "extra last square" without editing layouts.
 *
 * Also enforces: next op cannot be the inverse of the previous op.
 */
function generatePuzzle(layoutName = "snake1") {
  const fullLayout = layouts[layoutName];
  if (!fullLayout || !Array.isArray(fullLayout) || fullLayout.length < 3) {
    throw new Error(`Missing/invalid layout: ${layoutName}`);
  }

  const minB = readIntOrNull("minBound");
  const maxB = readIntOrNull("maxBound");

  if (minB != null && maxB != null && minB > maxB) {
    throw new Error("Min Bound cannot be greater than Max Bound.");
  }

  const allowed = getAllowedKinds();
  if (!allowed.length) throw new Error("Select at least one operation.");

  const maxAddSub = readRequiredInt("maxAddSub", 1);
  const maxMul = readRequiredInt("maxMul", 2);
  const maxDiv = readRequiredInt("maxDiv", 2);

  if (readChecked("allowAdd") && maxAddSub == null) throw new Error("Enter Max Add/Sub (≥ 1) or uncheck Add.");
  if (readChecked("allowSub") && maxAddSub == null) throw new Error("Enter Max Add/Sub (≥ 1) or uncheck Subtract.");
  if (readChecked("allowMul") && maxMul == null) throw new Error("Enter Max Multiply (≥ 2) or uncheck Multiply.");
  if (readChecked("allowDiv") && maxDiv == null) throw new Error("Enter Max Divide (≥ 2) or uncheck Divide.");

  const kinds = effectiveKinds(allowed, maxAddSub, maxMul, maxDiv);
  if (!kinds.length) throw new Error("No operations are usable (checked + max values).");

  // trim layout to last value cell (removes trailing dangling cell)
  const typesFull = buildCellTypes(fullLayout.length);
  const lastValIdxFull = lastValueIndex(typesFull);

  const layout = fullLayout.slice(0, lastValIdxFull + 1);
  const cellTypes = typesFull.slice(0, lastValIdxFull + 1);
  const lastValIdx = lastValIdxFull;

  const { cols, rows } = getDimsFromLayout(layout);

  const MAX_RESTARTS = 900;

  for (let attempt = 0; attempt < MAX_RESTARTS; attempt++) {
    const valuesByIndex = {};
    const opsByIndex = {};

    // choose start near bounds to reduce runaway
    let start;
    if (minB != null && maxB != null) start = randInt(minB, maxB);
    else if (minB != null && maxB == null) start = minB + randInt(0, 12);
    else if (minB == null && maxB != null) start = maxB - randInt(0, 12);
    else start = randInt(0, 12);

    if (!withinBounds(start, minB, maxB)) continue;
    valuesByIndex[0] = start;

    let ok = true;
    let prevOp = null;

    for (let i = 1; i <= lastValIdx; i++) {
      const t = cellTypes[i];

      if (t === "op") {
        const op = pickNonInverseOp(prevOp, kinds, maxAddSub, maxMul, maxDiv);
        opsByIndex[i] = op;
        prevOp = op;
        continue;
      }

      // value cell
      const prevValIdx = i - 2;
      const opIdx = i - 1;

      const prevVal = valuesByIndex[prevValIdx];
      const op = opsByIndex[opIdx];

      if (prevVal == null || !op) { ok = false; break; }

      let next = applyOp(prevVal, op);

      if (op.kind === "div" && !Number.isInteger(next)) { ok = false; break; }
      if (!withinBounds(next, minB, maxB)) { ok = false; break; }

      valuesByIndex[i] = next;
    }

    if (!ok) continue;

    return { layoutName, layout, cols, rows, cellTypes, lastValIdx, valuesByIndex, opsByIndex };
  }

  throw new Error("Could not generate a puzzle with those constraints. Loosen bounds or reduce Multiply/Divide.");
}

/* ===== Rendering + scaling ===== */

function ensureSizer(gridEl) {
  const parent = gridEl.parentElement;
  if (parent && parent.classList && parent.classList.contains("worksheetSizer")) return parent;

  const sizer = document.createElement("div");
  sizer.className = "worksheetSizer";
  gridEl.replaceWith(sizer);
  sizer.appendChild(gridEl);
  return sizer;
}

function measurePuzzlePixelSize(cols, rows) {
  const cs = getComputedStyle(document.documentElement);
  const cellW = parseFloat(cs.getPropertyValue("--cell-w")) || 100;
  const cellH = parseFloat(cs.getPropertyValue("--cell-h")) || 80;
  const gap = parseFloat(cs.getPropertyValue("--cell-gap")) || 16;

  return {
    width: cols * cellW + (cols - 1) * gap,
    height: rows * cellH + (rows - 1) * gap
  };
}

function renderTo(targetId, puzzle, showAnswers) {
  const grid = $(targetId);
  if (!grid) return;

  grid.innerHTML = "";
  grid.style.setProperty("--cols", puzzle.cols);

  for (let idx = 0; idx < puzzle.layout.length; idx++) {
    const pos = puzzle.layout[idx];

    const cell = document.createElement("div");
    cell.className = "cell";
    cell.style.gridColumn = (pos[0] + 1);
    cell.style.gridRow = (pos[1] + 1);

    const t = puzzle.cellTypes[idx];

    if (idx === 0) {
      cell.textContent = String(puzzle.valuesByIndex[0]);
    } else if (t === "op") {
      const op = puzzle.opsByIndex[idx];
      cell.textContent = formatOp(op);
      cell.classList.add("op");
    } else {
      const val = puzzle.valuesByIndex[idx];
      const isFinal = (idx === puzzle.lastValIdx);

      if (isFinal) {
        cell.textContent = String(val);
      } else if (showAnswers) {
        cell.textContent = String(val);
      } else {
        cell.textContent = "";
        cell.classList.add("blank");
      }
    }

    grid.appendChild(cell);
  }

  // Screen-fit scaling only
  const sizer = ensureSizer(grid);
  const { width, height } = measurePuzzlePixelSize(puzzle.cols, puzzle.rows);

  const puzzleCard = sizer.closest(".puzzleCard");
  let avail = 0;
  if (puzzleCard) {
    const rect = puzzleCard.getBoundingClientRect();
    const style = getComputedStyle(puzzleCard);
    const padL = parseFloat(style.paddingLeft) || 0;
    const padR = parseFloat(style.paddingRight) || 0;
    avail = rect.width - padL - padR - 2;
  }

  let scale = 1;
  if (avail > 0 && width > 0) scale = Math.min(1, avail / width);

  sizer.style.setProperty("--scale", scale.toString());
  sizer.style.setProperty("--grid-w", `${width}px`);
  sizer.style.setProperty("--grid-h", `${height}px`);
  sizer.style.width = `${width}px`;
  sizer.style.height = `${height}px`;
}

function clearSizerInline(targetId) {
  const grid = $(targetId);
  if (!grid) return;
  const sizer = grid.parentElement;
  if (!sizer || !sizer.classList.contains("worksheetSizer")) return;

  sizer.style.transform = "";
  sizer.style.removeProperty("--scale");
  sizer.style.width = "";
  sizer.style.height = "";
  sizer.style.removeProperty("--grid-w");
  sizer.style.removeProperty("--grid-h");
}

/* ===== App actions ===== */

function rerender() {
  if (CURRENT.puzzles.length !== 2) return;

  const show = readChecked("showAnswers");

  renderTo("worksheet1", CURRENT.puzzles[0], show);
  renderTo("worksheet2", CURRENT.puzzles[1], show);

  renderTo("key1", CURRENT.puzzles[0], true);
  renderTo("key2", CURRENT.puzzles[1], true);
}

function generate() {
  try {
    setStatus("");
    const p1 = generatePuzzle("snake1");
    const p2 = generatePuzzle("snake2");
    CURRENT.puzzles = [p1, p2];
    rerender();
  } catch (e) {
    setStatus(e.message || String(e));
  }
}

function prepareForPrint(includeKey) {
  if (includeKey) document.body.classList.add("printingWithKey");
  else document.body.classList.remove("printingWithKey");

  rerender();

  // iOS print: clear transform scaling before printing
  clearSizerInline("worksheet1");
  clearSizerInline("worksheet2");
  clearSizerInline("key1");
  clearSizerInline("key2");
}

function printPuzzlesOnly() {
  if (CURRENT.puzzles.length !== 2) {
    setStatus("No puzzles yet. Click Generate Puzzles first.");
    return;
  }
  setStatus("");
  prepareForPrint(false);
  window.print();
}

function printPuzzlesWithKey() {
  if (CURRENT.puzzles.length !== 2) {
    setStatus("No puzzles yet. Click Generate Puzzles first.");
    return;
  }
  setStatus("");
  prepareForPrint(true);
  window.print();
}

window.addEventListener("afterprint", () => {
  document.body.classList.remove("printingWithKey");
  rerender();
});

function wireUI() {
  $("btnGenerate").addEventListener("click", generate);
  $("btnPrint").addEventListener("click", printPuzzlesOnly);
  $("btnPrintKey").addEventListener("click", printPuzzlesWithKey);
  $("showAnswers").addEventListener("change", rerender);
}

wireUI();
// generate(); // optional
