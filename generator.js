/* global layouts */

const CURRENT = {
  puzzles: [], // [{ layoutName, layout, cols, rows, valuesByPath, opsByPath }]
};

function $(id) { return document.getElementById(id); }

function setStatus(msg) { $("status").textContent = msg || ""; }

function readChecked(id) {
  const el = $(id);
  return !!(el && el.checked);
}

function readIntOrNull(id) {
  const el = $(id);
  if (!el) return null;
  const raw = (el.value ?? "").toString().trim();
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function readRequiredInt(id, minValue) {
  const el = $(id);
  const raw = (el.value ?? "").toString().trim();
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const f = Math.floor(n);
  if (minValue != null && f < minValue) return null;
  return f;
}

function getAllowedKinds() {
  const kinds = [];
  if (readChecked("allowAdd")) kinds.push("add");
  if (readChecked("allowSub")) kinds.push("sub");
  if (readChecked("allowMul")) kinds.push("mul");
  if (readChecked("allowDiv")) kinds.push("div");
  return kinds;
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

function formatOp(op) {
  if (!op) return ""; // defensive
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

function effectiveKinds(allowed, maxAddSub, maxMul, maxDiv) {
  return allowed.filter(k => {
    if ((k === "add" || k === "sub") && maxAddSub == null) return false;
    if (k === "mul" && maxMul == null) return false;
    if (k === "div" && maxDiv == null) return false;
    return true;
  });
}

/**
 * Generate based on actual path indices, so ops and values always line up with the layout.
 * valuesByPath[pathIndex] is defined for even indices (0,2,4,...)
 * opsByPath[pathIndex] is defined for odd indices (1,3,5,...)
 */
function generatePuzzle(layoutName = "snake1") {
  const layout = layouts[layoutName];
  if (!layout || !Array.isArray(layout) || layout.length < 3) {
    throw new Error(`Missing/invalid layout: ${layoutName}`);
  }

  const cols = Math.max(...layout.map(p => p[0] + 1));
  const rows = Math.max(...layout.map(p => p[1] + 1));

  const minB = readIntOrNull("minBound");
  const maxB = readIntOrNull("maxBound");

  const allowed = getAllowedKinds();
  if (allowed.length === 0) throw new Error("Select at least one operation.");

  const maxAddSub = readRequiredInt("maxAddSub", 1);
  const maxMul = readRequiredInt("maxMul", 2);
  const maxDiv = readRequiredInt("maxDiv", 2);

  // If checked, require max
  if (readChecked("allowAdd") && maxAddSub == null) throw new Error("Enter Max Add/Sub (≥ 1) or uncheck Add.");
  if (readChecked("allowSub") && maxAddSub == null) throw new Error("Enter Max Add/Sub (≥ 1) or uncheck Subtract.");
  if (readChecked("allowMul") && maxMul == null) throw new Error("Enter Max Multiply (≥ 2) or uncheck Multiply.");
  if (readChecked("allowDiv") && maxDiv == null) throw new Error("Enter Max Divide (≥ 2) or uncheck Divide.");

  const kinds = effectiveKinds(allowed, maxAddSub, maxMul, maxDiv);
  if (kinds.length === 0) throw new Error("No operations are usable (checked + max values).");

  const MAX_RESTARTS = 250;

  for (let attempt = 0; attempt < MAX_RESTARTS; attempt++) {
    const valuesByPath = {}; // even indices only
    const opsByPath = {};    // odd indices only

    // start value
    let start;
    if (minB != null || maxB != null) {
      const lo = (minB != null) ? minB : -20;
      const hi = (maxB != null) ? maxB : 20;
      start = randInt(lo, hi);
    } else {
      start = randInt(0, 12);
    }
    if (!withinBounds(start, minB, maxB)) continue;

    valuesByPath[0] = start;

    let ok = true;

    // walk the path index-by-index
    for (let pathIndex = 1; pathIndex < layout.length; pathIndex++) {
      if (pathIndex % 2 === 1) {
        // op cell: choose an op that can lead to a valid next value later
        // We pick op now, but validate when we try to compute next even value.
        // Still, we can just store it; validation happens next step.
        const kind = pickOne(kinds);

        let op;
        if (kind === "add") op = { kind, n: randInt(1, maxAddSub) };
        else if (kind === "sub") op = { kind, n: randInt(1, maxAddSub) };
        else if (kind === "mul") op = { kind, n: randInt(2, maxMul) };
        else op = { kind, n: randInt(2, maxDiv) };

        opsByPath[pathIndex] = op;
      } else {
        // value cell: compute from previous value and previous op
        const prevValueIndex = pathIndex - 2;
        const opIndex = pathIndex - 1;

        const prevVal = valuesByPath[prevValueIndex];
        const op = opsByPath[opIndex];

        if (prevVal == null || !op) {
          ok = false;
          break;
        }

        let candidate = applyOp(prevVal, op);

        // division must be integer
        if (op.kind === "div" && !Number.isInteger(candidate)) {
          ok = false;
          break;
        }

        if (!withinBounds(candidate, minB, maxB)) {
          ok = false;
          break;
        }

        valuesByPath[pathIndex] = candidate;
      }
    }

    // If we failed due to a bad op choice, restart. This is simplest and robust.
    if (!ok) continue;

    // Ensure last cell is a value cell; if it's not, your layout is invalid for this puzzle model.
    if ((layout.length - 1) % 2 !== 0) {
      throw new Error("Layout must end on a VALUE cell (even index). Your snake layout ends on an operation cell.");
    }

    return { layoutName, layout, cols, rows, valuesByPath, opsByPath };
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

  const lastPathIndex = puzzle.layout.length - 1;

  puzzle.layout.forEach((pos, pathIndex) => {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.style.gridColumn = (pos[0] + 1);
    cell.style.gridRow = (pos[1] + 1);

    if (pathIndex === 0) {
      cell.textContent = String(puzzle.valuesByPath[0]);
    } else if (pathIndex % 2 === 1) {
      const op = puzzle.opsByPath[pathIndex];
      cell.textContent = formatOp(op);
      cell.classList.add("op");
    } else {
      const val = puzzle.valuesByPath[pathIndex];
      const isFinal = (pathIndex === lastPathIndex);

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
  });

  // Screen-fit scaling only
  const sizer = ensureSizer(grid);
  const { width, height } = measurePuzzlePixelSize(puzzle.cols, puzzle.rows);

  sizer.style.setProperty("--grid-w", `${width}px`);
  sizer.style.setProperty("--grid-h", `${height}px`);

  const puzzleCard = sizer.closest(".puzzleCard");
  let avail = 0;
  if (puzzleCard) {
    const rect = puzzleCard.getBoundingClientRect();
    const style = getComputedStyle(puzzleCard);
    const padL = parseFloat(style.paddingLeft) || 0;
    const padR = parseFloat(style.paddingRight) || 0;
    avail = rect.width - padL - padR;
  }

  let scale = 1;
  if (avail > 0 && width > 0) scale = Math.min(1, avail / width);

  sizer.style.setProperty("--scale", scale.toString());
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

  // keys always rendered; shown only when printingWithKey
  renderTo("key1", CURRENT.puzzles[0], true);
  renderTo("key2", CURRENT.puzzles[1], true);
}

function generate() {
  try {
    setStatus("");
    const p1 = generatePuzzle("snake1");
    const p2 = generatePuzzle("snake1");
    CURRENT.puzzles = [p1, p2];
    rerender();
  } catch (e) {
    setStatus(e.message || String(e));
  }
}

function prepareForPrint(includeKey) {
  if (includeKey) document.body.classList.add("printingWithKey");
  else document.body.classList.remove("printingWithKey");

  // Render current state
  rerender();

  // iOS print fix: remove inline scaling so print CSS can lay out in normal flow
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

// Cleanup (best-effort)
window.addEventListener("afterprint", () => {
  document.body.classList.remove("printingWithKey");
  // Restore scaling for screen
  rerender();
});

function wireUI() {
  $("btnGenerate").addEventListener("click", generate);
  $("btnPrint").addEventListener("click", printPuzzlesOnly);
  $("btnPrintKey").addEventListener("click", printPuzzlesWithKey);
  $("showAnswers").addEventListener("change", rerender);
}

wireUI();
