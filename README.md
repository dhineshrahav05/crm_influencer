# 🌟 Influencer Marketing CRM — Extension, Backend & Dashboard

A production-ready, end-to-end **Influencer Marketing CRM** built with **Node.js, Express, Firebase Firestore, and Manifest V3 Chrome Extension**.

Designed for talent managers, brand marketers, and agency teams to instantly capture Instagram creator profiles in one click, eliminate duplicate records, tag handles, record collaboration notes, and analyze creator metrics from a central dark-mode dashboard.

---

## 🏗️ System Architecture

```text
+-----------------------------------------------------------------------------------+
|                                  USER BROWSER                                     |
|                                                                                   |
|  +-------------------------------------+      +--------------------------------+  |
|  |     Instagram.com Profile Page      |      |     CRM Web Dashboard UI       |  |
|  |  (Floating Shadow DOM "+ Add to CRM") |      |  (http://localhost:5000/dash) |  |
|  +------------------+------------------+      +---------------+----------------+  |
|                     |                                         |                   |
|           Message   | (Scraped JSON)                REST API  | (Fetch & Mutate)  |
|           Passing   v                                 Calls   v                   |
|  +-------------------------------------+                      |                   |
|  |   Manifest V3 Background Worker     |                      |                   |
|  |     (chrome.runtime service)        |                      |                   |
|  +------------------+------------------+                      |                   |
|                     |                                         |                   |
+---------------------|-----------------------------------------|-------------------+
                      |                                         |
                      | HTTP POST / GET                         | HTTP GET / PUT / DELETE
                      v                                         v
+-----------------------------------------------------------------------------------+
|                                  NODE.JS BACKEND                                  |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                       Express REST API Server (Port 5000)                    |  |
|  |   - Express-Validator Middleware   - CORS Handler (Extensions + Localhost)  |  |
|  |   - Static File Server (/dashboard)  - Central Error Middleware             |  |
|  +----------------------------------+------------------------------------------+  |
|                                     |                                             |
+-------------------------------------|---------------------------------------------+
                                      |
                                      v Firebase Admin SDK (Service Account Key)
+-----------------------------------------------------------------------------------+
|                               FIREBASE CLOUD FIRESTORE                            |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                      Collection: "influencers"                              |  |
|  |  - Document ID: lowercased username (e.g., "virat.kohli", "mahi7781")        |  |
|  |  - Fields: name, bio, followers, following, postsCount, isVerified, tags...   |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## ✨ Features

- ⚡ **One-Click Instagram Profile Scraper**: Floating Shadow-DOM widget injected on Instagram profile pages (`+ Add to CRM`) to capture handle, name, bio, follower count, post count, verification status, and avatar URL automatically.
- 🛡️ **Guaranteed Duplicate Prevention**: Document IDs in Cloud Firestore map 1-to-1 with the creator's lowercased handle (e.g., `influencers/virat.kohli`). Re-submitting an existing profile returns a clean `409 Conflict` response and turns the extension button to `✓ In CRM`.
- 🏷️ **Automatic Tag & Handle Extraction**: Automatically parses tagged accounts (`@mahi7781` -> `#mahi7781`) and hashtags (`#cricket` -> `#cricket`) from biographies into interactive tag chips.
- 📊 **Real-Time KPI Metric Cards**: Live counters for total creators in CRM, combined audience reach, most-used category tag, and verified creator ratio.
- 🔍 **Debounced Search & Filtering**: Multi-field search across handle, name, bio, notes, and tags with automatic debouncing and dynamic tag filter dropdowns.
- 📝 **Tags & Collaboration Notes**: Manage custom campaign tags and internal pricing/deliverable notes with inline double-click or modal editing.
- 🎨 **Modern Glassmorphic Dark UI**: High-contrast slate design system built with CSS custom properties, micro-animations, accessible tooltips, and toast notifications.

---

## ⚡ Prerequisites

- **Node.js**: v18.0.0 or higher ([Download Node.js](https://nodejs.org/))
- **npm**: v9.0.0 or higher
- **Google Chrome**: Manifest V3 compliant web browser
- **Firebase Account**: Free Google Cloud / Firebase account to host Cloud Firestore

---

## 🚀 Step-by-Step Setup Guide

### Step 1: Create a Firebase Project & Service Account Key

1. Go to the [Firebase Console](https://console.firebase.google.com/) and click **"Add project"**.
2. Name your project (e.g., `influencer-crm`) and complete setup.
3. In the left sidebar, navigate to **Build > Firestore Database** and click **"Create database"**.
4. Choose **Start in production mode** (or test mode) and select a database location.
5. Click the **Gear icon (⚙️)** next to *Project Overview* -> **Project settings** -> **Service accounts**.
6. Click **"Generate new private key"** and confirm.
7. Save the downloaded JSON file as `serviceAccountKey.json` inside the `backend/` directory:
   ```text
   CRM_influencer/backend/serviceAccountKey.json
   ```

> ⚠️ **Security Note**: `serviceAccountKey.json` and `.env` contain private credentials and are listed in `.gitignore`. Never commit them to source control.

---

### Step 2: Configure & Run Backend Server

1. Open your terminal and navigate to `backend/`:
   ```bash
   cd backend
   npm install
   ```
2. Create environment file `backend/.env`:
   ```env
   PORT=5000
   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
   ```
3. Start the backend server in development mode:
   ```bash
   npm run dev
   ```
   *(Or on Windows CMD if script execution policies are restricted: `cmd /c npm run dev`)*

Once started, the server will output:
```text
============================================================
  🚀 Influencer Marketing CRM Server Running!
  ----------------------------------------------------------
  📡 API Base:      http://localhost:5000/api
  📊 Dashboard:     http://localhost:5000/dashboard
  🩺 Health check:  http://localhost:5000/api/health
============================================================
```

---

### Step 3: Load the Unpacked Chrome Extension

1. Open **Google Chrome** and navigate to:
   ```text
   chrome://extensions
   ```
2. Toggle ON **"Developer mode"** in the top-right corner.
3. Click the **"Load unpacked"** button in the top-left corner.
4. Select the **`extension/`** directory inside this repository:
   ```text
   CRM_influencer/extension
   ```
5. The **Influencer CRM Saver** extension icon will appear in your Chrome toolbar!

---

## 📖 Usage Guide

1. **Scraping Profiles**:
   - Ensure the backend server is running at `http://localhost:5000`.
   - Visit any public Instagram profile (e.g. `https://www.instagram.com/virat.kohli/`).
   - The floating **`+ Add to CRM`** widget will appear in the bottom-right corner.
   - Click **`+ Add to CRM`**. The widget will display `Saving...` and change to `✓ In CRM` with a success toast notification.

2. **Viewing & Managing Talent in Dashboard**:
   - Open [http://localhost:5000/dashboard](http://localhost:5000/dashboard) in your browser.
   - View live KPI cards, search profiles, filter by tags, edit notes, or remove creators.

---

## 🌐 REST API Reference

All endpoints return JSON responses.

### 1. Health Check
```http
GET /api/health
```
**Response (200 OK):**
```json
{
  "status": "ok",
  "service": "Influencer Marketing CRM API",
  "uptime": 142,
  "timestamp": "2026-10-07T12:00:00.000Z"
}
```

---

### 2. Check If Creator Exists in CRM
```http
GET /api/influencers/check/:username
```
**Response (200 OK):**
```json
{
  "exists": true,
  "username": "virat.kohli",
  "data": { "username": "virat.kohli", "name": "Virat Kohli", "followers": 271400000 }
}
```

---

### 3. Create Creator
```http
POST /api/influencers
Content-Type: application/json
```
**Payload:**
```json
{
  "username": "virat.kohli",
  "name": "Virat Kohli",
  "profileUrl": "https://www.instagram.com/virat.kohli/",
  "bio": "Carpediem!",
  "followers": 271400000,
  "following": 4,
  "postsCount": 112,
  "isVerified": true,
  "profilePicUrl": "https://instagram.fcc...cdn.jpg",
  "tags": ["cricket", "athlete"],
  "notes": "Top tier sports influencer."
}
```
**Success Response (201 Created):**
```json
{
  "message": "Influencer added to CRM successfully.",
  "data": { ... }
}
```
**Conflict Response (409 Conflict):**
```json
{
  "message": "Influencer already exists",
  "data": { ... }
}
```

---

### 4. List Creators (Search, Filter, Sort)
```http
GET /api/influencers?search=cricket&tag=athlete&sort=followers&order=desc
```
**Query Parameters:**
- `search` *(optional)*: Search string matching name, handle, bio, notes, or tags.
- `tag` *(optional)*: Filter by exact tag name.
- `sort` *(optional)*: `createdAt` (default) or `followers`.
- `order` *(optional)*: `desc` (default) or `asc`.

---

### 5. Update Creator
```http
PUT /api/influencers/:username
Content-Type: application/json
```
**Payload:**
```json
{
  "notes": "Sent rate card request for Q4 campaign.",
  "tags": ["cricket", "brand_partner"]
}
```

---

### 6. Delete Creator
```http
DELETE /api/influencers/:username
```

---

## 📁 Project Structure

```text
CRM_influencer/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── firebase.js             # Firebase Admin initialization & helper formats
│   │   ├── controllers/
│   │   │   └── influencerController.js # CRUD, Firestore query filters, sanitization
│   │   ├── middleware/
│   │   │   └── validate.js             # Request validation rules
│   │   ├── routes/
│   │   │   └── influencers.js          # Express router endpoints
│   │   └── server.js                   # Main Express app, CORS, static server
│   ├── .env.example                    # Sample environment variables
│   ├── .gitignore                      # Ignore credentials & node_modules
│   ├── package.json                    # Dependencies & start scripts
│   └── serviceAccountKey.json          # Firebase Private Key (Local only)
├── dashboard/
│   ├── index.html                      # Semantic dashboard HTML structure
│   ├── styles.css                      # Glassmorphic dark design system
│   └── app.js                          # Vanilla JS controller & view renderer
├── extension/
│   ├── manifest.json                   # Manifest V3 extension configuration
│   ├── icons/                          # Extension icons (16x16, 48x48, 128x128)
│   └── src/
│       ├── background/background.js    # Service worker API bridge & storage
│       ├── content/content.js          # Injected content script & Shadow DOM FAB
│       ├── content/content.css         # Extension widget styling
│       ├── popup/popup.html, js, css   # Settings popup & recent saves list
│       └── utils/
│           ├── parse.js                # Metric suffix & route parser
│           └── scraper.js              # Multi-strategy Instagram DOM scraper
├── .gitignore                          # Root ignore rules
└── README.md                           # Documentation & Setup Guide
```

---

## ⚠️ Known Limitations

1. **Instagram DOM Changes**: Instagram frequently updates its web markup and CSS classes. The scraper uses fallback strategies (Page JSON -> DOM Heuristics -> Meta Tags) to remain resilient, but major DOM overhauls may require updating selectors.
2. **Public Data Scope**: Only publicly accessible profile details (followers, bio, name, avatar, posts count) are scraped. Private profiles or private engagement metrics (story views, DM rates) are not available without account authentication.
3. **Scraping vs. Official Graph API**: This extension uses client-side DOM scraping to bypass complex Meta App Review approvals. For enterprise production scale, integration with the official Instagram Graph API is recommended.

---

## 🔮 Future Improvements

- 📤 **CSV / JSON Export**: One-click export of CRM records for campaign reporting.
- 📈 **Engagement Rate Estimator**: Automatic calculation of engagement rate based on recent public post likes and comments.
- 📱 **Multi-Platform Support**: Expand extension scraper to support TikTok, YouTube, and X (Twitter) creator profiles.
