# AlphaTrace Architecture

## Services

- `apps/web`: Telegram Mini App UI. It shows the dashboard, wallet leaderboard, copy-rule controls, subscription ladder, and growth tasks.
- `apps/api`: HTTP API. It validates Telegram `initData`, returns plans and smart wallets, enforces watch limits, creates share cards, exposes KOL metrics, and proxies Jupiter order/execute.
- `apps/bot`: Telegram Bot. It handles `/start`, Pro/Elite Stars invoices, pre-checkout approval, and `/paysupport`.
- `apps/worker`: Wallet event processor. It converts tracked wallet trades into alerts and trade intents after risk checks.
- `packages/shared`: Business rules for pricing, referrals, KOL commission, Telegram auth, and risk.
- `packages/db`: Prisma schema for PostgreSQL.

## Safety defaults

- No private keys are stored.
- The app does not custody funds.
- Free users only receive alerts.
- Pro users confirm copy trades.
- Elite and KOL users can enable automatic copy trading, still gated by risk rules.
- Referral rewards are one-level only.
- Share cards and bot messages include risk language and avoid profit guarantees.
