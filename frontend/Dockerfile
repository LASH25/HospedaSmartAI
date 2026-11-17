FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile
COPY . .
ARG VITE_HOTEL_NAME=HospedaSmart
ENV VITE_HOTEL_NAME=$VITE_HOTEL_NAME
RUN pnpm build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
