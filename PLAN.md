# PLAN.md — Hitch Pass

Planning anchor per the planning-with-files discipline (DIRECTIVE-002, 2026-07-07).
This file is the standing answer to "what is this repo doing right now"; update it when
the thrust changes, not per commit. Executed work is logged in the hub:
`Rootwork-workspace/directives/DIRECTIVE_LOG.md`.

## What this is

RV membership wallet app at hitch-pass-app.vercel.app. A low-stakes side project, fully
separate from Rootwork Energy. "TrailHopper" is only the Asana project name.

## Current thrust

- Self-refreshing parks pipeline: source-403 tolerance landed; pipeline runs in its own
  workspace.
- Go-live hygiene: AUDIT_REPORT.md, GO-LIVE-CHECKLIST.md, TEST_PLAN.md in flight
  (untracked as of 2026-07-07).

## Working rules

- All work rides a branch from the first commit; never commit to local main.
- Session-scoped task plans (task_plan.md, progress.md, findings.md) are welcome but
  git-ignored working files, not repo history.
