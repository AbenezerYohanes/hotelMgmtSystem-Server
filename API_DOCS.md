# Server API Overview (brief)

This document describes the primary server endpoints and safe migration steps.

## Environment

- Copy `server/.env.example` -> `server/.env` and fill values (DB credentials, `JWT_SECRET`, Stripe keys).

## Apply database schema (safe steps)

1. Backup your current database:

```bash
mysqldump -u $DB_USER -p $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).sql
```

2. Apply the schema SQL (from `server/database/schema.sql`):

```bash
mysql -u $DB_USER -p $DB_NAME < server/database/schema.sql
```

Notes:

- Review `server/database/schema.sql` for conflicting or duplicate statements before applying to production.
- Prefer a staging DB to validate schema first.

## Key endpoints (summary)

- `POST /api/auth/register` — register a user (fields: `username`, `email`, `password`, `first_name`, `last_name`, `role`).
- `POST /api/auth/login` — login (returns JWT). Use `Authorization: Bearer <token>` for protected routes.
- `GET /api/users` — list users (admin only). Query params: `page`, `limit`, `role`, `is_active`.
- `GET /api/users/:id` — user details (admin only).
- `PUT /api/users/:id` — update user (admin only).
- `GET /api/rooms` — list rooms.
- `POST /api/bookings` — create booking (authenticated users).
- `GET /api/bookings` — list bookings.
- `POST /api/uploads/staff/:employeeId/document` — upload staff document (multipart form-data `file`).
- `POST /api/uploads/bookings/:bookingId/invoice` — upload booking invoice (multipart form-data `file`).

## Payments

- Stripe integration endpoints are available under `/api/stripe` and `/api/paymentGateway`.
- Provide `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in `.env` to enable webhooks.

## Running locally

From project root:

````bash
cd server
npm install
# copy env
cp .env.example .env
# edit .env
npm run dev

### Migration script (Node)

A convenience script is included to apply the SQL file from Node. It executes statements sequentially and supports a dry-run mode.

Run a dry run to print statements:

```bash
npm run migrate:schema -- --dry-run
````

To apply the schema file (default path `server/database/schema.sql`):

```bash
npm run migrate:schema
```

You can also pass a custom file path:

```bash
npm run migrate:schema -- --file ./path/to/your.sql
```

````

## Testing endpoints

Use Postman or curl. Example: create booking

```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"guest_id":1, "room_id":1, "check_in_date":"2025-12-01", "check_out_date":"2025-12-03"}'
````

## Next steps (after migration)

- Run server and exercise auth flows (register/login/change password).
- Test file uploads endpoints.
- Verify Stripe webhook handling by sending test events to `POST /api/stripe/webhook` with correct webhook secret.

If you want, I can now:

- 1. Create a small migration script to apply `server/database/schema.sql` from Node (safe for CI/staging), or
- 2. Continue normalizing remaining routes and add basic integration tests, or
- 3. Start auditing the `client/` React app and prepare auth integration changes.

Tell me which you'd like next.
