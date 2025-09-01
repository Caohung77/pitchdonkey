# Repository Guidelines

## Project Structure & Module Organization
- Source: `src/app` (Next.js routes), shared logic in `lib/`, UI in `components/`, static assets in `public/`.
- Tests: `__tests__/` (e.g., `__tests__/lib/*.test.ts`, `__tests__/components/*.test.tsx`).
- Scripts & DB: utilities in `scripts/`; SQL files at repo root; Supabase config in `supabase/`.
- Imports: use `@/` alias from repo root (e.g., `import x from '@/lib/email-tracking'`).

## Build, Test, and Development Commands
- `npm run dev`: Start Next.js dev server at `http://localhost:3000`.
- `npm run build`: Create production build.
- `npm start`: Serve the built app.
- `npm run lint`: Lint with ESLint/Next rules.
- `npm test`: Run Jest tests once.
- `npm run test:watch`: Jest in watch mode.
- `npm run test:coverage`: Collect coverage for `lib/`, `components/`, `src/`.

## Coding Style & Naming Conventions
- Language: TypeScript; 2-space indentation; prefer single quotes.
- Components: PascalCase filenames/exports (e.g., `ErrorBoundary.tsx`).
- Helpers/services in `lib/`: kebab-case (e.g., `email-tracking.ts`, `campaign-processor.ts`).
- Imports: use `@/` alias; avoid deep relative paths.
- Run `npm run lint` before pushing; fix warnings or add clear justifications.

## Testing Guidelines
- Framework: Jest with `jsdom`; `jest.setup.js` mocks Next.js/Supabase.
- File pattern: `__tests__/<area>/*.test.ts` or `*.test.tsx`; use clear `describe` blocks.
- Focus: meaningful coverage for business logic (`lib/`) and UI edge cases (`components/`). Use `npm run test:coverage` to verify.
- During development, prefer `npm run test:watch` for quick feedback.

## Commit & Pull Request Guidelines
- Commits: imperative, concise; emojis/scopes allowed (e.g., `🚀 v0.1.0: Release notes`, `Fix: Resolve Next.js 15 Suspense issue`).
- PRs: include summary, linked issues, and screenshots for UI changes; note DB/script changes and any migrations.
- Checks: ensure `npm run lint` and `npm test` pass; include steps to reproduce and test instructions.

## Security & Configuration Tips
- Store secrets in `.env.local` (not committed).
- Common keys: `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Avoid committing real credentials; see provider configs under `lib/*providers.ts` and related docs.

