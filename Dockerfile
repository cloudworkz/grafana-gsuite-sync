FROM node:lts-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY . /app
RUN set -e; yarn install;
ENTRYPOINT [ "yarn", "start" ]