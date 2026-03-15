<div align="center">

<h1>
  <img src="https://img.shields.io/badge/DECP-Department%20Engagement%20%26%20Career%20Platform-1A56DB?style=for-the-badge&logoColor=white" alt="DECP" />
</h1>

<p>
  <strong>A cloud-native, event-driven university engagement & career platform</strong><br/>
  Connecting students, alumni, and academic staff through a microservices architecture powered by Apache Kafka.
</p>

<p>
  <img src="https://img.shields.io/badge/NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white" />
  <img src="https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Apache%20Kafka-231F20?style=flat-square&logo=apachekafka&logoColor=white" />
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=flat-square&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/MongoDB-4EA94B?style=flat-square&logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/Kubernetes-326CE5?style=flat-square&logo=kubernetes&logoColor=white" />
  <img src="https://img.shields.io/badge/Kong-003459?style=flat-square&logo=kong&logoColor=white" />
</p>

<p>
  <img src="https://img.shields.io/badge/status-In%20Active%20Development-brightgreen?style=flat-square" />
  <img src="https://img.shields.io/badge/architecture-Microservices-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/license-MIT-yellow?style=flat-square" />
  <img src="https://img.shields.io/badge/course-CO528%20Applied%20Software%20Architecture-purple?style=flat-square" />
</p>

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Microservices](#-microservices)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Kafka Topics](#-kafka-topics)
- [API Gateway](#-api-gateway)
- [Observability](#-observability)
- [Cloud Deployment](#-cloud-deployment)
- [Contributing](#-contributing)

---

## 🌐 Overview

**DECP** is an enterprise-grade university platform designed for the Department of Computer Engineering, University of Peradeniya. It bridges the gap between current students, alumni, and academic staff by providing a unified space for professional networking, career opportunities, departmental events, and research collaboration.

Built as part of **CO528 – Applied Software Architecture**, DECP demonstrates real-world application of:

- ✅ **Domain-Driven Design (DDD)** — 8 bounded contexts, each as an independent microservice
- ✅ **Service-Oriented Architecture (SOA)** — well-defined REST APIs, no shared databases
- ✅ **Event-Driven Architecture** — Apache Kafka as the async communication backbone
- ✅ **Database-per-Service Pattern** — PostgreSQL for Identity, MongoDB for all other services
- ✅ **Cloud-Native Design** — containerised, Kubernetes-ready, AWS deployment target

### Key Features

| Module | Capabilities |
|--------|-------------|
| 👤 **User Management** | Registration, JWT auth, RBAC (Student / Alumni / Admin), Google OAuth, bulk CSV provisioning |
| 📰 **Social Feed** | Posts with images/video, likes, comments, shares, paginated feed |
| 💼 **Jobs & Internships** | Job postings, applications, resume upload (PDF/MinIO), application lifecycle |
| 📅 **Events** | Department events, workshops, RSVP system, admin announcements |
| 🔬 **Research Collaboration** | Create projects, invite collaborators, document sharing |
| 💬 **Messaging** | Real-time direct messaging, group chat via WebSocket |
| 🔔 **Notifications** | Event-driven email, push, and in-app notifications (Kafka consumer) |
| 📊 **Analytics** | Active users, popular posts, job stats, engagement metrics (Kafka consumer) |

---

## 🏗 Architecture

DECP follows a **Cloud-Native Domain-Driven Microservices Architecture** with Apache Kafka event streaming and a database-per-service pattern.

### Architecture Diagrams

> 📌 All diagrams are located in [`/docs/diagrams/`](./docs/diagrams/)

| Diagram | Description |
|---------|-------------|
| [Enterprise Architecture](./docs/diagrams/enterprise-architecture.png) | High-level business view — actors, modules, departmental workflow |
| [SOA / Microservices Diagram](./docs/diagrams/soa-microservices.png) | Service-level view — REST flows, Kafka event flows, service boundaries |
| [Event-Driven Architecture](./docs/diagrams/event-driven.png) | Kafka-centric — topics, producers, consumers, event flow paths |
| [Product Modularity Diagram](./docs/diagrams/product-modularity.png) | Core vs extended vs infrastructure modules |
| [Cloud Deployment Diagram](./docs/diagrams/cloud-deployment.png) | AWS architecture — EKS, MSK, RDS, S3, CloudFront |

### High-Level Flow

```
 Users (Student / Alumni / Admin / Staff)
          │
          ▼
 ┌─────────────────────┐
 │   Web Client        │   React + TypeScript + Vite + MUI
 │   Mobile Client     │   (Same REST APIs)
 └─────────┬───────────┘
           │ HTTPS
           ▼
 ┌─────────────────────────────────────────┐
 │          Kong API Gateway               │
 │   JWT Validation │ Rate Limiting        │
 │   Service Routing │ HTTPS Termination   │
 └────────┬────────────────────────────────┘
          │ REST
          ▼
 ┌────────────────────────────────────────────────────────────────┐
 │                    Microservices Layer                         │
 │  Identity │ Engagement │ Career │ Events │ Collaboration       │
 │  Messaging │ Notification (consumer) │ Analytics (consumer)   │
 └────────────────────────┬───────────────────────────────────────┘
                          │ Publish / Consume
                          ▼
           ┌──────────────────────────────┐
           │      Apache Kafka            │
           │  identity.events             │
           │  engagement.events           │
           │  career.events    ...        │
           └──────────────────────────────┘
                          │
                          ▼
 ┌────────────────────────────────────────────────────────────────┐
 │                      Data Layer                                │
 │  PostgreSQL+Redis │ MongoDB │ MongoDB+MinIO │ MongoDB+MinIO    │
 └────────────────────────────────────────────────────────────────┘
```

### Communication Pattern

| Type | Protocol | Used For |
|------|----------|----------|
| **Synchronous** | REST (HTTP/HTTPS) | Client-facing requests — login, feed, job apply, RSVP |
| **Asynchronous** | Apache Kafka | Cross-service events — notifications, analytics, role changes |
| **Real-time** | WebSocket | Direct messages, group chat, online presence |

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React + TypeScript + Vite + MUI | SPA web client with role-based routing |
| **API Gateway** | Kong Gateway 3.6 | Centralised routing, JWT validation, rate limiting |
| **Backend** | NestJS (Node.js + TypeScript) | Microservice framework with built-in Kafka support |
| **Event Streaming** | Apache Kafka (KRaft mode) | Async event backbone, decoupled communication |
| **Identity DB** | PostgreSQL 15 | Relational data — users, roles, profiles |
| **Other Service DBs** | MongoDB | Document store — posts, jobs, events, messages |
| **Cache** | Redis 7 | Sessions, rate limiting, online presence, idempotency |
| **Object Storage** | MinIO (S3-compatible) | Profiles, resumes, media files |
| **Containerisation** | Docker + Docker Compose | Local dev environment, image builds |
| **Orchestration** | Kubernetes (EKS) *(future)* | Cloud auto-scaling and deployment |
| **Metrics** | Prometheus + Grafana | API latency, error rates, Kafka consumer lag |
| **Logging** | ELK Stack | Centralised structured logs, distributed debugging |
| **Tracing** | OpenTelemetry | End-to-end distributed request tracing |
| **CI/CD** | GitHub Actions | Automated build, test, Docker push, deploy |

---

## 🧩 Microservices

| Service | Port | Database | Description |
|---------|------|----------|-------------|
| `identity-service` | 4000 | PostgreSQL + Redis | Authentication, JWT, RBAC, user profiles |
| `engagement-service` | 4001 | MongoDB + MinIO | Social feed — posts, likes, comments |
| `career-service` | 4002 | MongoDB + MinIO | Jobs, internships, applications |
| `event-service` | 4003 | MongoDB | Department events, RSVP |
| `collaboration-service` | 4004 | MongoDB + MinIO | Research projects, document sharing |
| `messaging-service` | 4005 | MongoDB | Real-time chat (WebSocket) |
| `notification-service` | 4006 | MongoDB | Kafka consumer — email/push/in-app alerts |
| `analytics-service` | 4007 | MongoDB | Kafka consumer — metrics aggregation |

Each service exposes:
- `GET /health` — Liveness probe
- `GET /ready` — Readiness probe (checks DB + Kafka connection)
- `GET /metrics` — Prometheus scrape endpoint

---

## 📁 Project Structure

```
decp-platform/
│
├── services/
│   ├── identity-service/         # NestJS — Auth, RBAC, Profiles
│   ├── engagement-service/       # Express/TS — Feed, Posts, Likes
│   ├── career-service/           # NestJS — Jobs, Applications
│   ├── event-service/            # NestJS — Events, RSVP
│   ├── collaboration-service/    # NestJS — Research Projects
│   ├── messaging-service/        # NestJS — WebSocket Chat
│   ├── notification-service/     # NestJS — Kafka Consumer
│   └── analytics-service/        # NestJS — Kafka Consumer
│
├── clients/
│   ├── web/                      # React + TypeScript + Vite
│   └── mobile/                   # Mobile client
│
├── shared/
│   └── event-bus/                # Shared Kafka producer/consumer library
│       ├── event.interface.ts    # BaseEvent<T> standard envelope
│       ├── producer.ts           # Kafka publish wrapper
│       ├── consumer.ts           # Kafka consumer factory
│       └── index.ts
│
├── infrastructure/
│   ├── docker/
│   │   └── docker-compose.yml    # Full local environment
│   ├── kubernetes/               # K8s manifests (Helm charts)
│   └── observability/
│       └── prometheus/
│           └── prometheus.yml
│
├── docs/
│   ├── diagrams/                 # Architecture diagrams (PNG/SVG)
│   └── api/                      # API documentation
│
├── .github/
│   └── workflows/
│       └── ci.yml                # GitHub Actions CI/CD pipeline
│
└── docker-compose.yml            # Root compose file
```

---

## 🚀 Getting Started

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Docker Desktop | ≥ 24.x |
| Docker Compose | ≥ 2.x |
| Node.js | ≥ 20.x |
| WSL2 (Windows) | Enabled |
| RAM allocated to Docker | ≥ 8 GB |

### 1. Clone the Repository

```bash
https://github.com/cepdnaclk/PeraCom-DECP.git
cd decp-platform
```

### 2. Start Infrastructure Services

Start all infrastructure (Kafka, databases, gateway, observability) before running microservices:

```bash
docker-compose up -d postgres mongo redis kafka minio kong \
  prometheus grafana elasticsearch kibana
```

> ⚠️ **Kafka startup note:** If Kafka fails on first run with a permissions error, run the following fix:
> ```bash
> docker-compose stop kafka
> docker-compose run --rm -u root kafka chown -R 1000:1000 /tmp/kafka-logs
> docker-compose up -d kafka
> ```

### 3. Verify Infrastructure is Running

| Service | URL | Credentials |
|---------|-----|-------------|
| Kong Proxy | http://localhost:8000 | — |
| Kong Admin | http://localhost:8001 | — |
| MinIO Console | http://localhost:9001 | `minio` / `minio123` |
| Prometheus | http://localhost:9090 | — |
| Grafana | http://localhost:3001 | `admin` / `admin` |
| Kibana | http://localhost:5601 | — |
| PostgreSQL | localhost:5432 | `decp` / `decp123` |
| MongoDB | localhost:27017 | — |
| Redis | localhost:6379 | — |

### 4. Create Kafka Topics

```bash
docker exec -it decp-kafka bash

# Run for each topic:
kafka-topics.sh --create \
  --topic identity.events \
  --bootstrap-server kafka:9092 \
  --partitions 3 \
  --replication-factor 1

# Repeat for: engagement.events, career.events, event.events,
# collaboration.events, message.events, notification.events, analytics.events
```

Verify topics were created:
```bash
docker exec -it decp-kafka /opt/kafka/bin/kafka-topics.sh \
  --list --bootstrap-server localhost:9092
```

### 5. Start Microservices

```bash
# Start all services
docker-compose up --build

# Or start a specific service
docker-compose up --build identity-service
```

### 6. Register Identity Service in Kong

```bash
# Register the service
curl -X POST http://localhost:8001/services \
  --data name=identity-service \
  --data url=http://identity-service:3000

# Add route
curl -X POST http://localhost:8001/services/identity-service/routes \
  --data "paths[]=/identity"
```

### 7. Run a Quick Health Check

```bash
curl http://localhost:8000/identity/health
# Expected: { "status": "ok" }
```

---

## 🔐 Environment Variables

Each service has a `.env` file. Copy from the provided `.env.example`:

```bash
cp services/identity-service/.env.example services/identity-service/.env
```

### Identity Service

```env
PORT=3000
DATABASE_URL=postgresql://decp:decp123@postgres:5432/decp_identity
REDIS_URL=redis://redis:6379
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_REFRESH_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=your_google_client_id
KAFKA_BROKER=kafka:9092
SERVICE_NAME=identity-service
```

### Engagement / Career / Other Services

```env
PORT=4001
MONGO_URI=mongodb://mongo:27017/engagement
KAFKA_BROKER=kafka:9092
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=minio
MINIO_SECRET_KEY=minio123
SERVICE_NAME=engagement-service
```

---

## 📡 Kafka Topics

All events follow the standard envelope schema:

```json
{
  "eventId": "uuid-v4",
  "eventType": "identity.user.created",
  "eventVersion": "1.0",
  "timestamp": "2026-01-01T12:00:00Z",
  "producer": "identity-service",
  "correlationId": "uuid-v4",
  "data": { }
}
```

### Topic Reference

| Topic | Producer | Consumers | Key Events |
|-------|----------|-----------|------------|
| `identity.events` | Identity Service | Analytics, Notification | `user.created`, `user.updated`, `user.role_changed`, `BatchUsersProvisioned` |
| `engagement.events` | Engagement Service | Notification, Analytics | `post.created`, `post.liked`, `post.commented` |
| `career.events` | Career Service | Notification, Analytics | `job.posted`, `application.submitted`, `application.reviewed`, `application.accepted` |
| `event.events` | Event Service | Notification, Analytics | `event.created`, `event.rsvp` |
| `collaboration.events` | Collaboration Service | Notification | `project.created`, `collaborator.invited` |
| `message.events` | Messaging Service | Notification, Analytics | `message.sent` |

### Example Flow: Job Application

```
1. User submits application  →  Career Service (REST via Kong)
2. Career Service persists   →  MongoDB
3. Career Service publishes  →  career.events (career.application.submitted)
                                        │
                    ┌───────────────────┴────────────────────┐
                    ▼                                        ▼
        Notification Service                      Analytics Service
        sends email + in-app alert                updates application stats
```

---

## 🔀 API Gateway

All client traffic flows through **Kong Gateway** on port `8000`.

### Registered Services

| Service | Kong Path | Upstream |
|---------|-----------|----------|
| Identity | `/identity` | `http://identity-service:3000` |
| Engagement | `/feed` | `http://engagement-service:4001` |
| Career | `/career` | `http://career-service:4002` |
| Events | `/events` | `http://event-service:4003` |
| Collaboration | `/collaboration` | `http://collaboration-service:4004` |
| Messaging | `/messaging` | `http://messaging-service:4005` |
| Analytics | `/analytics` | `http://analytics-service:4007` |

### Key Endpoints

```
# Authentication
POST   /identity/auth/register
POST   /identity/auth/login
POST   /identity/auth/refresh
GET    /identity/auth/google

# Users
GET    /identity/users/me
PATCH  /identity/users/me
GET    /identity/users/:id
POST   /identity/users               (Admin only)
POST   /identity/users/bulk/validate (Admin only)
POST   /identity/users/bulk          (Admin only)
PATCH  /identity/users/roles         (Admin only)

# Feed
GET    /feed/posts?cursor=&limit=
POST   /feed/posts
POST   /feed/posts/:id/like
POST   /feed/posts/:id/comments

# Jobs
GET    /career/jobs?cursor=&limit=
POST   /career/jobs                  (Alumni/Admin only)
POST   /career/jobs/:id/apply
GET    /career/jobs/:id/applications (Alumni/Admin only)

# Events
GET    /events
POST   /events                       (Admin only)
POST   /events/:id/rsvp
```

---

## 📈 Observability

### Prometheus Metrics

Each service exposes application metrics at `GET /metrics`:

```
# HTTP request counters
http_requests_total{method, path, status}

# Request duration
http_request_duration_seconds{method, path, quantile}

# Domain metrics (examples)
career_applications_submitted_total
engagement_posts_created_total
identity_users_registered_total
kafka_consumer_lag{topic, group}
```

### Grafana Dashboards

Access at **http://localhost:3001** (admin / admin)

Import dashboards from [`/infrastructure/observability/grafana/`](./infrastructure/observability/grafana/)

### Log Correlation

All service logs include mandatory structured fields:

```json
{
  "timestamp": "2026-01-01T12:00:00Z",
  "level": "info",
  "service": "career-service",
  "correlationId": "uuid",
  "userId": "uuid",
  "message": "Job application submitted"
}
```

Search logs in **Kibana** at http://localhost:5601 by `correlationId` to trace a full request across services.

### Distributed Tracing

OpenTelemetry SDK is integrated in every service. Traces follow the `correlationId` from initial HTTP request through all Kafka events and database calls. Configure the OTEL exporter endpoint in each service's `.env`:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_SERVICE_NAME=career-service
```

---

## ☁️ Cloud Deployment

The platform is designed for deployment on **AWS** using **Kubernetes (EKS)**:

```
Internet → Route 53 → CloudFront → Kong (EKS) → Microservices (EKS Pods)
                                                        │
                               ┌────────────────────────┤
                               ▼                        ▼
                         Amazon MSK               Data Layer
                         (Managed Kafka)          RDS PostgreSQL
                                                  MongoDB Atlas
                                                  ElastiCache Redis
                                                  Amazon S3
```

### CI/CD Pipeline (GitHub Actions)

```
Push to main
    │
    ▼
Run Tests (npm test)
    │
    ▼
Build Docker Image
    │
    ▼
Push to Amazon ECR
    │
    ▼
kubectl apply (EKS)
    │
    ▼
Health Check (readiness probe)
```

See [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) for the full pipeline configuration.

### Kubernetes Deployment Notes

- Each microservice is a separate **Deployment** with **HPA** (Horizontal Pod Autoscaler)
- Readiness probes use `GET /ready` endpoint
- Liveness probes use `GET /health` endpoint
- Secrets managed via Kubernetes Secrets / AWS Secrets Manager
- Service discovery via internal Kubernetes DNS

---

## 🤝 Contributing

Contributions are welcome. Please follow the conventions below to keep the codebase consistent.

### Branch Naming

```
feature/<service>/<short-description>    # e.g. feature/career-service/resume-upload
fix/<service>/<short-description>        # e.g. fix/identity-service/refresh-token-bug
chore/<description>                      # e.g. chore/update-docker-compose
```

### Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(career): add resume upload to MinIO
fix(identity): prevent admin self-demotion in bulk role update
chore(docker): increase kafka memory allocation
docs(readme): update Kafka topic reference table
```

### Pull Request Checklist

- [ ] Service builds successfully (`docker-compose up --build <service-name>`)
- [ ] `GET /health` and `GET /ready` return 200
- [ ] New Kafka events follow the `BaseEvent<T>` interface from `/shared/event-bus`
- [ ] New endpoints registered in Kong (if applicable)
- [ ] `.env.example` updated with any new environment variables
- [ ] No hardcoded secrets or credentials in code

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](./LICENSE) file for details.

---

<div align="center">

**CO528 – Applied Software Architecture**<br/>
Department of Computer Engineering · University of Peradeniya

<br/>

*Built with ❤️ using NestJS · Apache Kafka · React · Docker · PostgreSQL · MongoDB*

</div>
