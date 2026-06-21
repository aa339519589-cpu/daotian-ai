FROM node:24-alpine

WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY . .

ENV HOST=0.0.0.0
ENV PORT=8787
EXPOSE 8787

CMD ["node", "server-start.js"]
