/* ================== CONFIG ================== */
// URL del Apps Script publicado (/exec)
const REMOTE_JSON_URL = 'https://script.google.com/macros/s/AKfycbwr0MszUhAr-rHVdy5Azpu274g8Q0wb-8PXHUARfYJ1An1lreL_y71ByR16HUxMunI0/exec';

// Fallbacks
const FALLBACK_CATEGORIES = [
'Mecánica Automotriz',
'Aire Acondicionado Residencial',
'Aire Acondicionado Comercial',
'Aire Acondicionado Automotriz',
'Pintor',
'Handy Man',
'Electricista',
'Plomería',
'Contratista'
];

// 78 municipios de Puerto Rico
const PR_TOWNS = [
"Adjuntas","Aguada","Aguadilla","Aguas Buenas","Aibonito","Arecibo","Arroyo","Añasco",
"Barceloneta","Barranquitas","Bayamón","Cabo Rojo","Caguas","Camuy","Canóvanas","Carolina",
"Cataño","Cayey","Ceiba","Ciales","Cidra","Coamo","Comerío","Corozal","Culebra","Dorado",
"Fajardo","Florida","Guánica","Guayama","Guayanilla","Guaynabo","Gurabo","Hatillo","Hormigueros",
"Humacao","Isabela","Jayuya","Juana Díaz","Juncos","Lajas","Lares","Las Marías","Las Piedras",
"Loíza","Luquillo","Manatí","Maricao","Maunabo","Mayagüez","Moca","Morovis","Naguabo","Naranjito",
"Orocovis","Patillas","Peñuelas","Ponce","Quebradillas","Rincón","Río Grande","Sabana Grande",
"Salinas","San Germán","San Juan","San Lorenzo","San Sebastián","Santa Isabel","Toa Alta",
"Toa Baja","Trujillo Alto","Utuado","Vega Alta","Vega Baja","Vieques","Villalba","Yabucoa",
"Yauco","Aguadilla Pueblo" // algunos listados incluyen barrios/pueblos repetidos; no afecta
];

/* ============ Estado ============ */
let DB = { version: 1, updatedAt: "", categories: [], towns: [], pros: [] };
const isAdmin = new URLSearchParams(location.search).get('admin') === '1';

/* ============ Utilidades ============ */
const $ = id => document.getElementById(id);
const norm = s => String(s ?? '')
.toLowerCase()
.normalize('NFD').replace(/\p{Diacritic}/gu, ''); // sin acentos

function unifyPro(p) {
// acepta español o inglés
const name = p.nombre ?? p.name ?? '';
const phone = p['teléfono'] ?? p.telefono ?? p.phone ?? '';
const cat = p['categoría'] ?? p.categoria ?? p.category ?? '';
const town = p.pueblo ?? p.town ?? '';
const bio = p['descripción'] ?? p.descripcion ?? p.bio ?? '';
const photo = p.foto ?? p.photo ?? null;
let services = p.servicios ?? p.services ?? [];
if (typeof services === 'string') {
services = services.split(',').map(s => s.trim()).filter(Boolean);
}
return {
id: String(p.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2)),
name, phone, category: cat, town, services, bio, photo
};
}

function dedupeSorted(arr) {
return [...new Set(arr.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es',{sensitivity:'base'}));
}

/* ============ Carga de datos ============ */
async function loadDB() {
const url = REMOTE_JSON_URL + '?t=' + Date.now();
const res = await fetch(url, { cache: 'no-store' });
if (!res.ok) throw new Error('HTTP ' + res.status);
const json = await res.json();
if (json.error) throw new Error(json.error);

// Normalizamos estructura
const pros = (json.pros || []).map(unifyPro);

// Si el backend no trae listas, las calculamos
const categories = dedupeSorted(json.categories && json.categories.length ? json.categories
: pros.map(p => p.category).filter(Boolean).concat(FALLBACK_CATEGORIES));
const towns = dedupeSorted(json.towns && json.towns.length ? json.towns
: pros.map(p => p.town).filter(Boolean).concat(PR_TOWNS));

DB = {
version: Number(json.version || 1),
updatedAt: json.updatedAt || new Date().toISOString(),
categories,
towns,
pros
};

// Diagnóstico útil en consola
console.info('DB loaded:', { total: pros.length, categories: categories.length, towns: towns.length });
console.table(pros.map(p => ({ name: p.name, phone: p.phone, category: p.category, town: p.town })));
}

/* ============ UI base ============ */
function initUI(){
const yearEl = $('year'); if (yearEl) yearEl.textContent = new Date().getFullYear();
const adminBar = $('adminBar'); if (adminBar) adminBar.classList.toggle('hidden', !isAdmin);

// llenar selects
const catSel = $('fCategory');
const townSel = $('fTown');

if (catSel) {
catSel.innerHTML = '<option value="">Todas las categorías</option>' +
DB.categories.map(c => `<option value="${c}">${c}</option>`).join('');
}
if (townSel) {
townSel.innerHTML = '<option value="">Todos los pueblos</option>' +
DB.towns.map(t => `<option value="${t}">${t}</option>`).join('');
}

// Sugerencias al buscador (datalist)
ensureDatalist();

// primer render
applyFilters();
}

function ensureDatalist(){
const input = $('fQuery');
if (!input) return;
let list = document.getElementById('qopts');
if (!list) {
list = document.createElement('datalist');
list.id = 'qopts';
document.body.appendChild(list);
}
input.setAttribute('list','qopts');

const opts = new Set();
DB.pros.forEach(p=>{
if (p.name) opts.add(p.name);
if (p.category) opts.add(p.category);
if (p.town) opts.add(p.town);
(p.services||[]).forEach(s=>opts.add(s));
});
// también añade todas las categorías y pueblos por si el JSON viene vacío
DB.categories.forEach(c=>opts.add(c));
DB.towns.forEach(t=>opts.add(t));

list.innerHTML = [...opts].slice(0,800).map(v=>`<option value="${v}">`).join('');
}

/* ============ Filtros + render ============ */
function applyFilters(){
const cat = $('fCategory')?.value || '';
const town = $('fTown')?.value || '';
const qraw = $('fQuery')?.value || '';
const q = norm(qraw);

let list = DB.pros.slice();

if (cat) list = list.filter(p => p.category === cat);
if (town) list = list.filter(p => p.town === town);

if (q) {
list = list.filter(p => {
const txt = [
p.name, p.category, p.town, p.bio,
...(p.services || [])
].join(' ');
return norm(txt).includes(q);
});
}

renderResults(list);
}

function renderResults(list){
const wrap = $('results');
const counter = $('resultCount');
if (counter) counter.textContent = `${list.length} encontrados`;
if (!wrap) return;
wrap.innerHTML = '';

list.forEach(p=>{
const el = document.createElement('article');
el.className = 'card-pro';

const initials = (p.name||'PRO').split(' ').map(w=>w[0]).join('').slice(0,3).toUpperCase();
const phoneHTML = p.phone ? `<a href="tel:${p.phone}" class="pill">${p.phone}</a>` : '';

el.innerHTML = `
<div class="row">
<div class="avatar">${p.photo ? `<img src="${p.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:12px">` : initials}</div>
<div class="name">${p.name || ''}</div>
<span class="pill">${p.category || ''}</span>
<span class="pill">${p.town || ''}</span>
${phoneHTML}
</div>
<div class="row" style="margin-top:8px;flex-wrap:wrap">
${(p.services||[]).map(s=>`<span class="tag">${s}</span>`).join('')}
</div>
${p.bio ? `<p class="desc">${p.bio}</p>` : ''}
`;
wrap.append(el);
});
}

/* ============ Eventos ============ */
function setupEvents(){
const debounce = (fn, ms=250)=>{
let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); };
};

$('filterBtn')?.addEventListener('click', applyFilters);
$('clearBtn')?.addEventListener('click', ()=>{
const c = $('fCategory'); if (c) c.value = '';
const t = $('fTown'); if (t) t.value = '';
const q = $('fQuery'); if (q) q.value = '';
applyFilters();
});

// búsqueda en vivo al tipear
const q = $('fQuery');
if (q) {
q.addEventListener('input', debounce(applyFilters, 200));
q.addEventListener('keyup', e => { if (e.key === 'Enter') applyFilters(); });
}
$('fCategory')?.addEventListener('change', applyFilters);
$('fTown')?.addEventListener('change', applyFilters);
}

/* ============ Init ============ */
document.addEventListener('DOMContentLoaded', async ()=>{
try {
await loadDB(); // JSON del Apps Script
} catch (e) {
console.error('Fallo al leer el Sheet:', e);
// No mostramos alert. Rellenamos selects con fallbacks.
DB = {
version: 1,
updatedAt: new Date().toISOString(),
categories: FALLBACK_CATEGORIES,
towns: PR_TOWNS,
pros: []
};
}
initUI();
setupEvents();
});

