FROM node:lts-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY . /app
RUN yarn install; chmod +x /app/src/index.js;
ENTRYPOINT [ "/app/src/index.js" ]