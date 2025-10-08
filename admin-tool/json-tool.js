// ====== Utilidades ======
const $ = (id) => document.getElementById(id);
const UUID = () => (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));

const emptyDB = () => ({
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
  towns: ["San Juan","Bayamón","Carolina","Guaynabo","Caguas","Ponce","Mayagüez"],
  pros: []
});

let DB = null;    // objeto JSON cargado
let selId = null; // id seleccionado

// ====== Cargar / Plantilla ======
$("fileInput").addEventListener("change", async (e)=>{
  const file = e.target.files?.[0]; if (!file) return;
  const text = await file.text();
  setDB(JSON.parse(text));
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
  setDB(emptyDB());
});

function setDB(json){
  if (!json || !Array.isArray(json.pros) || !Array.isArray(json.categories) || !Array.isArray(json.towns)){
    return alert("Formato inválido de data.json");
  }
  DB = json;
  $("meta").textContent = `Versión: ${DB.version ?? 1} · Actualizado: ${DB.updatedAt ?? ""} · Profesionales: ${DB.pros.length}`;
  fillCatalogs();
  renderTable(DB.pros);
  resetForm();
}

// ====== Catálogos a selects ======
function fillCatalogs(){
  const cats = DB.categories || [];
  const towns = DB.towns || [];
  const fills = [
    ["fCategory", ["", "Todas las categorías"], cats],
    ["fTown", ["", "Todos los pueblos"], towns],
    ["proCategory", null, cats],
    ["proTown", null, towns],
  ];
  for(const [id, first, list] of fills){
    const s = $(id); s.innerHTML = "";
    if (first) s.append(new Option(first[1], first[0]));
    list.forEach(v => s.append(new Option(v, v)));
  }
}

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

// ====== Filtros ======
$("filterBtn").addEventListener("click", applyFilters);
$("clearBtn").addEventListener("click", ()=>{
  $("fCategory").value = ""; $("fTown").value = ""; $("fQuery").value = "";
  applyFilters();
});
function applyFilters(){
  if (!DB) return;
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

// ====== Formulario ======
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
  if (!DB) return;

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

  if (url) {
    data.photo = url; // usar URL directa
  } else if (file) {
    data.photo = await fileToDataURL(file); // incrustar base64
  } // si nada: queda null (usa placeholder en la app)

  const i = DB.pros.findIndex(p => p.id === id);
  if (i >= 0) DB.pros[i] = data; else DB.pros.push(data);

  // actualizar meta y tabla
  DB.updatedAt = new Date().toISOString();
  renderTable(DB.pros);
  resetForm();
  alert("Profesional guardado ✅ (no olvides Exportar)");
});

$("delBtn").addEventListener("click", ()=>{
  if (!DB) return;
  const id = $("proId").value;
  if (!id) return;
  if (!confirm("¿Eliminar este profesional?")) return;
  DB.pros = DB.pros.filter(p => p.id !== id);
  DB.updatedAt = new Date().toISOString();
  renderTable(DB.pros);
  resetForm();
});

// helper
function fileToDataURL(file){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// ====== Exportar ======
$("bumpBtn").addEventListener("click", ()=>{
  if (!DB) return;
  DB.version = (Number(DB.version)||0) + 1;
  DB.updatedAt = new Date().toISOString();
  $("meta").textContent = `Versión: ${DB.version} · Actualizado: ${DB.updatedAt} · Profesionales: ${DB.pros.length}`;
  alert("Versión incrementada a v" + DB.version);
});

$("exportBtn").addEventListener("click", ()=>{
  if (!DB) return alert("Primero carga un data.json");
  const pretty = JSON.stringify(DB, null, 2);
  const blob = new Blob([pretty], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "data.json";
  document.body.appendChild(a); a.click(); a.remove();
});
