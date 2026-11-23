FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates git && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src ./src
COPY public ./public
COPY lab.json tsconfig.json Dockerfile ./
RUN mkdir -p /app/runs && chown -R node:node /app
USER node
ENV HOST=0.0.0.0 PORT=43271
EXPOSE 43271
CMD ["npm", "start"]
