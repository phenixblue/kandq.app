# KANDQ

KANDQ tracks and visualizes the nightly crown-light colors of the King & Queen buildings in Sandy Springs, GA.

Users can:
- View current/fallback building colors.
- Browse community photo submissions.
- Vote photos up/down.
- Use a time slider to view historical color entries.
- Toggle light/dark theme.

---

## Tech Stack

- `Next.js` (App Router) + `React` + `TypeScript`
- `Tailwind CSS` (v4)
- `Supabase` (Postgres, Auth, Storage)

---

## Project Structure

- `src/app/page.tsx`: Main single-page UI
- `src/components/*`: UI components (buildings, gallery, slider, auth, theme)
- `src/app/api/colors/route.ts`: Read color history API
- `src/app/api/photos/route.ts`: Photo list/create API
- `src/app/api/votes/route.ts`: Vote create/delete + score recalculation API
- `supabase/migrations/001_initial.sql`: Core schema
- `supabase/migrations/002_storage_policies.sql`: Storage policies

---

## Environment Variables

Create a local env file:

```bash
cp .env.local.example .env.local
```

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Recommended for production/server routes:

- `SUPABASE_SERVICE_ROLE_KEY`

Notes:
- Client-side code uses the public URL + anon key.
- API routes currently fall back to anon key if `SUPABASE_SERVICE_ROLE_KEY` is not set; for production, set the service role key explicitly.

---

## Local Development

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

---

## Supabase Setup

### Option A: Hosted Supabase (quickest)

1. Create a Supabase project.
2. Run migration SQL from:
   - `supabase/migrations/001_initial.sql`
   - `supabase/migrations/002_storage_policies.sql`
3. Create/configure storage bucket and policies as needed by your project.
4. Add project URL + anon key (+ service role key for server routes) to environment variables.

### Option B: Local Supabase CLI

Start local Supabase:

```bash
npx supabase start
```

Apply migrations:

```bash
npx supabase db reset
```

Get local keys/URLs:

```bash
npx supabase status
```

Then copy values into `.env.local`.

---

## Deploying

### Deploy to Vercel

1. Push repository to GitHub.
2. Import project in Vercel.
3. Add environment variables in Vercel Project Settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (recommended)
4. Deploy.

Build command and start behavior are already standard Next.js (`next build`, `next start`).

### Point to Hosted Supabase

- Ensure DB schema/policies match migrations.
- Ensure Auth redirect URLs include your deployed domain.
- Ensure Storage bucket policies allow your upload/read flow.

---

## Configuration Changes You May Want

### Visual Defaults

- Default building colors are currently white (`#FFFFFF`) when no valid photo/color exists for a date.
- You can change defaults in:
  - `src/app/page.tsx`
  - `src/components/TimeSlider.tsx`

### Hero Layout

- Title/building spacing and skyline alignment are in `src/app/page.tsx` hero section.
- Building size/glow positioning are in `src/components/BuildingDisplay.tsx`.

### Voting Logic

- Vote API recalculates `vote_score` after every vote/unvote in `src/app/api/votes/route.ts`.
- Color history updates from top-rated valid photo logic can be tuned in that same route.

### Performance/Query Limits

- Photos API returns max 50 entries currently (`/api/photos`).
- Colors API supports a `limit` query param, capped at 365 (`/api/colors`).

---

## Useful Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

---

## Troubleshooting

- **Uploads fail / upstream errors**: verify URL/key values and storage permissions.
- **Votes not reflected**: verify API routes are reachable and database table policies permit writes.
- **No history visible**: check `color_history` table has rows and expected date values.
- **Theme issues**: confirm `ThemeProvider` is active in `src/app/layout.tsx`.