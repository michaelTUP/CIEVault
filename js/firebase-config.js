/**
 * firebase-config.js
 * ─────────────────────────────────────────────────────────
 * Firebase project configuration and initialization.
 *
 * ► HOW TO SET UP YOUR OWN FIREBASE PROJECT:
 *   1. Go to https://console.firebase.google.com
 *   2. Create a new project (or use an existing one)
 *   3. Project Settings → General → Your Apps → Add Web App
 *   4. Copy your firebaseConfig object and replace below
 *   5. Firestore Database → Create database (test mode to start)
 * ─────────────────────────────────────────────────────────
 */

// ★ REPLACE THIS WITH YOUR OWN FIREBASE CONFIG ★
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Collection names
const COLLECTIONS = {
  DOCUMENTS: "documents",
  PEOPLE: "people"
};

// ─────────────────────────────────────────────────────────
// Sample seed data
// ─────────────────────────────────────────────────────────
const SAMPLE_PEOPLE = [
  { name: "Maria Santos",    department: "Finance",    position: "Finance Manager",      email: "m.santos@company.com",    status: "Active", dateAdded: firebase.firestore.Timestamp.now() },
  { name: "Juan dela Cruz",  department: "IT",         position: "Systems Administrator",email: "j.delacruz@company.com",  status: "Active", dateAdded: firebase.firestore.Timestamp.now() },
  { name: "Ana Reyes",       department: "HR",         position: "HR Officer",           email: "a.reyes@company.com",     status: "Active", dateAdded: firebase.firestore.Timestamp.now() },
  { name: "Carlos Mendoza",  department: "Operations", position: "Operations Lead",      email: "c.mendoza@company.com",   status: "Active", dateAdded: firebase.firestore.Timestamp.now() },
  { name: "Luz Villanueva",  department: "Legal",      position: "Legal Counsel",        email: "l.villanueva@company.com",status: "Active", dateAdded: firebase.firestore.Timestamp.now() }
];

const SAMPLE_DOCUMENTS = [
  {
    driveFileId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",
    driveFileLink: "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",
    fileName: "Q1 Budget Report 2024.xlsx",
    fileType: "spreadsheet",
    dateCreated: "2024-01-15",
    subject: "Q1 Budget Report",
    tags: ["budget","finance","Q1","2024"],
    peopleInvolved: ["Maria Santos","Carlos Mendoza"],
    departmentOrOffice: "Finance",
    uploadedBy: "Maria Santos",
    version: "1.0",
    notes: "Quarterly budget analysis for all departments.",
    visibility: "Internal",
    dateAdded: firebase.firestore.Timestamp.now()
  },
  {
    driveFileId: "1Mf9GBpiNmHpJxDrLAOIK3-yWnRTkjPpV",
    driveFileLink: "https://drive.google.com/file/d/1Mf9GBpiNmHpJxDrLAOIK3-yWnRTkjPpV",
    fileName: "Employee Handbook 2024.pdf",
    fileType: "pdf",
    dateCreated: "2024-01-02",
    subject: "Employee Handbook",
    tags: ["HR","policy","handbook","employees"],
    peopleInvolved: ["Ana Reyes"],
    departmentOrOffice: "HR",
    uploadedBy: "Ana Reyes",
    version: "3.2",
    notes: "Updated handbook with new hybrid work policies.",
    visibility: "Public",
    dateAdded: firebase.firestore.Timestamp.now()
  },
  {
    driveFileId: "1aBcDeFgHiJkLmNoPqRsTuVwXyZ",
    driveFileLink: "https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ",
    fileName: "IT Infrastructure Upgrade Proposal.docx",
    fileType: "document",
    dateCreated: "2024-02-10",
    subject: "IT Infrastructure Upgrade Proposal",
    tags: ["IT","infrastructure","proposal","network"],
    peopleInvolved: ["Juan dela Cruz","Carlos Mendoza"],
    departmentOrOffice: "IT",
    uploadedBy: "Juan dela Cruz",
    version: "2.0",
    notes: "Proposal for network upgrade and server migration.",
    visibility: "Confidential",
    dateAdded: firebase.firestore.Timestamp.now()
  },
  {
    driveFileId: "1zYxWvUtSrQpOnMlKjIhGfEdCbA",
    driveFileLink: "https://drive.google.com/file/d/1zYxWvUtSrQpOnMlKjIhGfEdCbA",
    fileName: "Service Agreement - Vendor XYZ.pdf",
    fileType: "pdf",
    dateCreated: "2024-03-05",
    subject: "Service Level Agreement",
    tags: ["legal","contract","vendor","SLA"],
    peopleInvolved: ["Luz Villanueva","Maria Santos"],
    departmentOrOffice: "Legal",
    uploadedBy: "Luz Villanueva",
    version: "1.1",
    notes: "Annual SLA renewal with updated penalty clauses.",
    visibility: "Confidential",
    dateAdded: firebase.firestore.Timestamp.now()
  },
  {
    driveFileId: "1pQrStUvWxYzAbCdEfGhIjKlMnOp",
    driveFileLink: "https://drive.google.com/file/d/1pQrStUvWxYzAbCdEfGhIjKlMnOp",
    fileName: "Operations Monthly Report - March.pptx",
    fileType: "presentation",
    dateCreated: "2024-03-31",
    subject: "Monthly Operations Report",
    tags: ["operations","monthly report","KPIs"],
    peopleInvolved: ["Carlos Mendoza"],
    departmentOrOffice: "Operations",
    uploadedBy: "Carlos Mendoza",
    version: "1.0",
    notes: "March operations summary with KPI dashboard.",
    visibility: "Internal",
    dateAdded: firebase.firestore.Timestamp.now()
  }
];

/**
 * Seeds Firestore with sample data if the documents collection is empty.
 */
async function seedSampleData() {
  try {
    const snap = await db.collection(COLLECTIONS.DOCUMENTS).limit(1).get();
    if (!snap.empty) return;
    console.log("Seeding sample data…");
    const batch = db.batch();
    SAMPLE_PEOPLE.forEach(p  => batch.set(db.collection(COLLECTIONS.PEOPLE).doc(), p));
    SAMPLE_DOCUMENTS.forEach(d => batch.set(db.collection(COLLECTIONS.DOCUMENTS).doc(), d));
    await batch.commit();
    console.log("Sample data seeded.");
  } catch (err) {
    console.warn("Seed skipped (Firebase not configured):", err.message);
  }
}
