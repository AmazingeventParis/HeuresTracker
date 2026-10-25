FROM node:22.23.4-alpine
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY . .
CMD ["node", "server.js"]
