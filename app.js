/* ===== CONFIG ===== */
const REMOTE_JSON_URL = 'https://eliezelapolinaris2017-lab.github.io/Profesionales-en-l-nea-/data.json';
let DB = null;

/* ===== Cargar SIEMPRE directo del JSON ===== */
async function loadDB() {
  try {
    const bust = `?t=${Date.now()}`; // evita caché
    const res = await fetch(REMOTE_JSON_URL + bust, { cache: "no-store" });
    if (!res.ok) throw new Error("Error al descargar data.json");
    DB = await res.json();
    renderApp();
  } catch (e) {
    console.error("No se pudo cargar data.json:", e.message);
    DB = { categories: [], towns: [], pros: [] };
    renderApp();
  }
}

/* ===== Render ===== */
function renderApp() {
  fillSelects();
  applyFilters();
  document.getElementById("year").textContent = new Date().getFullYear();
}

/* ===== Selects ===== */
function fillSelects() {
  const catSel = document.getElementById("fCategory");
  const townSel = document.getElementById("fTown");
  catSel.innerHTML = '<option value="">Todas las categorías</option>';
  townSel.innerHTML = '<option value="">Todos los pueblos</option>';
  DB.categories.forEach(c => catSel.append(new Option(c,c)));
  DB.towns.forEach(t => townSel.append(new Option(t,t)));
}

/* ===== Tabla ===== */
function renderTable(list) {
  const tbody = document.querySelector("#tbl tbody");
  tbody.innerHTML = "";
  list.forEach(p=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><img class="thumb" src="${p.photo||'https://dummyimage.com/80x80/0b1220/ccc.png&text=PRO'}"></td>
      <td>${p.name}</td>
      <td><a href="tel:${p.phone}">${p.phone}</a></td>
      <td>${p.category}</td>
      <td>${p.town}</td>
      <td>${(p.services||[]).join(", ")}</td>
    `;
    tbody.append(tr);
  });
}

/* ===== Filtros ===== */
function applyFilters() {
  const cat = document.getElementById("fCategory").value;
  const town = document.getElementById("fTown").value;
  const q = document.getElementById("fQuery").value.toLowerCase();

  let list = DB.pros.slice();
  if (cat) list = list.filter(p => p.category === cat);
  if (town) list = list.filter(p => p.town === town);
  if (q) list = list.filter(p =>
    p.name.toLowerCase().includes(q) ||
    (p.services||[]).join(" ").toLowerCase().includes(q) ||
    (p.bio||"").toLowerCase().includes(q)
  );

  renderTable(list);
}

/* ===== Eventos ===== */
document.getElementById("filterBtn").addEventListener("click", applyFilters);
document.getElementById("clearBtn").addEventListener("click", ()=>{
  document.getElementById("fCategory").value="";
  document.getElementById("fTown").value="";
  document.getElementById("fQuery").value="";
  applyFilters();
});

/* ===== Init ===== */
document.addEventListener("DOMContentLoaded", loadDB);
