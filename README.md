<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# closet.city – Local Development

The project now runs as a two-tier app:

1. A Vite + React frontend (this directory).
2. A lightweight Node.js gateway in [`backend/`](backend) that proxies all Gemini requests so API keys stay server-side.

View the latest AI Studio snapshot: https://ai.studio/apps/drive/1o4sdsi64P6s8PuOpv4CUJkyiRkihctjO

## Quick Start

**Automated Setup** (Recommended):
```bash
./setup-dev.sh
code closet-city.code-workspace
```

**Manual Setup**: Continue reading below.

## Prerequisites

- Node.js 20+
- A Gemini API key with access to `gemini-2.5-flash-image-preview`

## 1. Start the Backend Gateway

```bash
cd backend
cp .env.example .env # populate GEMINI_API_KEY and, optionally, ALLOWED_ORIGINS/PORT
node server.js
```

The gateway listens on `http://localhost:4000` by default. Configure `ALLOWED_ORIGINS` if you need stricter CORS rules.

## 2. Start the Frontend

From the repository root:

```bash
npm install
npm run dev
```

Set the frontend environment variable `VITE_API_BASE_URL` (e.g., in a `.env.local` file) if you run the backend on a non-default host/port. The frontend will otherwise default to `http://localhost:4000`.

## Environment Variables

| Location            | Variable            | Description                                   |
|---------------------|---------------------|-----------------------------------------------|
| `backend/.env`      | `GEMINI_API_KEY`    | Required. Server-side Gemini API key.         |
| `backend/.env`      | `ALLOWED_ORIGINS`   | Optional. Comma-separated list for CORS.      |
| `backend/.env`      | `PORT`              | Optional. Gateway listen port (default 4000). |
| `.env.local`        | `VITE_API_BASE_URL` | Optional. Frontend base URL for the gateway.  |

## Scripts

| Command            | Description                               |
|--------------------|-------------------------------------------|
| `npm run dev`      | Run the Vite dev server.                   |
| `npm run build`    | Build the frontend for production.         |
| `npm run preview`  | Preview the production build locally.      |
| `node backend/server.js` | Start the backend proxy in Node.js. |

This setup removes the need to expose `GEMINI_API_KEY` in the browser while keeping the existing AI flows intact.

## Enhanced Development Experience

For the best development experience with GitHub Copilot and VS Code:

- **📖 See [DEVELOPMENT.md](DEVELOPMENT.md)** for comprehensive development guide
- **🚀 Use `./setup-dev.sh`** for automated environment setup  
- **⚡ Open `closet-city.code-workspace`** for optimized VS Code configuration
