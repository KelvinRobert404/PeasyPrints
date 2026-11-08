# KADA-19 Nightly runbook · build the Swoop demo site

This runbook says how to run `docs/implementations/kada-19-demo.md` unattended, wave by wave, on the run branch `kada-19/demo-site`, which is cut from `kada-18/implement-redesign`. The run uses three files:

- **Packages.** `docs/implementations/kada-19-packages.json` has 26 packages in 5 waves, each with its own brief and the shared `common_rules`. The shared contract (flag, cookies, personas, demo API, shim files) lives in `common_rules`.
- **Ledger.** `docs/implementations/kada-19-ledger.md` is the only record of what is done. Always carry on from the ledger, never from the start.
- **Plan.** `docs/implementations/kada-19-demo.md` is the reference for people. Agents never read it.

## 0. Before wave 1 (the chat that starts the run)

1. **Check for a takeover.** Read KADA-19 in Linear and the "Claim" section of the ledger. If the newest claim line is a `**Working:**` line from another person or device, with no later `**Released:**` or `**Reclaimed:**` from them, stop and say who has it.
2. **Claim the run.** Otherwise, post `**Working:** <person> · <device> · chat "<chat title>" · since <d Mon HH:MM IST>` on KADA-19, and write the same line under "Claim" in the ledger.
3. **Check usage.** Read `get_usage`.
   - Schedule the first resume (section 6).
   - Call `request_keep_awake` with `until: "session_idle"`.
   - State the usage estimate in the preflight comment: 26 packages. KADA-18 used about 11.6M subagent tokens for 50 packages. Tonight has more browser work (wave 5 and the lead's checks), so estimate about 25M subagent tokens, which is one or two 5-hour windows.
   - Start heavy waves (2, 4, 5) right after a reset when possible.
4. **Plan commit.** The commit `KADA-19: plan and runbook` must already be on GitHub (the preflight checks). It holds:
   - the four plan files;
   - the `vercel.json` guard `"kada-19/**": false` under `git.deploymentEnabled`, so run pushes never create Vercel deployments.
5. **Baseline.** Run `npm ci`, then `npm run typecheck`, `npm run lint` and `npm test` on the branch head. All must be green (326 tests at the KADA-18 end).
6. **"Before" view for the morning report.**
   - Move every `.env*` file aside and run `npm run dev -- -p 3019` (Turbopack, no demo yet).
   - Capture `/` at 375 px: today it fails without env, because ClerkProvider needs a key.
   - Save the screenshot in the session scratchpad, never in the repo. Then stop the server.

## 1. How each wave runs

1. **Build.** Run one workflow per wave. It reads `waves[n].packages` from `kada-19-packages.json` and starts **one build-and-self-review agent per package**, all in parallel. No two packages in a wave share a file, so they cannot collide.
   - **Prompt.** Each agent's prompt is `common_rules`, then the package's `brief`, then the line `Files you may edit: <files>`. Nothing else: agents never get the plan, the maps or whole large files.
   - **Model.** All 26 packages run on the strongest model. None is purely mechanical.
   - **Self-review.** Each agent ends with its self-review: what it built, files, checks and results, skips, and any fix it needs in a file it doesn't own.
   - **Dependency-driven start (allowed).** Instead of waiting for a whole wave, a package may start as soon as every package in its `depends_on` is `done`, as long as no running package shares a file. Use at most 8 agents at once. The ledger and the commits stay per package.
2. **Verify** each package as its agent returns, the lead's job (section 2).
3. **Commit and push** each package that verifies (section 3), and update its ledger row.
4. **Close the wave.** Once the whole wave is in, run the end-of-wave check (section 2). Then commit and push the ledger: `KADA-19: ledger after wave <n>`.
5. **Next wave.** Move to the next wave. Packages whose dependencies are blocked are marked `skipped`, with the blocked dependency named.
6. **After wave 5, close out.**
   - Copy each check package's pass and fail list into the ledger.
   - Mark the KADA-18 skipped checks in `docs/implementations/kada-18-ledger.md`, and commit that file with the ledger. Only the lead edits ledgers.
   - If wave 5 found fixes outside every package's files, add a follow-up wave (section 4).

## 2. Verify

**Per package**, in the run folder:

1. `git status --porcelain` shows only that package's files.
   - Revert anything else: `git checkout -- <file>` for tracked files; delete stray new files.
   - Never revert `vercel.json` (section 0, step 4).
   - Ignore `next-env.d.ts` and `.next-demo/`, which are generated and gitignored.
2. `npm run typecheck`
3. `npm run lint`
4. `npm test`. It must include the package's own test files when it has any.
5. **UI packages:** a browser check in demo mode on http://localhost:3019 at 375 px and 1280 px, using the acceptance list in the brief.
   - **Start the demo** with `npm run demo`, or `preview_start` with the launch entry in "Run it anywhere".
   - **Restart it** after any package that changes `next.config.js` or `src/lib/demo/build-config.cjs`, or adds a shim file, because aliases are read at start.
   - **Switch students** with the demo bar once DEMOBAR is in. Before that, use `/demo`, or `fetch('/api/demo/session', {method:'POST', body: JSON.stringify({persona:'kabir'})})` from the page, then reload.
   - **Switch dates** with the bar, or `POST /api/demo/date {date:'may'}`.
   - **Check the page:** no horizontal scroll and no console errors. In `read_network_requests`, there must be no request to clerk, firebase or googleapis, razorpay, posthog, googletagmanager, google-analytics or vercel-insights.
   - **Keep one "after" screenshot** per changed screen, in the scratchpad.
   - **Waves 1 and 2:** the demo first renders with no env at the end of wave 2. Verify these packages with tests and `curl` (cookies, redirects, JSON), and do their browser part in the end-of-wave-2 smoke.
6. **Grep checks** named in the acceptance.
7. **Live-service checks are never attempted.** That means real Clerk round trips, real Firestore or Storage, the rules emulator, index or rules deploys, and a build with real env. Write them under "Skipped verifications" in the ledger.

**If a check fails,** send the agent its exact failure for one fix pass. If it fails again, the package is `blocked` (section 4).

**End of wave:**

1. The full `npm run typecheck && npm run lint && npm test` with the whole wave in.
2. Plain `npm run build`.
   - It must compile. If prerender fails only on missing env, record that under "Skipped verifications".
   - Then run `grep -rl "src/lib/demo/shims" .next` (Git Bash). It must find nothing: no stand-in leaks into a production build.
3. **Demo-mode build:** `npm run demo:check`, with every `.env*` file moved aside.
   - After wave 1, it must at least reach Ready on :3019.
   - From wave 2 on, every static page must compile and answer without a 500.
   - A production build can never be in demo mode, so this is the demo-mode build.
4. **From wave 4 on:** `npm run demo:smoke` against a fresh `npm run demo`.
5. **Route smoke list** (plan, "Route smoke list") in a real browser:
   - At 375 px, every route the wave touched, plus `/`, `/marketplace` and `/housing`.
   - After waves 4 and 5, the whole list at 375 px and 1280 px.
6. **After wave 2 only,** the gate: with no env, `/` renders signed out, `POST /api/demo/session {persona:'sana'}` answers, and after a reload Home greets Sana with no console error.

## 3. Commit and push (one commit per verified package)

For each verified package (Git Bash; quote every path, because paths contain `(auth)` and `[id]`):

```bash
# 1. Stage exactly the package's files (from kada-19-packages.json).
git add -A -- ':(literal)<file 1>' ':(literal)<file 2>' ...
git diff --cached --name-only        # must list only this package's files

# 2. Secrets check on the staged diff: any hit means unstage, don't push, and note it for the morning.
git diff --cached | grep -nE 'sk_(live|test)_[A-Za-z0-9]|pk_live_|rzp_(live|test)_|AIza[0-9A-Za-z_-]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY|(CLERK_SECRET_KEY|FIREBASE_ADMIN_PRIVATE_KEY|RAZORPAY_KEY_SECRET|RAZORPAY_WEBHOOK_SECRET|CRON_SECRET)=' && echo "STOP: secret in staged diff"

# 3. Commit.
git commit -m "KADA-19: <id> <title>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"

# 4. Check the claim, then push the run branch only.
git push origin kada-19/demo-site
```

Rules for every push:

- **Check the claim first.** Look at KADA-19 and the ledger for a `**Reclaimed:**` line newer than this run's `**Working:**` line. If there is one, the run was taken back: stop and push nothing more.
- **Placeholder values.** The launcher's placeholder values are fake on purpose. They are written as object keys, so the secrets grep stays clean. If the grep hits `scripts/demo.mjs`, the value was written as `NAME=value` text: fix the text, never push it.
- **What never gets staged:** `.claude/`, any `.env*` file, `.next-demo/`, logs, screenshots or `node_modules`.
- **Where to push:** only `kada-19/demo-site`. Never dev, main or kada-18, no PR, no merge, no deploy.
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
- **Wave 2 gate.** WORLD, CLERKSRV, CLERKUI and FIREBASE together make the demo render with no env. If, after wave 2 and one fix pass across them, `/` still can't render with no env, **stop the run**: every later package depends on it. Record the error, push the ledger, release the claim and report.
- **Fixes outside a package's files (wave 5).** Check agents only describe fixes they can't make. After wave 5, the lead may add **wave 6: follow-up packages**, the same way KADA-18 added its seam wave:
  - group the described fixes by file, so files stay disjoint;
  - add the packages to `kada-19-packages.json` with briefs;
  - run them through the same build, verify and push steps;
  - record this under "Decided at night".
- **Never ask the owner at night.** Every decision is in the plan's "Decided" tables. For anything truly new, take the safest reversible option and write it under "Decided at night": what it was, the options, the choice, where it lives and how to undo it.
- **Never touch a live service.** That includes Clerk, Firebase, Firestore rules or indexes deploys, Razorpay, PostHog, Vercel and any real account.
  - Never delete an asset file (images, fonts, sounds). Deleting dead code is fine.
  - Never build events, gigs, jobs, food surfaces or pets.

## 5. Ledger

- **Packages table.** Rows go `pending` → `building` → `verifying` → `done`. A row can also end as `blocked` or `skipped`, and a `done` row carries its commit hash.
- **Session log.** One line per event: wave start and end, each push, the wave-2 gate result, usage pauses and resumes, and the run's end.
- **Blocked, Skipped verifications, Decided at night.** Fill these as they happen. The morning report is built from them.
- **The KADA-18 ledger.** After wave 5, the lead marks each KADA-18 skipped check that ran in demo mode in `docs/implementations/kada-18-ledger.md`: run in demo mode, the date, pass or fail, and the fixing commit. The live-service checks stay skipped.
- **Commit and push the ledger** after every wave.

## 6. Usage limit: resume

Every time the run starts or resumes:

1. **Schedule the resume.** Read `get_usage` and create ONE one-shot cron (`CronCreate`, recurring false) at that window's reset time plus 3 minutes. Its prompt is "Nightly resume KADA-19: continue from the ledger".
2. **When it fires:**
   - If the run is still going, only schedule the next one-shot at the new reset.
   - If the run stopped on the limit, resume the same workflow with `resumeFromRunId`, re-run the interrupted packages first, and schedule the next one-shot.
3. **Clean up.** Delete the pending cron when the run is done or the owner pauses it. No recurring ticks.

## 7. When the work is done

1. **Make sure everything is pushed.** Run `git fetch origin kada-19/demo-site` and confirm that local HEAD equals `origin/kada-19/demo-site` and that the ledger is pushed.
2. **Morning report.** Post the morning report per the nightly skill:
   - **Branch and head commit.**
   - **How to run the demo:** `git checkout kada-19/demo-site && npm ci && npm run demo`, then open http://localhost:3019, with no env.
   - **Commits.** Each commit's hash and title.
   - **What landed.**
   - **What is blocked or skipped, and why.**
   - **What was decided at night.**
   - **The KADA-18 checks** run in demo mode, with results.
   - **Usage spent.**
   - **Before/after Artifact.** One page called "KADA-19 morning report", built from the scratchpad screenshots.
     - Before: `/` with no env.
     - After, at 375 px: `/demo`, `/`, the demo Google chooser on `/login`, `/marketplace`, `/housing`, the demo pay sheet on `/upload`, a ready pickup page, and May's Home.
     - After, at 1280 px: the desktop panel.
     - Embed them as images; the page itself follows the house style.
   - **Live-service list.** Copied from the plan's "What needs live services later".
3. **Release the claim.** Post `**Released:** <person> · <device> · <one line on where it stands>` on KADA-19, and write the same line in the ledger.

## Run it anywhere

- **Get it:** `git fetch origin && git checkout kada-19/demo-site`. If you don't have the repo yet: `git clone https://github.com/KelvinRobert404/PeasyPrints`, then check out `kada-19/demo-site`. The folder `C:/Developer/PeasyPrints-kada19` is only a suggestion. Use a fresh folder of your own, never one another chat is working in.
- **Tools:** Node 22.19 and npm (the repo pins `npm@11.5.2`). No other CLI is needed.
- **Install:** `npm ci` in the run folder. Never junction `node_modules` from another checkout.
- **Env: none needed for the demo.** Don't create `.env.local` for this run.
  - If one exists it does no harm: the aliases replace the Clerk and Firebase SDKs, and the launcher overrides the Razorpay, PostHog and cron values.
  - Move `.env*` files aside for the `demo:check` runs, which prove the demo needs none.
- **Demo command and port:** `npm run demo`, then open http://localhost:3019. It needs wave 1's SWITCH package; before that, there is no demo command.
  - **In Claude Code:** add a `.claude/launch.json` entry, `{"name": "swoop-demo", "runtimeExecutable": "npm", "runtimeArgs": ["run", "demo"], "port": 3019}`, and start it with `preview_start`.
  - **Other commands:** `npm run demo:check` is the demo-mode build. `npm run demo:smoke` exists after APICHK.
  - **The demo builds into `.next-demo`,** so it can run beside `npm run dev`.
- **Live services:** none.
  - No Clerk, Firebase, Firestore, Storage, Razorpay or PostHog calls.
  - No rules or index deploys, no Vercel deploys, no pushes outside the run branch.
  - The only outside fetch is `next/font` downloading Google Fonts while compiling. Offline, it falls back.
- **Preflight:** `node "~/.claude/skills/nightly/preflight.mjs" --repo <folder> --branch kada-19/demo-site --plan docs/implementations/kada-19-demo.md --plan docs/implementations/kada-19-demo-nightly.md --plan docs/implementations/kada-19-ledger.md --plan docs/implementations/kada-19-packages.json`
  - `~` is not expanded inside quotes. In Git Bash use `"$HOME/.claude/skills/nightly/preflight.mjs"`; in PowerShell use `"$env:USERPROFILE\.claude\skills\nightly\preflight.mjs"`.
  - Add `--url http://localhost:3019` once the demo runs (after wave 1).
  - On macOS, run the night under `caffeinate -dims`.
- **Start:** "Run KADA-19: build the Swoop demo site, wave by wave from the ledger". Then load the nightly skill, read KADA-19 in Linear, and follow it from the preflight on.
- **Taking it over:** put your own chat's name and `claude://` link in KADA-19's "## Chat" section, and say so in a comment on the issue. Then follow section 0 (claim) and carry on from the ledger.
