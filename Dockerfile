FROM node
WORKDIR /app
ENV NODE_ENV=production
COPY . /app
RUN yarn install; chmod +x /app/src/index.js;
CMD [ "/app/src/index.js", "-h" ]