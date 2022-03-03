FROM node:12.18.1

WORKDIR /dds_app

COPY ["package.json", "package-lock.json*", "./"]

RUN npm install

COPY . .

CMD [ "node", "./app/index.js" ]