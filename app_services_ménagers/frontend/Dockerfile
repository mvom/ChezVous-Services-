FROM node:20-alpine AS build

WORKDIR /frontend

COPY ./frontend/package.json ./
COPY ./frontend/tsconfig.json ./
COPY ./frontend/tsconfig.app.json ./
COPY ./frontend/tsconfig.node.json ./
COPY ./frontend/vite.config.ts ./
COPY ./frontend/index.html ./
COPY ./frontend/src ./src

RUN npm install
RUN npm run build

FROM nginx:1.27-alpine

COPY --from=build /frontend/dist /usr/share/nginx/html

EXPOSE 80
