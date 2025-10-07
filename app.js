/* ================== “Base de datos” ================== */
const KEY_DB = "sp_db_v1";
const KEY_LOGO = "sp_logo_v1";
const YEAR = new Date().getFullYear();

const DEFAULT_CATEGORIES = [
  "Mecánica Automotriz",
  "Aire Acondicionado Automotriz",
  "Aire Acondicionado Residencial",
  "Aire Acondicionado Comercial",
  "Pintor",
  "Handy Man"
];

const DEFAULT_TOWNS = [
  "San Juan","Bayamón","Carolina","Guaynabo","Caguas","Trujillo Alto",
  "Toa Baja","Toa Alta","Arecibo","Ponce","Mayagüez"
];

// ejemplo inicial
const SEED_PROS = [
  {
    id: crypto.randomUUID(),
    name: "José Rivera",
    phone: "787-555-1111",
    category: "Mecánica Automotriz",
    town: "Bayamón",
    services: ["Diagnóstico", "Cambio de aceite", "Frenos"],
    bio: "Técnico ASE. 10+ años. Trabaja Toyota, Honda, Nissan.",
    photo: null
  },
  {
    id: crypto.randomUUID(),
    name: "AC Master PR",
    phone: "787-555-2222",
    category: "Aire Acondicionado Residencial",
    town: "San Juan",
    services: ["Instalación minisplit", "Mantenimiento", "Carga de gas"],
    bio: "Especialistas en inverter. Marcas: LG, Midea, Gree.",
    photo: null
  },
  {
    id: crypto.randomUUID(),
    name: "Pintor Luis",
    phone: "787-555-3333",
    category: "Pintor",
    town: "Carolina",
    services: ["Exterior", "Interior", "Impermeabilización"],
    bio: "Trabajo garantizado, referencias disponibles.",
    photo: null
  }
];

function loadDB() {
  const raw = localStorage.getItem(KEY_DB);
  if (!raw) {
    const db = { categories: DEFAULT_CATEGORIES, towns: DEFAULT_TOWNS, pros: SEED_PROS };
    localStorage.setItem(KEY_DB, JSON.stringify(db));
    return db;
  }
  try { return JSON.parse(raw); } catch { return { categories: [], towns: [], pros: [] }; }
}
function saveDB(db){ localStorage.setItem(KEY_DB, JSON.stringify(db)); }

/* ================== Estado/UI ================== */
let DB = loadDB();
let admin = false;
const $ = (id) => document.getElementById(id);
$("year").textContent = YEAR;

/* Admin mode: ?admin=1 o Ctrl+Alt+A */
function computeAdmin() {
  const url = new URL(location.href);
  admin = url.searchParams.get("admin") === "1";
  if (admin) document.body.classList.add("admin-on");
  else document.body.classList.remove("admin-on");
}
computeAdmin();
window.addEventListener("keydown", (e)=>{
  if (e.ctrlKey && e.altKey && e.key.toLowerCase()==="a") {
    admin = !admin;
    if (admin) document.body.classList.add("admin-on");
    else document.body.classList.remove("admin-on");
  }
});

/* ================== Logo ================== */
function loadLogo() {
  const data = localStorage.getItem(KEY_LOGO);
  const el = $("logo");
  el.src = data ? data : "https://dummyimage.com/200x200/101522/fff.png&text=LOGO";
}
function handleLogoChange(e){
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    localStorage.setItem(KEY_LOGO, dataUrl);
    loadLogo();
  };
  reader.readAsDataURL(file);
}
$("logoInput")?.addEventListener("change", handleLogoChange);
loadLogo();

/* ================== Catálogos en selects ================== */
function fillSelects() {
  const catSel = $("fCategory"), townSel = $("fTown");
  const proCat = $("proCategory"), proTown = $("proTown");
  for (const s of [catSel, proCat]) {
    s.innerHTML = s === catSel ? `<option value="">Todas las categorías</option>` : "";
    DB.categories.forEach(c => s.append(new Option(c, c)));
  }
  for (const s of [townSel, proTown]) {
    s.innerHTML = s === townSel ? `<option value="">Todos los pueblos</option>` : "";
    DB.towns.forEach(t => s.append(new Option(t, t)));
  }
}
fillSelects();

/* ================== Búsqueda ================== */
function renderResults(list){
  $("count").textContent = list.length;
  const wrap = $("results"); wrap.innerHTML = "";
  if (!list.length) { wrap.innerHTML = `<p class="muted">No hay resultados.</p>`; return; }
  for (const p of list) {
    const card = document.createElement("article");
    card.className = "card-pro";
    card.innerHTML = `
      <div class="top">
        <img src="${p.photo || "https://dummyimage.com/128x128/0b1220/9aa4b2.png&text=PRO"}" alt="">
        <div>
          <h3 style="margin:0">${p.name}</h3>
          <div><span class="badge">${p.category}</span><span class="badge">${p.town}</span></div>
          <div><a href="tel:${p.phone}" class="badge" title="Llamar">${p.phone}</a></div>
        </div>
      </div>
      <div>${(p.services||[]).map(s=>`<span class="badge">${s}</span>`).join(" ")}</div>
      <p>${p.bio || ""}</p>
      ${admin ? `<button class="btn outline" data-edit="${p.id}">Editar</button>` : ""}
    `;
    wrap.append(card);
  }
  if (admin){
    wrap.querySelectorAll("[data-edit]").forEach(btn=>{
      btn.addEventListener("click", ()=> editPro(btn.dataset.edit));
    });
  }
}
function doSearch(e){
  if (e) e.preventDefault();
  const cat = $("fCategory").value.trim();
  const town = $("fTown").value.trim();
  const q = $("fQuery").value.trim().toLowerCase();
  let list = DB.pros.slice();
  if (cat) list = list.filter(p=>p.category===cat);
  if (town) list = list.filter(p=>p.town===town);
  if (q) list = list.filter(p =>
    (p.name||"").toLowerCase().includes(q) ||
    (p.bio||"").toLowerCase().includes(q) ||
    (p.services||[]).join(" ").toLowerCase().includes(q)
  );
  renderResults(list);
}
$("searchForm").addEventListener("submit", doSearch);
$("clearFilters").addEventListener("click", ()=>{
  $("fCategory").value = ""; $("fTown").value=""; $("fQuery").value="";
  doSearch();
});
doSearch();

/* ================== Admin: CRUD ================== */
function toDataURL(file){
  return new Promise((resolve,reject)=>{
    if (!file) return resolve(null);
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
function resetProForm(){
  $("proForm").reset();
  $("proId").value = "";
}
$("newBtn").addEventListener("click", resetProForm);

function editPro(id){
  const p = DB.pros.find(x=>x.id===id);
  if (!p) return;
  $("proId").value = p.id;
  $("proName").value = p.name || "";
  $("proPhone").value = p.phone || "";
  $("proCategory").value = p.category || "";
  $("proTown").value = p.town || "";
  $("proServices").value = (p.services||[]).join(", ");
  $("proBio").value = p.bio || "";
}

$("proForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const id = $("proId").value || crypto.randomUUID();
  const data = {
    id,
    name: $("proName").value.trim(),
    phone: $("proPhone").value.trim(),
    category: $("proCategory").value,
    town: $("proTown").value,
    services: $("proServices").value.split(",").map(s=>s.trim()).filter(Boolean),
    bio: $("proBio").value.trim()
  };
  const file = $("proPhoto").files[0];
  if (file) data.photo = await toDataURL(file);
  else {
    const existing = DB.pros.find(p=>p.id===id);
    data.photo = existing?.photo || null;
  }
  const i = DB.pros.findIndex(p=>p.id===id);
  if (i>=0) DB.pros[i] = data; else DB.pros.push(data);
  saveDB(DB);
  resetProForm();
  doSearch();
  alert("Guardado ✅");
});

$("deleteBtn").addEventListener("click", ()=>{
  const id = $("proId").value; if (!id) return;
  if (!confirm("¿Eliminar este profesional?")) return;
  DB.pros = DB.pros.filter(p=>p.id!==id);
  saveDB(DB);
  resetProForm();
  doSearch();
});

/* ===== Catálogos (categorías / pueblos) ===== */
function renderCats(){
  const ul = $("catList"); ul.innerHTML = "";
  DB.categories.forEach(c=>{
    const li = document.createElement("li");
    li.innerHTML = `<span>${c}</span> <button title="Eliminar" aria-label="Eliminar">✕</button>`;
    li.querySelector("button").onclick = ()=>{
      if (!confirm(`¿Eliminar categoría "${c}"?`)) return;
      DB.categories = DB.categories.filter(x=>x!==c);
      DB.pros = DB.pros.map(p => p.category===c ? {...p, category:""} : p);
      saveDB(DB); fillSelects(); renderCats(); doSearch();
    };
    ul.append(li);
  });
}
function renderTowns(){
  const ul = $("townList"); ul.innerHTML = "";
  DB.towns.forEach(t=>{
    const li = document.createElement("li");
    li.innerHTML = `<span>${t}</span> <button title="Eliminar" aria-label="Eliminar">✕</button>`;
    li.querySelector("button").onclick = ()=>{
      if (!confirm(`¿Eliminar pueblo "${t}"?`)) return;
      DB.towns = DB.towns.filter(x=>x!==t);
      DB.pros = DB.pros.map(p => p.town===t ? {...p, town:""} : p);
      saveDB(DB); fillSelects(); renderTowns(); doSearch();
    };
    ul.append(li);
  });
}
$("catAdd").addEventListener("click", ()=>{
  const v = $("catNew").value.trim(); if (!v) return;
  if (!DB.categories.includes(v)) DB.categories.push(v);
  $("catNew").value=""; saveDB(DB); fillSelects(); renderCats();
});
$("townAdd").addEventListener("click", ()=>{
  const v = $("townNew").value.trim(); if (!v) return;
  if (!DB.towns.includes(v)) DB.towns.push(v);
  $("townNew").value=""; saveDB(DB); fillSelects(); renderTowns();
});
renderCats(); renderTowns();

/* ================== Importar / Exportar ================== */
$("exportBtn")?.addEventListener("click", ()=>{
  const data = JSON.stringify(DB, null, 2);
  const blob = new Blob([data], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `serviciospro_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
});
$("importInput")?.addEventListener("change", async (e)=>{
  const file = e.target.files?.[0]; if (!file) return;
  const text = await file.text();
  try{
    const json = JSON.parse(text);
    if (!json.pros || !json.categories || !json.towns) throw new Error("formato inválido");
    DB = json; saveDB(DB);
    fillSelects(); renderCats(); renderTowns(); doSearch();
    alert("Importado ✅");
  }catch(err){ alert("Archivo inválido"); }
});
