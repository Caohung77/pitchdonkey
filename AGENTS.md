# Repository Guidelines

## Project Structure & Module Organization
- Source: `src/app` (Next.js routes), shared logic in `lib/`, UI in `components/`, static assets in `public/`.
- Tests: `__tests__/` (e.g., `__tests__/lib/*.test.ts`).
- Scripts & DB utilities: `scripts/` and SQL files at repo root; Supabase config in `supabase/`.
- Naming: modules in `lib/` use kebab-case (e.g., `campaign-processor.ts`); React components use PascalCase.

## Build, Test, and Development Commands
- `npm run dev`: Start Next.js dev server at http://localhost:3000.
- `npm run build`: Production build (Next.js).
- `npm start`: Run the built app.
- `npm run lint`: Lint with ESLint/Next rules.
- `npm test`: Run Jest tests once.
- `npm run test:watch`: Watch mode for Jest.
- `npm run test:coverage`: Collect coverage (targets `lib/`, `components/`, `src/`).

## Coding Style & Naming Conventions
- Language: TypeScript. Indentation: 2 spaces; prefer single quotes.
- Components: PascalCase filenames and exported components (e.g., `ErrorBoundary.tsx`).
- Helpers/services: kebab-case in `lib/` (e.g., `email-tracking.ts`).
- Imports: use `@/` alias mapped to repo root.
- Run `npm run lint` before pushing; fix warnings or add clear justifications.

## Testing Guidelines
- Framework: Jest with `jsdom`; setup in `jest.setup.js` mocks Next.js/Supabase.
- File pattern: `__tests__/<area>/*.test.ts` or `*.test.tsx` with clear `describe` blocks.
- Aim for meaningful coverage on business logic in `lib/` and UI edge cases in `components/`.
- Useful: `npm run test:watch` during development; verify with `npm run test:coverage`.

## Commit & Pull Request Guidelines
- Commits: imperative, concise; emojis/scopes allowed (e.g., `🚀 v0.1.0: Release notes` or `Fix: Resolve Next.js 15 Suspense issue`).
- PRs: include summary, linked issues, screenshots for UI, and notes on DB/script changes.
- Checks: ensure `npm run lint` and `npm test` pass; include steps to reproduce and test.

## Security & Configuration Tips
- Env: put secrets in `.env.local` (not committed). Common keys: `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Email/providers: see `lib/*providers.ts` and related docs; avoid committing real credentials.
