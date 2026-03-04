/**
 * documents.js — Document CRUD operations and rendering
 */

// ─────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────
let allDocuments = [];        // master list from Firestore
let filteredDocuments = [];   // current filtered/searched view
let currentEditId = null;     // ID of document being edited

// ─────────────────────────────────────────────────────────
// Firestore operations
// ─────────────────────────────────────────────────────────

/** Fetches all documents from Firestore, ordered by dateAdded desc */
async function fetchDocuments() {
  showLoading(true);
  try {
    const snap = await db.collection(COLLECTIONS.DOCUMENTS)
                         .orderBy("dateAdded", "desc")
                         .get();
    allDocuments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    filteredDocuments = [...allDocuments];
    renderDocumentTable(filteredDocuments);
    updateFilterDropdowns();
    updateStats();
  } catch (err) {
    showToast("Failed to load documents: " + err.message, "error");
  } finally {
    showLoading(false);
  }
}

/** Saves a new document to Firestore */
async function saveDocument(data) {
  const docRef = await db.collection(COLLECTIONS.DOCUMENTS).add({
    ...data,
    dateAdded: firebase.firestore.Timestamp.now()
  });
  return docRef.id;
}

/** Updates an existing document in Firestore */
async function updateDocument(id, data) {
  await db.collection(COLLECTIONS.DOCUMENTS).doc(id).update(data);
}

/** Deletes a document from Firestore */
async function deleteDocument(id) {
  await db.collection(COLLECTIONS.DOCUMENTS).doc(id).delete();
}

// ─────────────────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────────────────

/** Renders the document table with the given list */
function renderDocumentTable(docs) {
  const tbody = document.getElementById("documentTableBody");
  const empty = document.getElementById("emptyState");
  const tableWrap = document.getElementById("tableWrapper");

  if (!docs || docs.length === 0) {
    tbody.innerHTML = "";
    empty.style.display = "flex";
    tableWrap.style.display = "none";
    document.getElementById("docCount").textContent = "0 documents";
    return;
  }

  empty.style.display = "none";
  tableWrap.style.display = "block";
  document.getElementById("docCount").textContent =
    `${docs.length} document${docs.length !== 1 ? "s" : ""}`;

  tbody.innerHTML = docs.map((doc, i) => `
    <tr class="doc-row animate-row" style="animation-delay:${i * 30}ms"
        data-id="${doc.id}" title="Click to preview">
      <td class="td-icon">
        <div class="file-icon-wrap file-type-${doc.fileType || 'other'}">
          <i class="fa-solid ${fileTypeIcon(doc.fileType)}"></i>
        </div>
      </td>
      <td class="td-filename">
        <div class="filename-text">${escapeHtml(doc.fileName || "Untitled")}</div>
        <div class="filename-sub">${escapeHtml(doc.subject || "")}</div>
      </td>
      <td class="td-type">
        <span class="type-badge ${fileTypeBadgeColor(doc.fileType)}">
          ${escapeHtml(doc.fileType || "other")}
        </span>
      </td>
      <td class="td-dept">${escapeHtml(doc.departmentOrOffice || "—")}</td>
      <td class="td-tags">
        ${(doc.tags || []).slice(0, 3).map(t =>
          `<span class="tag-pill">${escapeHtml(t)}</span>`
        ).join("")}
        ${(doc.tags || []).length > 3
          ? `<span class="tag-pill tag-more">+${doc.tags.length - 3}</span>` : ""}
      </td>
      <td class="td-visibility">
        <span class="vis-badge ${visibilityBadgeColor(doc.visibility)}">
          ${escapeHtml(doc.visibility || "Internal")}
        </span>
      </td>
      <td class="td-date">${formatDate(doc.dateCreated)}</td>
      <td class="td-version">v${escapeHtml(doc.version || "1.0")}</td>
      <td class="td-actions" onclick="event.stopPropagation()">
        <button class="btn-icon-action" onclick="openPreviewModal('${doc.id}')" title="Preview">
          <i class="fa-solid fa-eye"></i>
        </button>
        <button class="btn-icon-action" onclick="openEditModal('${doc.id}')" title="Edit">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn-icon-action btn-delete" onclick="confirmDeleteDoc('${doc.id}','${escapeHtml(doc.fileName || '')}')" title="Delete">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join("");

  // Row click → preview
  tbody.querySelectorAll(".doc-row").forEach(row => {
    row.addEventListener("click", () => openPreviewModal(row.dataset.id));
  });
}

// ─────────────────────────────────────────────────────────
// Stats bar
// ─────────────────────────────────────────────────────────
function updateStats() {
  const total = allDocuments.length;
  const typeCounts = {};
  allDocuments.forEach(d => {
    typeCounts[d.fileType || "other"] = (typeCounts[d.fileType || "other"] || 0) + 1;
  });
  document.getElementById("statTotal").textContent = total;
  document.getElementById("statPDF").textContent   = typeCounts["pdf"]          || 0;
  document.getElementById("statDOC").textContent   = typeCounts["document"]     || 0;
  document.getElementById("statXLS").textContent   = typeCounts["spreadsheet"]  || 0;
  document.getElementById("statPPT").textContent   = typeCounts["presentation"] || 0;
}

// ─────────────────────────────────────────────────────────
// Preview Modal
// ─────────────────────────────────────────────────────────
function openPreviewModal(id) {
  const doc = allDocuments.find(d => d.id === id);
  if (!doc) return;

  // Header
  document.getElementById("previewFileName").textContent = doc.fileName || "Untitled";
  document.getElementById("previewFileType").textContent = doc.fileType || "other";
  document.getElementById("previewFileType").className   = `badge ${fileTypeBadgeColor(doc.fileType)} ms-2`;

  // Metadata panel
  document.getElementById("prevSubject").textContent    = doc.subject || "—";
  document.getElementById("prevDept").textContent       = doc.departmentOrOffice || "—";
  document.getElementById("prevUploader").textContent   = doc.uploadedBy || "—";
  document.getElementById("prevCreated").textContent    = formatDate(doc.dateCreated);
  document.getElementById("prevAdded").textContent      = formatDate(doc.dateAdded);
  document.getElementById("prevVersion").textContent    = "v" + (doc.version || "1.0");
  document.getElementById("prevVisibility").textContent = doc.visibility || "Internal";
  document.getElementById("prevNotes").textContent      = doc.notes || "—";

  // Tags
  document.getElementById("prevTags").innerHTML =
    (doc.tags || []).map(t => `<span class="tag-pill">${escapeHtml(t)}</span>`).join("") || "—";

  // People
  document.getElementById("prevPeople").innerHTML =
    (doc.peopleInvolved || []).map(p => `
      <span class="person-chip">
        <i class="fa-solid fa-user-circle me-1"></i>${escapeHtml(p)}
      </span>`
    ).join("") || "—";

  // Drive link button
  const linkBtn = document.getElementById("prevDriveLink");
  linkBtn.href = doc.driveFileLink || "#";
  linkBtn.target = "_blank";

  // Embed frame
  const frame = document.getElementById("previewFrame");
  const noPreview = document.getElementById("noPreviewMsg");
  const frameWrap = document.getElementById("previewFrameWrap");

  const previewSrc = doc.driveFileId ? getDrivePreviewUrl(doc.driveFileId) : null;
  if (previewSrc) {
    frame.src = previewSrc;
    frameWrap.style.display = "block";
    noPreview.style.display = "none";
  } else {
    frame.src = "";
    frameWrap.style.display = "none";
    noPreview.style.display = "flex";
  }

  const modal = new bootstrap.Modal(document.getElementById("previewModal"));
  modal.show();
}

// ─────────────────────────────────────────────────────────
// Add / Edit Document Modal
// ─────────────────────────────────────────────────────────
function openAddModal() {
  currentEditId = null;
  resetDocumentForm();
  document.getElementById("docModalTitle").textContent = "Register Document";
  document.getElementById("saveDocBtn").textContent    = "Save Document";
  document.getElementById("driveUrlRow").style.display = "block";
  document.getElementById("dateCreatedField").value    = todayISO();
  const modal = new bootstrap.Modal(document.getElementById("documentModal"));
  modal.show();
}

function openEditModal(id) {
  const doc = allDocuments.find(d => d.id === id);
  if (!doc) return;
  currentEditId = id;
  resetDocumentForm();

  document.getElementById("docModalTitle").textContent = "Edit Document";
  document.getElementById("saveDocBtn").textContent    = "Update Document";
  document.getElementById("driveUrlRow").style.display = "none"; // URL already stored

  // Populate fields
  document.getElementById("fileNameField").value       = doc.fileName || "";
  document.getElementById("fileTypeField").value       = doc.fileType || "other";
  document.getElementById("subjectField").value        = doc.subject || "";
  document.getElementById("dateCreatedField").value    = doc.dateCreated || "";
  document.getElementById("tagsField").value           = listToString(doc.tags);
  document.getElementById("peopleField").value         = listToString(doc.peopleInvolved);
  document.getElementById("departmentField").value     = doc.departmentOrOffice || "";
  document.getElementById("uploadedByField").value     = doc.uploadedBy || "";
  document.getElementById("versionField").value        = doc.version || "1.0";
  document.getElementById("notesField").value          = doc.notes || "";
  document.getElementById("visibilityField").value     = doc.visibility || "Internal";

  const modal = new bootstrap.Modal(document.getElementById("documentModal"));
  modal.show();
}

function resetDocumentForm() {
  document.getElementById("documentForm").reset();
  document.getElementById("urlPreviewSection").style.display = "none";
  document.getElementById("driveUrlField").value = "";
  document.getElementById("versionField").value = "1.0";
  document.getElementById("visibilityField").value = "Internal";
}

/** Called when Drive URL input changes — extracts file info */
function onDriveUrlInput() {
  const url = document.getElementById("driveUrlField").value.trim();
  const preview = document.getElementById("urlPreviewSection");

  if (!url) { preview.style.display = "none"; return; }

  const fileId = extractDriveFileId(url);
  if (!fileId) {
    preview.style.display = "none";
    return;
  }

  const inferredType = inferFileType(url, "");
  document.getElementById("detectedFileId").textContent   = fileId;
  document.getElementById("detectedFileType").textContent = inferredType;

  // Pre-fill file type if empty
  if (!document.getElementById("fileTypeField").value) {
    document.getElementById("fileTypeField").value = inferredType;
  }

  preview.style.display = "block";
}

/** Handles the document form submission (add or edit) */
async function handleDocumentFormSubmit(e) {
  e.preventDefault();
  const form = document.getElementById("documentForm");
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const btn = document.getElementById("saveDocBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving…';

  try {
    let driveFileId   = "";
    let driveFileLink = "";

    if (!currentEditId) {
      // New document — extract drive ID from URL
      const url = document.getElementById("driveUrlField").value.trim();
      driveFileId   = extractDriveFileId(url) || "";
      driveFileLink = url;
      if (!driveFileId) {
        showToast("Please enter a valid Google Drive link.", "error");
        return;
      }
    } else {
      const existing = allDocuments.find(d => d.id === currentEditId);
      driveFileId   = existing?.driveFileId || "";
      driveFileLink = existing?.driveFileLink || "";
    }

    const data = {
      driveFileId,
      driveFileLink,
      fileName:         document.getElementById("fileNameField").value.trim(),
      fileType:         document.getElementById("fileTypeField").value,
      dateCreated:      document.getElementById("dateCreatedField").value,
      subject:          document.getElementById("subjectField").value.trim(),
      tags:             parseList(document.getElementById("tagsField").value),
      peopleInvolved:   parseList(document.getElementById("peopleField").value),
      departmentOrOffice: document.getElementById("departmentField").value.trim(),
      uploadedBy:       document.getElementById("uploadedByField").value.trim(),
      version:          document.getElementById("versionField").value.trim() || "1.0",
      notes:            document.getElementById("notesField").value.trim(),
      visibility:       document.getElementById("visibilityField").value
    };

    if (currentEditId) {
      await updateDocument(currentEditId, data);
      showToast("Document updated successfully.", "success");
    } else {
      await saveDocument(data);
      showToast("Document registered successfully.", "success");
    }

    bootstrap.Modal.getInstance(document.getElementById("documentModal"))?.hide();
    await fetchDocuments();

  } catch (err) {
    showToast("Error saving document: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = currentEditId ? "Update Document" : "Save Document";
  }
}

// ─────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────
function confirmDeleteDoc(id, name) {
  document.getElementById("deleteDocName").textContent = name || "this document";
  document.getElementById("confirmDeleteBtn").onclick = async () => {
    try {
      await deleteDocument(id);
      bootstrap.Modal.getInstance(document.getElementById("deleteModal"))?.hide();
      showToast("Document deleted.", "success");
      await fetchDocuments();
    } catch (err) {
      showToast("Error deleting document: " + err.message, "error");
    }
  };
  const modal = new bootstrap.Modal(document.getElementById("deleteModal"));
  modal.show();
}

// ─────────────────────────────────────────────────────────
// Filter dropdowns — populated from current data
// ─────────────────────────────────────────────────────────
function updateFilterDropdowns() {
  const depts = getUniqueValues(allDocuments, "departmentOrOffice");
  const people = getUniqueValues(allDocuments, "peopleInvolved");
  const tags = getUniqueValues(allDocuments, "tags");
  const types = getUniqueValues(allDocuments, "fileType");

  populateSelect("filterDept",       depts,  "All Departments");
  populateSelect("filterType",       types,  "All Types");
  populateSelect("filterPeople",     people, "All People");
  populateSelect("filterVisibility", ["Public","Internal","Confidential"], "All Visibility");
}

function populateSelect(id, values, placeholder) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = `<option value="">${placeholder}</option>` +
    values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
  if (current) sel.value = current;
}
