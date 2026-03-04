/**
 * utils.js — Shared helper functions
 */

// ── Google Drive helpers ─────────────────────────────────
function extractDriveFileId(url) {
  if (!url) return null;
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
    /\/presentation\/d\/([a-zA-Z0-9_-]+)/,
    /\/forms\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function getDrivePreviewUrl(fileId) {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

function inferFileType(url, fileName) {
  const s = ((url || "") + " " + (fileName || "")).toLowerCase();
  if (s.includes("spreadsheet") || /\.(xlsx|xls|csv|ods)/.test(s)) return "spreadsheet";
  if (s.includes("presentation") || /\.(pptx|ppt|odp)/.test(s))    return "presentation";
  if (s.includes("document")     || /\.(docx|doc|odt|rtf)/.test(s)) return "document";
  if (/\.pdf/.test(s))  return "pdf";
  if (/\.(jpg|jpeg|png|gif|bmp|webp|svg)/.test(s)) return "image";
  if (/\.(mp4|mov|avi|wmv|mkv|webm)/.test(s))      return "video";
  if (/\.(mp3|wav|ogg|aac|flac|m4a)/.test(s))      return "audio";
  return "other";
}

function fileTypeIcon(type) {
  return ({
    pdf:"fa-file-pdf", document:"fa-file-word", spreadsheet:"fa-file-excel",
    presentation:"fa-file-powerpoint", image:"fa-file-image",
    video:"fa-file-video", audio:"fa-file-audio"
  })[type] || "fa-file";
}

function fileTypeBadgeClass(type) {
  return ({
    pdf:"badge-pdf", document:"badge-doc", spreadsheet:"badge-xls",
    presentation:"badge-ppt", image:"badge-img",
    video:"badge-vid", audio:"badge-aud"
  })[type] || "badge-other";
}

function visibilityBadgeClass(v) {
  return ({Public:"badge-public",Internal:"badge-internal",Confidential:"badge-confidential"})[v] || "badge-internal";
}

// ── Date helpers ─────────────────────────────────────────
function formatDate(val) {
  if (!val) return "—";
  let d = val?.toDate ? val.toDate() : (val instanceof Date ? val : new Date(val));
  if (isNaN(d)) return val;
  return d.toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"});
}

function formatDateTime(val) {
  if (!val) return "—";
  let d = val?.toDate ? val.toDate() : (val instanceof Date ? val : new Date(val));
  if (isNaN(d)) return val;
  return d.toLocaleString("en-US",{year:"numeric",month:"short",day:"numeric",
    hour:"2-digit",minute:"2-digit"});
}

function todayISO() { return new Date().toISOString().split("T")[0]; }
function nowTimestamp() { return firebase.firestore.Timestamp.now(); }

// ── String helpers ───────────────────────────────────────
function escapeHtml(s) {
  const d = document.createElement("div");
  d.appendChild(document.createTextNode(s || ""));
  return d.innerHTML;
}
function parseList(s) {
  return (s||"").split(",").map(x=>x.trim()).filter(Boolean);
}
function listToString(arr) {
  return Array.isArray(arr) ? arr.join(", ") : (arr||"");
}
function initials(name) {
  return (name||"?").split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
}

// ── Avatar color from name ───────────────────────────────
const AVATAR_COLORS = ["#e74c5e","#f59c3c","#3cb4f5","#5bc9a3","#a78bfa","#f97316","#ec4899","#14b8a6"];
function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < (name||"").length; i++) h = (name.charCodeAt(i) + ((h<<5)-h))|0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ── Toast notifications ──────────────────────────────────
function showToast(msg, type = "success") {
  const wrap = document.getElementById("toastContainer");
  if (!wrap) return;
  const icons = {success:"fa-circle-check",error:"fa-circle-xmark",warning:"fa-triangle-exclamation",info:"fa-circle-info"};
  const id = "t" + Date.now();
  wrap.insertAdjacentHTML("beforeend",`
    <div id="${id}" class="dms-toast dms-toast-${type} show">
      <i class="fa-solid ${icons[type]||icons.info}"></i>
      <span>${escapeHtml(msg)}</span>
      <button onclick="document.getElementById('${id}')?.remove()">×</button>
    </div>`);
  setTimeout(() => document.getElementById(id)?.remove(), 4500);
}

// ── Loading overlay ──────────────────────────────────────
function showLoading(show=true) {
  const el = document.getElementById("loadingOverlay");
  if (el) el.style.display = show ? "flex" : "none";
}

// ── Modal helpers ────────────────────────────────────────
function openModal(id)  { new bootstrap.Modal(document.getElementById(id)).show(); }
function closeModal(id) { bootstrap.Modal.getInstance(document.getElementById(id))?.hide(); }

// ── Unique values from array of objects ─────────────────
function getUniqueValues(arr, field) {
  const s = new Set();
  arr.forEach(o => {
    const v = o[field];
    if (Array.isArray(v)) v.forEach(x => s.add(x));
    else if (v) s.add(v);
  });
  return [...s].sort();
}

// ── Debounce ─────────────────────────────────────────────
function debounce(fn, ms=300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(()=>fn(...args), ms); };
}

// ── IndexedDB cache helpers ──────────────────────────────
const IDB_NAME    = "docvault-cache";
const IDB_VERSION = 1;
let _idb = null;

function openIDB() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      ["documents","users","tags","offices"].forEach(store => {
        if (!db.objectStoreNames.contains(store))
          db.createObjectStore(store, { keyPath: "id" });
      });
    };
    req.onsuccess = e => { _idb = e.target.result; res(_idb); };
    req.onerror   = e => rej(e.target.error);
  });
}

async function idbSave(store, items) {
  try {
    const db  = await openIDB();
    const tx  = db.transaction(store, "readwrite");
    const st  = tx.objectStore(store);
    items.forEach(i => st.put(i));
    return new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror    = rej;
    });
  } catch(e) { console.warn("IDB save failed:", e); }
}

async function idbLoad(store) {
  try {
    const db  = await openIDB();
    const tx  = db.transaction(store, "readonly");
    const st  = tx.objectStore(store);
    return new Promise((res, rej) => {
      const req = st.getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror   = rej;
    });
  } catch(e) { console.warn("IDB load failed:", e); return []; }
}

async function idbClear(store) {
  try {
    const db = await openIDB();
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).clear();
  } catch(e) { console.warn("IDB clear failed:", e); }
}
