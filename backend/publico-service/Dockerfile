FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY server.mjs verificacion.mjs estancia.mjs ./
USER node
EXPOSE 3010
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3010/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
