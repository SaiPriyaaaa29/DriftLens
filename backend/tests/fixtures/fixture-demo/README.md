# acme-api

A production REST API service.

## Requirements

- **Node.js 18** or higher
- npm

## Quick Start

```bash
npm install
npm start
```

## Environment Variables

Copy `.env.example` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `PORT` | Port the server listens on (default 3000) |
| `DATABASE_URL` | PostgreSQL connection string |
