# Free Deployment

This is the lowest-cost deployment path for early validation.

## Services

- Web: Vercel Hobby, fixed `*.vercel.app` domain.
- API: Render Free Web Service, fixed `*.onrender.com` domain.
- Postgres: Neon Free.
- Redis: Upstash Free.

## Environment

Set these on Render for `alphatrace-api`:

- `DATABASE_URL`
- `REDIS_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`
- `MINI_APP_URL`
- `JUPITER_API_KEY`
- `JUPITER_BASE_URL`
- `HELIUS_API_KEY`
- `HELIUS_BASE_URL`
- `PRISMA_CLIENT_ENGINE_TYPE=binary`
- `PRISMA_CLI_QUERY_ENGINE_TYPE=binary`

Set this on Vercel for the web app:

- `API_BASE_URL=https://<render-api-domain>`
- `TELEGRAM_BOT_USERNAME=AlphaTraceBot`

After Vercel returns a fixed domain, update:

- Render `MINI_APP_URL=https://<vercel-web-domain>`
- BotFather / Telegram menu button URL to the same value
