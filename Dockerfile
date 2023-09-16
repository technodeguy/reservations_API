FROM node:16-alpine

RUN apk update

RUN apk add nano mysql-client

WORKDIR /api

COPY package*.json /api/

RUN npm install

RUN npm install pm2 -g

COPY . /api

EXPOSE 3000

CMD ["npm", "run", "start"]