# Node.js Data Management Web Application (Google Sheets API Database)

Full-stack **Node.js Web Application** built using **Express.js**, **Google Sheets API** (`google-spreadsheet`), **Bootstrap 5 UI**, and **SheetJS**.

Your Google Spreadsheet serves as the live database:
- **Sheet 1 (`Data`)**: Stores all data records.
- **Sheet 2 (`Users`)**: Stores user accounts and permission roles.

---

## Technical Stack & Dependencies

- **Backend Runtime**: Node.js
- **Web Framework**: Express.js (`server.js`)
- **Database Connector**: Google Sheets API v4 (`google-spreadsheet`, `google-auth-library`)
- **Authentication**: `express-session`, `bcryptjs` password hashing against the `Users` sheet
- **Frontend SPA**: HTML5, CSS3, Vanilla JS, Bootstrap 5, Bootstrap Icons, SheetJS (`xlsx`)

---

## Google Sheets API Setup Instructions

### Step 1: Create or Open a Google Spreadsheet
1. Open [Google Sheets](https://sheets.google.com) and create a **Blank Spreadsheet**.
2. Copy the **Spreadsheet ID** from your browser address bar:
   `https://docs.google.com/spreadsheets/d/`**`YOUR_SPREADSHEET_ID_HERE`**`/edit`
3. Paste your Spreadsheet ID in the `.env` file:
   ```env
   SPREADSHEET_ID=YOUR_SPREADSHEET_ID_HERE
   ```

### Step 2: Set up a Google Service Account
1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a Project and enable the **Google Sheets API**.
3. Create a **Service Account** under **IAM & Admin** > **Service Accounts**.
4. Generate and download a **JSON Key** for the Service Account.
5. Save the downloaded JSON content inside your project folder as `config/credentials.json`.
6. **Share your Google Spreadsheet** with your Service Account email address (e.g. `your-service-account@...iam.gserviceaccount.com`) as **Editor**.

---

## Default Accounts (Auto-Seeded)

When the application runs, it automatically initializes the `Data` and `Users` sheets in your Google Spreadsheet with these default accounts:

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
