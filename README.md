# WorkPath Job Portal

WorkPath is a full-stack job portal for applicants and recruiters. Applicants can discover jobs, manage a profile, apply, and track applications. Recruiters can manage job postings and review applications.

## Technology

- Frontend: React 19 and Vite
- Backend: Node.js, Express, and Mongoose
- Database: MongoDB

## Requirements

- Node.js and npm
- A MongoDB instance, local or MongoDB Atlas

## Run locally

Open two terminals from the project root.

### 1. Configure the API

In PowerShell:

```powershell
Copy-Item server\.env.example server\.env
```

Edit `server\.env` and set `MONGO_URI`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET`. The example file documents the other available settings. Keep real credentials in `server\.env`; it is excluded from Git.

Install dependencies and start the API:

```powershell
cd server
npm ci
npm run dev
```

The API starts on port `5000` by default. `GET http://localhost:5000/api/health` reports whether it can connect to MongoDB.

### 2. Start the frontend

In the second terminal, from the project root:

```powershell
cd client
npm ci
npm run dev
```

Open the local URL printed by Vite (by default, `http://localhost:5173`). The API allows that origin by default; set `CLIENT_ORIGIN` in `server\.env` if the frontend uses a different origin.

## Checks

Run these from their respective directories:

```powershell
# In server\
npm test

# In client\
npm run lint
npm run build
```

## Project layout

```text
client/       React application
server/       Express API, MongoDB models, and tests
IMPLEMENTED_WORK.md
              Feature and implementation overview
JOB_FIT.md    Job Fit scoring behavior
```

See [IMPLEMENTED_WORK.md](IMPLEMENTED_WORK.md) for a more detailed feature overview and [JOB_FIT.md](JOB_FIT.md) for the matching-score specification.
[PROJECT_RECAP.md](PROJECT_RECAP.md) is an older snapshot; use the implementation overview for the current feature set.

## Upload to GitHub

1. Create a **new, empty repository** on [GitHub](https://github.com/new). Do not initialize it with a README, license, or `.gitignore` because this project already has files for those purposes.
2. From PowerShell, open the project root and check that local-only files are ignored:

   ```powershell
   cd D:\Projects\jobPortal
   git check-ignore server\.env server\node_modules server\private_uploads client\node_modules client\dist
   ```

   Each path should be reported as ignored. If `server\.env` was already staged or committed in an earlier Git history, ignoring it now will not remove it from that history; remove any exposed credentials and rotate them.
3. This workspace's local Git repository is already initialized. Stage the project and inspect what will be uploaded:

   ```powershell
   git add .
   git status --short
   ```

   Confirm that `.env` files (except `server/.env.example`), `node_modules`, build output, and private uploads are not listed before proceeding.
4. Commit and connect the empty GitHub repository. Replace the URL with the one shown on GitHub:

   ```powershell
   git commit -m "Initial project upload"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
   git push -u origin main
   ```

GitHub will prompt you to authenticate if needed. Never push real passwords, tokens, database connection strings, or private user uploads.
