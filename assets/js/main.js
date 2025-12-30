/* The Renovator — main JS (static / GitHub Pages friendly) */

const CONFIG = {
  // Later: paste your Google Apps Script (or other) endpoint URL here.
  FORM_ENDPOINT_URL: ""
};

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

function formatTitle(rawId){
  // Turns "WallRemovalAfter1" -> "Wall Removal"
  const cleaned = rawId
    .replace(/(Before|After)\d+$/i, "")
    .replace(/\d+$/,"")
    .replace(/-/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  return cleaned || rawId;
}

function initNav(){
  const toggle = $(".navToggle");
  const nav = $(".nav");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("isOpen");
    toggle.setAttribute("aria-expanded", String(open));
  });

  // close menu when clicking a link (mobile)
  nav.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a) return;
    nav.classList.remove("isOpen");
    toggle.setAttribute("aria-expanded", "false");
  });

  // close on outside click
  document.addEventListener("click", (e) => {
    if (!nav.classList.contains("isOpen")) return;
    if (e.target.closest(".nav") || e.target.closest(".navToggle")) return;
    nav.classList.remove("isOpen");
    toggle.setAttribute("aria-expanded", "false");
  });
}

function setBgFromDataAttr(){
  const el = document.querySelector("[data-hero-photo]");
  if (!el) return;
  const id = el.getAttribute("data-hero-photo");
  el.style.backgroundImage = `url('assets/img/projects/full/${id}.jpg')`;
}

function initForm(){
  const form = $("#estimateForm");
  const status = $("#formStatus");
  if (!form || !status) return;

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    status.textContent = "";

    // HTML5 validity check
    if (!form.reportValidity()) return;

    const payload = {
      name: form.name.value.trim(),
      phone: form.phone.value.trim(),
      email: form.email.value.trim(),
      cityAddress: form.cityAddress.value.trim(),
      serviceType: form.serviceType.value,
      description: form.description.value.trim(),
      sourcePage: window.location.href,
      createdAt: new Date().toISOString(),
      company: (form.company?.value || "").trim() // honeypot
    };

    // Honeypot: silently accept
    if (payload.company) {
      form.reset();
      status.textContent = "Submitted.";
      return;
    }

    // If endpoint is not configured yet, save locally.
    if (!CONFIG.FORM_ENDPOINT_URL) {
      const key = "renovator_leads";
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      existing.push(payload);
      localStorage.setItem(key, JSON.stringify(existing));
      form.reset();
      status.textContent = "Saved (setup mode).";
      return;
    }

    // If endpoint is configured later, it will post here.
    try {
      const res = await fetch(CONFIG.FORM_ENDPOINT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      // If endpoint returns JSON, parse; otherwise just treat ok status as success
      let data = {};
      try { data = await res.json(); } catch (_) {}

      if (!res.ok || (data.ok === false)) {
        // Keep it silent (site is not published yet). Save locally as fallback.
        const key = "renovator_leads";
        const existing = JSON.parse(localStorage.getItem(key) || "[]");
        existing.push(payload);
        localStorage.setItem(key, JSON.stringify(existing));
      }

      form.reset();
      status.textContent = "Submitted.";
    } catch (_) {
      // Silent fallback
      const key = "renovator_leads";
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      existing.push(payload);
      localStorage.setItem(key, JSON.stringify(existing));
      form.reset();
      status.textContent = "Saved (setup mode).";
    }
  });
}

let GALLERY = {
  allTiles: [],
  filteredTiles: [],
  activeCategory: "All",
  activeIndex: 0
};

function buildTilesFromData(data){
  const tiles = [];

  // Before/after
  for (const pair of (data.beforeAfter || [])) {
    tiles.push({
      type: "pair",
      id: pair.id,
      category: pair.category,
      title: formatTitle(pair.id),
      thumb: pair.after.thumb,
      data: pair
    });
  }

  // Full remodel collections
  for (const col of (data.collections || [])) {
    const first = col.photos?.[0];
    if (!first) continue;
    tiles.push({
      type: "collection",
      id: col.id,
      category: col.category,
      title: col.id.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/(\d+)/, " $1"),
      thumb: first.thumb,
      count: col.photos.length,
      data: col
    });
  }

  // Singles
  for (const s of (data.singles || [])) {
    tiles.push({
      type: "single",
      id: s.id,
      category: s.category,
      title: formatTitle(s.id),
      thumb: s.thumb,
      data: s
    });
  }

  // Sort by category then title
  tiles.sort((a,b) => (a.category.localeCompare(b.category) || a.title.localeCompare(b.title)));
  return tiles;
}

function renderFilters(categories){
  const wrap = $("#galleryFilters");
  if (!wrap) return;
  wrap.innerHTML = "";

  const all = ["All", ...categories];
  for (const cat of all) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filterBtn" + (cat === "All" ? " isActive" : "");
    btn.textContent = cat;
    btn.dataset.category = cat;
    btn.addEventListener("click", () => {
      $$(".filterBtn", wrap).forEach(b => b.classList.toggle("isActive", b.dataset.category === cat));
      applyFilter(cat);
    });
    wrap.appendChild(btn);
  }
}

function applyFilter(cat){
  GALLERY.activeCategory = cat;
  if (cat === "All") {
    GALLERY.filteredTiles = [...GALLERY.allTiles];
  } else {
    GALLERY.filteredTiles = GALLERY.allTiles.filter(t => t.category === cat);
  }
  renderGrid();
}

function renderGrid(){
  const grid = $("#galleryGrid");
  if (!grid) return;
  grid.innerHTML = "";

  for (let i=0; i<GALLERY.filteredTiles.length; i++){
    const t = GALLERY.filteredTiles[i];

    const tile = document.createElement("div");
    tile.className = "tile";
    tile.tabIndex = 0;
    tile.setAttribute("role","button");
    tile.setAttribute("aria-label", `Open ${t.title}`);

    const img = document.createElement("div");
    img.className = "tile__img";
    img.style.backgroundImage = `url('${t.thumb}')`;

    if (t.type === "pair") {
      const badge = document.createElement("div");
      badge.className = "pairBadge";
      badge.textContent = "Before / After";
      tile.appendChild(badge);
    }
    if (t.type === "collection") {
      const badge = document.createElement("div");
      badge.className = "countBadge";
      badge.textContent = `${t.count} photos`;
      tile.appendChild(badge);
    }

    const meta = document.createElement("div");
    meta.className = "tile__meta";
    meta.innerHTML = `
      <div class="tile__title">${escapeHtml(t.title)}</div>
      <div class="tile__cat">${escapeHtml(t.category)}</div>
    `;

    tile.appendChild(img);
    tile.appendChild(meta);

    const open = () => openModal(i);
    tile.addEventListener("click", open);
    tile.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });

    grid.appendChild(tile);
  }
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    """:"&quot;",
    "'":"&#39;"
  }[m]));
}

/* Modal viewer */
function initModal(){
  const modal = $("#modal");
  const body = $("#modalBody");
  const prev = $("#modalPrev");
  const next = $("#modalNext");
  if (!modal || !body || !prev || !next) return;

  const closeEls = $$("[data-close]", modal);
  const close = () => {
    modal.classList.remove("isOpen");
    modal.setAttribute("aria-hidden", "true");
    body.innerHTML = "";
  };

  closeEls.forEach(el => el.addEventListener("click", close));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("isOpen")) close();
    if (!modal.classList.contains("isOpen")) return;
    if (e.key === "ArrowLeft") modalPrev();
    if (e.key === "ArrowRight") modalNext();
  });

  prev.addEventListener("click", () => modalPrev());
  next.addEventListener("click", () => modalNext());

  function modalPrev(){
    if (!GALLERY.filteredTiles.length) return;
    GALLERY.activeIndex = (GALLERY.activeIndex - 1 + GALLERY.filteredTiles.length) % GALLERY.filteredTiles.length;
    renderModal();
  }
  function modalNext(){
    if (!GALLERY.filteredTiles.length) return;
    GALLERY.activeIndex = (GALLERY.activeIndex + 1) % GALLERY.filteredTiles.length;
    renderModal();
  }

  window.openModal = (index) => {
    GALLERY.activeIndex = index;
    modal.classList.add("isOpen");
    modal.setAttribute("aria-hidden","false");
    renderModal();
  };

  function renderModal(){
    const t = GALLERY.filteredTiles[GALLERY.activeIndex];
    if (!t) return;

    const heading = `
      <div class="viewerTitle">
        <h3>${escapeHtml(t.title)}</h3>
        <div class="muted">${escapeHtml(t.category)}</div>
      </div>
    `;

    if (t.type === "pair") {
      const before = t.data.before;
      const after = t.data.after;
      body.innerHTML = `
        ${heading}
        <div class="viewerGrid2">
          <figure class="viewerFigure">
            <img loading="lazy" src="${before.src}" alt="${escapeHtml(t.title)} before" />
            <figcaption>Before</figcaption>
          </figure>
          <figure class="viewerFigure">
            <img loading="lazy" src="${after.src}" alt="${escapeHtml(t.title)} after" />
            <figcaption>After</figcaption>
          </figure>
        </div>
      `;
      return;
    }

    if (t.type === "collection") {
      const photos = t.data.photos || [];
      const current = photos[0];
      // Simple strip of thumbnails with clickable selection
      const thumbs = photos.map((p, idx) => `
        <button class="filterBtn ${idx===0?'isActive':''}" type="button" data-idx="${idx}" style="font-weight:850;">
          ${idx+1}
        </button>
      `).join("");

      body.innerHTML = `
        ${heading}
        <div class="viewerSingle">
          <img id="collectionMain" loading="lazy" src="${current.src}" alt="${escapeHtml(t.title)} photo 1" />
        </div>
        <div style="margin-top:12px; display:flex; flex-wrap:wrap; gap:8px;">
          ${thumbs}
        </div>
      `;

      const main = $("#collectionMain", body);
      $$(".filterBtn", body).forEach(btn => {
        btn.addEventListener("click", () => {
          $$(".filterBtn", body).forEach(b => b.classList.remove("isActive"));
          btn.classList.add("isActive");
          const idx = Number(btn.dataset.idx);
          const p = photos[idx];
          if (p && main) {
            main.src = p.src;
            main.alt = `${t.title} photo ${idx+1}`;
          }
        });
      });
      return;
    }

    // single
    body.innerHTML = `
      ${heading}
      <div class="viewerSingle">
        <img loading="lazy" src="${t.data.src}" alt="${escapeHtml(t.title)}" />
      </div>
    `;
  }
}

async function initGallery(){
  const filters = $("#galleryFilters");
  const grid = $("#galleryGrid");
  if (!filters || !grid) return;

  try{
    const res = await fetch("assets/data/gallery.json", { cache: "no-store" });
    const data = await res.json();

    const tiles = buildTilesFromData(data);
    GALLERY.allTiles = tiles;
    GALLERY.filteredTiles = [...tiles];

    renderFilters(data.categories || []);
    renderGrid();
  } catch (e){
    // If something goes wrong, fail silently (site in setup mode)
    grid.innerHTML = "<div class='muted'>Gallery loading is not configured yet.</div>";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  setBgFromDataAttr();
  initForm();
  initModal();
  initGallery();
});
