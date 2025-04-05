FROM node:18


WORKDIR /app

COPY package*.json ./

# Install dependencies

RUN npm install

COPY . .

# Install global dependencies like nodemon
RUN npm install -g @nestjs/cli

# Default command (will be overridden by docker-compose)
CMD ["npm", "run", "start:dev"]