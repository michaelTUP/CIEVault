/**
 * documents.js — Document CRUD, access control, version history
 */

let allDocuments  = [];
let filteredDocs  = [];
let _editDocId    = null;

// ── Access control checks ─────────────────────────────────
function canViewDoc(doc, user) {
  if (!user) return false;
  if (isSuperPlus(user)) return true;

  const isUploader = doc.uploadedBy === user.id;
  const isInvolved = (doc.peopleInvolvedIds||[]).includes(user.id);
  const sameOffice = (doc.offices||[]).some(o => o === user.office);
  const isAdminPlus_ = isAdminPlus(user);

  switch (doc.visibility) {
    case "Public":
      return true;
    case "Internal":
      return isUploader || sameOffice || isInvolved || isAdminPlus_;
    case "Confidential":
      return isUploader;
    default:
      return isUploader;
  }
}

function canEditDoc(doc, user) {
  if (!user) return false;
  if (isSuperPlus(user)) return true;
  if (isGuest(user)) return false;

  const isUploader = doc.uploadedBy === user.id;
  const sameOffice = (doc.offices||[]).some(o => o === user.office);
  const isInvolved = (doc.peopleInvolvedIds||[]).includes(user.id);

  switch (doc.visibility) {
    case "Public":
      return isRegularPlus(user);
    case "Internal":
      return isUploader || (isAdminPlus(user) && (sameOffice || isInvolved));
    case "Confidential":
      return isUploader;
    default:
      return isUploader;
  }
}

function canDeleteDoc(doc, user) {
  if (!user) return false;
  if (isSuperPlus(user)) return true;
  return doc.uploadedBy === user.id;
}

function canOpenDriveLink(doc, user) {
  if (!user) return false;
  if (isSuperPlus(user)) return true;
  const isUploader = doc.uploadedBy === user.id;
  const sameOffice = (doc.offices||[]).some(o => o === user.office);
  const isInvolved = (doc.peopleInvolvedIds||[]).includes(user.id);
  return isUploader || (isAdminPlus(user) && (sameOffice || isInvolved));
}

// ── Fetch documents ───────────────────────────────────────
async function fetchDocuments() {
  showLoading(true);
  try {
    // Load from cache first for instant render
    const cached = await idbLoad("documents");
    if (cached.length) {
      allDocuments = cached;
      applyFilters();
      updateStats();
    }

    if (!db) return;
    const snap = await db.collection(C.DOCUMENTS)
      .orderBy("dateAdded","desc").get();
    allDocuments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    await idbSave("documents", allDocuments);
    applyFilters();
    updateStats();
    updateFilterDropdowns();
  } catch(e) {
    showToast("Failed to load documents: "+e.message,"error");
  } finally {
    showLoading(false);
  }
}

// ── Render table ──────────────────────────────────────────
function renderDocumentTable(docs) {
  const tbody  = document.getElementById("documentTableBody");
  const empty  = document.getElementById("emptyState");
  const wrap   = document.getElementById("tableWrapper");
  const cntEl  = document.getElementById("docCount");
  const user   = getCurrentUser();

  if (!docs?.length) {
    if (tbody) tbody.innerHTML = "";
    if (empty) empty.style.display = "flex";
    if (wrap)  wrap.style.display  = "none";
    if (cntEl) cntEl.textContent   = "0 documents";
    return;
  }

  if (empty) empty.style.display = "none";
  if (wrap)  wrap.style.display  = "block";
  if (cntEl) cntEl.textContent   = `${docs.length} document${docs.length!==1?"s":""}`;

  tbody.innerHTML = docs.map((doc, i) => {
    const canEdit   = canEditDoc(doc, user);
    const canDel    = canDeleteDoc(doc, user);
    const offices   = (doc.offices||[]).join(", ") || "—";
    const uploader  = allUsers.find(u => u.id === doc.uploadedBy);
    return `
    <tr class="doc-row animate-row" style="animation-delay:${i*25}ms"
        data-id="${doc.id}" title="Click to preview">
      <td class="td-icon">
        <div class="file-icon-wrap file-type-${doc.fileType||'other'}">
          <i class="fa-solid ${fileTypeIcon(doc.fileType)}"></i>
        </div>
      </td>
      <td class="td-filename">
        <div class="filename-text">${escapeHtml(doc.fileName||"Untitled")}</div>
        <div class="filename-sub">${escapeHtml(doc.subject||"")}</div>
      </td>
      <td class="text-muted small">${escapeHtml(offices)}</td>
      <td>
        ${(doc.tags||[]).slice(0,3).map(t=>`<span class="tag-pill">${escapeHtml(t)}</span>`).join("")}
        ${(doc.tags||[]).length>3?`<span class="tag-pill tag-more">+${doc.tags.length-3}</span>`:""}
      </td>
      <td><span class="vis-badge ${visibilityBadgeClass(doc.visibility)}">${escapeHtml(doc.visibility||"Internal")}</span></td>
      <td class="text-muted small">${formatDate(doc.dateCreated)}</td>
      <td class="text-muted small">v${escapeHtml(doc.version||"1.0")}</td>
      <td onclick="event.stopPropagation()">
        <button class="btn-icon-action" onclick="openPreviewModal('${doc.id}')" title="Preview">
          <i class="fa-solid fa-eye"></i>
        </button>
        ${canEdit?`<button class="btn-icon-action" onclick="openEditDocModal('${doc.id}')" title="Edit">
          <i class="fa-solid fa-pen"></i></button>`:""}
        ${canDel?`<button class="btn-icon-action btn-delete" onclick="confirmDeleteDoc('${doc.id}','${escapeHtml(doc.fileName||'')}')">
          <i class="fa-solid fa-trash"></i></button>`:""}
      </td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll(".doc-row").forEach(row =>
    row.addEventListener("click", () => openPreviewModal(row.dataset.id))
  );
}

// ── Stats bar ─────────────────────────────────────────────
function updateStats() {
  const tc = {};
  allDocuments.forEach(d => { tc[d.fileType||"other"] = (tc[d.fileType||"other"]||0)+1; });
  document.getElementById("statTotal")?.setAttribute("data-val", allDocuments.length);
  document.getElementById("statTotal") && (document.getElementById("statTotal").textContent = allDocuments.length);
  ["PDF","DOC","XLS","PPT"].forEach(k => {
    const map={PDF:"pdf",DOC:"document",XLS:"spreadsheet",PPT:"presentation"};
    const el = document.getElementById("stat"+k);
    if (el) el.textContent = tc[map[k]]||0;
  });
}

// ── Preview modal ─────────────────────────────────────────
function openPreviewModal(id) {
  const doc  = allDocuments.find(d => d.id === id);
  const user = getCurrentUser();
  if (!doc) return;

  document.getElementById("previewFileName").textContent = doc.fileName||"Untitled";
  const tb = document.getElementById("previewFileType");
  tb.textContent = doc.fileType||"other";
  tb.className   = `badge ${fileTypeBadgeClass(doc.fileType)} ms-2`;

  document.getElementById("prevSubject").textContent   = doc.subject||"—";
  document.getElementById("prevOffices").textContent   = (doc.offices||[]).join(", ")||"—";
  document.getElementById("prevCreated").textContent   = formatDate(doc.dateCreated);
  document.getElementById("prevAdded").textContent     = formatDate(doc.dateAdded);
  document.getElementById("prevVersion").textContent   = "v"+(doc.version||"1.0");
  document.getElementById("prevVisibility").textContent= doc.visibility||"—";
  document.getElementById("prevNotes").textContent     = doc.notes||"—";

  // Uploader name
  const uploader = allUsers.find(u => u.id===doc.uploadedBy);
  document.getElementById("prevUploader").textContent = uploader?.name || doc.uploadedByName || "—";

  // Modified
  const modifier = allUsers.find(u => u.id===doc.lastModifiedBy);
  document.getElementById("prevModified").textContent = doc.lastModifiedAt
    ? `${modifier?.name||doc.lastModifiedByName||"?"} · ${formatDateTime(doc.lastModifiedAt)}`
    : "—";

  // Tags
  document.getElementById("prevTags").innerHTML =
    (doc.tags||[]).map(t=>`<span class="tag-pill">${escapeHtml(t)}</span>`).join("")||"—";

  // People
  const pNames = (doc.peopleInvolvedNames||[]).concat(
    doc.othersInvolved ? parseList(doc.othersInvolved).map(n=>`<em>${escapeHtml(n)}</em>`) : []
  );
  document.getElementById("prevPeople").innerHTML =
    pNames.map(n=>`<span class="person-chip">${typeof n==="string"&&n.startsWith("<")? n:`<i class="fa-solid fa-user me-1"></i>${escapeHtml(n)}`}</span>`).join("")||"—";

  // Drive link
  const linkBtn = document.getElementById("prevDriveLink");
  const canDrive = canOpenDriveLink(doc, user);
  linkBtn.href    = canDrive ? (doc.driveFileLink||"#") : "#";
  linkBtn.style.opacity      = canDrive ? "1"    : "0.4";
  linkBtn.style.pointerEvents= canDrive ? "auto" : "none";
  linkBtn.title = canDrive ? "Open in Google Drive" : "You don't have permission to open this file";

  // Preview iframe
  const frame   = document.getElementById("previewFrame");
  const noPreview = document.getElementById("noPreviewMsg");
  const frameWrap = document.getElementById("previewFrameWrap");
  if (doc.driveFileId && navigator.onLine) {
    frame.src = getDrivePreviewUrl(doc.driveFileId);
    frameWrap.style.display = "block";
    noPreview.style.display = "none";
  } else if (!navigator.onLine) {
    frame.src = "";
    frameWrap.style.display = "none";
    noPreview.style.display = "flex";
    document.getElementById("noPreviewMsg").innerHTML =
      `<i class="fa-solid fa-wifi-slash fa-3x mb-3" style="color:var(--border-light)"></i>
       <div>Preview unavailable offline</div>
       <div class="small text-muted">Connect to the internet to view the file</div>`;
  } else {
    frame.src = "";
    frameWrap.style.display = "none";
    noPreview.style.display = "flex";
  }

  openModal("previewModal");
}

// ── Add document modal ────────────────────────────────────
async function openAddDocModal() {
  _editDocId = null;
  resetDocForm();
  document.getElementById("docModalTitle").textContent   = "Register Document";
  document.getElementById("saveDocBtn").textContent      = "Save Document";
  document.getElementById("driveUrlLabel").innerHTML     = 'Google Drive Link <span style="color:var(--danger)">*</span>';
  document.getElementById("dateCreatedField").value      = todayISO();

  await populateDocFormDropdowns([],[]);
  openModal("documentModal");
}

// ── Edit document modal ───────────────────────────────────
async function openEditDocModal(id) {
  const doc = allDocuments.find(d => d.id===id);
  if (!doc) return;
  _editDocId = id;
  resetDocForm();

  document.getElementById("docModalTitle").textContent = "Edit Document";
  document.getElementById("saveDocBtn").textContent    = "Update Document";
  document.getElementById("driveUrlLabel").innerHTML   = 'Google Drive Link <span style="color:var(--text-muted);font-weight:400">(update if needed)</span>';

  document.getElementById("driveUrlField").value        = doc.driveFileLink||"";
  document.getElementById("fileNameField").value        = doc.fileName||"";
  document.getElementById("fileTypeField").value        = doc.fileType||"other";
  document.getElementById("subjectField").value         = doc.subject||"";
  document.getElementById("dateCreatedField").value     = doc.dateCreated||"";
  document.getElementById("uploadedByField").value      = doc.uploadedByName||"";
  document.getElementById("versionField").value         = doc.version||"1.0";
  document.getElementById("notesField").value           = doc.notes||"";
  document.getElementById("visibilityField").value      = doc.visibility||"Internal";
  document.getElementById("othersInvolvedField").value  = doc.othersInvolved||"";

  if (doc.driveFileLink) onDriveUrlInput();

  await populateDocFormDropdowns(doc.offices||[], doc.peopleInvolvedIds||[]);

  // Set tags
  const tagInput = document.getElementById("tagsInput");
  if (tagInput?._setTags) tagInput._setTags(doc.tags||[]);

  openModal("documentModal");
}

async function populateDocFormDropdowns(selectedOffices, selectedPeopleIds) {
  populateOfficeCheckboxes("docOfficesWrap", selectedOffices);
  populatePeopleCheckboxes("docPeopleWrap",  selectedPeopleIds);
}

function resetDocForm() {
  document.getElementById("documentForm")?.reset();
  document.getElementById("urlPreviewSection").style.display = "none";
  document.getElementById("versionField").value  = "1.0";
  document.getElementById("visibilityField").value = "Internal";
  const tagInput = document.getElementById("tagsInput");
  if (tagInput?._setTags) tagInput._setTags([]);
}

function onDriveUrlInput() {
  const url     = document.getElementById("driveUrlField").value.trim();
  const preview = document.getElementById("urlPreviewSection");
  if (!url) { preview.style.display="none"; return; }
  const fileId = extractDriveFileId(url);
  if (!fileId) { preview.style.display="none"; return; }
  const inferredType = inferFileType(url,"");
  document.getElementById("detectedFileId").textContent   = fileId;
  document.getElementById("detectedFileType").textContent = inferredType;
  if (!document.getElementById("fileTypeField").value)
    document.getElementById("fileTypeField").value = inferredType;
  preview.style.display = "block";
}

// ── Check duplicate Drive link ────────────────────────────
async function checkDuplicateDriveLink(fileId, excludeDocId=null) {
  const snap = await db.collection(C.DOCUMENTS)
    .where("driveFileId","==",fileId).get();
  const matches = snap.docs.filter(d => d.id !== excludeDocId);
  return matches.length > 0 ? { id: matches[0].id, ...matches[0].data() } : null;
}

// ── Save document ─────────────────────────────────────────
async function handleDocFormSubmit(e) {
  e.preventDefault();
  const form = document.getElementById("documentForm");
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const btn = document.getElementById("saveDocBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving…';

  try {
    const url       = document.getElementById("driveUrlField").value.trim();
    const fileId    = extractDriveFileId(url);
    if (!fileId) { showToast("Invalid Google Drive link.","error"); return; }

    // Check duplicate
    const dup = await checkDuplicateDriveLink(fileId, _editDocId);
    if (dup) {
      showToast(`This Drive link is already registered as "${dup.fileName||"another document"}".`,"error");
      return;
    }

    const user      = getCurrentUser();
    const people    = getSelectedPeople("docPeopleWrap");
    const offices   = getSelectedOffices("docOfficesWrap");
    const tagInput  = document.getElementById("tagsInput");
    const tags      = tagInput?._getTags ? tagInput._getTags() : [];

    // Tags are required
    if (!tags.length) {
      showToast("Please select at least one tag before saving.","error");
      btn.disabled  = false;
      btn.innerHTML = _editDocId ? "Update Document" : "Save Document";
      return;
    }

    const data = {
      driveFileId          : fileId,
      driveFileLink        : url,
      fileName             : document.getElementById("fileNameField").value.trim(),
      fileType             : document.getElementById("fileTypeField").value,
      dateCreated          : document.getElementById("dateCreatedField").value,
      subject              : document.getElementById("subjectField").value.trim(),
      tags,
      offices,
      peopleInvolvedIds    : people.ids,
      peopleInvolvedNames  : people.names,
      othersInvolved       : document.getElementById("othersInvolvedField").value.trim(),
      visibility           : document.getElementById("visibilityField").value,
      version              : document.getElementById("versionField").value.trim()||"1.0",
      notes                : document.getElementById("notesField").value.trim(),
      lastModifiedBy       : user.id,
      lastModifiedByName   : user.name,
      lastModifiedAt       : nowTimestamp()
    };

    if (_editDocId) {
      // Save history snapshot before update
      const existing = allDocuments.find(d => d.id === _editDocId);
      if (existing) {
        await db.collection(C.DOCUMENTS).doc(_editDocId)
          .collection("history").add({
            snapshotData : { ...existing },
            modifiedBy   : user.id,
            modifiedByName:user.name,
            modifiedAt   : nowTimestamp(),
            changeNote   : "Document updated"
          });
      }
      await db.collection(C.DOCUMENTS).doc(_editDocId).update(data);
      await logAudit("update","document",_editDocId,data.fileName,"Document metadata updated");
      showToast("Document updated.","success");
    } else {
      data.uploadedBy     = user.id;
      data.uploadedByName = user.name;
      data.dateAdded      = nowTimestamp();
      const ref = await db.collection(C.DOCUMENTS).add(data);
      await logAudit("create","document",ref.id,data.fileName,"Document registered");
      showToast("Document registered.","success");
    }

    closeModal("documentModal");
    await fetchDocuments();

  } catch(err) {
    showToast("Error: "+err.message,"error");
  } finally {
    btn.disabled  = false;
    btn.innerHTML = _editDocId ? "Update Document" : "Save Document";
  }
}

// ── Delete document ───────────────────────────────────────
function confirmDeleteDoc(id, name) {
  document.getElementById("deleteDocName").textContent = name;
  document.getElementById("confirmDeleteBtn").onclick  = async () => {
    try {
      await db.collection(C.DOCUMENTS).doc(id).delete();
      await logAudit("delete","document",id,name,"Document deleted");
      closeModal("deleteModal");
      showToast("Document deleted.","success");
      await fetchDocuments();
    } catch(e) { showToast("Error: "+e.message,"error"); }
  };
  openModal("deleteModal");
}

// ── Filter dropdowns ──────────────────────────────────────
function updateFilterDropdowns() {
  const offices = getUniqueValues(allDocuments,"offices");
  const types   = getUniqueValues(allDocuments,"fileType");

  populateSelectOptions("filterOffice", offices, "All Offices");
  populateSelectOptions("filterType",   types,   "All Types");
}

function populateSelectOptions(id, values, placeholder) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = `<option value="">${placeholder}</option>` +
    values.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
  if (cur) sel.value = cur;
}
