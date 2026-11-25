# Contributing to Portfolab

Thanks for helping make Portfolab better. Portfolab is an Arabic-first (RTL) learning platform where junior developers build real full-stack portfolio projects, so contributions that make the lessons clearer, the code more reliable, or the Arabic UI better are all welcome.

## Ways to contribute

- **Fix or improve lesson content** in `content/` (typos, unclear steps, outdated commands, better Arabic wording).
- **Improve the TaskFlow Lite example** in `examples/taskflow-lite/` (reference solution, starter repo, tests).
- **Report bugs** in the web app (`apps/web`) or API (`apps/api`).
- **Improve docs** in `docs/` and the README.
- **Pick up an issue** labelled `good first issue`.

If you are planning something bigger than a small fix, please open an issue first so we can agree on the approach before you spend time on it.

## Getting set up

Requirements: Node 20.19+, pnpm 9, Docker Desktop. The full local setup is in the [README](README.md#local-setup-clean-clone).

```bash
pnpm install
docker compose up -d db
cp apps/api/.env.example apps/api/.env   # set SESSION_SECRET
pnpm --filter @pb/api db:deploy
pnpm db:seed
pnpm dev                                  # API :4000 + web :5173
```

## Before you open a pull request

Run the main checks CI runs:

```bash
pnpm lint && pnpm format:check && pnpm typecheck
pnpm test
pnpm build
```

If your change touches user flows, also run the Playwright smoke tests (`pnpm test:e2e`, see the README for `PW_CHANNEL`).

## Pull request guidelines

- Keep each pull request focused on one change.
- Use clear, conventional commit messages, for example `fix(web): correct RTL alignment on lesson page` or `docs: clarify TaskFlow Lite setup`.
- Add or update tests when you change behaviour.
- Do not commit secrets, `.env` files or real payment/analytics keys.
- For lesson content, follow the existing Markdown frontmatter format described under "Content workflow" in the README.

## Security issues

Please do not open a public issue for a security vulnerability. Contact the maintainer privately through the email on the GitHub profile instead.

## License

By contributing, you agree that your contributions are licensed under the project's [MIT License](LICENSE).
