# Repository Inventory

## Root Contents Overview

| Path | Purpose | Status |
| --- | --- | --- |
| ADVANCED_CHECKLIST_DOCS.md | Reference material on the advanced checklist feature set. | optional |
| ADVANCED_CHECKLIST_IMPLEMENTATION_STATUS.md | Status report for advanced checklist implementation. | optional |
| AUTH_FALLBACK_IMPLEMENTATION.md | Notes on fallback authentication strategies. | optional |
| CHECKLIST_FOR_ULYANA.md | Checklist specification tailored for the Ulyana workflow. | optional |
| DEGRADED_MODE.md | Guidance for handling degraded mode scenarios. | optional |
| IMPLEMENTATION_REPORT.md | Summary report of implementation progress. | optional |
| IMPLEMENTATION_SUMMARY.md | High-level implementation summary. | optional |
| IMPLEMENTATION_SUMMARY_DEGRADED_MODE.md | Implementation notes for degraded mode. | optional |
| IMPLEMENTATION_SUMMARY_FIX.md | Summary of fixes shipped. | optional |
| IMPLEMENTATION_SUMMARY_PRODUCTION_FIXES.md | Summary of production fixes. | optional |
| IMPLEMENTATION_SUMMARY_ULYANA.md | Implementation notes for the Ulyana checklist. | optional |
| IMPLEMENTATION_SUMMARY_VERCEL_FIX.md | Summary of Vercel-related fixes. | optional |
| MIGRATION_TRANSCRIPT_ID.md | Notes for the transcript ID migration. | optional |
| MULTI_USER_AUTH.md | Multi-user authentication design notes. | optional |
| PRODUCTION_FIXES.md | Production issue remediation log. | optional |
| README.md | Primary project overview and setup instructions. | optional |
| README_BACKEND_DEPLOY.md | Backend deployment guide. | optional |
| README_DEPLOY.md | General deployment instructions. | optional |
| README_ULYANA_CHECKLIST.md | README dedicated to the Ulyana checklist flow. | optional |
| REVERT_PR_84.md | Rollback plan for PR #84. | optional |
| SECURITY_SUMMARY.md | Baseline security assessment. | optional |
| SECURITY_SUMMARY_CHECKLIST_FIX.md | Security assessment for checklist fixes. | optional |
| SECURITY_SUMMARY_DEGRADED_MODE.md | Security summary for degraded mode. | optional |
| SECURITY_SUMMARY_PRODUCTION_FIXES.md | Security summary covering production fixes. | optional |
| SECURITY_SUMMARY_VERCEL_FIX.md | Security summary focused on the Vercel deployment. | optional |
| SESSION_SECRET_SETUP.md | Instructions for session secret management. | optional |
| TESTING_ADVANCED_CHECKLIST.md | Testing plan for the advanced checklist. | optional |
| TESTING_GUIDE.md | General testing guide. | optional |
| VERCEL_CHECKLIST_FIX.md | Notes on Vercel deployment checklist fixes. | optional |
| attached_assets/ | Imported screenshots and text snippets referenced via the `@assets` alias. | optional |
| ci.env.example | Example CI environment variables file. | optional |
| client/ | Front-end React + Vite application. | core |
| components.json | shadcn/ui component generator configuration. | optional |
| create-github-repo.js | Script to bootstrap a GitHub repository via the Replit connector. | optional |
| design_guidelines.md | Product and UI design guidelines. | optional |
| docs/ | Formal documentation and inventories. | optional |
| drizzle.config.ts | Drizzle ORM CLI configuration for migrations. | core |
| migrations/ | SQL migrations for the persistence layer. | core |
| nixpacks.toml | Railway/Nixpacks deployment recipe. | core |
| node_modules/ | Installed dependencies for the monorepo. | core |
| package-lock.json | Lockfile for reproducible npm installs. | core |
| package.json | Workspace-level scripts and dependencies. | core |
| push-to-github.js | Script that assists with pushing to GitHub from Replit. | optional |
| replit.md | Replit-focused setup and troubleshooting guide. | optional |
| reports/ | Operational reports (e.g., Railway health). | optional |
| sample-advanced-checklist.md | Sample data for the advanced checklist feature. | optional |
| sample-transcript.md | Sample transcript used in tests and documentation. | optional |
| scripts/ | Miscellaneous automation scripts. | optional |
| server/ | Express-based API service and supporting services. | core |
| server-dev.js | Standalone mock server for local demos outside the main stack. | maybe |
| shared/ | Shared TypeScript schema/types for cross-layer usage. | core |
| tailwind.config.ts | Root Tailwind config re-exporting the client setup for tooling compatibility. | core |
| tsconfig.json | TypeScript compiler configuration spanning client/server/shared. | core |
| vercel.json | Vercel deployment configuration. | optional |
| vite.config.ts | Root Vite config bootstrapping the client app from the monorepo. | core |

## Directory Trees (Depth ≤ 2)

### client/

```
client
├── .env.example
├── eslint.config.js
├── index.html
├── package-lock.json
├── package.json
├── packages
    ├── eslint-import-resolver-typescript
    └── vite-tsconfig-paths
├── postcss.config.js
├── scripts
    └── check-css-size.mjs
├── src
    ├── App.tsx
    ├── components
    ├── contexts
    ├── data
    ├── hooks
    ├── index.css
    ├── lib
    ├── main.tsx
    └── pages
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

### server/

```
server
├── .env.example
├── auth-guard.ts
├── data
    ├── for-ulyana-checklist.ts
    └── pre-trial-checklist.ts
├── db.ts
├── index.ts
├── lib
    └── gemini-client.ts
├── package-lock.json
├── package.json
├── routes.ts
├── services
    ├── advanced-gemini-analyzer.ts
    ├── auth.ts
    ├── checklist-parser.ts
    ├── gemini-analyzer.ts
    ├── gemini-client.ts
    ├── github-sync.ts
    ├── markdown-generator.ts
    ├── pdf-generator.ts
    └── whisper.ts
├── shared
    └── schema.ts
├── storage.ts
├── tsconfig.json
├── types
    ├── better-sqlite3.d.ts
    ├── cors-options.ts
    ├── cors.d.ts
    ├── dotenv.d.ts
    └── shared-schema.d.ts
├── utils
    ├── file-hash.ts
    └── logger.ts
├── vendor
    ├── cors
    └── dotenv
└── vite-server.ts
```

### shared/

```
shared
└── schema.ts
```

## Duplicate Configurations & Potentially Dead Files

- **Duplicate schema definitions:** `shared/schema.ts` and `server/shared/schema.ts` are byte-for-byte copies; only the server variant is imported at runtime while type declarations bridge to `shared/`. Consider consolidating the source of truth.
- **Tailwind configuration shadowing:** `tailwind.config.ts` simply forwards to `client/tailwind.config.js` for tooling compatibility. No action required, but keep in mind when editing Tailwind settings.
- **Potentially dead code paths:**
  - `server/lib/gemini-client.ts` is not imported anywhere in the repo and appears to be a superseded Gemini client implementation.
  - `server/services/github-sync.ts` exports helper functions that are never imported; similar functionality exists in standalone scripts.
  - `server-dev.js` implements a mock Express server that is not wired into the npm scripts.
  - `attached_assets/` is exposed via the `@assets` alias but the alias is not used under `client/src/`, suggesting the assets may be legacy.
  - `create-github-repo.js` and `push-to-github.js` duplicate logic from `server/services/github-sync.ts` for manual Replit workflows; evaluate whether a single shared utility is sufficient.

