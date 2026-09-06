# GoatCounter (https://www.goatcounter.com), the visitor statistics behind
# stats.kaartovuori.fi: one static binary and a SQLite file under /data. TLS
# and the hostname are the Droplet's Caddy's business; this listens on plain
# HTTP inside the compose network.
#
# First run, once, to make the site and its login:
#   docker compose run --rm stats db create site \
#     -db sqlite+/data/db.sqlite3 -vhost stats.kaartovuori.fi \
#     -user.email you@example.com
FROM alpine:3.21
ARG GOATCOUNTER_VERSION=2.7.0
RUN apk add --no-cache ca-certificates tzdata \
 && wget -qO- "https://github.com/arp242/goatcounter/releases/download/v${GOATCOUNTER_VERSION}/goatcounter-v${GOATCOUNTER_VERSION}-linux-amd64.gz" \
    | gunzip > /usr/local/bin/goatcounter \
 && chmod +x /usr/local/bin/goatcounter \
 && adduser -D -H goatcounter \
 && mkdir -p /data && chown goatcounter /data
USER goatcounter
WORKDIR /data
VOLUME /data
EXPOSE 8080
# Every flag also reads $GOATCOUNTER_<FLAG>
ENV GOATCOUNTER_DB=sqlite+/data/db.sqlite3
ENTRYPOINT ["goatcounter"]
CMD ["serve", "-automigrate", "-listen", ":8080", "-tls", "http"]
