/* ========= CONFIG ========= */
const REMOTE_JSON_URL = "https://eliezelapolinaris2017-lab.github.io/Profesionales-en-l-nea-/data.json";
const LS_KEYS = ["sp_db_v1", "sp_logo_v1"]; // por si tu código viejo las usaba
const isAdmin = new URLSearchParams(location.search).get("admin") === "1";
let DB = { categories: [], towns: [], pros: [] };

/* ========= MODO SIN LOCALSTORAGE ========= */
// 1) Borrar lo viejo
try { LS_KEYS.forEach(k => localStorage.removeItem(k)); } catch {}
// 2) Bloquear reescrituras futuras en esas claves
(() => {
  const origSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function(k, v) {
    if (LS_KEYS.includes(k)) return; // ignorar escrituras a esas claves
    return origSet.apply(this, arguments);
  };
})();

/* ========= CARGA DIRECTA DEL JSON ========= */
async function loadDB() {
  const bust = "?t=" + Date.now(); // anti-caché
  const res = await fetch(REMOTE_JSON_URL + bust, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo descargar data.json");
  DB = await res.json();
}

/* ========= UI ========= */
function initUI(){
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const adminBar = document.getElementById("adminBar");
  if (adminBar) adminBar.classList.toggle("hidden", !isAdmin);

  const catSel = document.getElementById("fCategory");
  const townSel = document.getElementById("fTown");
  if (catSel) {
    catSel.innerHTML = '<option value="">Todas las categorías</option>';
    (DB.categories||[]).forEach(c => catSel.append(new Option(c, c)));
  }
  if (townSel) {
    townSel.innerHTML = '<option value="">Todos los pueblos</option>';
    (DB.towns||[]).forEach(t => townSel.append(new Option(t, t)));
  }

  applyFilters();
}

function applyFilters(){
  const cat  = document.getElementById("fCategory")?.value || "";
  const town = document.getElementById("fTown")?.value || "";
  const q    = (document.getElementById("fQuery")?.value || "").toLowerCase();

  let list = (DB.pros||[]).slice();
  if (cat)  list = list.filter(p => p.category === cat);
  if (town) list = list.filter(p => p.town === town);
  if (q)    list = list.filter(p =>
    (p.name||"").toLowerCase().includes(q) ||
    (p.bio||"").toLowerCase().includes(q)  ||
    (p.services||[]).join(" ").toLowerCase().includes(q)
  );

  renderResults(list);
}

function renderResults(list){
  const wrap = document.getElementById("results");
  const counter = document.getElementById("resultCount");
  if (counter) counter.textContent = `${list.length} encontrados`;
  if (!wrap) return;
  wrap.innerHTML = "";

  list.forEach(p => {
    const el = document.createElement("article");
    el.className = "card-pro";
    const initials = (p.name||"PRO").split(" ").map(w=>w[0]).join("").slice(0,3).toUpperCase();
    const phoneHTML = p.phone ? `<a href="tel:${p.phone}" class="pill">${p.phone}</a>` : "";
    el.innerHTML = `
      <div class="row">
        <div class="avatar">${p.photo ? `<img src="${p.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:12px">` : initials}</div>
        <div class="name">${p.name||""}</div>
        <span class="pill">${p.category||""}</span>
        <span class="pill">${p.town||""}</span>
        ${phoneHTML}
      </div>
      <div class="row" style="margin-top:8px;flex-wrap:wrap">
        ${(p.services||[]).map(s=>`<span class="tag">${s}</span>`).join("")}
      </div>
      ${p.bio ? `<p class="desc">${p.bio}</p>` : ""}
      ${isAdmin ? `<button class="btn outline full" data-edit="${p.id||""}">Editar</button>` : ``}
    `;
    wrap.append(el);
  });

  if (isAdmin){
    wrap.querySelectorAll("[data-edit]").forEach(btn=>{
      btn.addEventListener("click", ()=> editPro(btn.dataset.edit));
    });
  }
}

/* ========= EDICIÓN EN MEMORIA (solo admin) ========= */
function editPro(id){
  const p = DB.pros.find(x => String(x.id||"") === String(id));
  if (!p) return alert("Elemento no encontrado");
  const name = prompt("Nombre:", p.name || "") ?? p.name;
  const phone = prompt("Teléfono:", p.phone || "") ?? p.phone;
  const category = prompt("Categoría:", p.category || "") ?? p.category;
  const town = prompt("Pueblo:", p.town || "") ?? p.town;
  const services = prompt("Servicios (coma separada):", (p.services||[]).join(", ")) ?? (p.services||[]).join(", ");
  const bio = prompt("Descripción:", p.bio || "") ?? p.bio;

  Object.assign(p, {
    name, phone, category, town,
    services: (services||"").split(",").map(s=>s.trim()).filter(Boolean),
    bio
  });
  renderResults(DB.pros);
  alert("Cambios aplicados en memoria. Exporta JSON y súbelo al repo para publicar.");
}

/* ========= BOTONES ADMIN ========= */
function setupAdmin(){
  if (!isAdmin) return;

  // Exportar JSON
  document.getElementById("btnExport")?.addEventListener("click", ()=>{
    const pretty = JSON.stringify(DB, null, 2);
    const blob = new Blob([pretty], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "data.json";
    document.body.appendChild(a); a.click(); a.remove();
  });

  // Importar JSON (solo local/vista previa)
  const fileImport = document.getElementById("fileImport");
  document.getElementById("btnImport")?.addEventListener("click", ()=> fileImport?.click());
  fileImport?.addEventListener("change", async (e)=>{
    const f = e.target.files?.[0]; if (!f) return;
    try { DB = JSON.parse(await f.text()); initUI(); }
    catch { alert("JSON inválido"); }
    fileImport.value = "";
  });

  // Cambiar logo (solo visual/local)
  const fileLogo = document.getElementById("fileLogo");
  document.getElementById("btnLogo")?.addEventListener("click", ()=> fileLogo?.click());
  fileLogo?.addEventListener("change", (e)=>{
    const f = e.target.files?.[0]; if (!f) return;
    document.getElementById("logoImg").src = URL.createObjectURL(f);
  });
}

/* ========= INIT ========= */
document.addEventListener("DOMContentLoaded", async ()=>{
  try { await loadDB(); } catch(e){ console.error(e); }
  initUI();
  setupAdmin();

  document.getElementById("filterBtn")?.addEventListener("click", applyFilters);
  document.getElementById("clearBtn")?.addEventListener("click", ()=>{
    const c = document.getElementById("fCategory");
    const t = document.getElementById("fTown");
    const q = document.getElementById("fQuery");
    if (c) c.value = ""; if (t) t.value = ""; if (q) q.value = "";
    applyFilters();
  });
});
