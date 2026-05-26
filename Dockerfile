FROM node:24-alpine

WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY server.js fileParser.js ./
COPY index.html styles.css app.js ./

ENV HOST=0.0.0.0
ENV PORT=8787
EXPOSE 8787

CMD ["node", "server.js"]
