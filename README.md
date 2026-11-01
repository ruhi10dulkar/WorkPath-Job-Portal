# WorkPath Job Portal

WorkPath is a full-stack job portal for applicants and recruiters. Applicants can discover jobs, manage a profile, apply, and track applications. Recruiters can manage job postings and review applications.

## Features

- Applicant and recruiter accounts with email verification and role-based access.
- Job search, filtering, and detailed job listings.
- Applicant profiles, resume uploads, and application tracking.
- Recruiter job-posting and application-management dashboards.
- Profile-to-job fit scores based on skills, experience, education, and location. Scores are informational and do not make hiring decisions.
- Private storage for resumes and profile photos.

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
