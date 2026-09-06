# Builds the site and runs the small Nitro server that serves the prerendered
# pages and the API (likes, visit log). The SQLite file lives in /data; mount
# a volume there so it outlives the container.
FROM node:22.13-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22.13-alpine
WORKDIR /app
ENV NODE_ENV=production \
    NITRO_HOST=0.0.0.0 \
    NITRO_PORT=3000 \
    NUXT_DATA_DIR=/data
COPY --from=build /app/.output ./.output
RUN mkdir -p /data && chown node:node /data /app
USER node
VOLUME /data
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
