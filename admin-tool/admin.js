/** ====== CONFIG INICIAL ====== **/
const DEFAULT_ENDPOINT = 'https://corsproxy.io/?https://script.google.com/macros/s/AKfycbxcrTp7A9-BVT-sEUU-24rxpb8mvAbyik0lZsWfacK_F7myl_dZ7sZe9qj3SpegjBjY/exec';
const DEFAULT_PASS     = '132115';

const KEY_ENDPOINT = 'admin.endpoint';
const KEY_PASS     = 'admin.pass';
const KEY_DB       = 'work.db';     // base local de profesionales
const KEY_CFG      = 'work.cfg';    // config de fondo

let ENDPOINT = localStorage.getItem(KEY_ENDPOINT) || DEFAULT_ENDPOINT;
let DB  = { items: [] }; // cada item: {nombre, telefono, categoria, pueblo, servicios[], descripcion, foto, whatsapp, activo}
let CFG = { bg_mode:'single', bg_urls:'', bg_opacity:0.35, bg_blur:4 };

/** ====== Utils ====== */
const $=(q)=>document.querySelector(q);
const el=(t,c)=>{const n=document.createElement(t); if(c) n.className=c; return n;};
function saveLocal(){ localStorage.setItem(KEY_DB,JSON.stringify(DB)); localStorage.setItem(KEY_CFG,JSON.stringify(CFG)); }
function loadLocal(){ try{DB=JSON.parse(localStorage.getItem(KEY_DB))||DB;}catch{} try{CFG=JSON.parse(localStorage.getItem(KEY_CFG))||CFG;}catch{} }
function setEndpoint(v){ ENDPOINT=v.trim(); localStorage.setItem(KEY_ENDPOINT,ENDPOINT); }
function isAuthed(){ const pass=localStorage.getItem(KEY_PASS)||DEFAULT_PASS; return sessionStorage.getItem('admin.authed')==='1'||false; }
function doLogin(){
  const input=$("#adminPass").value.trim();
  const pass=localStorage.getItem(KEY_PASS)||DEFAULT_PASS;
  if(input===pass){
    sessionStorage.setItem('admin.authed','1');
    $("#loginBox").classList.add('hidden');
    $("#panel").classList.remove('hidden');
    initPanel();
  }else alert('Contraseña incorrecta');
}

/** ====== TABS ====== */
function bindTabs(){
  document.querySelectorAll(".tab").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
      document.querySelectorAll(".tabpane").forEach(p=>p.classList.add("hidden"));
      btn.classList.add("active");
      document.querySelector(`.tabpane[data-pane="${btn.dataset.tab}"]`).classList.remove("hidden");
    });
  });
}

/** ====== CRUD ====== */
function blankForm(){
  $("#p_nombre").value="";
  $("#p_telefono").value="";
  $("#p_categoria").value="";
  $("#p_pueblo").value="";
  $("#p_whatsapp").value="";
  $("#p_foto").value="";
  $("#p_activo").value="";
  $("#p_servicios").value="";
  $("#p_descripcion").value="";
  $("#btnAdd").dataset.editing="";
}
function onEdit(e){
  const i = parseInt(e.target.dataset.idx,10);
  const it = DB.items[i];
  if(!it) return;
  $("#p_nombre").value=it.nombre||"";
  $("#p_telefono").value=it.telefono||"";
  $("#p_categoria").value=it.categoria||"";
  $("#p_pueblo").value=it.pueblo||"";
  $("#p_whatsapp").value=it.whatsapp||"";
  $("#p_foto").value=it.foto||"";
  $("#p_activo").value=it.activo||"";
  $("#p_servicios").value=(it.servicios||[]).join(", ");
  $("#p_descripcion").value=it.descripcion||"";
  $("#btnAdd").dataset.editing=i;
  window.scrollTo({top:0,behavior:"smooth"});
}
function onDel(e){
  const i = parseInt(e.target.dataset.idx,10);
  if(confirm("Eliminar este registro?")){
    DB.items.splice(i,1); saveLocal(); renderList();
  }
}
function rowCard(it, idx){
  const card = el("div","item");
  const servicios = (it.servicios||[]).join(", ");
  card.innerHTML = `
    <b>${it.nombre||""}</b>
    <span class="muted">${it.categoria||""} • ${it.pueblo||""}</span>
    <span class="muted">Tel: ${it.telefono||"-"} · WhatsApp: ${it.whatsapp||"-"} · Activo: ${it.activo||""}</span>
    ${servicios? `<span class="muted">Servicios: ${servicios}</span>`:""}
    ${it.descripcion? `<span class="muted">${it.descripcion}</span>`:""}
    ${it.foto? `<span class="muted">Foto: ${it.foto}</span>`:""}
    <div class="row" style="margin-top:8px">
      <button class="btn" data-idx="${idx}" data-act="edit">Editar</button>
      <button class="btn outline" data-idx="${idx}" data-act="del">Eliminar</button>
    </div>
  `;
  return card;
}
function renderList(){
  const q = ($("#q").value||"").toLowerCase();
  const cont = $("#list"); cont.innerHTML="";
  const filtered = DB.items.filter(it=>{
    const blob = `${it.nombre} ${it.categoria} ${it.pueblo} ${(it.servicios||[]).join(" ")} ${it.descripcion||""}`.toLowerCase();
    return !q || blob.includes(q);
  });
  $("#count").textContent = filtered.length + " resultados";
  filtered.forEach((it,i)=> cont.appendChild(rowCard(it,i)));
  cont.querySelectorAll("[data-act='edit']").forEach(b=> b.addEventListener("click", onEdit));
  cont.querySelectorAll("[data-act='del']").forEach(b=> b.addEventListener("click", onDel));
}
function bindCrud(){
  $("#btnAdd").addEventListener("click", ()=>{
    const item = {
      nombre: $("#p_nombre").value.trim(),
      telefono: $("#p_telefono").value.trim(),
      categoria: $("#p_categoria").value.trim(),
      pueblo: $("#p_pueblo").value.trim(),
      whatsapp: $("#p_whatsapp").value.trim(),
      foto: $("#p_foto").value.trim(),
      activo: $("#p_activo").value.trim(),
      servicios: $("#p_servicios").value.split(",").map(s=>s.trim()).filter(Boolean),
      descripcion: $("#p_descripcion").value.trim()
    };
    const idx = $("#btnAdd").dataset.editing;
    if(idx){ DB.items[parseInt(idx,10)] = item; }
    else { DB.items.push(item); }
    saveLocal(); renderList(); if(!idx) blankForm();
    alert("Guardado en base local. Usa ‘Subir SOLO profesionales’ para enviar a Sheets.");
  });
  $("#btnNew").addEventListener("click", blankForm);
  $("#btnSearch").addEventListener("click", renderList);
  $("#btnReset").addEventListener("click", ()=>{ $("#q").value=""; renderList(); });
}

/** ====== SYNC con Apps Script ====== */
async function pullFromSheets(){
  if(!ENDPOINT) return alert("Configura el endpoint en la pestaña Config.");
  try{
    const r = await fetch(ENDPOINT + "?action=read", {method:"GET", cache:"no-store"});
    const j = await r.json();
    if(!j.ok) throw new Error(j.error||"Error leyendo");
    // j.items usa nombres normalizados (ver Code.gs que te di)
    const items = Array.isArray(j.items)? j.items : [];
    DB.items = items.map(it=>({
      nombre:it.nombre||"", telefono:it.telefono||"", categoria:it.categoria||"", pueblo:it.pueblo||"",
      servicios:Array.isArray(it.servicios)? it.servicios : String(it.servicios||"").split(",").map(s=>s.trim()).filter(Boolean),
      descripcion:it.descripcion||"", foto:it.foto||"", whatsapp:it.whatsapp||"", activo:it.activo||""
    }));
    CFG = j.config || CFG;
    saveLocal(); bindBg(); renderList();
    alert("Cargado desde Sheets.");
  }catch(err){ alert("Error: "+err.message); }
}
async function pushItems(){
  if(!ENDPOINT) return alert("Configura el endpoint en la pestaña Config.");
  try{
    const r = await fetch(ENDPOINT, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action:"save_items", items: DB.items })
    });
    const j = await r.json();
    if(!j.ok) throw new Error(j.error||"Error guardando");
    alert("Profesionales actualizados en Sheets.");
  }catch(err){ alert("Error: "+err.message); }
}
async function pushAll(){
  if(!ENDPOINT) return alert("Configura el endpoint en la pestaña Config.");
  try{
    const r = await fetch(ENDPOINT, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action:"save_all", items: DB.items, config: CFG })
    });
    const j = await r.json();
    if(!j.ok) throw new Error(j.error||"Error guardando");
    alert("Profesionales + Fondo actualizados en Sheets.");
  }catch(err){ alert("Error: "+err.message); }
}

/** ====== FONDO ====== */
function renderPreview(){
  const box = $("#bgPreview");
  box.innerHTML = "";
  const urls = (CFG.bg_urls||"").split(",").map(s=>s.trim()).filter(Boolean);
  const add = (u,i)=>{
    const d = el("div","bgLayer");
    d.style.opacity = CFG.bg_opacity;
    d.style.filter  = `blur(${CFG.bg_blur}px)`;
    d.style.backgroundImage = u?`url("${u}")`:'none';
    d.style.backgroundPosition = `${(i*37)%100}% center`;
    box.appendChild(d);
  };
  if(CFG.bg_mode==="single") add(urls[0]||"",0); else urls.forEach(add);
}
function bindBg(){
  const mode=$("#bgMode"), urls=$("#bgUrls"), op=$("#bgOpacity"), bl=$("#bgBlur"), opV=$("#bgOpacityVal"), blV=$("#bgBlurVal");
  mode.value = CFG.bg_mode;
  urls.value = CFG.bg_urls;
  op.value   = CFG.bg_opacity;
  bl.value   = CFG.bg_blur;
  opV.textContent = CFG.bg_opacity;
  blV.textContent = CFG.bg_blur+"px";

  mode.addEventListener("change", ()=>{ CFG.bg_mode=mode.value; renderPreview(); saveLocal(); });
  urls.addEventListener("input", ()=>{ CFG.bg_urls = urls.value.trim(); });
  op.addEventListener("input", ()=>{ CFG.bg_opacity=parseFloat(op.value); opV.textContent=CFG.bg_opacity; renderPreview(); saveLocal(); });
  bl.addEventListener("input", ()=>{ CFG.bg_blur=parseInt(bl.value,10); blV.textContent=CFG.bg_blur+"px"; renderPreview(); saveLocal(); });

  $("#btnPreviewBg").addEventListener("click", renderPreview);
  $("#btnSaveCfg").addEventListener("click", saveConfigToSheets);

  renderPreview();
}
async function saveConfigToSheets(){
  if(!ENDPOINT) return alert("Configura el endpoint en la pestaña Config.");
  try{
    const r = await fetch(ENDPOINT, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action:"save_config", config: CFG })
    });
    const j = await r.json();
    if(!j.ok) throw new Error(j.error||"Error guardando config");
    alert("Configuración de fondo guardada en Sheets.");
  }catch(err){ alert("Error: "+err.message); }
}

/** ====== CONFIG PESTAÑA ====== */
function bindConfig(){
  $("#endpoint").value = ENDPOINT;
  $("#btnSaveEndpoint").addEventListener("click", ()=>{
    const v = $("#endpoint").value.trim();
    if(!v) return alert("Pega tu URL /exec de Apps Script");
    setEndpoint(v); alert("Endpoint guardado.");
  });
  $("#btnChangePass").addEventListener("click", ()=>{
    const v = $("#newPass").value.trim();
    if(v.length<4) return alert("Mínimo 4 caracteres.");
    localStorage.setItem(KEY_PASS, v);
    $("#newPass").value="";
    alert("Contraseña actualizada en este navegador.");
  });
  $("#btnLogout").addEventListener("click", ()=>{
    sessionStorage.removeItem("admin.authed");
    location.reload();
  });
}

/** ====== INIT ====== */
function bindSync(){
  $("#btnPull").addEventListener("click", pullFromSheets);
  $("#btnPushItems").addEventListener("click", pushItems);
  $("#btnPushAll").addEventListener("click", pushAll);
}
function initPanel(){
  bindTabs();
  loadLocal();
  bindCrud();
  bindBg();
  bindConfig();
  bindSync();
  renderList();
}
function boot(){
  $("#btnLogin").addEventListener("click", doLogin);
  if(isAuthed()){
    $("#loginBox").classList.add("hidden");
    $("#panel").classList.remove("hidden");
    initPanel();
  }
}
document.addEventListener("DOMContentLoaded", boot);
