
FROM node:20-alpine

WORKDIR /app


COPY package*.json ./


RUN npm install


COPY . .


ENV WITH_SNAPSHOT=true


EXPOSE 3000


CMD ["npm", "run", "start"]
