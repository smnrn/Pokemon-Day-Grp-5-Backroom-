# SILPH companion

## Routes

- `/` — full-width public showcase; no login form, account requirement, or
  private telemetry requests. Four-pillar previews use synthetic data only.
- `/login` — dedicated Supabase sign-in / player registration security airlock.
  `/auth` is an alias that preserves confirmation query strings and fragments.
- `/app` — authenticated Data-Dex. Players see their reference field guide;
  admins retain all existing companion tabs.
- `/admin` — authenticated administrator dashboard. Player accounts are sent
  to `/app`; backend role checks remain the source of authority.
- `/game` — authenticated game entry. A named, acknowledged check-in is still
  mandatory before the existing game mounts.

Successful login defaults to `/app` for players and `/admin` for admins, or
returns to an allowed protected destination such as `/game`. Arbitrary redirect
URLs and player-to-admin destinations are rejected. Legacy confirmation links
to `/` are forwarded to `/login` without losing their callback parameters.
Routing uses React Router Data mode and respects Vite's deployment base path.

Route-module delivery failures get one automatic full-page refresh per minute
to clear cached failed imports after preview/deployment updates. A persistent
failure shows a manual retry/public-return screen instead of Router's default
stack trace. The retry guard never clears authentication or stored records;
blocked browser storage disables automatic retries rather than risking a loop.

## Immersive access landing

The public showcase and the separate authentication/check-in airlock share
`motion/react`, the spring-following Canvas flashlight, CRT/VHS treatments,
pause/reduced-motion support, and the five-second anomaly preview. The public
page adds a full-viewport holographic radar hero, gameplay mechanics scroller,
four keyboard-accessible interactive analytics demos, specimen dossiers, and
dedicated `/login` calls to action. These effects are presentation-only:
they do not read credentials, create telemetry records, or alter account roles,
registration, or the game engine. The anomaly preview resets after five
seconds and can also be stopped immediately.

The header's pause control stops ambient motion. System reduced-motion
preferences disable flickering, tracking bars, movement, and flashlight
tracking, while retaining a static anomaly preview. Canvas rendering suspends
when the page is hidden and releases its animation frame/listeners on unmount.

## Four-pillar teaching framework

- A keyboard-accessible **Field Briefing & Rules** dialog/drawer is available
  on the landing header, player check-in/lobby, companion navigation, and game
  navigation. It explains actual objectives, controls, and the spoiler-free
  observation → hypothesis → forecast → intervention cycle.
- Data-Dex/admin modules have color-coded Descriptive, Diagnostic, Predictive,
  and Prescriptive badges with expandable methods. Pillar filters affect only
  presentation, reset on view changes, and never change data access or source.
- The **Analytical Deduction Engine** withholds its scenario feedback until a
  student chooses a hypothesis. Effects such as +38 / −45 are explicitly
  authored **percentage-point** changes from an assumed 50% baseline, not
  empirically fitted survival improvements or game-engine countermeasures.
- Recorded completed sessions can generate diagnostic timelines and a one-
  question reflection. Players see synthetic reference sessions, never the
  private admin roster. Synthetic debriefs are not attributed to the player.
- On the game's caught/escaped screen, **Generate Post-Run Debrief** uses a
  read-only, in-memory recorder for actual local battery samples, sprint time,
  rescue milestones, elapsed time, and outcome. It does not fabricate EMF,
  acoustic, heart-rate, or crouch data, persist grades, or upload engine
  telemetry. Retry creates a fresh recorder. Learning dialogs pause gameplay
  while open; movement/pursuit/power mechanics themselves are unchanged.
- Archetypes are nearest-reference-centroid teaching labels, not personality
  or medical judgments. A diagnostic association is not a causal verdict.

## Accounts and roles

- Public signup creates **player** accounts only. Players see the reference
  Data-Dex and can register a named game session.
- **Admins** see analytics, the private player roster, and telemetry controls.
  Every private endpoint verifies the access token with Supabase Auth and reads
  `app_metadata.role`. User-editable `user_metadata` never grants privileges.
- Check-ins collect a display name/nickname, verified account ID, generated
  session ID, and server timestamp. Authentication emails are not copied into
  analytics. No game outcome is inferred from registration.
- Admins can select a player check-in in the logger; manual observations then
  use that check-in's session ID. Imports can use the same session ID. Synthetic
  and unlinked sessions are not attributed to named players.
- Admins share an authenticated analytics store. Private device caches use
  per-account session storage and are removed on sign-out. Export unsynced
  observations before signing out.

### Assigning your administrator accounts

Create the accounts through the application's signup form and confirm email if
required. A project owner must grant the admin role through a trusted Supabase
administrative interface; there is deliberately no public role selector or
promotion endpoint. In the Supabase SQL editor, replace the placeholder with
the account's user UUID from Authentication → Users:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"role":"admin"}'::jsonb
where id = 'YOUR_ADMIN_USER_UUID'::uuid;
```

Sign out and back in to refresh clearance. To revoke access, set the trusted
role to `player`. Never grant admins through signup metadata or client code.
Use exhibition aliases and do not collect sensitive personal information.

## Data and storage

- Demo and simulator events are synthetic, manual events are observer estimates,
  and imported events are validated and labeled `import`.
- Source selection applies to every analytics panel. Models are exploratory,
  not validated safety or biometric predictions.
- Admin session storage retains the latest 5,000 displayed events and its pending queue.
  Export JSON regularly during long exhibition sessions.
- New records are queued locally until Supabase acknowledges the write.
  Failed writes retry after 12 seconds; cloud requests time out after 10 seconds.
- The previous anonymous booth-token API is no longer accepted. Legacy
  anonymous records are not automatically attributed to player accounts.

## Supabase deployment

The checked-in `supabase/config.toml` maps function `make-server-15374a1d` to
`supabase/functions/server/index.tsx`. On a machine with Supabase CLI access to
the connected project:

```sh
supabase login
supabase link --project-ref YOUR_CONNECTED_PROJECT_REF
supabase db push
supabase functions deploy make-server-15374a1d --project-ref YOUR_CONNECTED_PROJECT_REF
```

Use the project ref already present in `utils/supabase/info.tsx`. Never put a
service-role key in client code. The function expects Supabase's server-side
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` plus the existing
`kv_store_15374a1d` table (its schema is documented in `kv_store.tsx`).
Apply the checked-in storage migration before collecting player names. It
enables RLS and removes direct table privileges from anonymous and authenticated
browser clients; the server's service role retains access. If the project has
other unapplied migrations, review them before `db push`. The equivalent SQL
can also be run by the project owner in the Supabase SQL editor.

Enable email/password authentication in Supabase Auth. Allow the application's
origin and `/login` URL (including its deployment base path) in Auth → URL
Configuration for email confirmation redirects.

After deployment, click **Retry cloud sync**. The footer must say **Supabase
connected**, and pending records must reach zero. A connected project alone
does not mean the function is deployed; HTTP 404 means it is unavailable.

## Verification

```sh
pnpm build
pnpm exec tsc --noEmit
node --experimental-strip-types --test src/companion/analytics.test.ts
node --experimental-strip-types --test src/companion/accounts.test.ts
node --experimental-strip-types --test src/companion/landing-model.test.ts
node --experimental-strip-types --test src/companion/education-model.test.ts
node --experimental-strip-types --test src/companion/public-preview-model.test.ts
node --experimental-strip-types --test src/app/route-model.test.ts
node --experimental-strip-types --test src/app/route-recovery.test.ts
node --experimental-strip-types --test src/react-root.test.ts
```
