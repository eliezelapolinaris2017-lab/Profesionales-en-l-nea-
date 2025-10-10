/* ======== CONFIG ======== */
// Tu Apps Script /exec (el que me diste)
const REMOTE_JSON_URL = 'https://script.google.com/macros/s/AKfycbzQyHuDMsJAciqIb8Mm96Jt-k7xH8JxzR6z7Vn91xVxXmfukYyhqxBN26BncYPJHXsQ/exec';

// Contraseña admin (solo cliente, se compara por hash)
const ADMIN_PASSWORD = '132115';

/* ======== Fallbacks ======== */
const FALLBACK_CATEGORIES = [
  'Mecánica Automotriz','Aire Acondicionado Residencial','Aire Acondicionado Comercial',
  'Aire Acondicionado Automotriz','Pintor','Handy Man','Electricista','Plomería','Contratista'
];

// 78 municipios PR
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

function extractDriveId(urlOrId) {
  if (!urlOrId) return null;
  const m = String(urlOrId).match(/[-\w]{25,}/);
  return m ? m[0] : null;
}
function toEmbedUrl(urlOrId) {
  const id = extractDriveId(urlOrId);
  return id ? `https://drive.google.com/uc?export=view&id=${id}` : null;
}

/* Precarga una imagen. Resuelve si carga; rechaza si falla. */
function preloadImage(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => { img.src=''; reject(new Error('timeout loading image')); }, timeoutMs);
    img.onload = () => { clearTimeout(timer); resolve(true); };
    img.onerror = () => { clearTimeout(timer); reject(new Error('error loading image')); };
    img.referrerPolicy = 'no-referrer';
    img.decoding = 'async';
    img.loading = 'lazy';
    img.src = url;
  });
}

/* Normaliza un registro a la estructura interna de la UI */
function unifyPro(p) {
  // Mapea tus columnas reales (según hoja "pros")
  // Nombre, Telefono, Categoria, Pueblo, Servicios, Descripcion, Foto, Whatsapp
  const name  = p.Nombre ?? p.nombre ?? p.name ?? '';
  const phone = p.Telefono ?? p.telefono ?? p.phone ?? '';
  const cat   = p.Categoria ?? p.categoria ?? p.category ?? '';
  const town  = p.Pueblo ?? p.pueblo ?? p.town ?? '';
  let services = p.Servicios ?? p.servicios ?? p.services ?? [];
  if (typeof services === 'string') {
    services = services.split(',').map(s=>s.trim()).filter(Boolean);
  }
  const bio   = p.Descripcion ?? p.descripcion ?? p.bio ?? '';

  // Foto: acepta URL o ID de Drive (convierte a uc?export=view)
  const photoRaw = p.Foto ?? p.foto ?? p.photo ?? null;
  const photo = photoRaw
    ? (/^https?:\/\//i.test(photoRaw) ? (toEmbedUrl(photoRaw) || photoRaw) : toEmbedUrl(photoRaw))
    : null;

  return {
    id: String(p.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2)),
    name, phone, category: cat, town, services, bio, photo
  };
}

const dedupeSorted = arr => [...new Set(arr.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es',{sensitivity:'base'}));

/* ======== Carga desde Apps Script (soporta 2 formatos de respuesta) ======== */
async function fetchJSON(url){
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function loadDB() {
  let data;
  try {
    // Preferimos el formato con action=read (Code.gs que te preparé)
    data = await fetchJSON(REMOTE_JSON_URL + '?action=read&t=' + Date.now());
  } catch {
    // Fallback: intenta sin action (si tu script entrega otro formato)
    data = await fetchJSON(REMOTE_JSON_URL + '?t=' + Date.now());
  }

  // Dos posibilidades de backend:
  // A) { ok:true, items:[...], config:{...} }
  // B) { pros:[...], categories:[], towns:[], ... }
  let prosRaw = [];
  let cfg = null;

  if (data && data.ok) {
    prosRaw = Array.isArray(data.items) ? data.items : [];
    cfg = data.config || null;
  } else if (Array.isArray(data?.pros)) {
    prosRaw = data.pros;
    // si trae config en otra clave, tratar de leerla
    cfg = data.config || null;
  } else {
    // si el script devuelve filas "planas" (array de objetos con tus columnas), úsalo tal cual
    if (Array.isArray(data)) {
      prosRaw = data;
    } else if (Array.isArray(data?.items)) {
      prosRaw = data.items;
    }
  }

  const pros = prosRaw.map(unifyPro);
  const categories = dedupeSorted(
    (data?.categories?.length ? data.categories : pros.map(p=>p.category)).concat(FALLBACK_CATEGORIES)
  );
  const towns = dedupeSorted(
    (data?.towns?.length ? data.towns : pros.map(p=>p.town)).concat(PR_TOWNS)
  );

  DB = {
    version: Number(data?.version || 1),
    updatedAt: data?.updatedAt || new Date().toISOString(),
    categories, towns, pros
  };

  // aplica fondo si existe config
  if (cfg) aplicarFondo(cfg);

  console.info('DB loaded:', { total: pros.length, categories: categories.length, towns: towns.length });
}

/* ======== Fondo dinámico (opcional si tu script devuelve config) ======== */
function aplicarFondo(cfg){
  const mode = cfg.bg_mode || 'single';
  const urls = String(cfg.bg_urls || '').split(',').map(s=>s.trim()).filter(Boolean);
  const op   = Number(cfg.bg_opacity ?? 0.35);
  const blur = Number(cfg.bg_blur ?? 4);

  let cont = document.getElementById('bgRoot');
  if(!cont){
    cont = document.createElement('div');
    cont.id = 'bgRoot';
    Object.assign(cont.style,{
      position:'fixed', inset:'0', zIndex:'-1', overflow:'hidden', pointerEvents:'none'
    });
    document.body.appendChild(cont);
  }
  cont.innerHTML = '';

  const mk = (u,i)=>{
    const d = document.createElement('div');
    Object.assign(d.style,{
      position:'absolute', inset:'0',
      backgroundImage: u?`url("${u}")`:'none',
      backgroundSize:'cover',
      backgroundPosition: `${(i*37)%100}% center`,
      filter:`blur(${blur}px)`, opacity: op
    });
    return d;
  };
  if(mode==='single'){ cont.appendChild(mk(urls[0]||'',0)); } else { urls.forEach((u,i)=>cont.appendChild(mk(u,i))); }
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

  ensureDatalist();
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

/* Render con precarga de imagen para evitar “icono roto” */
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
        <div class="avatar">${initials}</div>
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

    if (p.photo) {
      const url = p.photo;
      preloadImage(url).then(()=>{
        const avatar = el.querySelector('.avatar');
        if (avatar) {
          const img = new Image();
          img.alt = p.name || 'Foto';
          img.loading = 'lazy';
          img.decoding = 'async';
          img.referrerPolicy = 'no-referrer';
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'cover';
          img.style.borderRadius = '12px';
          img.src = url;
          avatar.innerHTML = '';
          avatar.appendChild(img);
        }
      }).catch(err=>{
        console.warn('[IMG] No se pudo cargar la foto para', p.name, url, err?.message || err);
      });
    }
  });

  if (counter) counter.textContent = `${list.length} ${list.length===1?'encontrado':'encontrados'}`;

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
  alert('Cambios en memoria. (Solo se guardan si exportas JSON y lo subes a tu origen).');
}

/* ======== Admin: login / importar / exportar / logo ======== */
async function sha256(s){
  const enc = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

function setupAdminActions(){
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

  // Exportar DB visible
  $('btnExport')?.addEventListener('click', ()=>{
    const pretty = JSON.stringify(DB, null, 2);
    const blob = new Blob([pretty], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'data.json';
    document.body.appendChild(a); a.click(); a.remove();
  });

  // Importar (solo reemplaza en memoria)
  const fileImport = $('fileImport');
  $('btnImport')?.addEventListener('click', ()=> fileImport?.click());
  fileImport?.addEventListener('change', async (e)=>{
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const json = JSON.parse(await f.text());
      const pros = (json.pros||[]).map(unifyPro);
      const categories = dedupeSorted(json.categories?.length ? json.categories : pros.map(p=>p.category).concat(FALLBACK_CATEGORIES));
      const towns      = dedupeSorted(json.towns?.length ? json.towns : pros.map(p=>p.town).concat(PR_TOWNS));
      DB = { version:Number(json.version||1), updatedAt:json.updatedAt||new Date().toISOString(), categories, towns, pros };
      initUI();
      alert('JSON importado (local).');
    } catch { alert('JSON inválido'); }
    fileImport.value = '';
  });

  // Logo local (preview)
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
  $('clearBtn')?.addEventListener('click', ()=>{
    if($('fCategory')) $('fCategory').value='';
    if($('fTown')) $('fTown').value='';
    if($('fQuery')) $('fQuery').value='';
    applyFilters();
  });
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
    DB = { version:1, updatedAt:new Date().toISOString(), categories:FALLBACK_CATEGORIES, towns:PR_TOWNS, pros:[] };
  }
  initUI();
  setupFilters();
  setupAdminActions();
});
