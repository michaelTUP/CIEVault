/**
 * search.js — Search and filter logic for documents
 */

// ─────────────────────────────────────────────────────────
// Active filters state
// ─────────────────────────────────────────────────────────
const activeFilters = {
  query:      "",
  dept:       "",
  type:       "",
  people:     "",
  visibility: "",
  dateFrom:   "",
  dateTo:     ""
};

// ─────────────────────────────────────────────────────────
// Apply filters and re-render
// ─────────────────────────────────────────────────────────
function applyFilters() {
  const q    = activeFilters.query.toLowerCase().trim();
  const dept = activeFilters.dept;
  const type = activeFilters.type;
  const ppl  = activeFilters.people.toLowerCase();
  const vis  = activeFilters.visibility;
  const from = activeFilters.dateFrom ? new Date(activeFilters.dateFrom) : null;
  const to   = activeFilters.dateTo   ? new Date(activeFilters.dateTo)   : null;

  filteredDocuments = allDocuments.filter(doc => {
    // Full-text search across subject, tags, filename, notes, department, people
    if (q) {
      const haystack = [
        doc.subject, doc.fileName, doc.notes, doc.departmentOrOffice,
        doc.uploadedBy, doc.version,
        ...(doc.tags || []),
        ...(doc.peopleInvolved || [])
      ].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    // Department filter
    if (dept && (doc.departmentOrOffice || "").toLowerCase() !== dept.toLowerCase()) return false;

    // File type filter
    if (type && (doc.fileType || "") !== type) return false;

    // People filter
    if (ppl) {
      const peopleLower = (doc.peopleInvolved || []).map(p => p.toLowerCase());
      if (!peopleLower.some(p => p.includes(ppl))) return false;
    }

    // Visibility filter
    if (vis && (doc.visibility || "") !== vis) return false;

    // Date range filter (on dateCreated)
    if (from || to) {
      const docDate = doc.dateCreated ? new Date(doc.dateCreated) : null;
      if (!docDate) return false;
      if (from && docDate < from) return false;
      if (to   && docDate > to)   return false;
    }

    return true;
  });

  renderDocumentTable(filteredDocuments);
  renderActiveFilterPills();
}

// ─────────────────────────────────────────────────────────
// Filter pill display
// ─────────────────────────────────────────────────────────
function renderActiveFilterPills() {
  const container = document.getElementById("activeFilterPills");
  if (!container) return;

  const pills = [];
  if (activeFilters.query)      pills.push({ label: `"${activeFilters.query}"`,      key: "query"      });
  if (activeFilters.dept)       pills.push({ label: `Dept: ${activeFilters.dept}`,   key: "dept"       });
  if (activeFilters.type)       pills.push({ label: `Type: ${activeFilters.type}`,   key: "type"       });
  if (activeFilters.people)     pills.push({ label: `Person: ${activeFilters.people}`,key:"people"     });
  if (activeFilters.visibility) pills.push({ label: activeFilters.visibility,         key: "visibility" });
  if (activeFilters.dateFrom)   pills.push({ label: `From: ${activeFilters.dateFrom}`,key: "dateFrom"  });
  if (activeFilters.dateTo)     pills.push({ label: `To: ${activeFilters.dateTo}`,    key: "dateTo"    });

  container.innerHTML = pills.map(p => `
    <button class="filter-pill-active" onclick="clearFilter('${p.key}')">
      ${escapeHtml(p.label)} <i class="fa-solid fa-xmark ms-1"></i>
    </button>`
  ).join("");

  const clearAllBtn = document.getElementById("clearAllFiltersBtn");
  if (clearAllBtn) {
    clearAllBtn.style.display = pills.length > 1 ? "inline-flex" : "none";
  }
}

function clearFilter(key) {
  activeFilters[key] = "";
  // Reset corresponding UI input
  const map = {
    query:      "searchInput",
    dept:       "filterDept",
    type:       "filterType",
    people:     "filterPeople",
    visibility: "filterVisibility",
    dateFrom:   "filterDateFrom",
    dateTo:     "filterDateTo"
  };
  const el = document.getElementById(map[key]);
  if (el) el.value = "";
  applyFilters();
}

function clearAllFilters() {
  Object.keys(activeFilters).forEach(k => activeFilters[k] = "");
  ["searchInput","filterDept","filterType","filterPeople","filterVisibility",
   "filterDateFrom","filterDateTo"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  applyFilters();
}

// ─────────────────────────────────────────────────────────
// Event listeners for search/filter inputs
// ─────────────────────────────────────────────────────────
function initSearchListeners() {
  let debounceTimer;

  const debounced = (fn, delay = 300) => (...args) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fn(...args), delay);
  };

  const bind = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input",  debounced(e => { activeFilters[key] = e.target.value; applyFilters(); }));
    el.addEventListener("change", e => { activeFilters[key] = e.target.value; applyFilters(); });
  };

  bind("searchInput",    "query");
  bind("filterDept",     "dept");
  bind("filterType",     "type");
  bind("filterPeople",   "people");
  bind("filterVisibility","visibility");
  bind("filterDateFrom", "dateFrom");
  bind("filterDateTo",   "dateTo");
}

// ─────────────────────────────────────────────────────────
// Sort table columns
// ─────────────────────────────────────────────────────────
let sortState = { col: "dateAdded", dir: "desc" };

function sortDocuments(col) {
  if (sortState.col === col) {
    sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
  } else {
    sortState.col = col;
    sortState.dir = "asc";
  }

  filteredDocuments.sort((a, b) => {
    let av = a[col] || "", bv = b[col] || "";
    if (av?.toDate) av = av.toDate().getTime();
    if (bv?.toDate) bv = bv.toDate().getTime();
    if (typeof av === "string") av = av.toLowerCase();
    if (typeof bv === "string") bv = bv.toLowerCase();
    if (av < bv) return sortState.dir === "asc" ? -1 :  1;
    if (av > bv) return sortState.dir === "asc" ?  1 : -1;
    return 0;
  });

  renderDocumentTable(filteredDocuments);

  // Update sort icons
  document.querySelectorAll(".sortable").forEach(th => {
    th.classList.remove("sort-asc","sort-desc");
    if (th.dataset.col === col) th.classList.add("sort-" + sortState.dir);
  });
}
