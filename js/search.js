/**
 * search.js — Document search, filter, and sort
 */

const activeFilters = {
  query:"", office:"", type:"", tag:"", visibility:"", dateFrom:"", dateTo:""
};

let sortState = { col:"dateAdded", dir:"desc" };

// ── Apply all filters ────────────────────────────────────
function applyFilters() {
  const user = getCurrentUser();
  const q    = activeFilters.query.toLowerCase().trim();
  const { office, type, tag, visibility, dateFrom, dateTo } = activeFilters;
  const from = dateFrom ? new Date(dateFrom) : null;
  const to   = dateTo   ? new Date(dateTo)   : null;

  filteredDocs = allDocuments.filter(doc => {
    // Access control — skip docs user can't see
    if (!canViewDoc(doc, user)) return false;

    // Full-text search
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
    if (tag    && !(doc.tags||[]).includes(tag))         return false;
    if (visibility && doc.visibility !== visibility)     return false;

    if (from || to) {
      const d = doc.dateCreated ? new Date(doc.dateCreated) : null;
      if (!d) return false;
      if (from && d < from) return false;
      if (to   && d > to)   return false;
    }

    return true;
  });

  // Apply sort
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

// ── Active filter pills ───────────────────────────────────
function renderFilterPills() {
  const wrap = document.getElementById("activeFilterPills");
  if (!wrap) return;
  const pills = [];
  if (activeFilters.query)      pills.push({ label:`"${activeFilters.query}"`,      key:"query"      });
  if (activeFilters.office)     pills.push({ label:`Office: ${activeFilters.office}`,key:"office"    });
  if (activeFilters.type)       pills.push({ label:`Type: ${activeFilters.type}`,   key:"type"       });
  if (activeFilters.tag)        pills.push({ label:`Tag: ${activeFilters.tag}`,     key:"tag"        });
  if (activeFilters.visibility) pills.push({ label:activeFilters.visibility,         key:"visibility" });
  if (activeFilters.dateFrom)   pills.push({ label:`From: ${activeFilters.dateFrom}`,key:"dateFrom"  });
  if (activeFilters.dateTo)     pills.push({ label:`To: ${activeFilters.dateTo}`,   key:"dateTo"     });

  wrap.innerHTML = pills.map(p=>`
    <button class="filter-pill-active" onclick="clearFilter('${p.key}')">
      ${escapeHtml(p.label)} <i class="fa-solid fa-xmark ms-1"></i>
    </button>`).join("");

  const clrBtn = document.getElementById("clearAllFiltersBtn");
  if (clrBtn) clrBtn.style.display = pills.length>1 ? "inline-flex" : "none";
}

function clearFilter(key) {
  activeFilters[key] = "";
  const ids = { query:"searchInput", office:"filterOffice", type:"filterType",
                tag:"filterTag", visibility:"filterVisibility",
                dateFrom:"filterDateFrom", dateTo:"filterDateTo" };
  const el = document.getElementById(ids[key]);
  if (el) el.value = "";
  applyFilters();
}

function clearAllFilters() {
  Object.keys(activeFilters).forEach(k => activeFilters[k]="");
  ["searchInput","filterOffice","filterType","filterTag",
   "filterVisibility","filterDateFrom","filterDateTo"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
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
  bind("searchInput",       "query");
  bind("filterOffice",      "office");
  bind("filterType",        "type");
  bind("filterTag",         "tag");
  bind("filterVisibility",  "visibility");
  bind("filterDateFrom",    "dateFrom");
  bind("filterDateTo",      "dateTo");

  document.querySelectorAll(".sortable").forEach(th =>
    th.addEventListener("click", () => sortDocuments(th.dataset.col))
  );
  document.getElementById("clearAllFiltersBtn")?.addEventListener("click", clearAllFilters);
}
