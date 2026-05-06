# App Services Menagers

FastAPI backend application for connecting Clients and Providers in household services, with JWT authentication, role-based access control, SQLAlchemy persistence, Docker containerization, and a CI/CD pipeline.

## 1) Understanding the Project Through UML Diagrams

Project diagrams:

- Use cases: [UML_diagrams/uses_case_diag.png](UML_diagrams/uses_case_diag.png)
- Activity: [UML_diagrams/activity_diag.png](UML_diagrams/activity_diag.png)
- Sequence: [UML_diagrams/sequence_diag.png](UML_diagrams/sequence_diag.png)
- Class: [UML_diagrams/classes_diag.png](UML_diagrams/classes_diag.png)
- Architecture: [UML_diagrams/architecture_diag.png](UML_diagrams/architecture_diag.png)

Quick reading:

- Actors: client, provider, admin.
- Main flow: request creation -> acceptance -> mission -> payment -> review.
- Core data model: users, clients, providers, services, requests, missions, payments, reviews.

## 2) Implemented Technical Architecture

- API: FastAPI
- ORM: SQLAlchemy
- Target database: PostgreSQL
- Auth: JWT + RBAC (client/provider/admin)
- Tests: pytest (unit, integration, e2e)
- Containers: Docker + Docker Compose

Important folders/files:

- API: [app](app)
- Initial SQL schema: [schema_postgresql_initial.sql](schema_postgresql_initial.sql)
- Compose file: [docker-compose.yml](docker-compose.yml)
- CI/CD workflow: [.github/workflows/ci-cd.yml](.github/workflows/ci-cd.yml)

## 3) Quick Start With Docker

Prerequisites:

- Docker Desktop running
- Port 8000 available (API)
- Port 5500 available (Frontend)
- Port 5432 available (PostgreSQL)

From the project folder:

C:\DATA\Documents\projets\app_menage\app_services_ménagers

Commands:

1. Build and start database + API + frontend
   docker compose up -d --build db api frontend

2. Check service status
   docker compose ps

3. Follow API logs
   docker compose logs -f api

4. Stop services
   docker compose down

5. Fully reset volumes (if needed)
   docker compose down -v

## 4) Open Swagger Documentation

Once the API is running:

http://localhost:8000/docs

Health endpoint:

http://localhost:8000/health

Frontend URL:

http://localhost:5500

## 5) Database and Configuration

Environment example file: [.env.example](.env.example)

Runtime env files:

- [.env](.env)
- [.env.production](.env.production)

Main variables:

- APP_ENV
- APP_DEBUG
- AUTO_MIGRATE
- LOG_LEVEL
- LOG_JSON
- LOG_TO_FILE
- LOG_FILE_PATH
- LOG_MAX_BYTES
- LOG_BACKUP_COUNT
- ENABLE_REQUEST_LOGGING
- API_WORKERS
- CORS_ORIGINS
- REDIS_URL
- CELERY_BROKER_URL
- CELERY_RESULT_BACKEND
- DATABASE_URL
- JWT_SECRET_KEY
- JWT_ALGORITHM
- JWT_EXPIRE_MINUTES

Notes:

- [.env](.env) is now the default local runtime source and keeps the current working values so the app still starts the same way.
- [.env.production](.env.production) is a clean production-oriented profile meant to be used explicitly, for example with `docker compose --env-file .env.production up -d`.
- In Docker Compose, API DATABASE_URL is overridden to point to the db service.
- Docker Compose no longer reads [.env.example](.env.example) directly as runtime configuration. Use shell environment variables or a real `.env` file if you want to override JWT settings.
- Current secrets remain injectable through environment variables and were not removed from the running setup.

## 5.1) Phase 2 Backend Hardening

The backend now includes a first production-readiness layer:

- centralized settings in [app/core/config.py](app/core/config.py)
- JSON request logging with rotating file handler in [app/core/log_config.py](app/core/log_config.py)
- Gunicorn access/error logs unified in JSON through [app/core/gunicorn_logging.py](app/core/gunicorn_logging.py)
- request logging middleware in [app/main.py](app/main.py)
- GZip middleware for API responses
- `/health` for liveness and `/ready` for database readiness
- non-root API container runtime in [Dockerfile](Dockerfile)
- Compose healthcheck for the API service in [docker-compose.yml](docker-compose.yml)
- Alembic migration executed automatically at API startup through [docker/api-entrypoint.sh](docker/api-entrypoint.sh)

Alembic migration support is now available with:

- [alembic.ini](alembic.ini)
- [alembic/env.py](alembic/env.py)
- [alembic/versions/20260429_0001_initial_schema.py](alembic/versions/20260429_0001_initial_schema.py)

Useful commands:

- `c:/DATA/Documents/projets/app_menage/.venv/Scripts/python.exe -m alembic current`
- `c:/DATA/Documents/projets/app_menage/.venv/Scripts/python.exe -m alembic upgrade head`
- `docker compose run --rm api alembic upgrade head`

## 5.2) Redis and Async Tasks Preparation

The next phase foundation is now scaffolded with:

- Redis service (profile `async`) in [docker-compose.yml](docker-compose.yml)
- Celery app in [app/tasks/celery_app.py](app/tasks/celery_app.py)
- sample task in [app/tasks/tasks.py](app/tasks/tasks.py)
- worker service (profile `async`) in [docker-compose.yml](docker-compose.yml)

Run async stack when needed:

- `docker compose --profile async up -d redis worker`

Trigger a sample task from Python shell:

- `from app.tasks.tasks import ping; ping.delay()`

Useful endpoints:

- http://localhost:8000/health
- http://localhost:8000/ready

## 6) Authentication and Roles

Auth resources:

- Register
- Login
- List users (admin)

Public registration hardening:

- public `/api/v1/auth/register` now blocks `admin` role creation with HTTP 403
- admin accounts must be provisioned through a controlled internal process (not the public register endpoint)
- when the same identifier exists for multiple roles, `/api/v1/auth/login` now requires `role` in payload to disambiguate
- admin-only password reset endpoint for demo recovery: `PATCH /api/v1/auth/admin/users/{user_id}/reset-password`
- each admin password reset emits a dedicated audit log event `admin_password_reset` with actor and target ids
- each admin password reset is also persisted in `admin_audit_events` (insert-only business audit trail)

Account seeding (controlled internal process):

- seed/update admin + client + prestataire demo accounts:
   - `python -m app.scripts.seed_accounts`
- customize seeded accounts with `SEED_*` variables in `.env`

Roles:

- client: creates requests, payments, and reviews on owned resources
- provider: creates services, missions, and provider-specific actions
- admin: full supervision and reserved actions

## 7) Backend Tests

Test structure:

- Unit: [tests/unit](tests/unit)
- Integration: [tests/integration](tests/integration)
- E2E: [tests/e2e](tests/e2e)

Run tests locally (venv):

1. Install test dependencies
   c:/DATA/Documents/projets/app_menage/.venv/Scripts/python.exe -m pip install -r requirements-test.txt

2. Run test suite
   c:/DATA/Documents/projets/app_menage/.venv/Scripts/python.exe -m pytest -q

Backend coverage (current measurement):

- Total app coverage: 85%
- 80% target: achieved

Recompute coverage:

c:/DATA/Documents/projets/app_menage/.venv/Scripts/python.exe -m pytest --cov=app --cov-report=term-missing -q

## 8) Run Tests With Docker

Run tests in the dedicated container:

docker compose run --rm tests

## 9) CI/CD Pipeline

GitHub Actions workflow: [.github/workflows/ci-cd.yml](.github/workflows/ci-cd.yml)

Pipeline steps:

- unit tests
- integration tests
- e2e tests
- Docker image build
- GHCR publish on main/master push

## 10) Quick Troubleshooting

- If docker compose up fails:
  - check compose config: docker compose config
  - check logs: docker compose logs -f api db
  - check occupied ports: 5432 and 8000

- If Swagger is not reachable:
  - check service state: docker compose ps
  - verify menage_api is Up
  - verify API logs

## 11) Minimal Frontend Starter

A phase 1 web app is available in [frontend](frontend) with:

- React 18 + TypeScript + Vite
- routing with login and dashboard screens
- authentication (register/login)
- dashboard with requests and services listing
- role-aware creation forms
- role-based spaces:
   - client: `/espace/client`
   - prestataire: `/espace/prestataire`
   - admin: hidden route `/_staff/console`
- public landing role choice does not expose admin
- production bundle served by Nginx in Docker

Frontend routing tests now cover:

- public landing hides admin choice
- role-based redirects to the proper space
- hidden admin route access control

Run frontend tests:

- `cd frontend`
- `npm run test`

Frontend files:

- [frontend/index.html](frontend/index.html)
- [frontend/src/App.tsx](frontend/src/App.tsx)
- [frontend/src/main.tsx](frontend/src/main.tsx)
- [frontend/src/styles.css](frontend/src/styles.css)
- [frontend/package.json](frontend/package.json)
- [frontend/README.md](frontend/README.md)

Quick run (recommended):

1. Start the full stack with Docker:
   docker compose up -d --build db api frontend

2. Open:
   http://localhost:5500

Alternative local development mode:

1. Install frontend dependencies:
   cd frontend
   npm install

2. Start the Vite dev server:
   npm run dev

3. Open:
   http://localhost:5500

## 12) Project Structure

### Backend architecture

Layered FastAPI application following a vertical slice / domain pattern:

```
request
  └─► FastAPI router (app/api/router.py)
        └─► domain router  (app/domains/<domain>/router.py)
              └─► domain service (app/domains/<domain>/service.py)
                    └─► domain repository (app/domains/<domain>/repository.py)
                          └─► SQLAlchemy session → PostgreSQL
```

Key principles:

- Each domain (`auth`, `demandes`, `missions`, `paiement`, `prestataires`, `review`, `service`) is fully self-contained: `repository.py` → `service.py` → `router.py`.
- Shared schemas stay in `app/schemas/` (imported by multiple domains).
- Domain-local schemas (paiement, review, service) live directly inside the domain folder.
- Transversal services (`mail_service.py`, `matching_service.py`) remain in `app/services/`.
- Auth, security, and dependency injection helpers live in `app/core/` and `app/api/deps.py`.
- Database models live in `app/db/models/`.

### Frontend architecture

React 18 + TypeScript + Vite SPA following a feature-folder / MVVM pattern:

```
App.tsx  (routing shell)
  ├── PublicAuth          (features/auth/)       login / register
  ├── ClientWorkspace     (features/client/)      client dashboard
  ├── PrestataireWorkspace (features/prestataire/) provider dashboard
  └── AdminWorkspace      (features/admin/)       admin console (hidden route)
```

Each feature folder contains:

- `*Workspace.tsx` — pure UI component
- `*WorkspaceContainer.tsx` — data wiring (calls hooks, passes props)
- `use*DashboardViewModel.ts` — business logic hook (API calls, state)

Shared infrastructure:

- `AppContext.tsx` — global auth state (user, role, token)
- `AppShellRoutes.tsx` — route definitions
- `AppHeaderBanner.tsx` / `AppStatusBar.tsx` / `AppOverlays.tsx` — layout shell
- `useAuth*.ts` — auth actions, session lifecycle
- `useRoleSwitching.ts`, `useDemandeModals.ts`, `useClientMatching.ts` — feature hooks
- `types.ts`, `constants.ts`, `labels.ts`, `utils.ts` — shared utilities

### Full project tree

PR4 — all domain logic has been verticalized: each business domain owns its `repository.py`, `service.py`, and `router.py` inside `app/domains/`. Flat files in `app/repositories/` and domain-specific files in `app/services/` have been deleted. Only transversal services (`mail_service.py`, `matching_service.py`) remain in `app/services/`.

```
app_services_ménagers/
├── alembic/
├── docker/
├── frontend/
├── UML_diagrams/
├── app/
│   ├── main.py
│   ├── api/
│   │   ├── deps.py
│   │   ├── router.py
│   │   └── routes/
│   │       ├── missions.py         ← wrapper → domains/missions/router
│   │       └── prestataires.py     ← wrapper → domains/prestataires/router
│   ├── core/
│   │   ├── config.py
│   │   ├── gunicorn_logging.py
│   │   ├── log_config.py
│   │   └── security.py
│   ├── db/
│   │   ├── bootstrap.py
│   │   ├── session.py
│   │   └── models/
│   │       ├── audit.py
│   │       ├── badge.py
│   │       ├── base.py
│   │       ├── demande.py
│   │       ├── mission.py
│   │       ├── notification.py
│   │       ├── paiement.py
│   │       ├── review.py
│   │       ├── service.py
│   │       └── user.py
│   ├── domains/
│   │   ├── auth/
│   │   │   ├── _base_service.py
│   │   │   ├── admin_service.py
│   │   │   ├── repository.py
│   │   │   ├── router.py
│   │   │   └── service.py
│   │   ├── demandes/
│   │   │   ├── repository.py
│   │   │   ├── router.py
│   │   │   └── service.py
│   │   ├── missions/
│   │   │   ├── repository.py
│   │   │   ├── router.py
│   │   │   └── service.py
│   │   ├── paiement/
│   │   │   ├── repository.py
│   │   │   ├── router.py
│   │   │   ├── schemas.py
│   │   │   └── service.py
│   │   ├── prestataires/
│   │   │   ├── repository.py
│   │   │   ├── router.py
│   │   │   └── service.py
│   │   ├── review/
│   │   │   ├── repository.py
│   │   │   ├── router.py
│   │   │   ├── schemas.py
│   │   │   └── service.py
│   │   └── service/
│   │       ├── repository.py
│   │       ├── router.py
│   │       ├── schemas.py
│   │       └── service.py
│   ├── repositories/               ← vide (migré dans domains/)
│   ├── schemas/
│   │   ├── common.py
│   │   ├── demande.py
│   │   ├── gamification.py
│   │   ├── matching.py
│   │   ├── mission.py
│   │   ├── prestataire.py
│   │   └── user.py
│   ├── services/                   ← services transverses uniquement
│   │   ├── mail_service.py
│   │   └── matching_service.py
│   └── tasks/
│       ├── celery_app.py
│       └── tasks.py
├── tests/
│   ├── conftest.py
│   ├── e2e/
│   ├── integration/
│   ├── smoke/
│   └── unit/
├── alembic.ini
├── docker-compose.yml
├── Dockerfile
├── pytest.ini
├── requirements.txt
├── requirements-test.txt
└── README.md
```
