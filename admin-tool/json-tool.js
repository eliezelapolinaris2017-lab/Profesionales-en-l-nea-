// ========= Helpers =========
const $ = (id) => document.getElementById(id);
const UUID = () => (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));

const DEFAULT_DB = () => ({
  version: 1,
  updatedAt: new Date().toISOString(),
  categories: [
    "Mecánica Automotriz",
    "Aire Acondicionado Automotriz",
    "Aire Acondicionado Residencial",
    "Aire Acondicionado Comercial",
    "Pintor",
    "Handy Man"
  ],
  towns: [
    // *** Llena aquí todos los pueblos/municipios que usa tu app principal ***
    "San Juan","Bayamón","Carolina","Guaynabo","Caguas","Toa Baja","Toa Alta","Trujillo Alto",
    "Ponce","Mayagüez","Arecibo","Humacao","Fajardo","Cataño","Dorado","Vega Baja","Vega Alta",
    "Manatí","Isabela","Aguadilla","Cabo Rojo","Yauco","Guayama","Hatillo","Camuy","Quebradillas",
    "Barceloneta","Utuado","Cidra","Comerío","Juncos","Canóvanas","Loíza","Río Grande","Luquillo",
    "Naguabo","Las Piedras","Gurabo","Aibonito","Barranquitas","Corozal","Morovis","Orocovis",
    "Villalba","Coamo","Santa Isabel","Salinas","Juana Díaz","Peñuelas","Guánica","Lajas","San Germán",
    "Hormigueros","Moca","San Sebastián","Añasco","Rincón","Lares","Adjuntas","Maricao","Sabana Grande",
    "Guayanilla","Ciales","Florida","Aguas Buenas","Culebra","Vieques"
  ],
  pros: []
});

let DB = null;    // objeto JSON actual
let selId = null; // id seleccionado en edición

// ========= Cargar =========
$("fileInput").addEventListener("change", async (e)=>{
  const file = e.target.files?.[0]; if (!file) return;
  const text = await file.text();
  try {
    const json = JSON.parse(text);
    setDB(json);
  } catch(e){
    alert("JSON inválido");
  }
  $("fileInput").value = "";
});

$("fetchBtn").addEventListener("click", async ()=>{
  const url = $("urlInput").value.trim();
  if (!url) return alert("Pega la URL RAW de tu data.json");
  try{
    const res = await fetch(url, {cache:"no-store"});
    const json = await res.json();
    setDB(json);
  }catch(e){ alert("No se pudo descargar: " + e.message); }
});

$("seedBtn").addEventListener("click", ()=>{
  setDB(DEFAULT_DB());
});

function normalizeDB(json){
  // Garantiza que existan campos y sean arrays
  json.version   = Number(json.version ?? 1);
  json.updatedAt = json.updatedAt || new Date().toISOString();
  json.categories = Array.isArray(json.categories) ? json.categories : [];
  json.towns      = Array.isArray(json.towns) ? json.towns : [];
  json.pros       = Array.isArray(json.pros) ? json.pros : [];

  // Limpia duplicados y ordena catálogos
  json.categories = [...new Set(json.categories.map(s => String(s).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  json.towns      = [...new Set(json.towns.map(s => String(s).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));

  // Asegura estructura mínima en pros
  json.pros = json.pros.map(p => ({
    id: String(p.id || UUID()),
    name: String(p.name || ""),
    phone: String(p.phone || ""),
    category: String(p.category || ""),
    town: String(p.town || ""),
    services: Array.isArray(p.services) ? p.services.map(s=>String(s)) : [],
    bio: String(p.bio || ""),
    photo: p.photo || null
  }));
  return json;
}

function setDB(json){
  if (!json) return alert("Formato inválido de data.json");
  DB = normalizeDB(json);
  $("meta").textContent = `Versión: ${DB.version} · Actualizado: ${DB.updatedAt} · Profesionales: ${DB.pros.length}`;
  fillCatalogs(); renderCatalogChips();
  renderTable(DB.pros);
  resetForm();
}

// ========= Catálogos (categorías y pueblos) =========
function renderCatalogChips(){
  const catWrap = $("catChips"); catWrap.innerHTML = "";
  const townWrap = $("townChips"); townWrap.innerHTML = "";

  DB.categories.forEach(c => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `<span>${c}</span> <button title="Eliminar">✕</button>`;
    chip.querySelector("button").onclick = ()=>{
      if (!confirm(`¿Eliminar categoría "${c}"?`)) return;
      DB.categories = DB.categories.filter(x => x !== c);
      // Quita referencia en pros
      DB.pros = DB.pros.map(p => p.category === c ? {...p, category: ""} : p);
      DB.updatedAt = new Date().toISOString();
      fillCatalogs(); renderCatalogChips(); renderTable(DB.pros);
    };
    catWrap.append(chip);
  });

  DB.towns.forEach(t => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `<span>${t}</span> <button title="Eliminar">✕</button>`;
    chip.querySelector("button").onclick = ()=>{
      if (!confirm(`¿Eliminar pueblo "${t}"?`)) return;
      DB.towns = DB.towns.filter(x => x !== t);
      DB.pros = DB.pros.map(p => p.town === t ? {...p, town: ""} : p);
      DB.updatedAt = new Date().toISOString();
      fillCatalogs(); renderCatalogChips(); renderTable(DB.pros);
    };
    townWrap.append(chip);
  });
}

$("catAdd").addEventListener("click", ()=>{
  const v = $("catNew").value.trim(); if (!v) return;
  if (!DB.categories.includes(v)) DB.categories.push(v);
  DB.categories.sort((a,b)=>a.localeCompare(b));
  $("catNew").value = "";
  DB.updatedAt = new Date().toISOString();
  fillCatalogs(); renderCatalogChips();
});

$("townAdd").addEventListener("click", ()=>{
  const v = $("townNew").value.trim(); if (!v) return;
  if (!DB.towns.includes(v)) DB.towns.push(v);
  DB.towns.sort((a,b)=>a.localeCompare(b));
  $("townNew").value = "";
  DB.updatedAt = new Date().toISOString();
  fillCatalogs(); renderCatalogChips();
});

// Pone catálogos en selects (filtros + formulario)
function fillCatalogs(){
  const cats = DB.categories, towns = DB.towns;
  const sets = [
    ["fCategory", ["", "Todas las categorías"], cats],
    ["fTown", ["", "Todos los pueblos"], towns],
    ["proCategory", null, cats],
    ["proTown", null, towns],
  ];
  for (const [id, first, list] of sets){
    const s = $(id); s.innerHTML = "";
    if (first) s.append(new Option(first[1], first[0]));
    list.forEach(v => s.append(new Option(v, v)));
  }
}

// ========= Tabla / Filtros =========
function renderTable(list){
  $("count").textContent = `${list.length} elementos`;
  const tbody = $("tbl").querySelector("tbody");
  tbody.innerHTML = "";
  for (const p of list){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><img class="thumb" src="${p.photo || "https://dummyimage.com/80x80/0b1220/cccccc.png&text=PRO"}"></td>
      <td>${p.name||""}</td>
      <td><a href="tel:${p.phone||""}">${p.phone||""}</a></td>
      <td>${p.category||""}</td>
      <td>${p.town||""}</td>
      <td>${(p.services||[]).join(", ")}</td>
      <td><button class="btn outline" data-id="${p.id}">Editar</button></td>
    `;
    tbody.append(tr);
  }
  tbody.querySelectorAll("[data-id]").forEach(btn=>{
    btn.onclick = ()=> loadToForm(btn.dataset.id);
  });
}

$("filterBtn").addEventListener("click", applyFilters);
$("clearBtn").addEventListener("click", ()=>{
  $("fCategory").value = ""; $("fTown").value = ""; $("fQuery").value = "";
  applyFilters();
});

function applyFilters(){
  const cat = $("fCategory").value.trim();
  const town = $("fTown").value.trim();
  const q = $("fQuery").value.trim().toLowerCase();
  let list = DB.pros.slice();
  if (cat) list = list.filter(p => p.category === cat);
  if (town) list = list.filter(p => p.town === town);
  if (q) list = list.filter(p =>
    (p.name||"").toLowerCase().includes(q) ||
    (p.bio||"").toLowerCase().includes(q) ||
    (p.services||[]).join(" ").toLowerCase().includes(q)
  );
  renderTable(list);
}

// ========= Formulario =========
function resetForm(){
  selId = null;
  $("proForm").reset();
  $("proId").value = "";
}

function loadToForm(id){
  selId = id;
  const p = DB.pros.find(x => x.id === id);
  if (!p) return;
  $("proId").value = p.id;
  $("proName").value = p.name || "";
  $("proPhone").value = p.phone || "";
  $("proCategory").value = p.category || "";
  $("proTown").value = p.town || "";
  $("proServices").value = (p.services||[]).join(", ");
  $("proBio").value = p.bio || "";
  $("proPhoto").value = "";
  $("proPhotoUrl").value = "";
  window.scrollTo({top: document.body.scrollHeight, behavior: "smooth"});
}

$("newBtn").addEventListener("click", resetForm);

$("proForm").addEventListener("submit", async (e)=>{
  e.preventDefault();

  const id = $("proId").value || UUID();
  const file = $("proPhoto").files?.[0] || null;
  const url  = $("proPhotoUrl").value.trim();

  const data = {
    id,
    name: $("proName").value.trim(),
    phone: $("proPhone").value.trim(),
    category: $("proCategory").value,
    town: $("proTown").value,
    services: $("proServices").value.split(",").map(s=>s.trim()).filter(Boolean),
    bio: $("proBio").value.trim(),
    photo: null
  };

  if (url)      data.photo = url;
  else if (file) data.photo = await fileToDataURL(file);

  const i = DB.pros.findIndex(p => p.id === id);
  if (i >= 0) DB.pros[i] = data; else DB.pros.push(data);

  DB.updatedAt = new Date().toISOString();
  renderTable(DB.pros);
  resetForm();
  alert("Profesional guardado ✅ (no olvides Exportar)");
});

$("delBtn").addEventListener("click", ()=>{
  const id = $("proId").value;
  if (!id) return;
  if (!confirm("¿Eliminar este profesional?")) return;
  DB.pros = DB.pros.filter(p => p.id !== id);
  DB.updatedAt = new Date().toISOString();
  renderTable(DB.pros);
  resetForm();
});

function fileToDataURL(file){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// ========= Exportar =========
$("bumpBtn").addEventListener("click", ()=>{
  DB.version = (Number(DB.version)||0) + 1;
  DB.updatedAt = new Date().toISOString();
  $("meta").textContent = `Versión: ${DB.version} · Actualizado: ${DB.updatedAt} · Profesionales: ${DB.pros.length}`;
  alert("Versión incrementada a v" + DB.version);
});

$("exportBtn").addEventListener("click", ()=>{
  if (!DB) return alert("Primero carga o crea un data.json");
  // Normaliza antes de exportar (catálogos ordenados, sin duplicados)
  DB = normalizeDB(DB);
  DB.updatedAt = new Date().toISOString();
  const pretty = JSON.stringify(DB, null, 2);
  const blob = new Blob([pretty], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "data.json";
  document.body.appendChild(a); a.click(); a.remove();
});

// ========= INIT (plantilla por defecto) =========
setDB(DEFAULT_DB());
