/* Lee SIEMPRE desde data.json publicado en GitHub Pages (sin caché) */
const REMOTE_JSON_URL = 'https://eliezelapolinaris2017-lab.github.io/Profesionales-en-l-nea-/data.json';

let DB = { categories: [], towns: [], pros: [] };

/* ===== CARGA ===== */
async function loadDB() {
  try {
    const bust = '?t=' + Date.now(); // evita caché
    const res = await fetch(REMOTE_JSON_URL + bust, { cache: 'no-store' });
    if (!res.ok) throw new Error('No se pudo descargar data.json');
    DB = await res.json();
  } catch (e) {
    console.error('Error cargando data.json:', e.message);
    DB = { categories: [], towns: [], pros: [] };
  }
  renderUI();
}

/* ===== RENDER ===== */
function renderUI() {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // llenar selects con tus listas
  const catSel = document.getElementById('fCategory');
  const townSel = document.getElementById('fTown');
  if (catSel) {
    catSel.innerHTML = '<option value="">Todas las categorías</option>';
    (DB.categories || []).forEach(c => catSel.append(new Option(c, c)));
  }
  if (townSel) {
    townSel.innerHTML = '<option value="">Todos los pueblos</option>';
    (DB.towns || []).forEach(t => townSel.append(new Option(t, t)));
  }

  applyFilters(); // pinta la tabla inicial
}

/* ===== FILTROS + TABLA (usa tu misma estructura) ===== */
function applyFilters() {
  const cat  = document.getElementById('fCategory')?.value || '';
  const town = document.getElementById('fTown')?.value || '';
  const q    = (document.getElementById('fQuery')?.value || '').toLowerCase();

  let list = (DB.pros || []).slice();
  if (cat)  list = list.filter(p => p.category === cat);
  if (town) list = list.filter(p => p.town === town);
  if (q)    list = list.filter(p =>
    (p.name || '').toLowerCase().includes(q) ||
    (p.bio || '').toLowerCase().includes(q)  ||
    (p.services || []).join(' ').toLowerCase().includes(q)
  );

  const tbody = document.querySelector('#tbl tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  list.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><img class="thumb" src="${p.photo || 'https://dummyimage.com/80x80/0b1220/ccc.png&text=PRO'}" alt=""></td>
      <td>${p.name || ''}</td>
      <td>${p.phone ? `<a href="tel:${p.phone}">${p.phone}</a>` : ''}</td>
      <td>${p.category || ''}</td>
      <td>${p.town || ''}</td>
      <td>${(p.services || []).join(', ')}</td>
    `;
    tbody.append(tr);
  });
}

/* ===== EVENTOS ===== */
document.addEventListener('DOMContentLoaded', () => {
  loadDB();

  document.getElementById('filterBtn')?.addEventListener('click', applyFilters);
  document.getElementById('clearBtn')?.addEventListener('click', () => {
    const fCategory = document.getElementById('fCategory');
    const fTown     = document.getElementById('fTown');
    const fQuery    = document.getElementById('fQuery');
    if (fCategory) fCategory.value = '';
    if (fTown)     fTown.value = '';
    if (fQuery)    fQuery.value = '';
    applyFilters();
  });
});
