function getSeed(){

const params = new URLSearchParams(window.location.search)
return parseInt(params.get("seed")) || Math.floor(Math.random()*100000)

}

function generate(){

const seed = getSeed()

let rand = () => seededRandom(seed + Math.random())

const layout = layouts.snake1

let start = Math.floor(rand()*10)+1

let ops = []
let values = [start]

for(let i=1;i<layout.length;i++){

let op = Math.floor(rand()*9)-4

ops.push(op)

values.push(values[i-1] + op)

}

render(layout,values,ops)

}

function render(layout,values,ops){

const grid = document.getElementById("worksheet")

grid.innerHTML = ""

layout.forEach((pos,i)=>{

let cell = document.createElement("div")

cell.className = "cell"

cell.style.gridColumn = pos[0]+1
cell.style.gridRow = pos[1]+1

if(i===0){

cell.innerText = values[0]

}else{

if(i%2==1){

let op = ops[i-1]
cell.innerText = op>=0 ? "+"+op : op
cell.classList.add("op")

}else{

cell.classList.add("blank")

}

}

grid.appendChild(cell)

})

}
