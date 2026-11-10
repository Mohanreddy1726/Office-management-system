<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# OfficeFlow — Technical Decisions

- Stack: TanStack Start v1 (React 19 + TS + Tailwind v4 + shadcn/ui + Recharts). The master spec asked for Next.js, which is not supported on this platform; TanStack Start is the fixed equivalent. Frontend-only, no backend/DB.
- Demo "today" is fixed at 2026-10-22 so seeded data stays consistent across refreshes.
- Mock data: single shared store (`src/lib/data/`) — types, deterministic seed, React context store persisted to localStorage with Reset Demo Data. All modules read/write this store; no page-local hardcoded records.
- Auth: demo-only session (role + user id) in localStorage; `_app` layout guards client-side. Not production auth.
- Routes: `src/routes/index.tsx` = login; `_app.*` = authenticated shell with 16 module routes + `/employees/$id` profile.
- Role access: page access is gated in the app shell from the sidebar NAV roles; edit NAV roles to change who can open a module. Why: one source of truth for menu visibility and page access.
