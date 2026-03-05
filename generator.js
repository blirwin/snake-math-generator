/* global layouts */

const CURRENT = { puzzles: [] };

function $(id) { return document.getElementById(id); }
function setStatus(msg) { $("status").textContent = msg || ""; }
function readChecked(id) { return !!($(id) && $(id).checked); }

function readIntOrNull(id) {
  const el = $(id);
  const raw = (el?.value ?? "").toString().trim();
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function readRequiredInt(id, minValue) {
  const el = $(id);
  const raw = (el?.value ?? "").toString().trim();
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const f = Math.floor(n);
  if (minValue != null && f < minValue) return null;
  return f;
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
 * Cell types: index 0 is value, then alternate op/value.
 * We do NOT require the layout to end on a value.
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

/**
 * Last participating value cell (we will render up to this).
 * Any trailing cell after this is dropped from rendering entirely.
 */
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

/**
 * Generate using the trimmed layout: layout.slice(0, lastValueIdx+1)
 * This automatically removes the trailing last cell (your "extra square").
 */
function generatePuzzle(layoutName = "snake1") {
  const fullLayout = layouts[layoutName];
  if (!fullLayout || !Array.isArray(fullLayout) || fullLayout.length < 3) {
    throw new Error(`Missing/invalid layout: ${layoutName}`);
  }

  const minB = readIntOrNull("minBound");
  const maxB = readIntOrNull("maxBound");

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

  // Build types based on full layout, then trim so we always end on a value cell.
  const cellTypesFull = buildCellTypes(fullLayout.length);
  const lastValIdxFull = lastValueIndex(cellTypesFull);

  const layout = fullLayout.slice(0, lastValIdxFull + 1);
  const cellTypes = cellTypesFull.slice(0, lastValIdxFull + 1);
  const lastValIdx = lastValIdxFull; // now the last index of 'layout' is a value cell

  const { cols, rows } = getDimsFromLayout(layout);

  const MAX_RESTARTS = 450;

  for (let attempt = 0; attempt < MAX_RESTARTS; attempt++) {
    const valuesByIndex = {}; // indices where cellTypes[idx] === "value"
    const opsByIndex = {};    // indices where cellTypes[idx] === "op"

    // Start value choice
    let start;
    if (minB != null || maxB != null) {
      const lo = (minB != null) ? minB : -20;
      const hi = (maxB != null) ? maxB : 20;
      start = randInt(lo, hi);
    } else {
      start = randInt(0, 12);
    }
    if (!withinBounds(start, minB, maxB)) continue;
    valuesByIndex[0] = start;

    let ok = true;

    for (let i = 1; i <= lastValIdx; i++) {
      const t = cellTypes[i];

      if (t === "op") {
        // choose op
        const kind = pickOne(kinds);
        let op;
        if (kind === "add") op = { kind, n: randInt(1, maxAddSub) };
        else if (kind === "sub") op = { kind, n: randInt(1, maxAddSub) };
        else if (kind === "mul") op = { kind, n: randInt(2, maxMul) };
        else op = { kind, n: randInt(2, maxDiv) };

        opsByIndex[i] = op;
      } else {
        // value cell: compute from prev value + prev op
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
    }

    if (!ok) continue;

    return {
      layoutName,
      layout,         // TRIMMED layout (extra end cell removed)
      cols,
      rows,
      cellTypes,
      lastValIdx,
      valuesByIndex,
      opsByIndex
    };
  }

  throw new Error("Could not generate a puzzle with those constraints. Loosen bounds or reduce Multiply/Divide.");
}

/* ===== rendering + scaling ===== */

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

  // Only render indices that exist in trimmed layout
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
      // value
      const val = puzzle.valuesByIndex[idx];
      const isFinal = (idx === puzzle.lastValIdx);

      if (isFinal) {
        cell.textContent = String(val); // final answer always shown
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

/* ===== app actions ===== */

function rerender() {
  if (CURRENT.puzzles.length !== 2) return;

  const show = readChecked("showAnswers");

  renderTo("worksheet1", CURRENT.puzzles[0], show);
  renderTo("worksheet2", CURRENT.puzzles[1], show);

  // answer keys always rendered; print toggles visibility
  renderTo("key1", CURRENT.puzzles[0], true);
  renderTo("key2", CURRENT.puzzles[1], true);
}

function generate() {
  try {
    setStatus("");
    const p1 = generatePuzzle("snake1");
    const p2 = generatePuzzle("snake1"); // or "snake2" if you want a different shape
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

  // iOS print fix: no transform scaling during print flow
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
// generate(); // optional on load
