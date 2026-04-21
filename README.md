# Starmyte

A space battle arena game built with React, TypeScript, Vite, Tailwind CSS, and shadcn/ui.

## Tech Stack

- **Frontend:** React 18, TypeScript 5, Vite 5
- **Styling:** Tailwind CSS 3, shadcn/ui
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions, Storage)
- **PWA:** vite-plugin-pwa for installable app support

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A [Supabase](https://supabase.com) account (free tier works)
- A [Vercel](https://vercel.com) account (for deployment)

### Local Development

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app runs at `http://localhost:8080` by default.

### Production Build

```bash
npm run build
```

---

## Database Setup (Supabase)

Follow these steps to create and configure your own backend.

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New Project**, choose an organization, set a name and database password.
3. Select a region close to your users.
4. Wait for the project to finish provisioning.

### 2. Get Your API Credentials

In your Supabase project dashboard, go to **Settings → API**:

- **Project URL** — this is your `VITE_SUPABASE_URL`
- **anon / public key** — this is your `VITE_SUPABASE_PUBLISHABLE_KEY`
- **Project Reference ID** — this is your `VITE_SUPABASE_PROJECT_ID`

### 3. Create the Database Schema

Go to **SQL Editor** in the Supabase dashboard and run the schema SQL to create all required tables. The key tables include:

- `profiles` — player profiles (display name, credits, XP, level, trophies)
- `ships` — ship definitions (stats: HP, speed, fuel, heat cap)
- `weapons` — weapon definitions (damage, fire rate, cooldown, heat)
- `skins` — cosmetic skins for ships and thrusters
- `avatars` — player avatar images
- `emotes` — in-game emotes
- `player_ships` — ships owned by players (with active skin references)
- `player_weapons` — weapons equipped on player ships
- `player_skins` — skins owned by players
- `player_avatars` — avatars owned by players
- `player_emotes` — emotes owned by players
- `player_emote_loadout` — equipped emote slots
- `battle_results` — battle history and stats
- `campaign_progress` — single-player campaign progress
- `ship_stats` — per-ship statistics (battles fought, enemies defeated, etc.)
- `star_inventory` — star items for ship upgrades
- `player_owned_weapons` — weapon ownership records
- `quests` — quest definitions
- `player_quests` — player quest progress
- `seasons` — season/battle pass definitions
- `season_tiers` — season reward tiers
- `player_season_claims` — claimed season rewards
- `daily_login_rewards` — daily login reward definitions
- `player_daily_logins` — player login streaks
- `infinity_scores` — infinity mode leaderboard
- `infinity_rewards` — infinity mode reward thresholds
- `pvp_queue` — PvP matchmaking queue
- `pvp_matches` — PvP match records
- `pvp_data_usage` — PvP bandwidth tracking
- `vip_subscriptions` — VIP subscription status
- `user_roles` — role-based access control (admin, moderator, user)
- `app_errors` — client-side error logging

#### User Roles Enum

```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
```

#### User Roles Table

```sql
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
```

#### Role Check Function

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

### 4. Configure Authentication

In Supabase dashboard → **Authentication → Settings**:

1. Enable **Email** sign-in (the app uses email/password auth).
2. Configure email templates for confirmation, password recovery, etc.
3. Set the **Site URL** to your production domain.
4. Add your domain to **Redirect URLs**.

### 5. Row Level Security (RLS)

Enable RLS on all tables and create appropriate policies. General patterns:

- **Profiles:** Users can read all profiles, update only their own.
- **Player data tables** (ships, weapons, skins, etc.): Users can CRUD only their own rows.
- **Game data tables** (ships, weapons, skins, quests, etc.): Public read, admin-only write.
- **Battle results:** Users can insert their own, read all.
- **Admin tables:** Use the `has_role()` function to gate access.

Example policy:

```sql
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);
```

### 6. Edge Functions

The app uses Supabase Edge Functions for server-side logic. You'll need to create and deploy these using the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy all functions
supabase functions deploy
```

Key edge functions to implement:

- `save-battle-result` — validates and saves battle outcomes
- `claim-daily-login` — handles daily login rewards
- `assign-quests` — assigns daily/weekly quests
- `claim-quest` — validates and claims quest rewards
- `update-quest-progress` — updates quest progress
- `claim-season-tier` — claims battle pass rewards
- `check-vip` — checks VIP subscription status
- `create-vip-checkout` — creates Stripe checkout sessions
- `stripe-webhook` — handles Stripe webhook events
- `fulfill-prizes` — grants prizes (credits, XP, stars, skins, etc.)
- `get-turn-credentials` — provides TURN server credentials for PvP

### 7. Realtime (Optional)

If you need realtime features (e.g., PvP matchmaking), enable realtime on the relevant tables:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.pvp_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pvp_matches;
```

### 8. Storage (Optional)

If your app uses file uploads (avatars, etc.), create storage buckets in the Supabase dashboard under **Storage**.

---

## Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key_here
VITE_SUPABASE_PROJECT_ID=YOUR_PROJECT_REF
```

The app reads these at build time via Vite's `import.meta.env`.

---

## Deploying to Vercel

### 1. Connect Your Repository

1. Go to [vercel.com](https://vercel.com) and sign in.
2. Click **Add New → Project**.
3. Import this repository from GitHub.

### 2. Configure Build Settings

Vercel should auto-detect Vite. Verify these settings:

| Setting | Value |
|---------|-------|
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

### 3. Set Environment Variables

In Vercel project settings → **Environment Variables**, add:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

### 4. SPA Routing (Client-Side Router)

Create a `vercel.json` in the project root to handle client-side routing:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

This ensures all routes are handled by React Router instead of returning 404.

### 5. Deploy

Click **Deploy**. Vercel will build and publish your app. All subsequent pushes to `main` will trigger automatic redeployments.

### 6. Update Supabase Settings

After deploying, update your Supabase project:

1. Go to **Authentication → URL Configuration**.
2. Set **Site URL** to your Vercel domain (e.g., `https://your-app.vercel.app`).
3. Add the Vercel domain to **Redirect URLs**.

---

## PWA Configuration

The app is configured as a Progressive Web App. The PWA manifest is generated by `vite-plugin-pwa` in `vite.config.ts`. To customize:

- **Icons:** Replace files in `public/` (`android-chrome-192x192.png`, `android-chrome-512x512.png`, `apple-touch-icon.png`, `favicon.ico`, etc.)
- **Theme colors:** Update `theme_color` and `background_color` in the PWA config in `vite.config.ts`
- **App name:** Update `name` and `short_name` in the PWA config

---

## Project Structure

```
src/
├── assets/          # SVG ship/weapon/skin graphics
├── components/      # React components (UI, game, admin)
│   └── ui/          # shadcn/ui primitives
├── contexts/        # React contexts (Auth, Music)
├── data/            # Static data files
├── game/            # Game engine (loop, renderer, AI, audio)
├── hooks/           # Custom React hooks
├── integrations/    # API client configuration
├── lib/             # Utility functions
├── pages/           # Route page components
│   └── admin/       # Admin dashboard pages
└── main.tsx         # App entry point
```

---

## License

Proprietary. All rights reserved.
