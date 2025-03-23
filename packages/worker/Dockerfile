FROM node:20-alpine

WORKDIR /app


COPY package.json package-lock.json ./
COPY packages/worker/package.json ./packages/worker/
COPY packages/shared/package.json ./packages/shared/


RUN npm ci


COPY packages/shared ./packages/shared
COPY packages/worker ./packages/worker


RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/worker


RUN ls -la /app/packages/worker/ || true
RUN ls -la /app/packages/worker/dist/ || true


ENV NODE_ENV=production


WORKDIR /app
CMD ["node", "packages/worker/dist/logProcessingWorker.js"]