---
name: supabase
description: Use when doing any task involving this project's Supabase backend, Supabase MCP, Postgres database, schema changes, migrations, SQL, RLS policies, Auth, Storage, Edge Functions, Realtime, generated types, advisors, logs, or Supabase client configuration.
metadata:
  author: project
  project_ref: odljanxhmjysnduylvxz
---

# Supabase

## Project

- Supabase dashboard: https://supabase.com/dashboard/project/odljanxhmjysnduylvxz
- MCP server URL: `https://mcp.supabase.com/mcp?project_ref=odljanxhmjysnduylvxz&features=account,database,debugging,development,docs,functions,storage,branching`
- Project API settings: https://supabase.com/dashboard/project/odljanxhmjysnduylvxz/settings/api
- Data API settings: https://supabase.com/dashboard/project/odljanxhmjysnduylvxz/integrations/data_api/settings
- SQL editor: https://supabase.com/dashboard/project/odljanxhmjysnduylvxz/sql
- Database tables: https://supabase.com/dashboard/project/odljanxhmjysnduylvxz/editor
- Auth users: https://supabase.com/dashboard/project/odljanxhmjysnduylvxz/auth/users
- Storage: https://supabase.com/dashboard/project/odljanxhmjysnduylvxz/storage/buckets
- Edge Functions: https://supabase.com/dashboard/project/odljanxhmjysnduylvxz/functions
- Logs: https://supabase.com/dashboard/project/odljanxhmjysnduylvxz/logs/explorer
- Advisors: https://supabase.com/dashboard/project/odljanxhmjysnduylvxz/advisors

## Extension Sync

The browser extension syncs durable user data through `public.extension_user_state`.

- One row per Supabase Auth user: `user_id uuid primary key references auth.users(id)`.
- User data lives in `state jsonb`; `state_version` starts at `1`.
- RLS is enabled. Authenticated users can select/insert/update/delete only their own row.
- Local migration files live in `supabase/migrations/`.
- Browser code uses only the publishable key and the user's Supabase Auth session. Never add service-role keys to extension files.

When adding a new permanent extension storage key, update `supabase_sync.js` so the key is either synced or explicitly excluded. StageTimer data must stay outside Supabase sync and continue using Google Sheets.

Password recovery in the sidepanel expects a recovery code from email. If the default Supabase recovery email sends only a link, update the Recovery email template in the Dashboard to include `{{ .Token }}`.

## Connection

This repository stores portable MCP setup in git:

- Codex project config: `.codex/config.toml`
- Generic MCP client config: `.mcp.json`
- Project skill: `.agents/skills/supabase/SKILL.md`

The Codex config should contain:

```toml
[mcp_servers.supabase]
url = "https://mcp.supabase.com/mcp?project_ref=odljanxhmjysnduylvxz&features=account,database,debugging,development,docs,functions,storage,branching"
startup_timeout_sec = 20
tool_timeout_sec = 120
enabled = true
```

The generic `.mcp.json` should contain the same server URL for tools that read MCP config from the project root.

### New Computer Setup

After cloning this repository on another computer:

1. Open the repository in Codex and make sure it is trusted.
2. Verify the project config exists: `sed -n '1,120p' .codex/config.toml`
3. Run OAuth login once on that computer: `codex mcp login supabase`
4. Restart the Codex session if the Supabase tools are not visible immediately.
5. Confirm connectivity by asking Codex to list Supabase tables or search Supabase docs through MCP.

OAuth credentials are intentionally not stored in git. Only the non-secret project configuration is committed, so a new computer should need login only, not manual MCP setup.

If Supabase MCP tools are unavailable, check the config first:

```bash
sed -n '1,120p' .codex/config.toml
```

Then ask the user to authenticate from this repository:

```bash
codex mcp login supabase
```

Restart the Codex session after login if the tools still do not appear. If the `codex` CLI is broken locally, tell the user to run the same login from a working Codex CLI/IDE environment; do not ask for service role keys or database passwords as a workaround.

Because this server URL is project-scoped with `project_ref`, Supabase can disable account-management tools even though `account` is listed in `features`. This is expected. To manage organizations or create separate Supabase projects through MCP later, use an additional account-scoped server entry without `project_ref`.

## MCP Usage

Prefer Supabase MCP tools over direct dashboard instructions when they are available:

- Use docs/search tools before implementing unfamiliar Supabase features.
- Use database tools to list tables, inspect migrations, execute SQL, and apply schema changes.
- Use debugging tools for logs and advisors before guessing at runtime failures.
- Use development tools for project URL, publishable keys, and generated TypeScript types.
- Use functions tools for listing, reading, and deploying Edge Functions.
- Use storage tools for bucket and storage configuration tasks.
- Use branching tools only when the project plan supports Supabase branching.

The MCP URL is intentionally not read-only. Treat all mutating actions as real project changes. Before destructive SQL or storage changes, state the intended operation and verify the target objects.

## Safety Rules

- Never request or expose `service_role`, database passwords, JWT secrets, or private user data unless the user explicitly needs a secret-handling workflow.
- Do not put secret keys in committed files. Use local environment variables or the platform secret store.
- Use publishable/anon keys only in browser-facing code.
- Enable RLS on tables in exposed schemas, especially `public`.
- Do not use `user_metadata` / `raw_user_meta_data` for authorization decisions; use app metadata or database tables controlled by trusted code.
- For views that should respect RLS, use `security_invoker = true` on supported Postgres versions.
- Keep `security definer` functions out of exposed schemas.

## Schema Changes

For exploratory schema changes, use MCP `execute_sql` and verify with a read query. When a durable migration is needed:

1. Inspect existing migrations and local Supabase layout.
2. Create migrations with `supabase migration new <name>` when Supabase CLI is present.
3. Run advisors with MCP or CLI.
4. Generate/check types if frontend code consumes the changed schema.
5. Confirm RLS and grants for exposed tables.

If Supabase CLI is needed, discover commands with `supabase --help` and `supabase <group> --help`; do not guess CLI flags from memory.

## Documentation

- Supabase MCP docs: https://supabase.com/docs/guides/getting-started/mcp
- Supabase Agent Skills: https://supabase.com/docs/guides/getting-started/ai-skills
- Supabase JS docs: https://supabase.com/docs/reference/javascript/introduction
- Supabase CLI docs: https://supabase.com/docs/reference/cli/introduction
- RLS guide: https://supabase.com/docs/guides/database/postgres/row-level-security
- Securing the Data API: https://supabase.com/docs/guides/api/securing-your-api
- Edge Functions: https://supabase.com/docs/guides/functions
- Storage security: https://supabase.com/docs/guides/storage/security/access-control
- Auth security: https://supabase.com/docs/guides/auth
- Supabase changelog: https://supabase.com/changelog.md

Before implementing Supabase-specific behavior, check current docs or MCP docs search because Supabase APIs and platform behavior change frequently.
