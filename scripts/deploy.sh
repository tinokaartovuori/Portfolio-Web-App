#!/usr/bin/env bash
# Puts a release on the Droplet: builds the site here (a Nuxt build wants
# more memory than the Droplet's 1 GB), ships `.output` over SSH with the
# compose file and the Dockerfiles, and there wraps it in its image and
# starts it. Needs SSH access to the Droplet and nothing else; DEPLOY_HOST
# and DEPLOY_DIR override the target. The Droplet keeps the .env (see
# .env.example); this never touches it.
set -euo pipefail

host=${DEPLOY_HOST:-root@46.101.185.118}
dir=${DEPLOY_DIR:-/opt/Portfolio-Web-App}

cd "$(dirname "$0")/.."

echo "» building"
npm run build

echo "» checking $host:$dir"
ssh "$host" "mkdir -p '$dir/docker' && test -f '$dir/.env'" || {
  echo "no .env at $host:$dir — copy .env.example there and fill it in" >&2
  exit 1
}

echo "» shipping .output"
# -h follows symlinks: Nitro keeps a package it traced in two versions under
# server/node_modules/.nitro and symlinks to it with an absolute path of this
# machine, which would dangle on the Droplet (a 500 on every page that is not
# prerendered, "Cannot find module 'entities/decode'")
tar -czhf - .output | ssh "$host" "cd '$dir' \
  && rm -rf .output.new && mkdir .output.new \
  && tar -xzf - -C .output.new --strip-components=1 \
  && rm -rf .output && mv .output.new .output"
scp -q docker-compose.yml Dockerfile .dockerignore "$host:$dir/"
scp -qr docker/goatcounter "$host:$dir/docker/"

echo "» starting"
ssh "$host" "cd '$dir' \
  && docker compose up -d --build --remove-orphans \
  && docker image prune -f >/dev/null \
  && docker compose ps"
