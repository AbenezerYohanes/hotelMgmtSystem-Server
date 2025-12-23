# Backend (Refactor)

This backend scaffold uses Express + Sequelize (MySQL) and provides a modular structure inspired by the Teacher Management System.

Environment variables (create a `.env` in `backend/`):

- `DB_NAME` - MySQL database name
- `DB_USER` - MySQL user (default: root)
- `DB_PASS` - MySQL password
- `DB_HOST` - MySQL host (default: 127.0.0.1)
- `DB_PORT` - MySQL port (default: 3306)
- `JWT_SECRET` - JWT secret

Quick start (from `backend/`):

```
npm install
npm run seed
npm run dev
```

This creates basic roles, a default hotel, an admin user (`admin@hotel.test` / `admin123`) and sample rooms.
# Backend (Express + Sequelize)

Quick start:

1. Copy `.env.example` to `.env` and set DB credentials.
2. Install dependencies:

```bash
cd backend
npm install
```

3. Seed sample data (optional via `.env` or run):

```bash
npm run seed
```

4. Start server:

```bash
npm run dev
```
