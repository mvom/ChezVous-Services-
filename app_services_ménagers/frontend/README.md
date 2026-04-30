# Frontend Phase 1

This folder contains the phase 1 web frontend connected to the backend API.

## Features

- React 18 + TypeScript + Vite
- Public landing route with role choice (client and prestataire only)
- Dedicated auth routes:
   - `/auth/client`
   - `/auth/prestataire`
- Role spaces:
   - `/espace/client`
   - `/espace/prestataire`
- Hidden admin route (not exposed in public UI):
   - `/_staff/console`
- Register and login
- JWT token storage in browser localStorage
- Role-aware interfaces and redirects
- Production build served by Nginx in Docker

## Tests

- Route tests are implemented with Vitest + Testing Library
- Covered scenarios:
   - public landing does not show admin option
   - role-based redirects to the correct space
   - hidden admin route remains accessible only to admin users

Run tests:

1. Install dependencies:

    npm install

2. Execute tests:

    npm run test

## Run

1. Start the full stack with Docker:

   docker compose up -d --build db api frontend

2. Open:

   http://localhost:5500

## Local Development

1. Install dependencies:

   npm install

2. Start the Vite dev server:

   npm run dev

3. Open:

   http://localhost:5500

The frontend calls the API at:

http://localhost:8000/api/v1
