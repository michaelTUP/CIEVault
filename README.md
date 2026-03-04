# 📁 DocVault — Document Management System

A complete client-side Document Management System that runs on **GitHub Pages** with **Firebase Firestore** for metadata storage and **Google Drive** for file hosting.

---

## 🚀 Quick Start

### 1. Fork / Clone this Repository

```bash
git clone https://github.com/YOUR_USERNAME/docvault.git
cd docvault
```

### 2. Create a Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add Project** → give it a name → continue
3. In the left sidebar: **Build → Firestore Database**
4. Click **Create database** → choose **Start in test mode** → select a region → Done
5. Go to **Project Settings** (⚙️ gear icon) → **Your Apps** → click the web icon `</>`
6. Register an app → copy the `firebaseConfig` object shown

### 3. Configure Firebase

Open `js/firebase-config.js` and replace the placeholder config:

```js
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

### 4. Deploy to GitHub Pages

1. Push your code to GitHub
2. Go to **Settings → Pages**
3. Under **Source**, select `main` branch → `/ (root)` folder
4. Click **Save** — your site will be live at `https://YOUR_USERNAME.github.io/docvault/`

> **First load**: Sample data will be seeded automatically if the database is empty.

---

## 🔒 Firebase Security Rules (Recommended for Production)

In Firebase Console → Firestore → Rules, replace the default rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write for authenticated users only (add Firebase Auth for this)
    match /documents/{doc} {
      allow read, write: if true;  // Change to: request.auth != null
    }
    match /people/{person} {
      allow read, write: if true;  // Change to: request.auth != null
    }
  }
}
```

---

## 📂 Project Structure

```
docvault/
├── index.html              # Main application (single page)
├── css/
│   └── styles.css          # All custom styles
├── js/
│   ├── firebase-config.js  # ★ CONFIGURE THIS: Firebase credentials + sample data
│   ├── utils.js            # Shared helpers (Drive URL parsing, formatting, toasts)
│   ├── documents.js        # Document CRUD + table rendering + preview modal
│   ├── people.js           # People directory CRUD + rendering
│   ├── search.js           # Search, filter, and sort logic
│   └── app.js              # App bootstrap, navigation, dashboard
└── README.md
```

---

## ✨ Features

| Feature | Details |
|---|---|
| **Document Registration** | Paste any Google Drive URL → auto-detects file ID and type |
| **Google Drive Preview** | Embedded iframe preview for PDF, Word, Excel, PPT, images, video |
| **Metadata Storage** | Firestore stores: filename, type, subject, tags, people, dept, visibility, version, notes |
| **Search** | Full-text across subject, tags, filename, department, people |
| **Filters** | Department, file type, people involved, visibility, date range |
| **Sort** | Click column headers to sort by filename, department, or date |
| **People Directory** | Track staff with department, position, email, status |
| **Dashboard** | Document counts by type, by department, recent activity |
| **Responsive** | Works on desktop, tablet, and mobile |

---

## 🔗 Supported Google Drive URL Formats

```
https://drive.google.com/file/d/{FILE_ID}/view
https://drive.google.com/file/d/{FILE_ID}/edit
https://docs.google.com/spreadsheets/d/{FILE_ID}
https://docs.google.com/document/d/{FILE_ID}
https://docs.google.com/presentation/d/{FILE_ID}
https://drive.google.com/open?id={FILE_ID}
```

---

## 🗄️ Firestore Data Schema

### `documents` collection

| Field | Type | Description |
|---|---|---|
| `id` | auto | Firestore document ID |
| `driveFileId` | string | Google Drive file ID |
| `driveFileLink` | string | Original Drive URL |
| `fileName` | string | Display name with extension |
| `fileType` | string | pdf / document / spreadsheet / presentation / image / video / audio / other |
| `dateCreated` | string | ISO date the original file was created |
| `dateAdded` | timestamp | When the record was added to the DMS |
| `subject` | string | Short descriptive title |
| `tags` | array | Searchable keywords |
| `peopleInvolved` | array | Names of staff associated with the document |
| `departmentOrOffice` | string | Originating department |
| `uploadedBy` | string | Who registered the document |
| `version` | string | Document version number |
| `notes` | string | Free-form notes |
| `visibility` | string | Public / Internal / Confidential |

### `people` collection

| Field | Type | Description |
|---|---|---|
| `id` | auto | Firestore document ID |
| `name` | string | Full name |
| `department` | string | Department name |
| `position` | string | Job title |
| `email` | string | Email address |
| `status` | string | Active / Inactive |
| `dateAdded` | timestamp | When added to the directory |

---

## 🛠️ Tech Stack

- **HTML5 / CSS3 / JavaScript (ES6+)**
- **Bootstrap 5.3** — responsive layout and modals
- **Font Awesome 6** — icons
- **Firebase Firestore 9** (compat mode) — metadata database
- **Google Drive** — file storage and embedded preview
- **Google Fonts** — Syne + DM Sans

---

*DocVault runs 100% client-side — no backend server required.*
