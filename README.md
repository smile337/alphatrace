# AlphaTrace

AlphaTrace is an early-stage open-source Telegram Mini App for Solana
smart-wallet tracking and non-custodial copy-trading workflows.

The project is built as a TypeScript monorepo with a web app, API, Telegram bot,
worker service, shared business rules, and a Prisma/PostgreSQL data model. It is
maintained in public so the wallet-signing, Telegram authentication, payment,
risk, and trade-intent flows can be reviewed and improved openly.

## Project goals

- Track public smart-wallet activity and convert useful events into alerts or
  trade intents.
- Keep the product non-custodial: users sign their own swaps and AlphaTrace does
  not store private keys.
- Make safety boundaries explicit around risk rules, plan permissions, payment
  verification, and copy-trading controls.
- Provide a practical reference for Telegram Mini App trading workflows that can
  be studied, tested, and improved by other developers.

## What is implemented

- Telegram Mini App frontend in `apps/web`
- Fastify API in `apps/api`
- Telegraf bot payment/start flows in `apps/bot`
- Wallet event processor in `apps/worker`
- Shared pricing, referral, KOL commission, risk, and Telegram auth rules in `packages/shared`
- Prisma PostgreSQL schema in `packages/db`

The product avoids custody and profit guarantees. Users sign their own swaps,
and all payment copy should describe tools, data, and risk controls rather than
guaranteed returns.

## Repository status

AlphaTrace is currently early-stage but actively maintained. The main areas of
work are:

- Telegram `initData` validation and webhook handling.
- Subscription and Telegram Stars payment flows.
- Smart-wallet analysis and alert generation.
- Trade-intent preview, wallet-signing, order, and execute flows.
- Risk limits, plan permissions, referral rules, and KOL dashboard behavior.
- Deployment on Vercel, Render, Neon, and Redis providers.

## Pricing

- Free: `0 Stars/month`
- Pro: `999 Stars/month`
- Elite: `2499 Stars/month`
- KOL Room: `9999 Stars/month`

Execution fees are `0.75%` for Free/Pro and `0.5%` for Elite/KOL, exposed as
basis points in the swap order API.

## Safety model

- No user private keys are stored.
- Free users receive alerts only.
- Pro users confirm copy trades before signing.
- Elite and KOL users can enable more automation, still gated by risk rules.
- Swap orders should be inspectable before signing.
- Bot messages, share cards, and UI copy should avoid profit guarantees.
- Secrets belong in `.env` or deployment provider settings, not in Git.

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

## Documentation

- [Architecture](docs/architecture.md)
- [Free deployment](docs/free-deploy.md)
- [Roadmap](docs/roadmap.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## Open-source maintenance

AlphaTrace welcomes focused issues and pull requests that improve correctness,
test coverage, documentation, deployment reliability, and safety-sensitive
workflows. Changes that touch authentication, payments, wallet signing, swap
execution, or risk controls should include tests and a short explanation of the
security impact.

## License

MIT
