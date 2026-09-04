# SplitBill — real-time collaborative bill splitting

Mobile-first web app: an authenticated **owner** creates a bill, uploads a receipt (mock OCR for line items), adds participants, and shares a link. **Guests** join without an account, pick their name, select items in real time, and mark themselves done. The owner finalizes to lock the bill and show per-person totals.

## Stack

- Next.js (App Router), TypeScript, Tailwind CSS  
- Firebase Authentication (email/password for owners)  
- Cloud Firestore (live listeners)  
- Firebase Storage (receipt images)

## Quick start

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your Firebase web app keys (Project settings → Your apps).
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to `/login` until an owner account exists.

## Environment variables

Required in `.env.local` (all `NEXT_PUBLIC_*` are exposed to the browser):

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | e.g. `your-project.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Storage bucket name |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | App ID |

## Firebase Console checklist

1. **Create a project** (or use an existing one) and register a **Web** app to obtain the config values above.  
2. **Authentication**  
   - Enable **Email/Password**.  
   - Do **not** expose a public sign-up screen in this product; add users manually (see below) or run the seed script while sign-up is still allowed.  
3. **Firestore**  
   - Create database (production or test mode for first try).  
   - Deploy rules from `firebase/firestore.rules` (Console → Firestore → Rules), or use the Firebase CLI.  
   - Create the composite index from `firebase/firestore.indexes.json` when prompted by the app error link, or deploy indexes with CLI.  
4. **Storage**  
   - Enable Storage.  
   - Apply rules from `firebase/storage.rules`.  

## Create the owner login manually

**Recommended (works even when client sign-up is disabled):**

1. Firebase Console → **Authentication** → **Users** → **Add user**.  
2. Enter email and password.  
3. Sign in at `/login` in the app.

**Optional script** (only if the Identity Toolkit **signUp** API is allowed for your key / project settings):

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_key npm run seed-owner -- owner@example.com 'secure-password'
```

If this fails with `OPERATION_NOT_ALLOWED` or sign-up disabled, use the Console method above.

## Security rules

- **Firestore:** `firebase/firestore.rules` — owners own their bills; guests with a link can read **active/completed** bills and write participants/selections while **active** (MVP trust model). Comments note where to tighten (App Check, field validation, custom claims).  
- **Storage:** `firebase/storage.rules` — authenticated uploads under `bills/{billId}/…`; reads are public in MVP (change for production).

## Project layout

| Path | Purpose |
|------|---------|
| `app/` | Routes: `/`, `/login`, `/dashboard`, `/bills/new`, `/bill/[billId]`, `/bill/[billId]/summary` |
| `components/` | Shared UI (`AppShell`, `OwnerGuard`, `LoadingScreen`, …) |
| `hooks/` | `useAuth`, `useRealtimeBill`, `useOwnerBills` |
| `lib/` | Firebase init, Firestore helpers, mock OCR, totals math |
| `types/` | Shared TypeScript models |
| `firebase/` | Rules and index definitions |
| `scripts/seed-owner.mjs` | Optional REST helper to create a user |

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |
| `npm run seed-owner` | Optional owner user creation via API |

## Product notes

- OCR is **mocked** (`lib/mock-ocr.ts`); replace with a real service when ready.  
- Totals are **computed on the client** from items + selections (equal split per item among everyone who selected it). Items with no selectors are labeled **unassigned** and excluded from totals.  
- **Owner routes** (`/dashboard`, `/bills/new`) are guarded on the client with `OwnerGuard`; guests use `/bill/[id]` only.
