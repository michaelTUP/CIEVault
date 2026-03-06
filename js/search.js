/**
 * search.js — Document search, filter, and sort
 */

const activeFilters = {
  query:"", office:"", type:"", tags:[], dateFrom:"", dateTo:""
};

let sortState = { col:"dateAdded", dir:"desc" };

// ── Apply all filters ────────────────────────────────────
function applyFilters() {
  const user = getCurrentUser();
  const q    = activeFilters.query.toLowerCase().trim();
  const { office, type, tags, dateFrom, dateTo } = activeFilters;
  const from = dateFrom ? new Date(dateFrom) : null;
  const to   = dateTo   ? new Date(dateTo)   : null;

  filteredDocs = allDocuments.filter(doc => {
    if (!canViewDoc(doc, user)) return false;

    if (q) {
      const hay = [
        doc.subject, doc.fileName, doc.notes,
        ...(doc.offices||[]),
        ...(doc.tags||[]),
        ...(doc.peopleInvolvedNames||[]),
        doc.uploadedByName, doc.version
      ].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }

    if (office && !(doc.offices||[]).includes(office)) return false;
    if (type   && doc.fileType !== type)                return false;

    // Tags: doc must have ALL selected tags
    if (tags.length) {
      const docTags = doc.tags || [];
      if (!tags.some(t => docTags.includes(t))) return false;
    }

    if (from || to) {
      const d = doc.dateCreated ? new Date(doc.dateCreated) : null;
      if (!d) return false;
      if (from && d < from) return false;
      if (to   && d > to)   return false;
    }

    return true;
  });

  filteredDocs.sort((a, b) => {
    let av = a[sortState.col]||"", bv = b[sortState.col]||"";
    if (av?.toDate) av = av.toDate().getTime();
    if (bv?.toDate) bv = bv.toDate().getTime();
    if (typeof av === "string") av = av.toLowerCase();
    if (typeof bv === "string") bv = bv.toLowerCase();
    if (av < bv) return sortState.dir==="asc" ? -1 :  1;
    if (av > bv) return sortState.dir==="asc" ?  1 : -1;
    return 0;
  });

  renderDocumentTable(filteredDocs);
  renderFilterPills();
}

// ── Filter pills ─────────────────────────────────────────
function renderFilterPills() {
  const wrap = document.getElementById("activeFilterPills");
  if (!wrap) return;
  const pills = [];
  if (activeFilters.query)    pills.push({ label:`"${activeFilters.query}"`,       key:"query"    });
  if (activeFilters.office)   pills.push({ label:`Office: ${activeFilters.office}`,key:"office"   });
  if (activeFilters.type)     pills.push({ label:`Type: ${activeFilters.type}`,    key:"type"     });
  if (activeFilters.dateFrom) pills.push({ label:`From: ${activeFilters.dateFrom}`,key:"dateFrom" });
  if (activeFilters.dateTo)   pills.push({ label:`To: ${activeFilters.dateTo}`,    key:"dateTo"   });
  // One pill per selected tag
  activeFilters.tags.forEach(t =>
    pills.push({ label:`Tag: ${t}`, key:`tag:${t}` })
  );

  wrap.innerHTML = pills.map(p=>`
    <button class="filter-pill-active" onclick="clearFilter('${p.key}')">
      ${escapeHtml(p.label)} <i class="fa-solid fa-xmark ms-1"></i>
    </button>`).join("");

  const clrBtn = document.getElementById("clearAllFiltersBtn");
  if (clrBtn) clrBtn.style.display = pills.length > 1 ? "inline-flex" : "none";
}

function clearFilter(key) {
  if (key.startsWith("tag:")) {
    const tag = key.slice(4);
    activeFilters.tags = activeFilters.tags.filter(t => t !== tag);
    // Uncheck the checkbox
    const cb = document.querySelector(`#tagFilterOptions input[data-tag="${CSS.escape(tag)}"]`);
    if (cb) cb.checked = false;
    updateTagFilterLabel();
  } else {
    activeFilters[key] = key === "tags" ? [] : "";
    const ids = { query:"searchInput", office:"filterOffice", type:"filterType",
                  dateFrom:"filterDateFrom", dateTo:"filterDateTo" };
    const el = document.getElementById(ids[key]);
    if (el) el.value = "";
  }
  applyFilters();
}

function clearAllFilters() {
  activeFilters.query = ""; activeFilters.office = "";
  activeFilters.type  = ""; activeFilters.tags   = [];
  activeFilters.dateFrom = ""; activeFilters.dateTo = "";
  ["searchInput","filterOffice","filterType","filterDateFrom","filterDateTo"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  // Uncheck all tag checkboxes
  document.querySelectorAll("#tagFilterOptions input[type='checkbox']")
    .forEach(cb => cb.checked = false);
  updateTagFilterLabel();
  applyFilters();
}

// ── Tag filter dropdown ───────────────────────────────────
function buildTagFilterOptions() {
  const wrap = document.getElementById("tagFilterOptions");
  if (!wrap) return;
  if (!allTags || !allTags.length) {
    wrap.innerHTML = `<div class="text-muted small p-2">No tags available.</div>`;
    return;
  }
  wrap.innerHTML = allTags.map(t => `
    <label class="tag-filter-option" data-name="${escapeHtml(t.name)}">
      <input type="checkbox" data-tag="${escapeHtml(t.name)}"
             onchange="onTagFilterChange(this)" />
      <span class="tag-pill">${escapeHtml(t.name)}</span>
    </label>`).join("");
}

function filterTagOptions(q) {
  document.querySelectorAll("#tagFilterOptions .tag-filter-option").forEach(el => {
    el.style.display = el.dataset.name.includes(q.toLowerCase()) ? "" : "none";
  });
}

function onTagFilterChange(cb) {
  const tag = cb.dataset.tag;
  if (cb.checked) {
    if (!activeFilters.tags.includes(tag)) activeFilters.tags.push(tag);
  } else {
    activeFilters.tags = activeFilters.tags.filter(t => t !== tag);
  }
  updateTagFilterLabel();
  applyFilters();
}

function updateTagFilterLabel() {
  const label = document.getElementById("tagFilterLabel");
  if (!label) return;
  const count = activeFilters.tags.length;
  label.textContent = count === 0 ? "All Tags"
    : count === 1 ? activeFilters.tags[0]
    : `${count} tags selected`;
}

function toggleTagFilterDropdown() {
  const dd = document.getElementById("tagFilterDropdown");
  if (!dd) return;
  const isOpen = dd.style.display !== "none";
  dd.style.display = isOpen ? "none" : "block";
  if (!isOpen) buildTagFilterOptions();
}

// Close dropdown when clicking outside
document.addEventListener("click", e => {
  const wrap = document.getElementById("tagFilterWrap");
  if (wrap && !wrap.contains(e.target)) {
    const dd = document.getElementById("tagFilterDropdown");
    if (dd) dd.style.display = "none";
  }
});

function clearTagFilter() {
  activeFilters.tags = [];
  document.querySelectorAll("#tagFilterOptions input[type='checkbox']")
    .forEach(cb => cb.checked = false);
  updateTagFilterLabel();
  applyFilters();
}

// ── Column sort ───────────────────────────────────────────
function sortDocuments(col) {
  sortState.dir = (sortState.col===col && sortState.dir==="asc") ? "desc" : "asc";
  sortState.col = col;
  document.querySelectorAll(".sortable").forEach(th => {
    th.classList.remove("sort-asc","sort-desc");
    if (th.dataset.col===col) th.classList.add("sort-"+sortState.dir);
  });
  applyFilters();
}

// ── Wire up listeners ─────────────────────────────────────
function initSearchListeners() {
  const bind = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    const handler = debounce(e => { activeFilters[key]=e.target.value; applyFilters(); });
    el.addEventListener("input",  handler);
    el.addEventListener("change", e => { activeFilters[key]=e.target.value; applyFilters(); });
  };
  bind("searchInput",    "query");
  bind("filterOffice",   "office");
  bind("filterType",     "type");
  bind("filterDateFrom", "dateFrom");
  bind("filterDateTo",   "dateTo");

  document.querySelectorAll(".sortable").forEach(th =>
    th.addEventListener("click", () => sortDocuments(th.dataset.col))
  );
  document.getElementById("clearAllFiltersBtn")?.addEventListener("click", clearAllFilters);
}
