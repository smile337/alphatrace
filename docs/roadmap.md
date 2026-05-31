# AlphaTrace Roadmap

AlphaTrace is early-stage and maintained in public. The roadmap focuses on
making the project safer, easier to review, and more useful for developers who
want to study Telegram Mini App trading workflows without adding custody risk.

## Near term

- Expand tests for Telegram `initData`, webhook, subscription, and payment
  verification paths.
- Harden wallet-signing and trade-intent screens so users can inspect order
  details before signing.
- Improve smart-wallet analysis fixtures and document how tracked wallet events
  become alerts or trade intents.
- Add clearer local development docs for Postgres, Redis, Render, Vercel, and
  Telegram bot setup.
- Create the first tagged release after the public repository docs and setup
  flow are stable.

## Maintenance focus

- Keep the app non-custodial and avoid private-key storage.
- Review code paths that touch authentication, payments, swap execution, and
  risk controls before release.
- Improve TypeScript type safety across the monorepo.
- Keep generated files, logs, deployment artifacts, and secrets out of Git.
- Maintain public docs for architecture, deployment, contribution, and security
  expectations.

## Longer term

- Add integration tests for API, bot, and worker workflows.
- Add observability guidance for production deployments.
- Document adapter boundaries for Solana data providers and swap providers.
- Add examples for running AlphaTrace against mock wallet and provider data.
