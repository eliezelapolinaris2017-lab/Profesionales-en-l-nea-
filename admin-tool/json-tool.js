const $ = id => document.getElementById(id);
const UUID = () => (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2));

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

let DB = DEFAULT_DB();
let selId = null;

function normalizeDB(json){
  json.version   = Number(json.version ?? 1);
  json.updatedAt = json.updatedAt || new Date().toISOString();
  json.categories = Array.isArray(json.categories) ? json.categories : [];
  json.towns      = Array.isArray(json.towns) ? json.towns : [];
  json.pros       = Array.isArray(json.pros) ? json.pros : [];

  json.categories = [...new Set(json.categories.map(x=>String(x).trim()).filter(Boolean))].sort();
  json.towns      = [...new Set(json.towns.map(x=>String(x).trim()).filter(Boolean))].sort();

  json.pros = json.pros.map(p=>({
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
  DB = normalizeDB(json);
  $('meta').textContent = `Versión: ${DB.version} · Actualizado: ${DB.updatedAt} · Profesionales: ${DB.pros.length}`;
  fillCatalogs();
  renderTable(DB.pros);
  resetForm();
}

/* ==== Cargar ==== */
$('fileInput').addEventListener('change', async e=>{
  const f = e.target.files?.[0]; if(!f) return;
  try{ setDB(JSON.parse(await f.text())); }catch{ alert('JSON inválido'); }
  e.target.value = '';
});
$('fetchBtn').addEventListener('click', async ()=>{
  const url = $('urlInput').value.trim();
  if (!url) return alert('Pega una URL RAW');
  try{
    const r = await fetch(url, {cache:'no-store'});
    setDB(await r.json());
  }catch(err){ alert('No se pudo descargar: ' + err.message); }
});
$('seedBtn').addEventListener('click', ()=> setDB(DEFAULT_DB()));

/* ==== Catálogos en selects ==== */
function fillCatalogs(){
  const cats = DB.categories, towns = DB.towns;
  const sets = [
    ['fCategory', ['', 'Todas las categorías'], cats],
    ['fTown', ['', 'Todos los pueblos'], towns],
    ['proCategory', null, cats],
    ['proTown', null, towns]
  ];
  for (const [id, first, list] of sets){
    const s = $(id); s.innerHTML = '';
    if (first) s.append(new Option(first[1], first[0]));
    list.forEach(v => s.append(new Option(v, v)));
  }
}

/* ==== Tabla / Filtros ==== */
function renderTable(list){
  $('count').textContent = `${list.length} elementos`;
  const tbody = $('tbl').querySelector('tbody');
  tbody.innerHTML = '';
  list.forEach(p=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><img class="thumb" src="${p.photo || 'https://dummyimage.com/80x80/0b1220/ccc.png&text=PRO'}"></td>
      <td>${p.name}</td>
      <td><a href="tel:${p.phone}">${p.phone}</a></td>
      <td>${p.category}</td>
      <td>${p.town}</td>
      <td>${(p.services||[]).join(', ')}</td>
      <td><button data-id="${p.id}">Editar</button></td>`;
    tbody.append(tr);
  });
  tbody.querySelectorAll('[data-id]').forEach(b=> b.onclick = ()=> loadToForm(b.dataset.id));
}
$('filterBtn').addEventListener('click', applyFilters);
$('clearBtn').addEventListener('click', ()=>{
  $('fCategory').value = ''; $('fTown').value=''; $('fQuery').value='';
  applyFilters();
});
function applyFilters(){
  const cat = $('fCategory').value.trim();
  const town = $('fTown').value.trim();
  const q = $('fQuery').value.trim().toLowerCase();
  let list = DB.pros.slice();
  if (cat) list = list.filter(p=>p.category===cat);
  if (town) list = list.filter(p=>p.town===town);
  if (q) list = list.filter(p =>
    (p.name||'').toLowerCase().includes(q) ||
    (p.bio||'').toLowerCase().includes(q) ||
    (p.services||[]).join(' ').toLowerCase().includes(q)
  );
  renderTable(list);
}

/* ==== Form ==== */
function resetForm(){ selId=null; $('proForm').reset(); $('proId').value=''; }
$('newBtn').addEventListener('click', resetForm);

function loadToForm(id){
  selId = id;
  const p = DB.pros.find(x=>x.id===id); if(!p) return;
  $('proId').value = p.id;
  $('proName').value = p.name;
  $('proPhone').value = p.phone;
  $('proCategory').value = p.category;
  $('proTown').value = p.town;
  $('proServices').value = (p.services||[]).join(', ');
  $('proPhotoUrl').value = p.photo || '';
  $('proBio').value = p.bio || '';
  window.scrollTo({top: document.body.scrollHeight, behavior: 'smooth'});
}

$('proForm').addEventListener('submit', e=>{
  e.preventDefault();
  const id = $('proId').value || UUID();
  const data = {
    id,
    name: $('proName').value.trim(),
    phone: $('proPhone').value.trim(),
    category: $('proCategory').value,
    town: $('proTown').value,
    services: $('proServices').value.split(',').map(s=>s.trim()).filter(Boolean),
    bio: $('proBio').value.trim(),
    photo: $('proPhotoUrl').value.trim() || null
  };
  const i = DB.pros.findIndex(p=>p.id===id);
  if (i>=0) DB.pros[i]=data; else DB.pros.push(data);
  DB.updatedAt = new Date().toISOString();
  renderTable(DB.pros);
  resetForm();
  alert('Profesional guardado ✅ (ahora Exportar)');
});

$('delBtn').addEventListener('click', ()=>{
  const id = $('proId').value; if(!id) return;
  if (!confirm('¿Eliminar este profesional?')) return;
  DB.pros = DB.pros.filter(p=>p.id!==id);
  DB.updatedAt = new Date().toISOString();
  renderTable(DB.pros);
  resetForm();
});

/* ==== Export ==== */
$('bumpBtn').addEventListener('click', ()=>{
  DB.version = (Number(DB.version)||0) + 1;
  DB.updatedAt = new Date().toISOString();
  $('meta').textContent = `Versión: ${DB.version} · Actualizado: ${DB.updatedAt} · Profesionales: ${DB.pros.length}`;
  alert('Versión incrementada a v' + DB.version);
});

$('exportBtn').addEventListener('click', ()=>{
  DB = normalizeDB(DB);
  DB.updatedAt = new Date().toISOString();
  const pretty = JSON.stringify(DB, null, 2);
  const blob = new Blob([pretty], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'data.json';
  document.body.appendChild(a); a.click(); a.remove();
});

/* ==== Init ==== */
setDB(DB);
