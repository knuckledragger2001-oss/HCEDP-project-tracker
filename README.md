# HCEDP Projects Tracker

Internal tool for the Hays Caldwell Economic Development Partnership to track
RFIs (Requests for Information from companies considering relocation or
expansion into central Texas) from intake through outcome — and to produce the
activity and submission reports its city partners expect.

It runs locally today (single user) but is structured so that login, roles, a
cloud database, and cloud file storage can be added later without rewriting
feature code.

---

## What it does

- **Intake** — Paste an RFI email and/or upload attachments (PDF, Excel, Word,
  PowerPoint, images). The content is sent to Anthropic's API, which extracts
  the structured fields (capex, jobs, site/utility requirements, ranked
  criteria, dates, deliverables, qualitative notes). **Nothing is saved
  automatically** — the parsed proposal is shown in an editable form for review
  first, and any value the parser had to assume or convert is flagged.
- **Pipeline board** — Projects move through seven stages (RFI Received →
  Pending Information → RFI Submitted → Shortlisted → Site Visit → Won / Lost)
  by drag-and-drop or a dropdown. Every stage change is timestamped in history.
- **Sites & submissions** — Maintain a list of real-estate sites grouped by the
  nine communities, and record which sites were submitted for each project.
- **Reports** — Two partner-facing reports, each filterable (community, date or
  quarter, NAICS, stage) and exportable to **PDF and Excel**:
  - *City Activity* — projects that submitted at least one site in a community,
    with the submitted sites grouped under each project.
  - *Quarterly Submission Summary* — per-community counts of submissions,
    distinct projects, and win/loss outcomes.

Unit normalization is applied during parsing: electricity → MW (with dated
day-one / peak / ramp datapoints), water and wastewater → thousand gal/day
(monthly figures converted to daily and flagged), gas → thousand ft³/day (the
raw value is always retained). Normalized value, raw value, and time-phasing
are all stored, and conversions are flagged for review.

---

## Tech stack

| Concern      | Choice                                                    |
| ------------ | --------------------------------------------------------- |
| Framework    | Next.js (App Router) + React + TypeScript                 |
| Database     | PostgreSQL (Docker locally; any managed Postgres in prod) |
| ORM          | Prisma — all database access goes through it              |
| AI parsing   | Anthropic API (model configurable via env var)            |
| File storage | Pluggable driver (local disk now; S3 / Blob later)        |
| PDF export   | pdfmake                                                   |
| Excel export | ExcelJS                                                   |
| Styling      | Tailwind CSS                                              |

---

## Prerequisites

- **Node.js 20+**
- **Docker Desktop** for the local Postgres container — or any reachable
  PostgreSQL instance
- An **Anthropic API key** (only needed for automated RFI parsing; without it
  the app still runs and RFIs can be entered manually)

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file and fill it in
cp .env.example .env
#    - paste your ANTHROPIC_API_KEY (leave blank to enter RFIs manually)
#    - DATABASE_URL already points at the Docker Postgres below

# 3. Start the local Postgres container
npm run db:up

# 4. Generate the Prisma client, create the schema, seed the 9 communities
npm run setup

# 5. Run the app
npm run dev
```

Then open <http://localhost:3000>.

### Environment variables

| Variable                      | Required | Purpose                                                                  |
| ----------------------------- | -------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`                | yes      | PostgreSQL connection string                                             |
| `ANTHROPIC_API_KEY`           | no\*     | Enables automated RFI parsing. **Read from env only — never committed.** |
| `ANTHROPIC_MODEL`             | no       | Model for routine parsing (default `claude-sonnet-4-6`)                  |
| `ANTHROPIC_MODEL_HIGH_EFFORT` | no       | Stronger model for difficult docs (default `claude-opus-4-8`)            |
| `STORAGE_DRIVER`              | no       | `local` (default). Future: `s3` / `blob`                                 |
| `STORAGE_LOCAL_DIR`           | no       | Where local uploads are written (default `./storage-uploads`)            |
| `BASIC_AUTH_USER`             | no       | Username for the shared-password login gate (see below)                  |
| `BASIC_AUTH_PASS`             | no       | Password for the shared-password login gate                              |

\* Without an API key, intake falls back to a blank, fully editable form so RFIs
can still be entered and saved by hand.

The API key is read **only** from the environment (`src/lib/config.ts`). It is
never hardcoded, and `.env` is git-ignored.

### Login gate

The app uses HTTP Basic Auth (browser-native login prompt). To enable it, set
`BASIC_AUTH_USER` and `BASIC_AUTH_PASS` in your Railway environment variables
(or `.env` locally). If either variable is unset, the gate is disabled — useful
for local development. In Railway, add both variables in the app service
Variables tab, then redeploy.

---

## Useful scripts

| Script              | What it does                                    |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Start the dev server                            |
| `npm run build`     | Production build (runs `prisma generate` first) |
| `npm run start`     | Serve the production build                       |
| `npm run db:up`     | Start the Postgres container                     |
| `npm run db:down`   | Stop the Postgres container                      |
| `npm run setup`     | `prisma generate` + `db push` + seed communities |
| `npm run db:studio` | Open Prisma Studio to browse the database        |

---

## Project structure

```
prisma/
  schema.prisma        # data model (Project, Community, Site, Submission, …)
  seed.ts              # seeds the 9 communities in order
src/
  app/                 # routes (board, intake, sites, reports) + API handlers
  components/          # UI (board, intake review form, reports view, …)
  lib/
    anthropic/         # RFI parsing: schema, attachment handling, parser
    reports/           # report queries + PDF/Excel generation
    storage/           # storage abstraction (local driver today)
    projects/          # project save/update schemas
    config.ts          # env-driven configuration (API key, model, storage)
```

---

## Deploying to the cloud

The app is host-agnostic (Vercel, Render, Railway, a container, …). To deploy:

1. Provision a managed PostgreSQL database and set `DATABASE_URL` to its
   connection string.
2. Set `ANTHROPIC_API_KEY` (and optionally the model variables) in the host's
   environment settings.
3. Run `prisma migrate deploy` (or `prisma db push`) and seed once.
4. For uploaded files, implement an S3 / Blob `StorageDriver` in
   `src/lib/storage/` and set `STORAGE_DRIVER` accordingly — no feature code
   changes are required.

> Note on PDF generation: `pdfmake` does `__dirname`-relative font reads that
> break once the module is bundled, so PDFs are rendered in a short-lived Node
> subprocess (`scripts/pdf-render.cjs`) that loads `pdfmake` from `node_modules`
> directly. The report layout is built in `src/lib/reports/pdf.ts` and passed to
> that script as JSON. Both files must ship together, and `node` must be on the
> host PATH (it is on every supported host). `officeparser` has the same bundling
> issue and is declared in `next.config.ts` under `serverExternalPackages` — keep
> that entry when changing the build.

---

## Roadmap (intentionally not built yet)

- Generate RFI Response documents from stored project data
- Site database sourced from LoopNet and automated site-search matching
- Authentication, roles, and multi-user support
- Inbound Outlook task that posts to the same internal intake endpoint
- Free-form AI reporting: a text box on the Reports page where staff type a
  plain-language question and the Claude API answers over the project/site data
  (likely via tool use against read-only queries), beyond the fixed report types
- Site brochure scraper: upload a PDF marketing brochure for a site and the
  Anthropic API extracts the structured fields (acreage, sq ft, price/sq ft,
  utilities, county, address) into a draft review form before saving to the
  sites database — same review-before-save pattern as RFI intake
