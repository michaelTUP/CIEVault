/**
 * utils.js — Shared utility functions
 */

// ─────────────────────────────────────────────────────────
// Google Drive helpers
// ─────────────────────────────────────────────────────────

/**
 * Extracts the Google Drive file ID from various URL formats:
 *   • /file/d/{id}/view
 *   • /file/d/{id}/edit
 *   • /open?id={id}
 *   • docs.google.com/spreadsheets/d/{id}
 *   • docs.google.com/document/d/{id}
 *   • docs.google.com/presentation/d/{id}
 */
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
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Returns a Google Drive embed/preview URL for the given file ID.
 */
function getDrivePreviewUrl(fileId) {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

/**
 * Returns a thumbnail URL for the given file ID.
 */
function getDriveThumbnailUrl(fileId) {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w100`;
}

/**
 * Infers file type from URL and/or filename.
 * Returns one of: pdf, document, spreadsheet, presentation, image, video, audio, other
 */
function inferFileType(url, fileName) {
  const combined = ((url || "") + " " + (fileName || "")).toLowerCase();

  if (combined.includes("spreadsheet") || /\.(xlsx|xls|csv|ods)/.test(combined)) return "spreadsheet";
  if (combined.includes("presentation") || /\.(pptx|ppt|odp)/.test(combined)) return "presentation";
  if (combined.includes("document") || /\.(docx|doc|odt|rtf)/.test(combined)) return "document";
  if (/\.pdf/.test(combined)) return "pdf";
  if (/\.(jpg|jpeg|png|gif|bmp|webp|svg)/.test(combined)) return "image";
  if (/\.(mp4|mov|avi|wmv|mkv|webm)/.test(combined)) return "video";
  if (/\.(mp3|wav|ogg|aac|flac|m4a)/.test(combined)) return "audio";
  return "other";
}

/**
 * Returns the Font Awesome icon class for a file type.
 */
function fileTypeIcon(type) {
  const icons = {
    pdf:          "fa-file-pdf",
    document:     "fa-file-word",
    spreadsheet:  "fa-file-excel",
    presentation: "fa-file-powerpoint",
    image:        "fa-file-image",
    video:        "fa-file-video",
    audio:        "fa-file-audio",
    other:        "fa-file"
  };
  return icons[type] || "fa-file";
}

/**
 * Returns a Bootstrap badge color class for a file type.
 */
function fileTypeBadgeColor(type) {
  const colors = {
    pdf:          "badge-pdf",
    document:     "badge-doc",
    spreadsheet:  "badge-xls",
    presentation: "badge-ppt",
    image:        "badge-img",
    video:        "badge-vid",
    audio:        "badge-aud",
    other:        "badge-other"
  };
  return colors[type] || "badge-other";
}

/**
 * Returns a badge color for visibility level.
 */
function visibilityBadgeColor(visibility) {
  const map = {
    "Public":       "badge-public",
    "Internal":     "badge-internal",
    "Confidential": "badge-confidential"
  };
  return map[visibility] || "badge-internal";
}

// ─────────────────────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────────────────────
function formatDate(value) {
  if (!value) return "—";
  let d;
  if (value?.toDate) d = value.toDate();           // Firestore Timestamp
  else if (value instanceof Date) d = value;
  else d = new Date(value);
  if (isNaN(d)) return value;
  return d.toLocaleDateString("en-US", { year:"numeric", month:"short", day:"numeric" });
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

// ─────────────────────────────────────────────────────────
// String helpers
// ─────────────────────────────────────────────────────────
function escapeHtml(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str || ""));
  return div.innerHTML;
}

function slugify(str) {
  return (str || "").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

/** Parses a comma-separated string into a trimmed array */
function parseList(str) {
  return (str || "").split(",").map(s => s.trim()).filter(Boolean);
}

/** Converts an array to a comma-separated string */
function listToString(arr) {
  return Array.isArray(arr) ? arr.join(", ") : (arr || "");
}

// ─────────────────────────────────────────────────────────
// Toast notification
// ─────────────────────────────────────────────────────────
function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const id = "toast-" + Date.now();
  const icons = { success: "fa-circle-check", error: "fa-circle-xmark", warning: "fa-triangle-exclamation", info: "fa-circle-info" };
  const html = `
    <div id="${id}" class="toast dms-toast dms-toast-${type} align-items-center show" role="alert">
      <div class="d-flex align-items-center gap-2 p-3">
        <i class="fa-solid ${icons[type] || icons.info}"></i>
        <span>${escapeHtml(message)}</span>
        <button type="button" class="btn-close btn-close-white ms-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>`;
  container.insertAdjacentHTML("beforeend", html);
  setTimeout(() => {
    const el = document.getElementById(id);
    if (el) el.remove();
  }, 4000);
}

// ─────────────────────────────────────────────────────────
// Loading overlay
// ─────────────────────────────────────────────────────────
function showLoading(show = true) {
  const el = document.getElementById("loadingOverlay");
  if (el) el.style.display = show ? "flex" : "none";
}

// ─────────────────────────────────────────────────────────
// Unique values helper for filter dropdowns
// ─────────────────────────────────────────────────────────
function getUniqueValues(docs, field) {
  const set = new Set();
  docs.forEach(doc => {
    const val = doc[field];
    if (Array.isArray(val)) val.forEach(v => set.add(v));
    else if (val) set.add(val);
  });
  return [...set].sort();
}
