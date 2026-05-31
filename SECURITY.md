# Security Policy

AlphaTrace handles security-sensitive workflows around Telegram authentication,
subscription verification, smart-wallet analysis, trade intents, and
non-custodial swap execution.

## Supported versions

The `main` branch is the only supported development line while the project is
early-stage.

## Reporting a vulnerability

Please do not open a public GitHub issue for vulnerabilities that could expose
users, payment flows, wallet-signing behavior, or infrastructure credentials.

Report privately by contacting the maintainer through the GitHub profile for
`smile337` and include:

- A concise description of the issue.
- Affected files, endpoints, or workflows.
- Reproduction steps or a proof of concept.
- The likely impact.
- Any suggested mitigation.

## Security boundaries

AlphaTrace is designed to be non-custodial:

- The app must not store user private keys.
- Users should sign their own swaps.
- Free users receive alerts only.
- Automatic copy-trading behavior must remain gated by plan permissions and risk
  rules.
- Product copy and bot messages should describe tools, data, and risk controls
  rather than guaranteed returns.

## Secrets

Do not commit real values for:

- `DATABASE_URL`
- `REDIS_URL`
- `TELEGRAM_BOT_TOKEN`
- `JUPITER_API_KEY`
- `HELIUS_API_KEY`
- Deployment provider tokens

Use `.env.example` for placeholders only.
