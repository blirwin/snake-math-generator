// ==============================
// Seed handling
// ==============================

function getSeed() {

  const params = new URLSearchParams(window.location.search)

  let seed = parseInt(params.get("seed"))

  if (!seed) {
    seed = Math.floor(Math.random() * 100000)
  }

  // update URL so it can be shared
  history.replaceState(null, "", "?seed=" + seed)

  return seed
}



// ==============================
// Deterministic RNG
// ==============================

function seededRandom(seed) {

  let x = Math.sin(seed) * 10000
  return x - Math.floor(x)

}



// ==============================
// Main generator
// ==============================

function generate() {

  let seed = getSeed()

  // RNG with advancing state
  function rand() {
    seed += 1
    return seededRandom(seed)
  }

  const layout = layouts.snake1

  let start = Math.floor(rand() * 10) + 1

  let values = [start]
  let ops = []

  const steps = Math.floor((layout.length - 1) / 2)

  for (let i = 0; i < steps; i++) {

    let op

    // generate operations excluding +0
    do {
      op = Math.floor(rand() * 9) - 4
    } while (op === 0)

    let next = values[i] + op

    // keep numbers readable
    if (next < -20 || next > 50) {
      i--
      continue
    }

    ops.push(op)
    values.push(next)

  }

  // sanity check
  validateSnake(values, ops)

  render(layout, values, ops)

}



// ==============================
// Validation (debug)
// ==============================

function validateSnake(values, ops) {

  for (let i = 0; i < ops.length; i++) {

    if (values[i] + ops[i] !== values[i + 1]) {

      console.error("Snake math error at step", i)

    }

  }

}



// ==============================
// Rendering
// ==============================

function render(layout, values, ops) {

  const grid = document.getElementById("worksheet")

  grid.innerHTML = ""

  layout.forEach((pos, i) => {

    let cell = document.createElement("div")

    cell.className = "cell"

    cell.style.gridColumn = pos[0] + 1
    cell.style.gridRow = pos[1] + 1

    if (i === 0) {

      cell.innerText = values[0]

    }

    else if (i % 2 === 1) {

      let op = ops[(i - 1) / 2]

      cell.innerText = op > 0 ? "+" + op : op

      cell.classList.add("op")

    }

    else {

      cell.classList.add("blank")

    }

    grid.appendChild(cell)

  })

}



// ==============================
// Auto-generate on load
// ==============================

generate()
