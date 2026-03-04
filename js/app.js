/**
 * app.js — Main application bootstrap and navigation controller
 */

// ─────────────────────────────────────────────────────────
// View / tab management
// ─────────────────────────────────────────────────────────
const VIEWS = { DOCUMENTS: "documents", PEOPLE: "people", DASHBOARD: "dashboard" };
let currentView = VIEWS.DOCUMENTS;

function showView(view) {
  currentView = view;

  // Hide all views
  document.querySelectorAll(".app-view").forEach(v => v.classList.remove("active"));

  // Show selected view
  const el = document.getElementById("view-" + view);
  if (el) el.classList.add("active");

  // Update nav links
  document.querySelectorAll(".nav-link[data-view]").forEach(a => {
    a.classList.toggle("active", a.dataset.view === view);
  });

  // Lazy-load data
  if (view === VIEWS.PEOPLE && allPeople.length === 0) fetchPeople();
  if (view === VIEWS.DASHBOARD) renderDashboard();
}

// ─────────────────────────────────────────────────────────
// Dashboard rendering
// ─────────────────────────────────────────────────────────
function renderDashboard() {
  // Counts
  document.getElementById("dashTotal").textContent  = allDocuments.length;
  document.getElementById("dashPeople").textContent = allPeople.length || "—";

  const typeCounts = {};
  const deptCounts = {};
  const monthCounts = {};

  allDocuments.forEach(doc => {
    // By type
    const t = doc.fileType || "other";
    typeCounts[t] = (typeCounts[t] || 0) + 1;

    // By department
    const d = doc.departmentOrOffice || "Unknown";
    deptCounts[d] = (deptCounts[d] || 0) + 1;

    // By month added
    let month = "Unknown";
    if (doc.dateAdded?.toDate) {
      const dt = doc.dateAdded.toDate();
      month = dt.toLocaleDateString("en-US", { year:"numeric", month:"short" });
    }
    monthCounts[month] = (monthCounts[month] || 0) + 1;
  });

  // Type breakdown bar
  const typeBar = document.getElementById("typeBreakdownBar");
  const typeColors = { pdf:"#e74c5e", document:"#3cb4f5", spreadsheet:"#5bc9a3",
                       presentation:"#f59c3c", image:"#a78bfa", video:"#f97316", other:"#94a3b8" };
  const totalDocs = allDocuments.length || 1;
  typeBar.innerHTML = Object.entries(typeCounts).map(([type, count]) =>
    `<div class="dash-bar-segment tooltip-wrap" style="width:${(count/totalDocs*100).toFixed(1)}%; background:${typeColors[type]||'#94a3b8'}"
         title="${type}: ${count}">
       <span class="tooltip-text">${type}: ${count}</span>
     </div>`
  ).join("");

  // Department list
  const deptList = document.getElementById("deptBreakdownList");
  const sortedDepts = Object.entries(deptCounts).sort((a,b) => b[1]-a[1]);
  deptList.innerHTML = sortedDepts.map(([dept, count]) => `
    <div class="dash-dept-row">
      <span>${escapeHtml(dept)}</span>
      <div class="d-flex align-items-center gap-2">
        <div class="dash-mini-bar" style="width:${Math.round(count/totalDocs*120)}px"></div>
        <span class="fw-bold">${count}</span>
      </div>
    </div>`
  ).join("") || "<p class='text-muted small'>No data</p>";

  // Recent documents
  const recentList = document.getElementById("recentDocsList");
  const recent = [...allDocuments]
    .sort((a,b) => {
      const at = a.dateAdded?.toDate?.()?.getTime() || 0;
      const bt = b.dateAdded?.toDate?.()?.getTime() || 0;
      return bt - at;
    }).slice(0, 6);

  recentList.innerHTML = recent.map(doc => `
    <div class="recent-doc-item" onclick="showView('documents'); setTimeout(()=>openPreviewModal('${doc.id}'),200)">
      <div class="file-icon-wrap file-type-${doc.fileType||'other'} small-icon">
        <i class="fa-solid ${fileTypeIcon(doc.fileType)} small"></i>
      </div>
      <div class="flex-grow-1 overflow-hidden">
        <div class="text-truncate fw-medium">${escapeHtml(doc.fileName||"Untitled")}</div>
        <div class="text-muted small">${escapeHtml(doc.departmentOrOffice||"")} · ${formatDate(doc.dateAdded)}</div>
      </div>
      <span class="type-badge ${fileTypeBadgeColor(doc.fileType)}">${escapeHtml(doc.fileType||"other")}</span>
    </div>`
  ).join("") || "<p class='text-muted small'>No documents yet.</p>";
}

// ─────────────────────────────────────────────────────────
// Sidebar toggle (mobile)
// ─────────────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("sidebar-open");
  document.getElementById("sidebarOverlay").classList.toggle("active");
}

// ─────────────────────────────────────────────────────────
// Firebase connection status check
// ─────────────────────────────────────────────────────────
async function checkFirebaseConnection() {
  const statusEl = document.getElementById("firebaseStatus");
  try {
    await db.collection(COLLECTIONS.DOCUMENTS).limit(1).get();
    if (statusEl) {
      statusEl.innerHTML = '<i class="fa-solid fa-circle-check text-success me-1"></i>Firebase Connected';
      statusEl.className = "firebase-status status-ok";
    }
  } catch (err) {
    if (statusEl) {
      statusEl.innerHTML = '<i class="fa-solid fa-circle-exclamation text-warning me-1"></i>Configure Firebase';
      statusEl.className = "firebase-status status-warn";
    }
    console.warn("Firebase not connected:", err.message);
  }
}

// ─────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Wire up navigation
  document.querySelectorAll(".nav-link[data-view]").forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      showView(link.dataset.view);
      // Close mobile sidebar
      document.getElementById("sidebar").classList.remove("sidebar-open");
      document.getElementById("sidebarOverlay").classList.remove("active");
    });
  });

  // Wire up column sorting
  document.querySelectorAll(".sortable").forEach(th => {
    th.addEventListener("click", () => sortDocuments(th.dataset.col));
  });

  // Wire up search listeners
  initSearchListeners();

  // Document form submit
  document.getElementById("documentForm")
    ?.addEventListener("submit", handleDocumentFormSubmit);

  // Person form submit
  document.getElementById("personForm")
    ?.addEventListener("submit", handlePersonFormSubmit);

  // Drive URL input auto-detect
  document.getElementById("driveUrlField")
    ?.addEventListener("input", onDriveUrlInput);

  // Clear all filters button
  document.getElementById("clearAllFiltersBtn")
    ?.addEventListener("click", clearAllFilters);

  // People search
  document.getElementById("peopleSearchInput")?.addEventListener("input", e => {
    searchPeople(e.target.value);
  });

  // Sidebar overlay click
  document.getElementById("sidebarOverlay")?.addEventListener("click", toggleSidebar);

  // ── Bootstrap modal: clear preview frame when preview modal closes
  document.getElementById("previewModal")?.addEventListener("hidden.bs.modal", () => {
    document.getElementById("previewFrame").src = "";
  });

  // Initial data load
  await checkFirebaseConnection();
  await seedSampleData();
  await fetchDocuments();

  // Show default view
  showView(VIEWS.DOCUMENTS);
});
