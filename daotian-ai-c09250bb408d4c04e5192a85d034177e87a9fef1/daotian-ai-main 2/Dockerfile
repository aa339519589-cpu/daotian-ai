FROM node:24-alpine

WORKDIR /app
COPY package.json ./
COPY server.js ./server.js
COPY index.html styles.css app.js ./
COPY README.md ./

ENV HOST=0.0.0.0
ENV PORT=8787
EXPOSE 8787

CMD ["node", "server.js"]
