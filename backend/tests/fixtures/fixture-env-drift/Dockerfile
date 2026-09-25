FROM node:18-alpine
WORKDIR /app
ENV PORT=3000
ENV SECRET_KEY=
ENV DATABASE_URL=
RUN npm ci
COPY . .
CMD ["node", "index.js"]
