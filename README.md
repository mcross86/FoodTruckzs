# foodtruckzs

## Product architecture (dual-intent redesign)

See [`docs/product-ux-architecture-redesign.md`](docs/product-ux-architecture-redesign.md) for workflows, IA, routing, domain boundaries, state machines, and implementation phases.

**Customer entry points**

- `/` — Intent gateway (Hungry Now vs Plan Event vs Vendor)
- `/discover` — Real-time discovery (mobile-first)
- `/plan/*` — Progressive catering RFQ (auth before submit)
- `/marketplace` — Catering-oriented vendor search (existing)

**Vendor entry points**

- `/vendor/login` — Vendor sign-in
- `/vendor/register` — Multi-step onboarding wizard

foodtruckzs is a marketplace and catering operations platform for food truck catering.

This repository is bootstrapped as a TypeScript monorepo with:

- `apps/web`: Next.js web application.
- `apps/api`: Node.js/TypeScript Fastify API.
- `packages/shared`: shared TypeScript package for cross-app constants, DTOs, and validators.
- `docs`: product, architecture, technical, flow, and build-continuity documentation.

## Prerequisites

- Node.js 22 or newer.
- pnpm 9 or newer.

## Setup

```sh
pnpm install
```

Copy environment defaults when local runtime configuration is needed:

```sh
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

## Development

Run both app shells:

```sh
pnpm dev
```

Run checks:

```sh
pnpm typecheck
pnpm lint
pnpm build
```

## Current Scope

The repository currently contains foundation-only app shells and tooling. Product workflows such as auth, RFQs, payments, agreements, and UI pages are intentionally not implemented yet.
