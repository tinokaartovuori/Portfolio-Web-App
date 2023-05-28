# Dockerfile
FROM node:14-alpine

# create destination directory
RUN mkdir -p /app
WORKDIR /app

# update and install dependency
RUN apk update && apk upgrade
RUN apk add git

COPY ./package*.json /app/

RUN npm install && npm cache clean --force

COPY . .

ENV PATH ./node_modules/.bin/:$PATH

EXPOSE 3000
# We need to expose 24678 for the hot reload to work
EXPOSE 24678

ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000

# Start the app
CMD [ "npm", "run", "dev" ]