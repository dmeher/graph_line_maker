# Graph Pixel Maker

Next.js App Router app for converting uploaded images into graph-paper pixel charts. The app uses a custom Brevo email OTP flow, signed httpOnly app-session cookies, and server-only Supabase service-role access.

## Local Setup

```bash
npm install
npm run dev
```

The production build commands are intentionally not run by default in this repo workflow.

## Environment

Copy `.env.example` to `.env.local` and fill in the values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_SCHEMA=image_to_graph
BREVO_API_KEY=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=Graph Pixel Maker
EMAIL_OTP_SECRET=
GRAPH_PIXEL_SESSION_SECRET=
```

`SUPABASE_DB_SCHEMA` must be `image_to_graph`. The Supabase Data API also needs that schema exposed in the project API settings.

## Database

The migration in `supabase/migrations` creates:

- `image_to_graph.app_users`
- `image_to_graph.email_otp_attempts`
- `image_to_graph.projects`
- `image_to_graph.project_palettes`
- Private storage buckets for original and processed images

The bootstrap admin is seeded as `dmeher1996@gmail.com`. Admins can add or revoke other allowed email users from `/settings`.

## Auth Model

This app does not use Supabase Auth OTP. It follows the sibling app pattern:

- Generate a server-side 6-digit OTP.
- Hash the OTP with `EMAIL_OTP_SECRET`.
- Store the attempt in Supabase.
- Send via Brevo transactional email.
- Verify max attempts, expiry, consumed state, and active email allowlist.
- Set a signed httpOnly `graph_pixel_session` cookie.

All database and storage reads/writes go through server routes/actions with ownership checks.
