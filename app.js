/* Lee SIEMPRE desde data.json publicado en GitHub Pages (sin caché) */
const REMOTE_JSON_URL = 'https://eliezelapolinaris2017-lab.github.io/Profesionales-en-l-nea-/data.json';

let DB = { categories: [], towns: [], pros: [] };

/* ===== CARGA ===== */
async function loadDB() {
  const bust = `?t=${Date.now()}`; // cache-busting
  const res = await fetch(REMOTE_JSON_URL + bust, { cache: 'no-store' });
  if (!res.ok) throw new Error('No se pudo descargar data.json');
  DB = await res.json();
}

/* ===== UI HELPERS (no cambia tu HTML/CSS) ===== */
const el = (id) => document.getElementById(id);

function safeText(elm, txt){ if (elm) elm.textContent = txt; }
function appendOptions(select, list, firstOptText){
  if (!select) return;
  select.innerHTML = '';
  if (firstOptText !== undefined) {
    const opt = document.createElement('option');
    opt.value = ''; opt.textContent = firstOptText;
    select.append(opt);
  }
  (list || []).forEach(v=>{
    const o = document.createElement('option');
    o.value = v; o.textContent = v;
    select.append(o);
  });
}

/* ===== RENDER ===== */
function fillSelects(){
  appendOptions(el('fCategory'), DB.categories, 'Todas las categorías');
  appendOptions(el('fTown'),     DB.towns,     'Todos los pueblos');
}

function renderTable(list){
  const table = document.querySelector('#tbl tbody');
  if (!table) return;
  table.innerHTML = '';
  (list || []).forEach(p=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><img class="thumb" src="${p.photo || 'https://dummyimage.com/80x80/0b1220/ccc.png&text=PRO'}" alt=""></td>
      <td>${p.name || ''}</td>
      <td>${p.phone ? `<a href="tel:${p.phone}">${p.phone}</a>` : ''}</td>
      <td>${p.category || ''}</td>
      <td>${p.town || ''}</td>
      <td>${(p.services || []).join(', ')}</td>
    `;
    table.append(tr);
  });
}

function applyFilters(){
  const cat  = el('fCategory')?.value || '';
  const town = el('fTown')?.value || '';
  const q    = (el('fQuery')?.value || '').toLowerCase();

  let list = (DB.pros || []).slice();
  if (cat)  list = list.filter(p => p.category === cat);
  if (town) list = list.filter(p => p.town === town);
  if (q)    list = list.filter(p =>
              (p.name || '').toLowerCase().includes(q) ||
              (p.bio || '').toLowerCase().includes(q)  ||
              (p.services || []).join(' ').toLowerCase().includes(q)
            );
  renderTable(list);
}

/* ===== INIT ===== */
async function init(){
  try { await loadDB(); } 
  catch (e){ console.error(e); DB = { categories: [], towns: [], pros: [] }; }

  // año en footer si existe
  safeText(el('year'), new Date().getFullYear());

  // combos y resultados
  fillSelects();
  applyFilters();

  // eventos (si existen en tu HTML, se conectan; si no, no molestan)
  el('filterBtn')?.addEventListener('click', applyFilters);
  el('clearBtn')?.addEventListener('click', ()=>{
    if (el('fCategory')) el('fCategory').value = '';
    if (el('fTown'))     el('fTown').value = '';
    if (el('fQuery'))    el('fQuery').value = '';
    applyFilters();
  });
}

document.addEventListener('DOMContentLoaded', init);
