/* URL del Apps Script publicado */
const REMOTE_JSON_URL = 'https://script.google.com/macros/s/AKfycbwviVzm7LMcsobKjZ460oIWDHm-8W-0vCakLNNZZxNYbtwM3UCyUXG9PtP0d_g-PpT8/exec';

let DB = { categories: [], towns: [], pros: [] };
const isAdmin = new URLSearchParams(location.search).get('admin') === '1';

/* Cargar JSON del Sheet (sin caché) */
async function loadDB() {
  const url = REMOTE_JSON_URL + '?t=' + Date.now();
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('No se pudo descargar JSON del Sheet');
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  DB = json;
  // Diagnóstico en consola
  console.table((DB.pros || []).map(p => ({
    name: p.name, phone: p.phone, category: p.category, town: p.town
  })));
}

/* Render base (igual a tu UI bonita) */
function initUI(){
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const adminBar = document.getElementById('adminBar');
  if (adminBar) adminBar.classList.toggle('hidden', !isAdmin);

  const catSel = document.getElementById('fCategory');
  const townSel = document.getElementById('fTown');
  if (catSel){
    catSel.innerHTML = '<option value="">Todas las categorías</option>';
    (DB.categories||[]).forEach(c => catSel.append(new Option(c,c)));
  }
  if (townSel){
    townSel.innerHTML = '<option value="">Todos los pueblos</option>';
    (DB.towns||[]).forEach(t => townSel.append(new Option(t,t)));
  }

  applyFilters();
}

/* Filtros + resultados */
function applyFilters(){
  const cat  = document.getElementById('fCategory')?.value || '';
  const town = document.getElementById('fTown')?.value || '';
  const q    = (document.getElementById('fQuery')?.value || '').toLowerCase();

  let list = (DB.pros||[]).slice();
  if (cat)  list = list.filter(p => p.category === cat);
  if (town) list = list.filter(p => p.town === town);
  if (q)    list = list.filter(p =>
    (p.name||'').toLowerCase().includes(q) ||
    (p.bio||'').toLowerCase().includes(q)  ||
    (p.services||[]).join(' ').toLowerCase().includes(q)
  );

  renderResults(list);
}

function renderResults(list){
  const wrap = document.getElementById('results');
  const counter = document.getElementById('resultCount');
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
      ${isAdmin ? `<button class="btn outline full" data-edit="${p.id||''}">Editar</button>` : ``}
    `;
    wrap.append(el);
  });
}

/* Init */
document.addEventListener('DOMContentLoaded', async ()=>{
  try { await loadDB(); }
  catch (e) {
    console.error('Fallo al leer el Sheet:', e.message);
    alert('No pude leer los datos del Sheet. Revisa la URL del Apps Script y los encabezados.');
    DB = { categories: [], towns: [], pros: [] };
  }
  initUI();

  document.getElementById('filterBtn')?.addEventListener('click', applyFilters);
  document.getElementById('clearBtn')?.addEventListener('click', ()=>{
    const c = document.getElementById('fCategory');
    const t = document.getElementById('fTown');
    const q = document.getElementById('fQuery');
    if (c) c.value = ''; if (t) t.value = ''; if (q) q.value = '';
    applyFilters();
  });
});
