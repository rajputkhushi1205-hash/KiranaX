# KiranaX Backend

KiranaX is a real backend for an AI-powered neighborhood grocery ordering workflow. The system is designed to take a customer message, identify the customer, resolve products against the live catalog, verify stock, create an order, update inventory, and return a structured confirmation.

## Responsibilities

- Customer identification and profile management
- Product catalog search and normalization
- Inventory checks and atomic stock updates
- Secure order creation with idempotency
- Loyalty and delivery rule evaluation
- Agent workflow with clarification and approval states
- Event tracking for frontend consumption

## Architecture

```text
Frontend → API → Agent → Tools → Database
```

The database is the source of truth for price, inventory, and order state. The AI can suggest intent and orchestration steps, but backend tools perform the real work.

## Stack

- Node.js + TypeScript + Express
- SQLite for local hackathon execution
- Zod validation
- Vitest for business tests
- Dotenv and CORS support

## Environment variables

Copy `.env.example` to `.env` and fill in values as needed.

## Installation

```bash
npm install
npm run seed
npm run dev
```

## Deploy on Render

This repository includes `render.yaml` for a Render web service.

1. Push the repository to GitHub.
2. In Render, choose **New > Blueprint** and select the repository.
3. Deploy the `kirana-api` service.
4. Use the generated URL, for example `https://kirana-api.onrender.com`.

The health check is available at `/api/health`. The default Render configuration uses an in-memory SQLite database, so seeded data resets when the service restarts. Use a persistent database before treating the deployment as production storage.

## Database setup

This project uses SQLite for easy local setup and reproduction. The seed script initializes:

- stores
- customers
- products
- inventory
- orders
- order items
- inventory transactions

## API overview

- `GET /api/health`
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/customers`
- `GET /api/customers/:id/history`
- `POST /api/orders`
- `POST /api/agent/message`

## Demo scenarios

- Normal order
- Unavailable product alternatives
- Usual order from customer history
- Clarification for ambiguous matching
- Missing customer information

## Known limitations

- This is a local-first backend intended for hackathon/demo use.
- Payment processing is intentionally not implemented.
- Real AI provider integration is optional and can be configured via env vars.
