# Weekly Hours Check — monday code app (new, separate app)

Flags Science team members under 40 hrs this week (Sat–Fri), excluding
anyone with PTO or a matching company holiday. On each run, sends you
(test phase only) a styled HTML email with a color-coded bar per flagged
person, and also returns output fields so you can chain a native monday
automation step off the same run later.

Everything below is browser-only — no terminal, no local install.

## 1. Create the app in the Developer Center

1. Go to **developers.monday.com** → **My Apps** → **Create app** → **Custom App**.
2. Name it something like **"Weekly Hours Check"**.
3. On the app's **Basic Information** tab, copy the **App ID**.
4. Go to **App Credentials** (or similar, depending on current UI) and copy the **Signing Secret**.
5. Generate a **developer/API token** for your own monday.com account (Avatar → Developers → My Access Tokens) if you don't already have one — this is `MONDAY_TOKEN` in step 4 below (used only by the GitHub Actions deploy step, not by the running app).

## 2. Create a GitHub repo

On github.com: **New repository** → name it (e.g. `weekly-hours-check-app`) → Create.
Everything from here is "Add file → Create new file" clicks on github.com — no git commands.

## 3. Add the app files

Create each of these files in the repo with the contents provided:
- `package.json`
- `src/config.js`
- `src/mondayApi.js`
- `src/weeklyHoursCheck.js`
- `src/emailer.js`
- `src/index.js`
- `.github/workflows/deploy.yml`

## 4. Add GitHub repo secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:
- `MONDAY_TOKEN` → the developer token from step 1.5
- `MONDAY_APP_ID` → the App ID from step 1.3

## 5. Deploy

Once all files are committed to `main`, the GitHub Action runs automatically. Check the **Actions** tab to confirm it succeeded. (The workflow includes `force: true` so re-deploys after the app is live won't fail.)

## 6. Get your Live URL

Developer Center → your app → **Host on monday → Server-side code**. Copy the **Live URL** — your action's Run URL will be that plus `/run-hours-check`.

## 7. Set runtime secrets (in the Developer Center, not GitHub)

Same **Host on monday → Server-side code** page → **Secrets** section. Add:
- `MONDAY_API_TOKEN` → your regular monday API token (reads the timesheet/roster/holiday boards)
- `MONDAY_APP_ID` → same App ID as before
- `MONDAY_APP_SIGNING_SECRET` → the Signing Secret from step 1.4
- `SMTP_USER` → your full M365 mailbox address (`sierra.collins@datavant.com`)
- `SMTP_PASS` → see note below — **not** your normal login password

> **M365 SMTP note:** Microsoft 365 blocks plain username/password SMTP AUTH by default on most tenants (security default). You'll likely need either:
> - An **app password** (requires MFA enabled on the account; generate under My Account → Security Info → App passwords), or
> - Your IT admin to enable **SMTP AUTH** for your mailbox specifically, if it's currently disabled tenant-wide.
>
> If neither is available, the alternative is OAuth2 client-credentials against Microsoft Graph's `sendMail` API instead of raw SMTP — let me know and I'll swap `emailer.js` to that if the app-password route is blocked.

## 8. Create the Custom Action feature

Developer Center → your app → **Features → Create feature → Workflow Block → Action**.
- Title: **"Run Weekly Hours Check"**
- Execution URL: your Live URL + `/run-hours-check`
- No input fields needed
- Check **"Mark block as async"**
- Set a slug, e.g. `run-weekly-hours-check`
- Under **Output fields**, add:
  - `message` (Long Text)
  - `flaggedCount` (Number)
  - `flaggedNames` (Long Text)
  - `emailSent` (Text)
  - `emailError` (Long Text)
- Under **Automation builder**, toggle **"Allow this block to be exposed"** to On.

## 9. Promote to live and install

Developer Center → **Promote to live** on the app version, then install it to your Datavant account if not already installed (Marketplace → your app → Install, or it may already be scoped to your account as the developer).

## 10. Build the automation recipe

In any board's Automation Center → Custom → build:
- **Schedule test**: *Every [day] at [time]* → **Run Weekly Hours Check**
- Or **Button test**: *When button clicked* → **Run Weekly Hours Check**

No fields to fill in — just pick the action. Since it's async, monday will show "in progress" briefly then complete once the callback lands.

## Testing

Right now `TEST_RECIPIENT` in `src/index.js` is hardcoded to `sierra.collins@datavant.com`. Every run — no matter what triggers it — emails only you. Once you've confirmed the formatting and data look right, tell me and I'll swap this to whatever real recipient list you want (and can also wire recipients dynamically off automation input, rather than hardcoded).

## Going live later

When you're ready to move past testing:
- Replace `TEST_RECIPIENT` with the real recipient(s), or better, add an input field on the action so the automation recipe itself picks the recipient (e.g. "notify {{person}}").
- Consider whether you still want the output fields wired into a secondary native step (e.g., Slack notify) — they're populated either way.
