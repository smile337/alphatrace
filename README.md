# AlphaTrace

Solana smart-wallet tracking and non-custodial copy-trading Telegram Mini App.

## What is implemented

- Telegram Mini App frontend in `apps/web`
- Fastify API in `apps/api`
- Telegraf bot payment/start flows in `apps/bot`
- Wallet event processor in `apps/worker`
- Shared pricing, referral, KOL commission, risk, and Telegram auth rules in `packages/shared`
- Prisma PostgreSQL schema in `packages/db`

The product avoids custody and profit guarantees. Users sign their own swaps, and all payment copy should describe tools, data, and risk controls rather than guaranteed returns.

## Pricing

- Free: `0 Stars/month`
- Pro: `999 Stars/month`
- Elite: `2499 Stars/month`
- KOL Room: `9999 Stars/month`

Execution fees are `0.75%` for Free/Pro and `0.5%` for Elite/KOL, exposed as basis points in the swap order API.

## Local setup

```bash
npm install
copy .env.example .env
docker compose up -d
npm test
npm run typecheck
npm run build
```

Validate Prisma on 32-bit Node environments:

```powershell
$env:PRISMA_CLIENT_ENGINE_TYPE='binary'
$env:PRISMA_CLI_QUERY_ENGINE_TYPE='binary'
$env:DATABASE_URL='postgresql://alphatrace:alphatrace@localhost:5432/alphatrace?schema=public'
npx prisma validate --schema packages/db/prisma/schema.prisma
```

Run services:

```bash
npm run dev
npm run dev:api
npm run dev --workspace @alphatrace/bot
npm run dev --workspace @alphatrace/worker
```

## Main API

- `POST /api/auth/telegram`
- `GET /api/plans`
- `GET /api/smart-wallets`
- `POST /api/watchlist`
- `POST /api/copy-rules`
- `POST /api/swap/order`
- `POST /api/swap/execute`
- `GET /api/referrals/me`
- `POST /api/referrals/claim`
- `GET /api/kol/dashboard`
- `POST /api/share-cards`
- `POST /api/telegram/webhook`
