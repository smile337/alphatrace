# Contributing to AlphaTrace

AlphaTrace is an early-stage open-source project for Solana smart-wallet tracking
and non-custodial copy-trading workflows inside a Telegram Mini App.

## Development setup

```bash
npm install
copy .env.example .env
docker compose up -d
npm test
npm run typecheck
npm run build
```

Use Node.js 20 or newer. Keep real credentials in `.env`; never commit them.

## Before opening a pull request

- Run `npm test`.
- Run `npm run typecheck`.
- Run `npm run build` when changing frontend or shared package behavior.
- Include tests for changed business rules, wallet-signing flows, Telegram auth,
  subscription logic, payment webhooks, or swap intent handling.
- Update README or docs when behavior, setup, deployment, or safety assumptions
  change.

## Safety-sensitive changes

Please call out any change that touches:

- Telegram `initData` validation or webhook handling.
- Subscription and payment verification.
- Wallet-signing, trade-intent, order, or execute flows.
- Risk limits, auto-copy behavior, or fee calculations.
- Environment variable handling or deployment configuration.

AlphaTrace must remain non-custodial. The app should not store user private keys,
and product copy should avoid profit guarantees.

## Issue reports

Good issue reports include:

- The service or package affected.
- Steps to reproduce.
- Expected and actual behavior.
- Logs with secrets removed.
- Screenshots only when they do not expose private account data.
