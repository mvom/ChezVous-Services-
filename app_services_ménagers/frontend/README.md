# Frontend — ChezVous Services

React 18 + TypeScript + Vite SPA for the ChezVous Services platform, connected to the FastAPI backend.

## Architecture

Feature-folder / MVVM pattern:

```
src/
├── main.tsx                        entry point
├── App.tsx                         routing shell
├── AppShellRoutes.tsx              route definitions
├── AppContext.tsx                  global auth state (user, role, token)
├── AppHeaderBanner.tsx             top navigation bar
├── AppStatusBar.tsx                status / notification bar
├── AppOverlays.tsx                 modals and overlay layer
│
├── features/
│   ├── auth/
│   │   └── PublicAuth.tsx          login / register (client & prestataire)
│   ├── client/
│   │   ├── ClientWorkspace.tsx             UI component
│   │   ├── ClientWorkspaceContainer.tsx    data wiring
│   │   └── useClientDashboardViewModel.ts  API calls + state
│   ├── prestataire/
│   │   ├── PrestataireWorkspace.tsx
│   │   ├── PrestataireWorkspaceContainer.tsx
│   │   └── usePrestataireDashboardViewModel.ts
│   └── admin/
│       ├── AdminWorkspace.tsx
│       ├── AdminWorkspaceContainer.tsx
│       └── useAdminDashboardViewModel.ts
│
├── useAuthActions.ts               login / register / logout calls
├── useAuthSessionLifecycle.ts      token refresh, session expiry
├── useRoleSwitching.ts             multi-role switch logic
├── useDemandeModals.ts             demande creation / cancel modals
├── useClientMatching.ts            matching prestataires for client
├── useAvatarCrop.ts                avatar upload & crop
├── useProfileAvatar.ts             avatar fetch / update
├── useUnregisterFlow.ts            account deletion flow
├── useRefreshDashboard.ts          dashboard polling helper
│
├── types.ts                        shared TypeScript interfaces
├── constants.ts                    API base URL, routes, config
├── labels.ts                       UI labels (i18n-ready)
└── utils.ts                        shared helpers
```

## Routes

| Path | Access | Description |
|---|---|---|
| `/` | public | Landing — role choice (client / prestataire only) |
| `/auth/client` | public | Client login / register |
| `/auth/prestataire` | public | Prestataire login / register |
| `/espace/client` | client | Client dashboard |
| `/espace/prestataire` | prestataire | Prestataire dashboard |
| `/_staff/console` | admin | Admin console (hidden from public UI) |

## Features

- JWT token stored in `localStorage`, refreshed automatically
- Role-based redirects on login
- Multi-role switching (user can hold client + prestataire)
- Demande creation, cancellation, and status tracking
- Service browsing and matching
- Avatar upload with crop
- Account unregister flow
- Production build served by Nginx in Docker

## Tests

Vitest + Testing Library. Covered scenarios:

- public landing does not show admin option
- role-based redirects to the correct space
- hidden admin route access control
- avatar crop logic
- demande modal state machine
- role switching flow
- unregister flow

Run tests:

```bash
npm install
npm run test
```

## Run with Docker (recommended)

```bash
docker compose up -d --build db api frontend
```

Open: http://localhost:5500

## Local Development

```bash
cd frontend
npm install
npm run dev
```

Open: http://localhost:5500

API base URL: `http://localhost:8000/api/v1`
