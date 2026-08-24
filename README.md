# LinkSnip

LinkSnip is a full-stack URL shortener with link management, authentication, and click analytics. Create short links with optional aliases and expiration dates, then inspect traffic by time, referrer, device, browser, operating system, country, and city.

## Features

- User registration and login with JWT authentication
- Generated short codes and custom aliases
- Optional link expiration and deactivation
- Copy and manage created links
- Click analytics and breakdowns by date, referrer, device, browser, operating system, country, and city
- Responsive React interface

## Stack

- **Frontend:** React 19, Vite, Axios, CSS
- **Backend:** Python, FastAPI, SQLAlchemy
- **Database:** PostgreSQL in production; SQLite by default for local development
- **Deployment:** Vercel-compatible backend configuration and a static frontend deployment

## Project Structure

```text
LinkSnip/
├── frontend/       React/Vite application
├── backend/
│   ├── api/        Serverless entry point
│   ├── app/        FastAPI application and database models
│   └── tests/      Backend test suite
└── README.md
```

## Local Development

### Prerequisites

- Python 3.10 or newer
- Node.js 18 or newer
- npm

### 1. Start the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export SECRET_KEY="replace-with-a-long-random-value"
uvicorn app.main:app --reload
```

The API runs at `http://127.0.0.1:8000`. Interactive API documentation is available at `/docs`, and the health check is available at `/api/health`.

The backend uses `sqlite:///./linksnip.db` when no database URL is configured. To use PostgreSQL, set `DATABASE_URL` instead.

### 2. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at the URL printed by Vite, usually `http://localhost:5173`. Set `VITE_API_URL` when the API is running somewhere other than the local default:

```bash
VITE_API_URL=http://127.0.0.1:8000 npm run dev
```

## Environment Variables

### Backend

| Variable | Required | Description |
| --- | --- | --- |
| `SECRET_KEY` | Yes | Secret used to sign authentication tokens |
| `DATABASE_URL` | No | SQLAlchemy database URL; defaults to local SQLite |
| `BASE_URL` | No | Public backend URL used when constructing shortened links |
| `ALGORITHM` | No | JWT algorithm; defaults to `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | Token lifetime in minutes; defaults to `1440` |

### Frontend

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_API_URL` | No | Backend API base URL; defaults to the local API in development |

## Testing

Run the backend tests from the repository root:

```bash
cd backend
pytest
```

Run the frontend lint and production build:

```bash
cd frontend
npm run lint
npm run build
```

## Deployment

The backend includes [`backend/vercel.json`](backend/vercel.json) and [`backend/api/index.py`](backend/api/index.py) for Vercel deployments. Configure `SECRET_KEY`, `DATABASE_URL`, and `BASE_URL` in the deployment environment. Build the frontend with `npm run build` and configure `VITE_API_URL` to point to the deployed backend.

## API

FastAPI generates interactive documentation from the running application. Visit `http://127.0.0.1:8000/docs` locally to explore authentication, link, analytics, health-check, and redirect endpoints.