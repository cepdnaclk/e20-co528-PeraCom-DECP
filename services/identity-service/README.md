# Identity Service

User authentication and management service for the DECP platform.

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Prerequisites
- Dependencies installed (`npm install`)
- Environment variables set (tests use defaults from `test/jest-setup.cjs`; no real database, Redis, or Kafka required)

---

## Test Overview

Tests are unit tests using Jest and `@nestjs/testing`. External services (Prisma, Redis, Kafka, Google OAuth) are mocked.

| Test File | What It Tests |
|-----------|---------------|
| **auth/auth.service.spec.ts** | Google OAuth login: valid token returns JWT and user; invalid token, null payload, unverified email, missing email, user not found, and inactive user all throw `UnauthorizedException`. |
| **auth/auth.controller.spec.ts** | `POST /auth/google` delegates to `AuthService.loginWithGoogle` with the body token. |
| **auth/strategies/jwt.strategy.spec.ts** | JWT validation: valid token with active user returns `{ userId, role }`; missing or inactive user throws `UnauthorizedException`. |
| **auth/guards/roles.guard.spec.ts** | Role checks: no required roles allows access; user with required role passes; user without required role throws `ForbiddenException`. |
| **auth/dto/google-login.dto.spec.ts** | `GoogleLoginDto`: token required, must be a non-empty string. |
| **users/users.service.spec.ts** | User CRUD and bulk operations: create (new, duplicate, reactivate inactive), validate bulk, bulk create, suspend (single/bulk, no self-suspend), update profile, admin update, role updates, admin list (pagination, search, filters), public profile, my profile. |
| **users/users.controller.spec.ts** | Controller delegates correctly to `UsersService` for validate, bulk create, create user, and get my profile. |
| **users/dto/create-user.dto.spec.ts** | `CreateUserDto`: university email domain, required fields. |
| **users/dto/query-users.dto.spec.ts** | `QueryUsersDto`: optional page, limit, search, role. |
| **social-media/social.service.spec.ts** | Social links: create (success, duplicate), update (success, duplicate), delete (success, empty ID), view (ordered by `created_at`). |
| **social-media/dto/social-media.dto.spec.ts** | `CreateSocialLinkDto` and `UpdateSocialLinkDto`: platform enum, URL validation, UUID for updates. |
| **projects/projects.service.spec.ts** | Projects: create (success, duplicate), delete (success, empty ID, not found), update (success, not found, ownership, duplicate), view (ordered). |
| **experience/experience.service.spec.ts** | Experience: create (success, duplicate), update (success, not found, ownership, duplicate), delete (success, empty ID), view (ordered). |
| **presence/presence.service.spec.ts** | Presence: `setOnline` uses correct Redis key and TTL, `isOnline` returns true when key exists and false otherwise, `setOffline` deletes key. |
| **presence/presence.controller.spec.ts** | `POST /presence/heartbeat` calls `setOnline` with `req.user.userId`. |
| **config/validateEnv.config.spec.ts** | Env config: all required vars present, numeric fields parsed correctly. |
