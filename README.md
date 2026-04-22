# TenderSpot

TenderSpot is a production-focused B2B tender intelligence platform for roofing opportunities. It combines a controlled data ingestion pipeline with an operational dashboard for qualification, triage, and team workflow.

## Product Scope

TenderSpot addresses three operational needs:

- discover relevant tenders from public procurement sources;
- normalize and score incoming records with deterministic filters;
- support internal deal flow through status tracking and analyst notes.

The system is designed for recurrent daily ingestion with idempotent persistence.

## Core Capabilities

- Source ingestion through a modular ETL adapter architecture.
- Two-stage EIS parsing pipeline (surface scan + deep enrichment).
- Deterministic duplicate protection at database level.
- Rule-based relevance scoring for regional and domain accuracy.
- Price, date, and customer gating aligned with B2B procurement priorities.
- Realtime-ready UI with workflow statuses and analyst annotations.
- Viewed/unviewed tracking with optimistic updates and "Only new" focus mode.

## Architecture Overview

TenderSpot has two primary runtime domains:

- Frontend application in React + TypeScript.
- Parser service in Node.js + TypeScript.

### Frontend Domain

The frontend is responsible for:

- secure invite-token authentication;
- data listing and filtering;
- status transitions;
- analyst note updates;
- realtime synchronization with Appwrite.

### Parser Domain

The parser domain is responsible for:

- source crawling and extraction;
- domain filtering and reject statistics;
- relevance scoring;
- normalized row mapping;
- idempotent upsert into Appwrite collections.

## Technology Stack

### Frontend

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Appwrite Web SDK

### Backend and Data Ingestion

- Node.js
- TypeScript
- tsx runtime for parser jobs
- node-cron for scheduling
- node-appwrite SDK for server-side writes
- Cheerio for HTML parsing

### Data Platform

- Appwrite Databases
- Appwrite Realtime
- Appwrite API keys for parser service authentication

## Data Ingestion Methodology

TenderSpot parser follows a structured ETL flow:

1. Stage 1: extraction from EIS result pages and fast block-level candidate filtering;
2. Stage 2: deep page enrichment by `sourceUrl` with strict INN/ZIP checks;
3. deterministic reject classification with reason-level logging;
4. relevance scoring and ranking for final shortlist;
5. bounded load to Appwrite with deterministic document IDs.

### Two-Stage EIS Pipeline

- Stage 1 keeps only cheap, high-throughput checks (price/date/non-B2B/hard-roof exclusions).
- Stage 2 performs deterministic deep validation using parsed page content.
- INN checks use prefix-based rules; ZIP checks use address-context extraction only.
- Final ETL logs include explicit stage summaries and reject reason distribution.

### Idempotency Model

Idempotency is guaranteed through deterministic document identifiers:

- create with `ID.custom(externalId)`;
- on conflict (`409`), update existing document;
- no destructive cleanup in regular ETL runs.

This model prevents duplicate growth during repeated executions.

## Filtering Strategy

The parser uses layered filtering:

- source-side narrowing via URL query params;
- Stage 1 hard rejects for non-target records;
- Stage 2 deterministic geographic validation (INN and ZIP guillotines);
- regional scoring penalties and bonuses;
- post-filter ranking and truncation.

The canonical filter specification is maintained in `EIS_FILTERS_CURRENT.md`.

## Domain Workflow in UI

TenderSpot supports four workflow statuses:

- new
- wip
- submitted
- rejected

Analysts can update status and notes directly from the dashboard. These workflow fields are persisted in Appwrite and preserved across parser reruns.

The dashboard also supports read tracking:

- unread tenders are visually highlighted;
- opening a row or source link marks a tender as viewed;
- optimistic frontend mutation updates UI immediately;
- a dedicated "Only new" filter helps operators process fresh intake faster.

`isViewed` is initialized on document create and is not force-overwritten on updates.

## Repository Structure

Top-level modules:

- `src/` frontend application;
- `services/parser/` parser service;
- `EIS_FILTERS_CURRENT.md` active extraction and filtering specification.

## Security and Access Model

- Public sign-up is not part of the operational flow.
- Access is controlled through invite-token onboarding.
- Parser uses server API key and runs outside browser security context.
- Frontend uses scoped client credentials and collection permissions.

## Operational Principles

- Prefer idempotent writes over cleanup procedures.
- Keep reject reasons explicit and measurable.
- Preserve analyst workflow metadata during data refreshes.
- Preserve viewed state (`isViewed`) when existing records are updated.
- Separate extraction logic from UI workflow concerns.

## Quality and Governance

The project emphasizes operational predictability:

- deterministic filters with inspectable reasons;
- explicit logging at each ETL phase;
- typed contracts between adapters, loaders, and UI data models;
- documentation-driven filter governance.

## Intended Audience

This repository is intended for:

- engineering leads overseeing tender intelligence systems;
- backend engineers maintaining ETL quality gates;
- frontend engineers responsible for workflow productivity;
- operations teams requiring stable daily ingestion.

## License

This project is licensed under the MIT License. See `LICENSE`.
