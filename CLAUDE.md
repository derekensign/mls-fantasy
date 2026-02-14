# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
# Root level (runs all workspaces)
npm run dev       # Start dev servers for all apps
npm run build     # Build all workspaces
npm run lint      # Lint TypeScript/TSX files across project

# App-specific (from apps/golden-bota or apps/lv-fantasy)
npm run dev       # Dev server (golden-bota uses Turbopack)
npm run build     # Production build
npm run lint      # ESLint validation

# Shared API package (from packages/api)
npm run build     # Compile TypeScript to dist/
npm run watch     # Watch mode for development
```

## Testing

```bash
# From apps/golden-bota
npm test                              # Run all 87 Playwright tests
npm run test:ui                       # Interactive UI mode
npx playwright test --grep "draft"    # Run specific test suite
npx playwright test --headed          # Run with visible browser
```

Tests are in `apps/golden-bota/tests/` covering:
- `auth.spec.ts` - Authentication flows
- `draft.spec.ts` - Draft page and commissioner test mode
- `league.spec.ts` - League management
- `my-team.spec.ts` - Team display
- `standings.spec.ts` - Golden Boot standings
- `transfer.spec.ts` - Transfer window

Note: Commissioner-only tests (test mode, reset) require authentication to fully exercise.

## AWS Access

```bash
# AWS credentials are in .env.local
# Must unset work AWS env vars first when running CLI commands:
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_PROFILE AWS_DEFAULT_PROFILE
source .env.local  # or export manually

# Account: 853443719819
# Region: us-east-1
```

## Architecture Overview

### Monorepo Structure

This is an npm workspaces monorepo with:
- **apps/golden-bota**: Primary fantasy app (Next.js Pages Router) with full draft, transfer, and league management
- **apps/lv-fantasy**: Lightweight ladder view app (Next.js 14 App Router)
- **packages/api**: Shared TypeScript API client (`@mls-fantasy/api`) used by both apps

### Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS, Material-UI
- **State**: Zustand for global state, React state for components
- **Auth**: AWS Cognito via `react-oidc-context`
- **Backend**: AWS Lambda (Node.js 20.x), DynamoDB, API Gateway HTTP API
- **Deployment**: Vercel (frontend), AWS Console (backend)

### Data Flow

```
User → Next.js App → @mls-fantasy/api → API Gateway (HTTP API) → Lambda → DynamoDB
```

## AWS Resources (Actually In Use)

### API Gateway (HTTP API v2)

| API ID | Name | Base URL |
|--------|------|----------|
| `emp47nfi83` | mls-fantasy | `https://emp47nfi83.execute-api.us-east-1.amazonaws.com/prod` |
| `0n685go0ul` | copa-tejas | `https://0n685go0ul.execute-api.us-east-1.amazonaws.com` |

### API Endpoints (emp47nfi83)

| Method | Path | Lambda Function |
|--------|------|-----------------|
| ANY | `/get-all-players` | fetchPlayers |
| ANY | `/players/{league_id}` | fetchPlayersByLeagueId |
| GET | `/get-user-info` | getUserInfo |
| GET | `/golden-boot-table/{leagueId}` | getGoldenBootTable |
| GET | `/league/{league_id}` | fetchLeagueData |
| GET | `/league/{league_id}/draft` | getDraftedPlayers |
| GET | `/league/{league_id}/draft-settings` | getDraftData |
| GET | `/league/{league_id}/drafted-players` | getDraftedPlayersByLeague |
| GET | `/league/{league_id}/settings` | getLeagueSettings |
| GET | `/league/{league_id}/transfer` | transfer-functions-GetTransferWindowFunction |
| POST | `/get-my-team` | fetchFantasyTeamByPlayer |
| POST | `/league/create` | createLeague |
| POST | `/league/{league_id}/draft` | draftPlayers |
| POST | `/league/{league_id}/draft-settings` | updateDraftData |
| POST | `/league/{league_id}/draft/join` | joinDraftSession |
| POST | `/league/{league_id}/join` | joinLeague |
| POST | `/league/{league_id}/settings` | updateLeagueSettings |
| POST | `/league/{league_id}/transfer/advance` | transfer-functions-AdvanceTransferTurnFunction |
| POST | `/league/{league_id}/transfer/done` | markUserDoneTransferring |
| POST | `/league/{league_id}/transfer/drop` | transfer-functions-DropPlayerFunction |
| POST | `/league/{league_id}/transfer/pickup` | transfer-functions-PickupPlayerFunction |
| POST | `/update-team` | updateTeam |

### DynamoDB Tables (In Use)

| Table | Purpose |
|-------|---------|
| `Draft` | Draft session and transfer window state |
| `Fantasy_Players` | User teams, profiles, and rosters |
| `Players_2026` | MLS player database for current season |
| `League_{leagueId}` | Per-league player assignments (dynamic table per league) |

### DynamoDB Tables (Legacy/Other)

| Table | Purpose |
|-------|---------|
| `Players_2025`, `Players_2024`, `Player_2023` | Historical player data |
| `Golden_Boot_Players` | Legacy standings table |
| `League_Settings` | League configuration |
| `Copa_Tejas_Table` | Separate copa-tejas app data |

## Key Files for Understanding the System

- `packages/api/src/API.ts` - All API endpoints, types, and interfaces (~600 lines)
- `apps/golden-bota/src/types/DraftTypes.ts` - Core data models
- `apps/golden-bota/src/config/authConfig.ts` - Cognito authentication config

## Important Patterns

### Transfer Window State Machine
The transfer window is the most complex part of the system:
- Uses snake draft order for turn management
- Two-phase transfers: drop player → pick up player
- Tracks goals at drop/pickup time for accurate scoring
- State stored in `Draft` table with `transfer_window_status`, `transferOrder`, `activeTransfers`

### Authentication
- AWS Cognito Hosted UI handles OAuth flows
- Tokens stored in localStorage, auto-refresh 60s before expiry
- **Cognito User Pool**: `us-east-1_D6OPuwWML`
- **App Client ID**: `7b2ljliksvl2pn7gadjrn90e1a`
- **Session duration**: Refresh token set to 30 days (updated Feb 2026)

## Season Management Scripts

Located in `backend/goldenbota2025/OneTime/`:

| Script | Purpose |
|--------|---------|
| `resetDraftForTesting.js` | Wipe draft state, clear League_1, reset Fantasy_Players rosters |
| `markNewPlayers.js` | Tag players with `isNew` (new to MLS) and `isNewToTeam` badges |
| `archive2025Standings.js` | Archive previous season standings |
| `archiveLeague1_2025.js` | Archive league player assignments |
| `initializeDraft2026.js` | Set up draft for new season |

Run scripts with: `AWS_PROFILE=mls-fantasy node backend/goldenbota2025/OneTime/<script>.js`
(Remember to unset work AWS env vars first)

## Commissioner Features

- **Test Mode** (draft page): Allows commissioner to draft as any team for testing
- **Reset Draft**: Button to wipe draft and start fresh (calls resetDraftForTesting logic)
- Commissioner is determined by matching `userDetails.email` with `leagueSettings.commissioner`

## Player Data Fields

| Field | Purpose |
|-------|---------|
| `isNew` | Player is new to MLS (first season) |
| `isNewToTeam` | Player transferred to new MLS team (intra-league transfer) |
| `goals_2025` | Previous season goals (for reference during draft) |

## Current Season

**2026 Season** is active. Players table is `Players_2026`.

## Notes

- Lambda functions are deployed via AWS Console (not SAM/CloudFormation for the active API)
- The SAM-deployed REST APIs (`7vyo0a46v4`, `2z3015lyvl`) exist but are NOT used by the app
- Table names are hardcoded in Lambda functions (no environment variables)
- Production URL: Deployed on Vercel (check Vercel dashboard for current URL)
