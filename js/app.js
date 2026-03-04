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
  document.querySelectorAll(".app-view").forEach(v => v.classList.remove("active"));
  const el = document.getElementById("view-" + view);
  if (el) el.classList.add("active");
  document.querySelectorAll(".nav-link[data-view]").forEach(a => {
    a.classList.toggle("active", a.dataset.view === view);
  });
  if (view === VIEWS.PEOPLE && allPeople.length === 0) fetchPeople();
  if (view === VIEWS.DASHBOARD) renderDashboard();
}

// ─────────────────────────────────────────────────────────
// Dashboard rendering
// ─────────────────────────────────────────────────────────
function renderDashboard() {
  document.getElementById("dashTotal").textContent  = allDocuments.length;
  document.getElementById("dashPeople").textContent = allPeople.length || "—";

  const typeCounts = {};
  const deptCounts = {};

  allDocuments.forEach(doc => {
    const t = doc.fileType || "other";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
    const d = doc.departmentOrOffice || "Unknown";
    deptCounts[d] = (deptCounts[d] || 0) + 1;
  });

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
// Firebase not-configured banner
// ─────────────────────────────────────────────────────────
function showNotConfiguredBanner() {
  // Update Firebase status indicator
  const statusEl = document.getElementById("firebaseStatus");
  if (statusEl) {
    statusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation me-1"></i>Not Configured';
    statusEl.className = "firebase-status status-warn";
  }

  // Show a prominent setup banner above the table
  const banner = document.getElementById("setupBanner");
  if (banner) banner.style.display = "flex";

  // Show empty state with a helpful message
  const emptyTitle = document.querySelector("#emptyState .empty-title");
  const emptySub   = document.querySelector("#emptyState .empty-sub");
  if (emptyTitle) emptyTitle.textContent = "Firebase not configured";
  if (emptySub)   emptySub.innerHTML =
    'Open <code>js/firebase-config.js</code> and replace the placeholder values ' +
    'with your real Firebase credentials, then push to GitHub again.';
  document.getElementById("emptyState").style.display  = "flex";
  document.getElementById("tableWrapper").style.display = "none";
  document.getElementById("docCount").textContent = "0 documents";
}

// ─────────────────────────────────────────────────────────
// Firebase connection status check
// ─────────────────────────────────────────────────────────
async function checkFirebaseConnection() {
  const statusEl = document.getElementById("firebaseStatus");
  if (!FIREBASE_CONFIGURED || !db) {
    if (statusEl) {
      statusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation me-1"></i>Not Configured';
      statusEl.className = "firebase-status status-warn";
    }
    return false;
  }
  try {
    await db.collection(COLLECTIONS.DOCUMENTS).limit(1).get();
    if (statusEl) {
      statusEl.innerHTML = '<i class="fa-solid fa-circle-check me-1"></i>Firebase Connected';
      statusEl.className = "firebase-status status-ok";
    }
    return true;
  } catch (err) {
    if (statusEl) {
      statusEl.innerHTML = '<i class="fa-solid fa-circle-exclamation me-1"></i>Connection Error';
      statusEl.className = "firebase-status status-warn";
    }
    console.error("Firebase connection error:", err.message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────
// Sidebar toggle (mobile)
// ─────────────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("sidebar-open");
  document.getElementById("sidebarOverlay").classList.toggle("active");
}

// ─────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Safety net: always dismiss loading after 5 seconds no matter what
  const loadingTimeout = setTimeout(() => {
    showLoading(false);
    console.warn("DocVault: Loading timeout reached. Check Firebase configuration.");
  }, 5000);

  // Wire up navigation
  document.querySelectorAll(".nav-link[data-view]").forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      showView(link.dataset.view);
      document.getElementById("sidebar").classList.remove("sidebar-open");
      document.getElementById("sidebarOverlay").classList.remove("active");
    });
  });

  // Wire up column sorting
  document.querySelectorAll(".sortable").forEach(th => {
    th.addEventListener("click", () => sortDocuments(th.dataset.col));
  });

  // Wire up search/filter listeners
  initSearchListeners();

  // Form submit handlers
  document.getElementById("documentForm")?.addEventListener("submit", handleDocumentFormSubmit);
  document.getElementById("personForm")?.addEventListener("submit", handlePersonFormSubmit);
  document.getElementById("driveUrlField")?.addEventListener("input", onDriveUrlInput);
  document.getElementById("clearAllFiltersBtn")?.addEventListener("click", clearAllFilters);
  document.getElementById("peopleSearchInput")?.addEventListener("input", e => searchPeople(e.target.value));
  document.getElementById("sidebarOverlay")?.addEventListener("click", toggleSidebar);

  // Clear preview iframe on modal close
  document.getElementById("previewModal")?.addEventListener("hidden.bs.modal", () => {
    document.getElementById("previewFrame").src = "";
  });

  // ── Main init sequence ──
  if (!FIREBASE_CONFIGURED || !db) {
    // Firebase not set up yet — show the app in demo/empty state
    showNotConfiguredBanner();
    clearTimeout(loadingTimeout);
    showLoading(false);
    showView(VIEWS.DOCUMENTS);
    return;
  }

  try {
    const connected = await checkFirebaseConnection();
    if (connected) {
      await seedSampleData();
      await fetchDocuments();
    } else {
      showNotConfiguredBanner();
    }
  } catch (err) {
    console.error("Startup error:", err);
    showToast("Startup error: " + err.message, "error");
    showNotConfiguredBanner();
  } finally {
    clearTimeout(loadingTimeout);
    showLoading(false);
    showView(VIEWS.DOCUMENTS);
  }
});