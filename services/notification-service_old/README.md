# Notification Service

Notification service for the DECP platform. Consumes Kafka events from `identity.events` (and extensible for future topics), stores notifications in MongoDB, and exposes an HTTP API for listing and acknowledging notifications.

---

## How to Run

### Prerequisites

- Node.js 24+
- Kafka and MongoDB running (e.g. via Docker)

### Local Development

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` if needed (defaults: `KAFKA_BROKER=kafka:9092`, `MONGO_URI` for Mongo)
3. Install dependencies:
   ```bash
   npm install
   ```
4. Build and run:
   ```bash
   npm start
   ```
   Or run pre-built:
   ```bash
   npm run start:prod
   ```

The service listens on port **3003**.

### Docker

From the project root:

```bash
docker compose up -d kafka mongo
cp services/notification-service/.env.example services/notification-service/.env
docker compose build notification-service
docker compose up -d notification-service
```

---

## What Changed

The notification-service was implemented from scratch. Previously it was a shell (Dockerfile only). The following was added:

| Area | Changes |
|------|---------|
| **Project** | `package.json`, `tsconfig.json`, NestJS + Mongoose + `@decp/event-bus` |
| **Config** | `NODE_PORT`, `KAFKA_BROKER`, `MONGO_URI` via `.env` |
| **Kafka Consumer** | Consumes `identity.events`, routes by `eventType` to handlers |
| **Event Handlers** | `identity.user.created`, `identity.user.suspended`, `identity.user_profile.updated` → create notifications |
| **Storage** | MongoDB (Mongoose schema: `userId`, `type`, `title`, `body`, `read`, `eventId`, etc.) |
| **HTTP API** | `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` |
| **Docker** | Updated Dockerfile (shared event-bus, multi-stage build), `docker-compose` depends on `mongo` |

---

## HTTP API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/notifications?userId=<id>&read=&limit=&offset=` | List notifications for a user |
| PATCH | `/notifications/:id/read?userId=<id>` | Mark one notification as read |
| PATCH | `/notifications/read-all` | Mark all as read (body: `{ "userId": "..." }`) |

## Event Handlers

Consumes `identity.events` and creates notifications for:

- `identity.user.created` — Welcome notification
- `identity.user.suspended` — Account suspended notification
- `identity.user_profile.updated` — Profile updated notification
