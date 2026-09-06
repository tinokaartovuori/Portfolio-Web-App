# Runs a built site: the prerendered pages and the Nitro server for the API
# (likes, visit log) that `npm run build` leaves in `.output`. The build is
# not done here — the Droplet's 1 GB is not enough for a Nuxt build — but
# on the machine deploying, and `scripts/deploy.sh` ships `.output` over;
# `.dockerignore` lets nothing else into the context. The SQLite file lives
# in /data; mount a volume there so it outlives the container.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    NITRO_HOST=0.0.0.0 \
    NITRO_PORT=3000 \
    NUXT_DATA_DIR=/data
COPY --chown=node:node .output ./.output
RUN mkdir -p /data && chown node:node /data /app
USER node
VOLUME /data
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
