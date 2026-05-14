FROM node:20-alpine AS build

WORKDIR /frontend

COPY ./frontend/package.json ./
RUN npm install

COPY ./frontend/tsconfig.json ./
COPY ./frontend/tsconfig.app.json ./
COPY ./frontend/tsconfig.node.json ./
COPY ./frontend/vite.config.ts ./
COPY ./frontend/index.html ./
COPY ./frontend/src ./src

RUN npm run build:docker

FROM nginx:1.27-alpine

COPY --from=build /frontend/dist /usr/share/nginx/html
COPY ./frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
