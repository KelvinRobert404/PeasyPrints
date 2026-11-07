# KADA-18 Nightly runbook · implement the 7 Nov redesign

How to run `docs/implementations/kada-18-redesign.md` unattended, wave by wave, on the run branch `kada-18/implement-redesign`, which is cut from `dev`. The run uses three files:

- **Packages.** `docs/implementations/kada-18-packages.json` has 44 packages in 6 waves, each with its own brief and the shared `common_rules`.
- **Ledger.** `docs/implementations/kada-18-ledger.md` is the only record of what is done. Always carry on from the ledger, never from the start.
- **Plan.** `docs/implementations/kada-18-redesign.md` is the reference for people. Agents never read it.

## 0. Before wave 1 (the chat that starts the run)

1. **Check for a takeover.** Read KADA-18 in Linear. If the newest claim line is a `**Working:**` line from another person or device, with no later `**Released:**` or `**Reclaimed:**` from them, stop and say who has it.
2. **Claim the run.** Otherwise post `**Working:** <person> · <device> · chat "<chat title>" · since <d Mon HH:MM IST>` on KADA-18, and write the same line under "Claim" in the ledger.
3. **Check usage.** Read `get_usage`.
   - Schedule the first resume (section 6).
   - Call `request_keep_awake` with `until: "session_idle"`.
   - State the usage estimate in the preflight comment: 44 packages at about 5M effective tokens each, so about 220M in total, spread over several 5-hour windows.
   - Start heavy waves right after a reset.
4. **Start the dev server** in fixture mode on port 3018 ("Run it anywhere" below). Confirm that `http://localhost:3018/` loads.

## 1. How each wave runs

1. **Build.** Run one workflow per wave. The workflow reads `waves[n].packages` from `kada-18-packages.json` and starts **one build-and-self-review agent per package**, all in parallel. No two packages in a wave share a file, so they cannot collide.
   - **Prompt.** Each agent's prompt is `common_rules`, then the package's `brief`, then the line `Files you may edit: <files>` (deletions are listed in `deletes`). Nothing else: agents never get the plan, the area maps or whole large files.
   - **Model.** Packages marked `"model": "strongest"` run on the strongest model. That covers all UI, copy, data, schema, server and test work, which is 43 of the 44 packages. `"standard"` (only DEAD, which deletes dead code) may run on Sonnet.
   - **Self-review.** Each agent ends with its self-review: what it built, files, checks and results, skips, and live-service needs.
2. **Verify** (the lead, per package, as each agent returns). Follow section 2.
3. **Commit and push** each package that verifies (section 3), and update the ledger row.
4. **Close the wave.** Run the end-of-wave check (section 2) once the whole wave is in. Then commit and push the ledger: `KADA-18: ledger after wave <n>`.
5. **Next wave.** Move to the next wave. Packages whose dependencies are blocked are marked `skipped`, with the blocked dependency named.
6. **After wave 1, capture the "before" views** for the morning report. Use fixture mode at 375 px, with the old screens still in place:
   - `/`
   - `/marketplace`
   - `/marketplace/new`
   - `/housing`
   - `/housing/new`
   - `/campus/verify` as `unverified-kju`
   - `/campus/activity`
   - one market detail and one housing detail

   Save them in the session scratchpad, never in the repo. `/login` can't be captured offline (prebuilt Clerk), so describe it from the code.

## 2. Verify

**Per package**, in the worktree:

1. `git status --porcelain` shows only that package's files.
   - Revert anything else: `git checkout -- <file>` for tracked files; delete new stray files.
   - Never revert `vercel.json` (see section 3).
2. `npm run typecheck`
3. `npm run lint`
4. `npm test`. It must include the package's own test files when it has any.
5. **UI packages:** browser check on `http://localhost:3018` in fixture mode, at 375 px and 1280 px. Use the acceptance list in the brief.
   - Switch users with `/api/dev/fixture-user?id=<fixture id>&next=<path>`.
   - Fixture ids: `new-user`, `unverified-kju`, `pending-id-card`, `verified-kju-main` (the default), `verified-kju-airport`, `girls-approved`, `admin`.
   - Confirm there is no horizontal scroll and no console errors.
   - Keep one "after" screenshot per changed screen, in the scratchpad.
   - Packages before FIX and MEM land (waves 1 and 2) have no fixture principal yet. Their UI is checked on the dev-only pages (`/dev/parts`, `/login/preview`) or in the next wave's smoke test.
6. **Grep checks** named in the acceptance.
7. **Live-service checks are never attempted.** That means Clerk round trips, real Firestore or Storage, the rules emulator without Java, and the Godview admin gate. Write them under "Skipped verifications" in the ledger.

**If a check fails,** send the agent its exact failure for one fix pass. If it fails again, the package is `blocked` (section 4).

**End of wave:**

1. Full `npm run typecheck && npm run lint && npm test` with the whole wave in.
2. Fixture-mode smoke test of every route the wave changed, plus `/`, `/marketplace` and `/housing`, at 375 px.
3. **After wave 1 only:** run `npm run build` once.
   - This confirms that relative `.ts`-extension imports in `src/` resolve under webpack.
   - If it fails only on missing env, record it as a skipped verification.
   - If it fails on those imports, switch the affected `src/` imports to extensionless `@/` paths, change the tests to type-only imports, and record it under "Decided at night".
4. **After wave 6:** `npm run build` again, plus CLEAN's audit greps.

## 3. Commit and push (one commit per verified package)

Before the first package: the plan commit `KADA-18: plan and runbook` holds the three plan files and the `docs/implementations/kada-18-packages.json` file. It also holds the `vercel.json` deployment guard (`git.deploymentEnabled` for `kada-18/**`), so run pushes never create Vercel deployments. That commit must already be on GitHub, which the preflight checks.

For each verified package (Git Bash; quote every path, because paths contain `(auth)` and `[id]`):

```bash
# 1. Stage exactly the package's files (from kada-18-packages.json), deletions included.
git add -A -- ':(literal)<file 1>' ':(literal)<file 2>' ...
git diff --cached --name-only        # must list only this package's files

# 2. Secrets check on the staged diff: any hit means unstage, don't push, note it for the morning.
git diff --cached | grep -nE 'sk_(live|test)_[A-Za-z0-9]|pk_live_|rzp_(live|test)_|AIza[0-9A-Za-z_-]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY|(CLERK_SECRET_KEY|FIREBASE_ADMIN_PRIVATE_KEY|RAZORPAY_KEY_SECRET|RAZORPAY_WEBHOOK_SECRET|CRON_SECRET)=' && echo "STOP: secret in staged diff"

# 3. Commit.
git commit -m "KADA-18: <id> <title>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"

# 4. Check the claim, then push the run branch only.
git push origin kada-18/implement-redesign
```

Rules for every push:

- **Check the claim first.** Look at KADA-18 and the ledger for a `**Reclaimed:**` line newer than this run's `**Working:**` line. If there is one, the run was taken back: stop and push nothing more.
- **What never gets staged:** `.claude/`, any `.env*` file, logs, screenshots or `node_modules`.
- **Where to push:** only `kada-18/implement-redesign`. Never dev or main, no PR, no merge, no deploy.
- **If a push fails** (for example, the network is down), keep going and push again after the next package.
- **Update the ledger row** after each push: status `done`, the short hash, and one line of notes (anything skipped, anything decided).

## 4. Stop rules

- **Fails twice, then blocked.** A package that fails verification twice (the first try plus one fix pass) is `blocked`.
  - Restore its files: `git checkout -- <tracked files>`, and delete its new files.
  - Record the failing command, its first error line and what was tried under "Blocked".
  - Carry on with the rest of the wave.
- **Broken build after one fix pass.** If the end-of-wave check fails and one fix pass doesn't mend it, find the package that broke it. Then:
  - Revert that package's commit with `git revert --no-edit <hash>`. If it is not committed yet, restore its files.
  - Mark it `blocked` and push the revert.
  - Its dependants in later waves become `skipped`.
- **Never ask the owner at night.** Every decision is in the plan's "Decided" and "Defaults" tables. For anything truly new, take the safest reversible option, and write it under "Decided at night": what it was, the options, the choice, where it lives and how to undo it.
- **Never touch a live service.** That includes Firebase, Clerk, Razorpay, Firestore rules or indexes deploys, Vercel, and any real account. Never delete an asset file (images, fonts, sounds). Deleting dead code is fine.

## 5. Ledger

- **Packages table.** Rows go `pending` → `building` → `verifying` → `done`. A row can also end as `blocked` or `skipped`, and a `done` row carries its commit hash.
- **Session log.** One line per event: wave start and end, each push, usage pauses and resumes, and the run's end.
- **Blocked, Skipped verifications, Decided at night.** Fill these as they happen. The morning report is built from them.
- **Commit and push the ledger** after every wave.

## 6. Usage limit: resume

Every time the run starts or resumes:

1. **Schedule the resume.** Read `get_usage` and create ONE one-shot cron (`CronCreate`, recurring false) at that window's reset time plus 3 minutes. Its prompt is "Nightly resume KADA-18: continue from the ledger".
2. **When it fires:**
   - If the run is still going, only schedule the next one-shot at the new reset.
   - If the run stopped on the limit, resume the same workflow with `resumeFromRunId`, re-run the interrupted packages first, and schedule the next one-shot.
3. **Clean up.** Delete the pending cron when the run is done or the owner pauses it. No recurring ticks.

## 7. When the work is done

1. **Make sure everything is pushed.** Run `git fetch origin kada-18/implement-redesign` and confirm that local HEAD equals `origin/kada-18/implement-redesign` and that the ledger is pushed.
2. **Morning report.** Post the morning report per the nightly skill:
   - **Branch and head commit.**
   - **Commits.** Each commit's hash and title.
   - **What landed.**
   - **What is blocked or skipped, and why.**
   - **What was decided at night.**
   - **Usage spent.**
   - **Before/after Artifact.** One page called "KADA-18 morning report", made from the scratchpad screenshots.
   - **Live-service list.** Copied from the plan's "What needs live services later".
   - **Asset files awaiting the owner.** Copied from the plan's asset table.
3. **Release the claim.** Post `**Released:** <person> · <device> · <one line on where it stands>` on KADA-18, and write the same line in the ledger.

## Run it anywhere

- **Get it:** `git fetch origin && git checkout kada-18/implement-redesign`. If you don't have the repo yet: `git clone https://github.com/KelvinRobert404/PeasyPrints` and then check out the branch. The worktree folder `C:/Developer/PeasyPrints-kada18` is only a suggestion. Use a fresh folder of your own, never one another chat is working in.
- **Tools:** Node 22.19 and npm (the repo pins `npm@11.5.2`). No other CLI is needed. Java and `firebase-tools` are needed only for the optional local rules-emulator test in NTF; without them, that test is a skipped verification.
- **Install:** `npm ci` in the run folder. Never junction `node_modules` from another checkout.
- **Env:** put these names (no values here) in `.env.local`, which git ignores. Copy them from your own main checkout's `.env.local` or from the team's secrets, never from a commit.
  - `NEXT_PUBLIC_SWOOP_FIXTURES=1`: the offline fixture flag defined by this plan. It works only when `NODE_ENV` is not `production`.
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`: a development-instance key pair. `ClerkProvider` won't render without the publishable key. Our code makes no Clerk call in fixture mode.
  - `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` and `NEXT_PUBLIC_FIREBASE_APP_ID`: needed only so the client SDK initialises. Campus screens read the fake DB in fixture mode.
  - `CRON_SECRET`: any local string. It is used for the CRON maintenance check.
  - Not needed tonight, though they are named in `.env.example`:
    - `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` (the fake Admin DB replaces them)
    - `RAZORPAY_KEY_ID`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
    - `ADMIN_EMAILS`, `CAMPUS_MAINTENANCE_TOKEN`, `VIDEO_WORKER_TOKEN`, `CAMPUS_ACCOUNT_HOOK_TOKEN`
    - `NEXT_PUBLIC_ALLOWED_ORIGINS` (same-origin requests are already allowed)
    - `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `POSTHOG_API_KEY`
- **Dev server:** `npm run dev -- -p 3018`, with `NEXT_PUBLIC_SWOOP_FIXTURES=1` set in `.env.local`, or inline in Git Bash as `NEXT_PUBLIC_SWOOP_FIXTURES=1 npm run dev -- -p 3018`. In Claude Code, add a `.claude/launch.json` entry (`"runtimeExecutable": "npm"`, `"runtimeArgs": ["run", "dev", "--", "-p", "3018"]`, `"port": 3018`) and start it with `preview_start`. Open `http://localhost:3018`, then switch users with `/api/dev/fixture-user?id=verified-kju-main&next=/`. Fixture mode exists only once wave 1's FIX package has landed; before that, the dev server runs as normal and campus screens need sign-in.
- **Live services:** none tonight. There are no Firebase, Clerk, Razorpay or database calls, no rules or index deploys, no Vercel deploys, and no pushes outside the run branch. Clerk's browser script still loads, because `ClerkProvider` wraps the app, but nothing signs in.
- **Preflight:** `node "~/.claude/skills/nightly/preflight.mjs" --repo <folder> --branch kada-18/implement-redesign --plan docs/implementations/kada-18-redesign.md --plan docs/implementations/kada-18-redesign-nightly.md --plan docs/implementations/kada-18-ledger.md`
  - `~` is not expanded inside quotes. In Git Bash use `"$HOME/.claude/skills/nightly/preflight.mjs"`; in PowerShell use `"$env:USERPROFILE\.claude\skills\nightly\preflight.mjs"`.
  - Add `--url http://localhost:3018` once the dev server is up.
  - On macOS, run the night under `caffeinate -dims`.
- **Start:** "Run KADA-18: implement the 7 Nov redesign decisions, wave by wave from the ledger". Then load the nightly skill, read KADA-18 in Linear, and follow it from the preflight on.
- **Taking it over:** put your own chat's name and `claude://` link in KADA-18's "## Chat" section, and say so in a comment on the issue. Then follow section 0 (claim) and carry on from the ledger.
