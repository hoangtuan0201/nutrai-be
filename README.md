# NutraAI — Backend API (`be-nutraai`)

> **AI-Powered Nutrition & Calorie Tracking Backend** — Modular NestJS 11 RESTful API backed by PostgreSQL, Prisma ORM v7.8, and Redis.

[![NestJS](https://img.shields.io/badge/NestJS-11.0-E0234E?logo=nestjs)](https://nestjs.com)
[![Prisma](https://img.shields.io/badge/Prisma-7.8-2D3748?logo=prisma)](https://www.prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis)](https://redis.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org)

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema (16 Models / 7 Domains)](#database-schema-16-models--7-domains)
- [Environment Setup & Running](#environment-setup--running)
- [API Documentation (Swagger)](#api-documentation-swagger)
- [Testing](#testing)
- [Common Utilities & Security](#common-utilities--security)
- [Seeded Demo Accounts](#seeded-demo-accounts)

---

## Overview

`be-nutraai` is the central backend service powering both the **NutraAI Mobile Application** (`mobile-nutraai`) and the **NutraAI Web Administration Console** (`admin-nutrai`). It provides:

- **Authentication & Account Security**: Email/password registration with bcrypt hashing, Google Firebase OAuth, JWT access tokens, `@AdminOnly()` Role-Based Access Control (RBAC), and Gmail SMTP 6-digit OTP email verification & password recovery dispatched asynchronously via `@nestjs/cqrs` EventBus.
- **Biometrics & Nutrition Targets**: Mifflin-St Jeor BMR/TDEE energy calculation with safe calorie floors and automatic macro target recalculation.
- **Multi-Source Food & Meal Tracking**: Verified local PostgreSQL food catalogue (with fail-open Redis cache-aside and non-blocking `SCAN` invalidation), Open Food Facts v2 barcode lookup, USDA FoodData Central search, and full meal/item CRUD.
- **Multimodal AI Services (Google Gemini)**:
  - **AI Vision Meal Scanner**: Structured JSON food decomposition with automatic model fallback (`gemini-flash-lite-latest` → `gemini-2.5-flash`), optional user text hints, and no-food guards.
  - **Hybrid AI Nutritionist Coach**: Live database context injection paired with a 2-turn server-side function-calling loop across 4 tools (`get_nutrition_by_date_range`, `search_food_database`, `quick_log_meal`, `log_body_weight`).
  - **Timezone-Aware Daily AI Quotas**: Differentiated Free (`3 scans / 5 chats`) and Pro (`20 scans / 50 chats`) daily limits.
- **Subscriptions & Payments (SePay VietQR)**: Dynamic VietQR checkout generation, constant-time webhook authentication (`crypto.timingSafeEqual`), active User API v2 reconciliation, idempotent `PaymentEvent` tracking, and atomic Pro activation inside `prisma.$transaction()`.
- **Notifications & Push Scheduling**: Timezone-aware per-minute cron schedulers (`@nestjs/schedule`) for meal reminders with logged-meal suppression, Streak Rescue, Weekly Weigh-In, and Firebase Cloud Messaging (FCM) delivery.
- **Web Admin Operations API**: Dedicated `@AdminOnly()` endpoints for revenue/MRR metrics, user inspection & Pro tier management, verified food CRUD with Cloudinary uploads, payment/webhook auditing, and segmented push broadcasts.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| Framework | [NestJS](https://nestjs.com) `^11.0.1` + `@nestjs/cqrs` + `@nestjs/schedule` |
| Language | TypeScript `^5.7.3` |
| Database & ORM | PostgreSQL 15 + [Prisma ORM](https://www.prisma.io) `^7.8.0` (`@prisma/adapter-pg`) |
| Caching | Redis 7 via `ioredis` `^6.0.0` (fail-open cache-aside) |
| Validation | `class-validator` / `class-transformer` + `zod` (env validation) |
| API Docs | OpenAPI / Swagger (`@nestjs/swagger`, `/api/docs`) |
| AI / Multimodal LLM | Google Gemini API (`gemini-flash-lite-latest` → `gemini-2.5-flash`) |
| Auth & Push | JWT (`@nestjs/jwt`), `bcrypt`, Firebase Admin SDK (`firebase-admin`) |
| Email & Media | Nodemailer (Gmail SMTP) & Cloudinary (`cloudinary`) |
| Payments | SePay VietQR (Webhooks + User API v2) |
| Testing | Jest `^30.0.0` + `ts-jest` + Supertest |

---

## Project Structure

```text
be-nutraai/
├── prisma.config.ts                     # Prisma v7 CLI config (points to src/database/prisma/schema.prisma)
├── docker-compose.yml                   # Local PostgreSQL 15 + Redis 7 containers
├── Dockerfile                           # Multi-stage production container build
├── package.json
├── src/
│   ├── main.ts                          # Bootstrap: 25MB rawBody JSON, ValidationPipe, CORS, Swagger (/api/docs)
│   ├── app.module.ts                    # Root module wiring Config, Prisma, Redis, CQRS, Schedule & 13 domain modules
│   ├── app.controller.ts / app.service.ts
│   │
│   ├── config/                          # Typed environment configuration & Zod validation
│   │   ├── configuration.ts
│   │   ├── database.config.ts
│   │   ├── redis.config.ts
│   │   ├── auth.config.ts
│   │   ├── jwt.config.ts
│   │   ├── firebase.config.ts
│   │   └── validation.schema.ts
│   │
│   ├── common/                          # Shared cross-cutting infrastructure
│   │   ├── cloudinary/                  # Cloudinary media upload service & module
│   │   ├── redis/                       # Fail-open Redis cache-aside & SCAN invalidation
│   │   ├── decorators/                  # @CurrentUser, @Public, @Roles / @AdminOnly
│   │   ├── filters/                     # Global HttpExceptionFilter
│   │   ├── guards/                      # JwtAuthGuard, RolesGuard
│   │   ├── interceptors/                # LoggingInterceptor, TransformInterceptor
│   │   ├── pipes/                       # CustomValidationPipe (field-level JSON error map)
│   │   ├── constants/                   # Global constants
│   │   └── utils/                       # Timezone & date helpers (date.util.ts)
│   │
│   ├── database/
│   │   └── prisma/
│   │       ├── schema.prisma            # Authoritative 3NF Prisma schema (16 models across 7 domains)
│   │       ├── migrations/              # Prisma migration history
│   │       ├── seed.ts                  # Database seeder (users, plans, 44 verified foods, sample logs)
│   │       ├── prisma.service.ts        # PrismaClient lifecycle with @prisma/adapter-pg
│   │       └── prisma.module.ts         # Global PrismaModule
│   │
│   ├── modules/                         # 13 Feature / Domain Modules (Controller -> Service -> Repository)
│   │   ├── account/                     # Account profile, avatar upload (Cloudinary), password & account actions
│   │   ├── admin/                       # Admin Console APIs (dashboard, users, foods, payments, notifications)
│   │   ├── ai/                          # Gemini Vision meal scanning, fallback & AiQuotaService
│   │   ├── ai-assistant/                # Hybrid AI Coach (context injection + 4 server-side tools)
│   │   ├── auth/                        # Register/Login, Firebase Google OAuth, OTP & CQRS email events
│   │   ├── firebase/                    # Firebase Admin Auth verification
│   │   ├── foods/                       # Local verified foods (Redis-cached), Open Food Facts & USDA lookup
│   │   ├── mail/                        # Gmail SMTP Nodemailer service & OTP HTML templates
│   │   ├── meals/                       # Meal & MealItem logging CRUD and daily summaries
│   │   ├── notifications/               # In-app Notification Center, DeviceToken FCM & timezone cron scheduler
│   │   ├── payments/                    # SePay VietQR checkout, webhook idempotency & atomic Pro activation
│   │   ├── profile/                     # UserProfile, Mifflin-St Jeor nutrition calculator & NutritionTarget
│   │   └── progress/                    # WeightLog tracking, BMI & 30-day calorie/weight analytics
│   │
│   └── scripts/                         # Verification & maintenance utility scripts
│
└── test/
    ├── unit/                            # Unit test suites (Jest)
    └── app.e2e-spec.ts                  # End-to-end test configuration
```

---

## Database Schema (16 Models / 7 Domains)

The authoritative Prisma schema is located at:

- **Schema path**: [`src/database/prisma/schema.prisma`](src/database/prisma/schema.prisma)
- **Prisma v7 CLI configuration**: [`prisma.config.ts`](prisma.config.ts)
- **Seed script**: [`src/database/prisma/seed.ts`](src/database/prisma/seed.ts)

Designed in Third Normal Form (3NF), the schema defines **16 PostgreSQL tables** organised into **7 domains**:

| Domain | Prisma Model | PostgreSQL Table (`@@map`) | Purpose |
| :--- | :--- | :--- | :--- |
| **1. Auth & Account** | `User` | `users` | Core account identity, credentials/Google Firebase UID, RBAC role (`USER`/`ADMIN`), email verification & password reset tokens |
| **2. Profile & Targets** | `UserProfile` | `user_profiles` | Biometrics (DOB, gender, height, weight, target weight), activity level, fitness goal, timezone & meal reminder preferences |
| | `NutritionTarget` | `nutrition_targets` | Historical & active daily calorie and macro targets (protein, carbs, fat) computed via Mifflin-St Jeor |
| **3. Food & Meal Tracking** | `Food` | `foods` | Verified standard food catalogue (per-100g macros, default serving size, Cloudinary image) |
| | `Meal` | `meals` | Logged meal header (`BREAKFAST`, `LUNCH`, `DINNER`, `SNACK`), source (`MANUAL`, `AI_TEXT`, `AI_IMAGE`), aggregated totals |
| | `MealItem` | `meal_items` | Individual food items belonging to a `Meal`, optionally linked (`SetNull`) to `Food` |
| **4. AI Features** | `AiMealAnalysis` | `ai_meal_analyses` | Multimodal Gemini scan audit records (raw response, parsed items, confidence, status, model, latency, optional 1-to-0..1 `Meal` link) |
| | `ChatConversation` | `chat_conversations` | AI Nutritionist Coach conversation threads per user |
| | `ChatMessage` | `chat_messages` | Individual `USER`/`ASSISTANT`/`SYSTEM` chat messages with context snapshots and token/latency metadata |
| **5. Progress & Weight** | `WeightLog` | `weight_logs` | Dated body-weight entries for trend analytics and BMI tracking |
| **6. Subscriptions & Payments** | `SubscriptionPlan` | `subscription_plans` | Pro billing plan definitions (`MONTHLY` / `YEARLY`, VND pricing, JSON feature flags) |
| | `UserSubscription` | `user_subscriptions` | Active/historical user subscriptions with `startsAt` and `expiresAt` windows |
| | `Payment` | `payments` | Payment checkout orders (`SEPAY`, unique `transactionId` / `paymentCode` / `providerTxId`, status & expiry) |
| | `PaymentEvent` | `payment_events` | Immutable webhook/reconciliation audit log enforcing `eventId` idempotency |
| **7. Notifications & Push** | `Notification` | `notifications` | In-app notification feed (`MEAL_REMINDER`, `GOAL_ALERT`, `AI_RECOMMENDATION`, `SUBSCRIPTION`, `SYSTEM`) |
| | `DeviceToken` | `device_tokens` | Registered Android/iOS FCM push tokens per user |

---

## Environment Setup & Running

### 1. Prerequisites

- **Node.js** `>= 20.x` & **npm** `>= 10.x`
- **Docker Desktop** (for local PostgreSQL 15 & Redis 7)

### 2. Configure Environment Variables

Create a `.env` file in `be-nutraai/` (validated at startup by `src/config/validation.schema.ts`):

```env
PORT=3000
NODE_ENV=development

# PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=nutraai_db
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT & Auth
JWT_SECRET=replace_with_at_least_16_chars_secret
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# Firebase Admin (OAuth & FCM)
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Gmail SMTP (OTP verification & password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

# External APIs & Media
GEMINI_API_SCANFOOD=
USDA_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# SePay VietQR Payment Gateway
SEPAY_ACCESS_TOKEN=
SEPAY_API_BASE_URL=https://userapi-sandbox.sepay.vn/v2
SEPAY_BANK_ACCOUNT=
SEPAY_BANK_NAME=MBBank
SEPAY_ACCOUNT_HOLDER=
SEPAY_WEBHOOK_API_KEY=
```

### 3. Start PostgreSQL & Redis via Docker

```bash
docker-compose up -d
```

This starts both `nutraai_postgres` (`postgres:15-alpine`) and `nutraai_redis` (`redis:7-alpine`).

### 4. Install Dependencies, Sync Prisma Schema & Seed Data

```bash
# Install packages
npm install

# Generate Prisma Client from src/database/prisma/schema.prisma
npx prisma generate

# Push schema to PostgreSQL (or apply migrations via `npx prisma migrate dev`)
npx prisma db push

# Seed initial plans, verified foods, and demo accounts
npm run seed
```

### 5. Run the NestJS Server

```bash
# Development mode (watch)
npm run start:dev

# Production build & start
npm run build
npm run start:prod
```

---

## API Documentation (Swagger)

Once the server is running, interactive OpenAPI / Swagger documentation is available at:

- **Swagger UI**: `http://localhost:3000/api/docs`

Bearer JWT authentication can be configured directly via the **Authorize** button in Swagger UI.

---

## Testing

Unit tests are located under `test/unit/` and run with Jest:

```bash
# Run all unit tests
npm test

# Run with coverage
npm run test:cov

# Type-check without emitting build artefacts
npx tsc --noEmit
```

---

## Common Utilities & Security

- **`CustomValidationPipe`**: Transforms `class-validator` errors into a structured field-keyed JSON response for Mobile and Admin clients:
  ```json
  {
    "statusCode": 400,
    "error": "Bad Request",
    "message": "Validation failed",
    "errors": {
      "calories": ["calories must not be less than 0"]
    }
  }
  ```
- **`HttpExceptionFilter`**: Global exception filter producing consistent error payloads with `timestamp` and `path`.
- **`LoggingInterceptor` & `TransformInterceptor`**: Logs HTTP method, route, and latency (ms), and standardises API response envelopes.
- **`JwtAuthGuard` & `RolesGuard`**: Enforces JWT authentication globally (with `@Public()` opt-out) and `@AdminOnly()` RBAC protection across administrative routes.
- **`RedisService`**: Fail-open cache-aside wrapper using non-blocking `SCAN` prefix invalidation so Redis outages degrade safely to PostgreSQL.

---

## Seeded Demo Accounts

After running `npm run seed`, the following accounts are available for local evaluation:

| Role / Tier | Email | Description |
| :--- | :--- | :--- |
| **Administrator** | `admin@nutraai.com` | Full access to the Admin Console (`admin-nutrai`) |
| **Standard User (Free)** | `user@nutraai.com` | Pre-populated with sample meals, weight progress, and AI chat history |
| **Pro User** | `pro@nutraai.com` | Active Pro subscription with elevated daily AI scan/chat quotas |

---

## Related Repositories

- **Mobile App**: [`../mobile-nutraai`](../mobile-nutraai) — React Native + Expo SDK 57 + TypeScript
- **Admin Console**: [`../admin-nutrai`](../admin-nutrai) — React 19 + Vite 6 + Ant Design 5 + Tailwind CSS
