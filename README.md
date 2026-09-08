# Node.js Data Management Web Application (Cloudflare R2 Database)

Full-stack **Node.js Web Application** built using **Express.js**, **Cloudflare R2 (S3 API)**, **Bootstrap 5 UI**, and **SheetJS**.

Cloudflare R2 serves as the primary live database:
- **`data/records.json`**: Stores all data records.
- **`data/users.json`**: Stores user accounts and permission roles.
- **`data/delete_requests.json`**: Stores delete requests and audit trails.
- **`data/edit_requests.json`**: Stores edit requests and approval status.
- **`data/list_add_requests.json`**: Stores dropdown add requests.
- **`data/remark_options.json`**: Stores dynamic dropdown options.
- **`data/system_settings.json`**: Stores system settings.

---

## Technical Stack & Dependencies

- **Backend Runtime**: Node.js
- **Web Framework**: Express.js (`server.js`)
- **Database Engine**: Cloudflare R2 via AWS S3 SDK (`@aws-sdk/client-s3`)
- **Authentication**: `cookie-session`, `bcryptjs` password hashing against Cloudflare users
- **Frontend SPA**: HTML5, CSS3, Vanilla JS, Bootstrap 5, Bootstrap Icons, SheetJS (`xlsx`)

---

## Cloudflare R2 Configuration (.env)

All Cloudflare API credentials are stored securely in `.env`:
```env
# Server Configuration
PORT=3000
SESSION_SECRET=a_very_secure_secret_key_12345

# Cloudflare R2 S3 API Configuration
CLOUDFLARE_ACCOUNT_ID="d3256a283a9793df959adf1319132806"
CLOUDFLARE_R2_ENDPOINT="https://d3256a283a9793df959adf1319132806.r2.cloudflarestorage.com"
CLOUDFLARE_R2_ACCESS_KEY_ID="52351084215d9bf76974cde9dfc64256"
CLOUDFLARE_R2_SECRET_ACCESS_KEY="db57659ad71fba605ec3da2d473c31a50e0690e5e6d70d1995692d6e2fab815a"
CLOUDFLARE_R2_BUCKET_NAME="jam-data"
```

---

## Default Accounts (Auto-Seeded)

When the application runs, it automatically initializes with these default accounts:

| Username | Password | Role | Import Perm. | Full Access | Status | Capabilities |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Admin** | `Admin@123` | `Admin` | `Yes` | `Yes` | `Active` | Full system access, User Management, Import/Export |
| **Add** | `Add@123` | `Add` | `No` | `No` | `Active` | Add records, Edit/Delete own records <24h |
| **View** | `View@123` | `View` | `No` | `No` | `Active` | Read-only view, Search, Filter, Download Excel/PDF/Print |

---

## How to Run the Website

### Start the Server:
```cmd
npm start
```

### Access in Browser:
```text
http://localhost:3000
```
Sign in with `Admin` / `Admin@123`!
