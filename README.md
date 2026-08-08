# App Services Menagers

FastAPI backend application for connecting Clients and Providers in household services, with JWT authentication, role-based access control, SQLAlchemy persistence, Docker containerization, and a CI/CD pipeline.

## 1) Understanding the Project Through UML Diagrams

Project diagrams:

* Use cases: [app_services_ménagers/UML_diagrams/uses_case_diag.png](app_services_ménagers/UML_diagrams/uses_case_diag.png)
* Activity: [app_services_ménagers/UML_diagrams/activity_diag.png](app_services_ménagers/UML_diagrams/activity_diag.png)
* Sequence: [app_services_ménagers/UML_diagrams/sequence_diag.png](app_services_ménagers/UML_diagrams/sequence_diag.png)
* Class: [app_services_ménagers/UML_diagrams/classes_diag.png](app_services_ménagers/UML_diagrams/classes_diag.png)
* Architecture: [app_services_ménagers/UML_diagrams/architecture_diag.png](app_services_ménagers/UML_diagrams/architecture_diag.png)

Quick reading:

* Actors: client, provider, admin.
* Main flow: request creation -> acceptance -> mission -> payment -> review.
* Core data model: users, clients, providers, services, requests, missions, payments, reviews.

## 2) Implemented Technical Architecture

* API: FastAPI
* ORM: SQLAlchemy
* Target database: PostgreSQL
* Auth: JWT + RBAC (client/provider/admin)
* Tests: pytest (unit, integration, e2e)
* Containers: Docker + Docker Compose

Important folders/files:

* API: `app_services_ménagers/app`
* Initial SQL schema: `app_services_ménagers/schema_postgresql_initial.sql`
* Compose file: `app_services_ménagers/docker-compose.yml`
* CI/CD workflow: `app_services_ménagers/.github/workflows/ci-cd.yml`

## 3) Quick Start With Docker

Prerequisites:

* Docker Desktop running
* Port 8000 available (API)
* Port 5500 available (Frontend)
* Port 5432 available (PostgreSQL)

From the repository root, first enter the project directory:

```bash
cd app_services_ménagers
```

Then run the following commands:

1. Build and start database + API + frontend:

```bash
docker compose up -d --build db api frontend
```

2. Check service status:

```bash
docker compose ps
```

3. Follow API logs:

```bash
docker compose logs -f api
```

4. Stop services:

```bash
docker compose down
```

5. Fully reset volumes (if needed):

```bash
docker compose down -v
```

## 4) Open Swagger Documentation

Once the API is running:

http://localhost:8000/docs

Health endpoint:

http://localhost:8000/health

Frontend URL:

http://localhost:5500

## 5) Database and Configuration

Environment example file:

`app_services_ménagers/.env.example`

Runtime environment files:

* `app_services_ménagers/.env`
* `app_services_ménagers/.env.production`

Main variables:

* `APP_ENV`
* `APP_DEBUG`
* `AUTO_MIGRATE`
* `LOG_LEVEL`
* `LOG_JSON`
* `LOG_TO_FILE`
* `LOG_FILE_PATH`
* `LOG_MAX_BYTES`
* `LOG_BACKUP_COUNT`
* `ENABLE_REQUEST_LOGGING`
* `API_WORKERS`
* `CORS_ORIGINS`
* `REDIS_URL`
* `CELERY_BROKER_URL`
* `CELERY_RESULT_BACKEND`
* `DATABASE_URL`
* `JWT_SECRET_KEY`
* `JWT_ALGORITHM`
* `JWT_EXPIRE_MINUTES`

Notes:

* `.env` is now the default local runtime source and keeps the current working values so the app still starts the same way.
* `.env.production` is a clean production-oriented profile meant to be used explicitly, for example with `docker compose --env-file .env.production up -d`.
* In Docker Compose, API `DATABASE_URL` is overridden to point to the `db` service.
* Docker Compose no longer reads `.env.example` directly as runtime configuration. Use shell environment variables or a real `.env` file if you want to override JWT settings.
* Current secrets remain injectable through environment variables and were not removed from the running setup.

## 5.1) Phase 2 Backend Hardening

The backend now includes a first production-readiness layer:

* centralized settings in `app_services_ménagers/app/core/config.py`
* JSON request logging with rotating file handler in `app_services_ménagers/app/core/log_config.py`
* Gunicorn access/error logs unified in JSON through `app_services_ménagers/app/core/gunicorn_logging.py`
* request logging middleware in `app_services_ménagers/app/main.py`
* GZip middleware for API responses
* `/health` for liveness and `/ready` for database readiness
* non-root API container runtime in `app_services_ménagers/Dockerfile`
* Compose healthcheck for the API service in `app_services_ménagers/docker-compose.yml`
* Alembic migration executed automatically at API startup through `app_services_ménagers/docker/api-entrypoint.sh`

Alembic migration support is now available with:

* `app_services_ménagers/alembic.ini`
* `app_services_ménagers/alembic/env.py`
* `app_services_ménagers/alembic/versions/20260429_0001_initial_schema.py`

Useful commands:

```bash
python -m alembic current
python -m alembic upgrade head
docker compose run --rm api alembic upgrade head
```

Run these commands from the `app_services_ménagers` directory.

## 5.2) Redis and Async Tasks Preparation

The next phase foundation is now scaffolded with:

* Redis service (profile `async`) in `app_services_ménagers/docker-compose.yml`
* Celery app in `app_services_ménagers/app/tasks/celery_app.py`
* sample task in `app_services_ménagers/app/tasks/tasks.py`
* worker service (profile `async`) in `app_services_ménagers/docker-compose.yml`

Run async stack when needed:

```bash
docker compose --profile async up -d redis worker
```

Trigger a sample task from Python shell:

```python
from app.tasks.tasks import ping
ping.delay()
```

Useful endpoints:

* http://localhost:8000/health
* http://localhost:8000/ready

## 6) Authentication and Roles

Auth resources:

* Register
* Login
* List users (admin)

Public registration hardening:

* Public `/api/v1/auth/register` now blocks `admin` role creation with HTTP 403.
* Admin accounts must be provisioned through a controlled internal process (not the public register endpoint).

Roles:

* client: creates requests, payments, and reviews on owned resources
* provider: creates services, missions, and provider-specific actions
* admin: full supervision and reserved actions

## 7) Backend Tests

Test structure:

* Unit: `app_services_ménagers/tests/unit`
* Integration: `app_services_ménagers/tests/integration`
* E2E: `app_services_ménagers/tests/e2e`

Run tests locally from the `app_services_ménagers` directory:

1. Install test dependencies:

```bash
python -m pip install -r requirements-test.txt
```

2. Run test suite:

```bash
python -m pytest -q
```

Backend coverage (current measurement):

* Total app coverage: 85%
* 80% target: achieved

Recompute coverage:

```bash
python -m pytest --cov=app --cov-report=term-missing -q
```

## 8) Run Tests With Docker

Run tests in the dedicated container:

```bash
docker compose run --rm tests
```

## 9) CI/CD Pipeline

GitHub Actions workflow:

`app_services_ménagers/.github/workflows/ci-cd.yml`

Pipeline steps:

* unit tests
* integration tests
* e2e tests
* Docker image build
* GHCR publish on main/master push

## 10) Quick Troubleshooting

If `docker compose up` fails:

```bash
docker compose config
```

Check logs:

```bash
docker compose logs -f api db
```

Check occupied ports:

* 5432
* 8000
* 5500

If Swagger is not reachable:

```bash
docker compose ps
```

Verify that:

* the API service is `Up`
* the `db` service is `Up`
* the API logs do not contain startup errors

## 11) Minimal Frontend Starter

A phase 1 web app is available in:

`app_services_ménagers/frontend`

It includes:

* React 18 + TypeScript + Vite
* routing with login and dashboard screens
* authentication (register/login)
* dashboard with requests and services listing
* role-aware creation forms
* role-based spaces:

  * client: `/espace/client`
  * prestataire: `/espace/prestataire`
  * admin: hidden route `/_staff/console`
* public landing role choice does not expose admin
* production bundle served by Nginx in Docker

Frontend routing tests now cover:

* public landing hides admin choice
* role-based redirects to the proper space
* hidden admin route access control

Run frontend tests:

```bash
cd frontend
npm run test
```

Frontend files:

* `app_services_ménagers/frontend/index.html`
* `app_services_ménagers/frontend/src/App.tsx`
* `app_services_ménagers/frontend/src/main.tsx`
* `app_services_ménagers/frontend/src/styles.css`
* `app_services_ménagers/frontend/package.json`
* `app_services_ménagers/frontend/README.md`

### Quick run (recommended)

From the repository root:

```bash
cd app_services_ménagers
docker compose up -d --build db api frontend
```

Open:

http://localhost:5500

### Alternative local development mode

From the `app_services_ménagers` directory:

1. Install frontend dependencies:

```bash
cd frontend
npm install
```

2. Start the Vite development server:

```bash
npm run dev
```

3. Open:

http://localhost:5500
