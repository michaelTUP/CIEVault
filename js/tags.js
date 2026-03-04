/**
 * tags.js — Tags CRUD + autocomplete for document forms
 */

let allTags = [];

// ── Fetch tags ───────────────────────────────────────────
async function fetchTags() {
  try {
    const cached = await idbLoad("tags");
    if (cached.length) allTags = cached;
    if (!db) return allTags;
    const snap = await db.collection(C.TAGS).orderBy("name","asc").get();
    allTags = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    await idbSave("tags", allTags);
    return allTags;
  } catch(e) { console.warn("fetchTags:", e); return allTags; }
}

// ── Tag autocomplete input ───────────────────────────────
// Attach to an input + a container div for selected pills + a hidden input for raw value
function initTagAutocomplete(inputId, pillsId, suggestId) {
  const input   = document.getElementById(inputId);
  const pills   = document.getElementById(pillsId);
  const suggest = document.getElementById(suggestId);
  if (!input || !pills || !suggest) return;

  let selectedTags = [];

  function refresh() {
    pills.innerHTML = selectedTags.map(t => `
      <span class="tag-pill tag-pill-selected">
        ${escapeHtml(t)}
        <button type="button" onclick="removeTagFromInput('${escapeHtml(t)}','${pillsId}','${suggestId}','${inputId}')">×</button>
      </span>`).join("");
    // store as comma-separated in a hidden field
    const hidden = document.getElementById(inputId + "Hidden");
    if (hidden) hidden.value = selectedTags.join(",");
  }

  function showSuggestions(query) {
    const q = query.toLowerCase().trim();
    if (!q) { suggest.style.display = "none"; return; }
    const matches = allTags.filter(t =>
      t.name.toLowerCase().includes(q) && !selectedTags.includes(t.name)
    );
    if (!matches.length) {
      suggest.innerHTML = `<div class="tag-suggest-none">No matching tags. Ask an admin to add it.</div>`;
      suggest.style.display = "block";
      return;
    }
    suggest.innerHTML = matches.map(t =>
      `<div class="tag-suggest-item" data-name="${escapeHtml(t.name)}">${escapeHtml(t.name)}</div>`
    ).join("");
    suggest.style.display = "block";
    suggest.querySelectorAll(".tag-suggest-item").forEach(el => {
      el.addEventListener("mousedown", e => {
        e.preventDefault();
        selectedTags.push(el.dataset.name);
        input.value = "";
        suggest.style.display = "none";
        refresh();
      });
    });
  }

  input.addEventListener("input",  () => showSuggestions(input.value));
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); input.value = ""; suggest.style.display = "none"; }
    if (e.key === "Backspace" && !input.value && selectedTags.length) {
      selectedTags.pop(); refresh();
    }
  });
  input.addEventListener("blur", () => setTimeout(() => { suggest.style.display = "none"; }, 150));

  // expose setter/getter
  input._setTags = (tags) => { selectedTags = Array.isArray(tags)?[...tags]:[]; refresh(); };
  input._getTags = () => [...selectedTags];
}

// Called by pill × buttons
function removeTagFromInput(tagName, pillsId, suggestId, inputId) {
  const input = document.getElementById(inputId);
  if (!input || !input._setTags) return;
  const current = input._getTags().filter(t => t !== tagName);
  input._setTags(current);
}

// ── Render tags management table ─────────────────────────
function renderTagsTable() {
  const tbody = document.getElementById("tagsTableBody");
  if (!tbody) return;
  if (!allTags.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-3">No tags yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = allTags.map((t,i) => `
    <tr class="animate-row" style="animation-delay:${i*20}ms">
      <td><span class="tag-pill">${escapeHtml(t.name)}</span></td>
      <td class="text-muted small">${formatDate(t.dateCreated)}</td>
      <td onclick="event.stopPropagation()">
        <button class="btn-icon-action" onclick="openEditTagModal('${t.id}')" title="Edit">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn-icon-action btn-delete" onclick="confirmDeleteTag('${t.id}','${escapeHtml(t.name)}')" title="Delete">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>`).join("");
}

// ── Add / Edit tag ───────────────────────────────────────
let _editTagId = null;

function openAddTagModal() {
  _editTagId = null;
  document.getElementById("tagNameInput").value = "";
  document.getElementById("tagModalTitle").textContent = "Add Tag";
  openModal("tagModal");
}

function openEditTagModal(id) {
  const t = allTags.find(x => x.id === id);
  if (!t) return;
  _editTagId = id;
  document.getElementById("tagNameInput").value = t.name;
  document.getElementById("tagModalTitle").textContent = "Edit Tag";
  openModal("tagModal");
}

async function handleTagFormSubmit(e) {
  e.preventDefault();
  const name = document.getElementById("tagNameInput").value.trim();
  if (!name) return;
  const u = getCurrentUser();
  try {
    if (_editTagId) {
      await db.collection(C.TAGS).doc(_editTagId).update({ name });
      await logAudit("update","tag",_editTagId,name,"Tag updated");
      showToast("Tag updated.","success");
    } else {
      // Check duplicate
      const exists = allTags.find(t => t.name.toLowerCase()===name.toLowerCase());
      if (exists) { showToast("Tag already exists.","warning"); return; }
      const ref = await db.collection(C.TAGS).add({ name, createdBy: u.id, dateCreated: nowTimestamp() });
      await logAudit("create","tag",ref.id,name,"Tag added");
      showToast("Tag added.","success");
    }
    closeModal("tagModal");
    await fetchTags();
    renderTagsTable();
  } catch(e) { showToast("Error: "+e.message,"error"); }
}

function confirmDeleteTag(id, name) {
  document.getElementById("deleteTagName").textContent = name;
  document.getElementById("confirmDeleteTagBtn").onclick = async () => {
    try {
      await db.collection(C.TAGS).doc(id).delete();
      await logAudit("delete","tag",id,name,"Tag deleted");
      closeModal("deleteTagModal");
      showToast("Tag deleted.","success");
      await fetchTags();
      renderTagsTable();
    } catch(e) { showToast("Error: "+e.message,"error"); }
  };
  openModal("deleteTagModal");
}
