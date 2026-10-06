# SquadVault
Build 2 plan: CONFIRMED by Build 2 Planner on October 6, 2026.

## What the app does and who it's for
SquadVault is a football club fan hub where classmates and the teacher can rate player performances, post match recaps, share custom match graphics or memes, and discuss real club results (like Real Madrid).

## Sign-in
- Email + password sign-in and sign-up with password requirements: at least 8 characters, containing lowercase, uppercase, and a number.
- "Sign in with GitHub" OAuth provider.
- Session persistence on page refresh and explicit sign-out functionality.
- Change-password screen accessible for email + password users.

## Tables
1. `profiles`
   - `id` (uuid, primary key, references auth.users)
   - `username` (text, unique)
   - `created_at` (timestamp)
2. `match_posts`
   - `id` (uuid, primary key)
   - `user_id` (uuid, references profiles.id)
   - `club_name` (text, e.g., "Real Madrid")
   - `match_title` (text)
   - `player_rating` (integer/text)
   - `recap_notes` (text)
   - `image_url` (text)
   - `created_at` (timestamp)

## Who can see what
- `profiles` table:
  - Select: Any authenticated user can read usernames.
  - Insert/Update: Users can only create or update their own profile (`id = auth.uid()`).
- `match_posts` table:
  - Select: Any authenticated classmate/user can view all posts.
  - Insert: Authenticated users can insert posts associated with their own `user_id`.
  - Update/Delete: Users can only edit or delete their own posts (`user_id = auth.uid()`).

## Buckets
- Bucket name: `match_media`
- File size limit: 5 MB per file
- Allowed file types: `.png`, `.jpg`, `.jpeg`
- Access rules:
  - Public read for all authenticated users.
  - Insert/Delete restricted to authenticated users uploading to their own user path/folder.

## Screens
1. **Sign-In / Sign-Up Screen:** Supports GitHub sign-in, email/password login, and new user sign-up.
2. **Username Setup Screen:** Prompted on first sign-in if no unique username exists yet.
3. **Main Match Feed Screen:** Displays all classmate match posts, player ratings, and uploaded images.
4. **Create Match Post Screen:** Form to submit a match recap, player rating, and upload a match photo/meme.
5. **Settings & Password Screen:** Change password page for email users and profile management.

## Code files
- `index.html`: Contains all HTML structure and CSS styles for the app interface.
- `config.js`: Contains only the Supabase project URL and publishable key.
- `app.js`: Contains all JavaScript application logic, authentication handlers, Supabase queries, and file uploads.

## Rules for every chat
- This app uses exactly three code files: index.html, app.js, config.js. Do not create more.
- index.html contains the HTML and CSS, and loads config.js before app.js.
- config.js contains only the Supabase URL and the publishable key.
- When you change code, name the file and give me the whole file, not a snippet.
- Change nothing I did not ask you to change.
- Never put a secret key in any file.

## Addresses
- GitHub Pages URL: to fill in

## Secrets
- GitHub client secret: stored in Supabase dashboard under Authentication -> Providers -> GitHub. (Never placed in code or project files).

## Where we are right now
Planning complete, nothing built yet.

## NOT doing, on purpose
- Live API match score feeds (Belongs to Build 3: Connection).
- Automated AI match summary generation (Belongs to Build 4).
- Password reset emails (Supabase free tier limitation).

## Next thing I want to add
Set up Supabase sign-in settings, then email + password sign-in.

## Change log
- October 6, 2026: Planning session with Build 2 Planner. Plan confirmed.