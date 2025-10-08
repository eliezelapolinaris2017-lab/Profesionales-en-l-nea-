/* ======== CONFIG ======== */
// URL del Apps Script (/exec)
const REMOTE_JSON_URL = 'https://script.google.com/macros/s/AKfycbwr0MszUhAr-rHVdy5Azpu274g8Q0wb-8PXHUARfYJ1An1lreL_y71ByR16HUxMunI0/exec';

// Cambia esta contraseña por la tuya (solo para admin). Se hashea en el cliente.
const ADMIN_PASSWORD = '132115';

/* ======== Fallbacks ======== */
const FALLBACK_CATEGORIES = [
  'Mecánica Automotriz','Aire Acondicionado Residencial','Aire Acondicionado Comercial',
  'Aire Acondicionado Automotriz','Pintor','Handy Man','Electricista','Plomería','Contratista'
];

// 78 municipios
const PR_TOWNS = ["Adjuntas","Aguada","Aguadilla","Aguas Buenas","Aibonito","Arecibo","Arroyo","Añasco",
"Barceloneta","Barranquitas","Bayamón","Cabo Rojo","Caguas","Camuy","Canóvanas","Carolina","Cataño","Cayey",
"Ceiba","Ciales","Cidra","Coamo","Comerío","Corozal","Culebra","Dorado","Fajardo","Florida","Guánica","Guayama",
"Guayanilla","Guaynabo","Gurabo","Hatillo","Hormigueros","Humacao","Isabela","Jayuya","Juana Díaz","Juncos",
"Lajas","Lares","Las Marías","Las Piedras","Loíza","Luquillo","Manatí","Maricao","Maunabo","Mayagüez","Moca",
"Morovis","Naguabo","Naranjito","Orocovis","Patillas","Peñuelas","Ponce","Quebradillas","Rincón","Río Grande",
"Sabana Grande","Salinas","San Germán","San Juan","San Lorenzo","San Sebastián","Santa Isabel","Toa Alta",
"Toa Baja","Trujillo Alto","Utuado","Vega Alta","Vega Baja","Vieques","Villalba","Yabucoa","Yauco"];

/* ======== Estado ======== */
let DB = { version: 1, updatedAt: "", categories: [], towns: [], pros: [] };

/* ======== Utils ======== */
const $ = id => document.getElementById(id);
const norm = s => String(s ?? '').toLowerCase()
  .normalize('NFD').replace(/\p{Diacritic}/gu, '');

function unifyPro(p) {
  // acepta español o inglés
  const name  = p.nombre ?? p.name ?? '';
  const phone = p['teléfono'] ?? p.telefono ?? p.phone ?? '';
  const cat   = p['categoría'] ?? p.categoria ?? p.category ?? '';
  const town  = p.pueblo ?? p.town ?? '';
  const bio   = p['descripción'] ?? p.descripcion ?? p.bio ?? '';
  const photo = p.foto ?? p.photo ?? null;
  let services = p.servicios ?? p.services ?? [];
  if (typeof services === 'string') services = services.split(',').map(s=>s.trim()).filter(Boolean);

  return {
    id: String(p.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2)),
    name, phone, category: cat, town, services, bio, photo
  };
}
const dedupeSorted = arr => [...new Set(arr.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es',{sensitivity:'base'}));

/* ======== Carga JSON (Apps Script) ======== */
async function loadDB() {
  const url = REMOTE_JSON_URL + '?t=' + Date.now();
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  if (json.error) throw new Error(json.error);

  const pros = (json.pros || []).map(unifyPro);
  const categories = dedupeSorted(json.categories?.length ? json.categories : pros.map(p=>p.category).concat(FALLBACK_CATEGORIES));
  const towns      = dedupeSorted(json.towns?.length ? json.towns : pros.map(p=>p.town).concat(PR_TOWNS));

  DB = { version: Number(json.version||1), updatedAt: json.updatedAt || new Date().toISOString(), categories, towns, pros };

  console.info('DB loaded:', { total: pros.length, categories: categories.length, towns: towns.length });
  console.table(pros.map(p => ({ name:p.name, phone:p.phone, category:p.category, town:p.town })));
}

/* ======== UI base ======== */
function initUI(){
  const yearEl = $('year'); if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Admin visible si hay sesión
  const adminOn = sessionStorage.getItem('sp_admin') === '1';
  $('adminBar')?.classList.toggle('hidden', !adminOn);
  $('btnLogin')?.classList.toggle('hidden', adminOn);

  // selects
  const catSel = $('fCategory'); const townSel = $('fTown');
  if (catSel) {
    catSel.innerHTML = '<option value="">Todas las categorías</option>' + DB.categories.map(c=>`<option>${c}</option>`).join('');
  }
  if (townSel) {
    townSel.innerHTML = '<option value="">Todos los pueblos</option>' + DB.towns.map(t=>`<option>${t}</option>`).join('');
  }

  // datalist para el input de texto
  ensureDatalist();

  // primer render
  applyFilters();
}

/* datalist de términos sugeridos */
function ensureDatalist(){
  const input = $('fQuery'); if (!input) return;
  let list = document.getElementById('qopts');
  if (!list){ list = document.createElement('datalist'); list.id='qopts'; document.body.appendChild(list); }
  input.setAttribute('list','qopts');

  const opts = new Set();
  DB.pros.forEach(p=>{
    if (p.name) opts.add(p.name);
    if (p.category) opts.add(p.category);
    if (p.town) opts.add(p.town);
    (p.services||[]).forEach(s=>opts.add(s));
  });
  DB.categories.forEach(c=>opts.add(c));
  DB.towns.forEach(t=>opts.add(t));
  list.innerHTML = [...opts].slice(0,800).map(v=>`<option value="${v}">`).join('');
}

/* ======== Filtros y render ======== */
function applyFilters(){
  const cat  = $('fCategory')?.value || '';
  const town = $('fTown')?.value || '';
  const q    = norm($('fQuery')?.value || '');

  let list = DB.pros.slice();
  if (cat)  list = list.filter(p => p.category === cat);
  if (town) list = list.filter(p => p.town === town);
  if (q) {
    list = list.filter(p => {
      const txt = [p.name, p.category, p.town, p.bio, ...(p.services||[])].join(' ');
      return norm(txt).includes(q);
    });
  }
  renderResults(list);
}

function renderResults(list){
  const wrap = $('results');
  const counter = $('resultCount');
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
      ${sessionStorage.getItem('sp_admin')==='1' ? `<button class="btn outline full" data-edit="${p.id}">Editar</button>` : ``}
    `;
    wrap.append(el);
  });

  // contador corregido
  if (counter) counter.textContent = `${list.length} ${list.length===1?'encontrado':'encontrados'}`;

  // acciones editar (solo admin)
  if (sessionStorage.getItem('sp_admin')==='1'){
    wrap.querySelectorAll('[data-edit]').forEach(b=>{
      b.addEventListener('click', ()=> editPro(b.dataset.edit));
    });
  }
}

/* ======== Edición simple (memoria) ======== */
function editPro(id){
  const p = DB.pros.find(x=>String(x.id)===String(id));
  if (!p) return alert('No encontrado');
  const name = prompt('Nombre:', p.name) ?? p.name;
  const phone = prompt('Teléfono:', p.phone) ?? p.phone;
  const category = prompt('Categoría:', p.category) ?? p.category;
  const town = prompt('Pueblo:', p.town) ?? p.town;
  const services = prompt('Servicios (coma separada):', (p.services||[]).join(', ')) ?? (p.services||[]).join(', ');
  const bio = prompt('Descripción:', p.bio||'') ?? p.bio;
  Object.assign(p, { name, phone, category, town, services: services.split(',').map(s=>s.trim()).filter(Boolean), bio });
  applyFilters();
  alert('Cambios en memoria. Exporta JSON y súbelo a tu origen si quieres publicarlos.');
}

/* ======== Admin: login / importar / exportar / logo ======== */
async function sha256(s){
  const enc = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

function setupAdminActions(){
  // Login modal
  $('btnLogin')?.addEventListener('click', ()=> $('dlgLogin')?.showModal());
  $('loginForm')?.addEventListener('submit', async (ev)=>{
    if (ev.submitter?.value !== 'login') return;
    ev.preventDefault();
    const pass = $('inpPass').value.trim();
    const ok = await sha256(pass) === await sha256(ADMIN_PASSWORD);
    if (!ok) return alert('Contraseña incorrecta');
    sessionStorage.setItem('sp_admin','1');
    $('dlgLogin')?.close();
    initUI();
  });
  $('btnLogout')?.addEventListener('click', ()=>{
    sessionStorage.removeItem('sp_admin');
    initUI();
  });

  // Exportar
  $('btnExport')?.addEventListener('click', ()=>{
    const pretty = JSON.stringify(DB, null, 2);
    const blob = new Blob([pretty], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'data.json';
    document.body.appendChild(a); a.click(); a.remove();
  });

  // Importar
  const fileImport = $('fileImport');
  $('btnImport')?.addEventListener('click', ()=> fileImport?.click());
  fileImport?.addEventListener('change', async (e)=>{
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const json = JSON.parse(await f.text());
      // Normalizamos y reemplazamos DB en memoria
      const pros = (json.pros||[]).map(unifyPro);
      const categories = dedupeSorted(json.categories?.length ? json.categories : pros.map(p=>p.category).concat(FALLBACK_CATEGORIES));
      const towns      = dedupeSorted(json.towns?.length ? json.towns : pros.map(p=>p.town).concat(PR_TOWNS));
      DB = { version:Number(json.version||1), updatedAt:json.updatedAt||new Date().toISOString(), categories, towns, pros };
      initUI();
      alert('JSON importado localmente. Si te gusta, exporta y súbelo a tu origen.');
    } catch { alert('JSON inválido'); }
    fileImport.value = '';
  });

  // Cambiar logo (local, vista previa)
  const fileLogo = $('fileLogo');
  $('btnLogo')?.addEventListener('click', ()=> fileLogo?.click());
  fileLogo?.addEventListener('change', (e)=>{
    const f = e.target.files?.[0]; if (!f) return;
    $('logoImg').src = URL.createObjectURL(f);
  });
}

/* ======== Eventos ======== */
function setupFilters(){
  const debounce = (fn, ms=220)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms);} };
  $('filterBtn')?.addEventListener('click', applyFilters);
  $('clearBtn')?.addEventListener('click', ()=>{ if($('fCategory'))$('fCategory').value=''; if($('fTown'))$('fTown').value=''; if($('fQuery'))$('fQuery').value=''; applyFilters(); });
  $('fQuery')?.addEventListener('input', debounce(applyFilters,200));
  $('fQuery')?.addEventListener('keyup', e=>{ if(e.key==='Enter') applyFilters(); });
  $('fCategory')?.addEventListener('change', applyFilters);
  $('fTown')?.addEventListener('change', applyFilters);
}

/* ======== Init ======== */
document.addEventListener('DOMContentLoaded', async ()=>{
  try { await loadDB(); }
  catch (e) {
    console.error('No pude leer datos del Sheet:', e);
    // sin alertas: UI seguirá con fallbacks para que puedas probar
    DB = { version:1, updatedAt:new Date().toISOString(), categories:FALLBACK_CATEGORIES, towns:PR_TOWNS, pros:[] };
  }
  initUI();
  setupFilters();
  setupAdminActions();
});
