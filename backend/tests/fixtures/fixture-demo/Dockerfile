# Drift 1: Node version mismatch — README says 18, here we use Node 20
FROM node:20-alpine

WORKDIR /app

# Drift 3: ENV variables not fully documented in .env.example
ENV PORT=3000
ENV DATABASE_URL=
ENV JWT_SECRET=
ENV INTERNAL_API_KEY=

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/index.js"]
