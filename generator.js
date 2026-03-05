// -----------------------------
// 1. Read seed from URL
// -----------------------------
function getSeed() {

  const params = new URLSearchParams(window.location.search)

  let seed = parseInt(params.get("seed"))

  if (!seed) {
    seed = Math.floor(Math.random() * 100000)
  }

  // update URL so teacher can copy it
  history.replaceState(null, "", "?seed=" + seed)

  return seed
}



// -----------------------------
// 2. Deterministic RNG
// -----------------------------
function seededRandom(seed) {
  let x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}



// -----------------------------
// 3. Generate puzzle
// -----------------------------
function generate() {

  let seed = getSeed()

  // seeded RNG with advancing state
  let rand = () => {
    seed += 1
    return seededRandom(seed)
  }

  const layout = layouts.snake1

  let start = Math.floor(rand() * 10) + 1

  let ops = []
  let values = [start]

  // generate snake values
  for (let i = 1; i < layout.length; i++) {

    let op = Math.floor(rand() * 9) - 4

    let next = values[i - 1] + op

    // -----------------------------
    // 4. bounds control
    // prevents huge numbers
    // -----------------------------
    if (next < -20 || next > 50) {
      i--
      continue
    }

    ops.push(op)
    values.push(next)

  }

  // -----------------------------
  // 5. Debug correctness check
  // -----------------------------
  for (let i = 0; i < ops.length; i++) {

    if (values[i] + ops[i] !== values[i + 1]) {
      console.error("Snake math mismatch", i)
    }

  }

  render(layout, values, ops)

}



// -----------------------------
// 6. Render snake grid
// -----------------------------
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

    } else if (i % 2 === 1) {

      let op = ops[Math.floor(i / 2)]

      cell.innerText = op >= 0 ? "+" + op : op

      cell.classList.add("op")

    } else {

      cell.classList.add("blank")

    }

    grid.appendChild(cell)

  })

}



// -----------------------------
// auto-generate on page load
// -----------------------------
generate()
