# JAM Portal - React.js + Node.js + Cloudflare R2

Enterprise Data Management Portal built with **React.js (Vite)**, **Node.js (Express)**, **Cloudflare R2 Object Storage**, and **Bootstrap 5 / Modern 3D Cyber Theme**.

---

## 🚀 Architecture Overview

- **Frontend (`client/`)**:
  - React 18 with Vite
  - React Router DOM v6
  - Dual-Theme System: `Classic UI` & `Modern 3D Cyber UI` (with dynamic WebGL 3D Canvas background)
  - 15 Interactive Modals (Add, Edit, View, Delete, Requests, Approvals, User Management, Police Stations)
  - Global Keyboard Shortcut `/` for instant search bar activation
  - 12-Hour Modification Protection for normal users
  - Single-Click Prevention on record submissions
- **Backend (`server.js`, `routes/`, `middleware/`, `config/`)**:
  - Node.js & Express.js (Vercel Serverless Function compatible)
  - HTTP Gzip/Deflate Compression (`compression`) for 80-90% faster transfers
  - Non-blocking In-Memory Cache with asynchronous background Cloudflare R2 synchronization
  - Session authentication with `cookie-session` and `bcryptjs`
- **Database & Storage**:
  - **Cloudflare R2**: Persistent single source of truth for records, users, requests, options, and police stations.
  - **Local SQLite / JSON**: Resilient offline fallback and startup cache.
  - **Google Sheets**: **100% Removed** from application data storage and dependencies.
- **Deployment**:
  - Pre-configured for **Vercel** serverless hosting with SPA rewrites.

---

## 🛠️ Project Structure

```text
JAM data/
├── client/                     # React.js + Vite Frontend
│   ├── public/                 # Static assets (3D background engine)
│   ├── src/
│   │   ├── components/         # Navbar, Sidebar, 3D Canvas, Modals (15 Modals)
│   │   ├── context/            # AuthContext & ThemeContext
│   │   ├── layouts/            # MainLayout (Shell)
│   │   ├── pages/              # Dashboard, Records, Import, Requests, Users, PS, Settings, Login
│   │   ├── services/           # Unified API client (fetch)
│   │   ├── styles/             # style.css (Classic & Modern 3D Cyber CSS)
│   │   ├── App.jsx             # React Router routing
│   │   └── main.jsx            # React root entry
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── config/
│   ├── cloudflareStorage.js    # Cloudflare R2 Storage & Cache Engine
│   └── database.js             # SQLite schema & helpers
│
├── routes/                     # Express REST API routes
│   ├── authRoutes.js           # Login, logout, session, password change
│   ├── recordRoutes.js         # Records CRUD, search, filter, 12h rule, options
│   ├── deleteRequestRoutes.js  # Delete requests submit, approve, reject
│   ├── editRequestRoutes.js    # Edit requests submit, approve, reject
│   ├── listAddRequestRoutes.js # Dropdown option requests submit, approve, reject
│   ├── psRoutes.js             # 15,082 Police Stations directory search & CRUD
│   ├── userRoutes.js           # Admin user management & permissions
│   ├── importRoutes.js         # Excel/CSV batch data import
│   └── exportRoutes.js         # Excel/CSV data export
│
├── middleware/
│   └── auth.js                 # Session validation, role & permission guards, 12h rule
│
├── data/                       # Local JSON cache files
├── _backup_original/           # Backup of original vanilla project files
├── .env.example                # Example environment variables template
├── package.json                # Root package configuration
├── server.js                   # Express server entry point
├── vercel.json                 # Vercel deployment configuration
└── README.md
```

---

## 💻 Local Development Setup

### 1. Install Dependencies
```bash
# Install root backend dependencies
npm install

# Install client React dependencies
cd client
npm install
cd ..
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory based on `.env.example`:
```env
PORT=3000
SESSION_SECRET=your_random_secret_here
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_key
CLOUDFLARE_R2_BUCKET_NAME=jam-data
```

### 3. Build & Run
```bash
# Build the React frontend
npm run build

# Start the Node.js server (serves API & compiled React frontend on http://localhost:3000)
npm start
```

### 4. Concurrent Development Mode (Optional)
To run Vite's hot-reloading dev server:
```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Start Vite React dev server
npm run client:dev
```
Open `http://localhost:5173` for Vite HMR (API calls are proxied to port 3000).

---

## ☁️ Vercel Deployment

1. Connect the repository to Vercel.
2. In Project Settings:
   - **Framework Preset**: Other / Node.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `client/dist`
3. Add Environment Variables in Vercel Dashboard:
   - `SESSION_SECRET`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_R2_ENDPOINT`
   - `CLOUDFLARE_R2_ACCESS_KEY_ID`
   - `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
   - `CLOUDFLARE_R2_BUCKET_NAME`
4. Deploy!
