# Frontend Phase 1

This folder contains the phase 1 web frontend connected to the backend API.

## Features

- React 18 + TypeScript + Vite
- Login route and dashboard route
- Register and login
- JWT token storage in browser localStorage
- Dashboard with:
  - requests listing
  - services listing
- Role-aware forms:
  - client/admin: create request
  - provider/admin: create service
- Production build served by Nginx in Docker

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
