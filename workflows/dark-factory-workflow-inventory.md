# Dark Factory Workflow Inventory

**Source repo:** https://github.com/coleam00/dark-factory-experiment  
**Fetched via:** unauthenticated GitHub public API (`api.github.com` + `raw.githubusercontent.com`)  
**Inventory date:** 2026-04-24  
**Path inspected:** `.archon/workflows/`

---

## Workflows Found (5 total)

| # | Filename | Workflow Name | Node Count | Import Candidate? |
|---|----------|---------------|------------|-------------------|
| 1 | `dark-factory-comprehensive-test.yaml` | `dark-factory-comprehensive-test` | 12 | YES — self-healing regression loop |
| 2 | `dark-factory-fix-github-issue.yaml` | `dark-factory-fix-github-issue` | 21 | YES — Python+Bun-aware fix pipeline |
| 3 | `dark-factory-triage.yaml` | `dark-factory-triage` | 4 | YES — flood-protected triage with rate limiting |
| 4 | `dark-factory-validate-pr.yaml` | `dark-factory-validate-pr` | 34 | YES — holdout-principle validator with 2-pass fix loop |
| 5 | `minimax-smoke.yaml` | `minimax-smoke` | 1 | NO — smoke test only, repo-specific |

---

## Workflow Details

---

### 1. `dark-factory-comprehensive-test.yaml`

**Name:** `dark-factory-comprehensive-test`  
**Provider/Model:** `claude` / `sonnet`  
**Size:** ~18 KB

#### Purpose
Weekly end-to-end regression suite that runs 4 agent-browser scenarios against the live app
on `main`, then auto-files GitHub issues for any failures. Closes the self-healing loop:
comprehensive test → triage → fix-github-issue → validate-pr → merge, no human in the loop
unless all stages fail.

#### Node IDs
| ID | Type |
|----|------|
| `pull-latest` | `bash` |
| `allocate-ports` | `bash` |
| `install-deps` | `bash` |
| `start-app` | `bash` |
| `test-chat-ui` | `command` (`dark-factory-test-chat-ui`) |
| `test-video-ingestion` | `command` (`dark-factory-test-video-ingestion`) |
| `test-rag-response` | `command` (`dark-factory-test-rag-response`) |
| `test-conversation-history` | `command` (`dark-factory-test-conversation-history`) |
| `teardown` | `bash` |
| `report` | `command` (`dark-factory-comprehensive-report`) |
| `file-issues` | `bash` |

#### Node Types
- `bash` (infrastructure setup/teardown, port allocation, issue filing)
- `command` (AI-driven scenario tests, report synthesis)

#### Providers / Models
- Root: `claude` / `sonnet`
- Scenario nodes inherit root model

#### Tools Used
- `agent-browser` skill (all 4 scenario test nodes)
- `gh` CLI (issue list, issue create, issue edit, issue comment, issue view)
- `curl` (health checks against running app)
- `uv` (Python backend deps)
- `bun` (frontend deps)
- `nohup` (background process management)

#### GitHub / GitHub CLI Dependencies
- `gh issue list` — dedup check, rate-limited label management
- `gh issue create` — file new bugs with label `factory:from-comprehensive-test`
- `gh issue edit` — add labels
- `gh issue comment` — post evidence
- Writes `filed-issues.json` artifact

#### Risky Actions
- `git reset --hard origin/main` — hard reset worktree to main (intentional, documented)
- `kill $PID` — kills backend/frontend processes on teardown
- Creates GitHub issues automatically (self-healing loop side effect)

#### Governance Patterns Worth Preserving
- **Infra-failure guard ("Rule 0"):** If fewer than 4 `test-*.md` evidence files exist, the
  `file-issues` node refuses to create any GitHub issues. Prevents spamming bogus bugs when
  the test harness itself crashes.
- **Sequential scenario chaining:** `test-*` nodes are forced sequential (`depends_on` chain)
  because `agent-browser` maintains one shared browser session; parallel runs would race.
- **Fixed backend port (8000) + dynamic frontend port:** Backend port is hardcoded to match
  the Vite proxy config; frontend uses dynamic port from a range.
- **Canonical fixture URL lock:** The YouTube test video URL
  (`https://www.youtube.com/watch?v=pjF-0dliYhg`) is shared between `test-video-ingestion`
  and `test-rag-response`; documented as locked.
- **`trigger_rule: all_done` on teardown:** Teardown always runs even if scenarios fail.
- **Dedup before filing:** Uses `gh issue list --search` to skip issues with identical titles
  already labeled `factory:from-comprehensive-test`.
- **Validation env file (`/opt/dark-factory/validation.env`):** Backend requires live secrets
  (DATABASE_URL, OPENROUTER_API_KEY, etc.). Missing vars produce a clear error, not a
  silent hang.
- **Separate cron schedule:** Weekly (Mondays 06:00 UTC), NOT the 4-hour orchestrator cron.

#### Repo-Specific Assumptions
- `agent-browser` v0.25.3 + Chrome for Testing installed globally on VPS
- `uv` available at `$HOME/.local/bin`
- `bun` available on PATH
- `/opt/dark-factory/validation.env` must exist with secrets (overridable via
  `$DARK_FACTORY_VALIDATION_ENV`)
- App structure: `app/backend/` (FastAPI/uvicorn), `app/frontend/` (Vite/React)
- Backend health endpoint: `GET /api/health` (NOT `/health`)
- Vite proxy hardcoded to forward `/api/*` → `localhost:8000`
- YouTube channel ID referenced in env as `YOUTUBE_CHANNEL_ID`

---

### 2. `dark-factory-fix-github-issue.yaml`

**Name:** `dark-factory-fix-github-issue`  
**Provider/Model:** `claude` / `sonnet`  
**Size:** ~13 KB

#### Purpose
Implements accepted GitHub issues in the DynaChat codebase (Python/FastAPI backend + React/TS
frontend). Triggered by the orchestrator when an issue gets the `factory:accepted` label. A
fork of the bundled `archon-fix-github-issue` adapted for the Dark Factory stack.

Key divergences from the bundled workflow:
- All AI prompts reference `.md` command files — no inline prompts.
- Implementation uses `dark-factory-fix-issue` (Python+Bun dep install, DynaChat sanity checks).
- Validation uses `dark-factory-validate` (ruff/mypy/pytest + tsc/biome/vitest).
- 4 prompts that were inline in the bundled workflow are now separate command files.

#### Node IDs
| ID | Type |
|----|------|
| `extract-issue-number` | `command` (`dark-factory-extract-issue-number`) |
| `fetch-issue` | `bash` |
| `classify-issue` | `command` (`dark-factory-classify-issue`), model: `haiku` |
| `web-research` | `command` (`archon-web-research`), context: `fresh` |
| `investigate` | `command` (`archon-investigate-issue`), when: bug |
| `plan` | `command` (`archon-create-plan`), when: non-bug |
| `bridge-artifacts` | `bash`, `trigger_rule: one_success` |
| `implement` | `command` (`dark-factory-fix-issue`), context: `fresh` |
| `validate` | `command` (`dark-factory-validate`), context: `fresh` |
| `create-pr` | `command` (`dark-factory-create-pr`), context: `fresh` |
| `capture-pr-number` | `bash` |
| `review-scope` | `command` (`dark-factory-pr-review-scope`), context: `fresh` |
| `review-classify` | `command` (`dark-factory-review-classify`), model: `haiku` |
| `code-review` | `command` (`archon-code-review-agent`), context: `fresh` |
| `error-handling` | `command` (`archon-error-handling-agent`), conditional |
| `test-coverage` | `command` (`archon-test-coverage-agent`), conditional |
| `comment-quality` | `command` (`archon-comment-quality-agent`), conditional |
| `docs-impact` | `command` (`archon-docs-impact-agent`), conditional |
| `synthesize` | `command` (`archon-synthesize-review`), `trigger_rule: one_success` |
| `self-fix` | `command` (`archon-self-fix-all`), context: `fresh` |
| `simplify` | `command` (`archon-simplify-changes`), context: `fresh` |
| `report` | `command` (`archon-issue-completion-report`), context: `fresh` |
| `cleanup-issue-label` | `bash`, `trigger_rule: all_done` |

#### Node Types
- `bash` (fetch, bridge, capture, cleanup)
- `command` — AI nodes referencing `.md` command files

#### Providers / Models
- Default: `claude` / `sonnet`
- `classify-issue`, `review-classify`: `haiku` (classification only, no tools)

#### Tools Used
- `gh` CLI (issue view, pr view, issue edit — label management)
- Bundled `archon-*` commands for web research, investigation, planning, review agents
- Dark Factory `dark-factory-*` commands for implementation, validation, PR creation

#### GitHub / GitHub CLI Dependencies
- `gh issue view` — fetch issue details
- `gh issue edit` — remove `factory:in-progress` label on completion
- `gh pr view` — capture PR number fallback
- Issues expected to have label `factory:accepted` before dispatch
- Adds/removes: `factory:in-progress`, `factory:needs-review` labels

#### Risky Actions
- Creates a PR (draft) against the repository
- Pushes a feature branch
- Removes GitHub labels from issues

#### Governance Patterns Worth Preserving
- **`bridge-artifacts` pattern:** Normalizes `plan.md` → `investigation.md` so the `implement`
  node always reads from the same path regardless of whether `investigate` or `plan` ran.
  Uses `trigger_rule: one_success` to activate after whichever branch resolved.
- **Deterministic PR number capture:** `capture-pr-number` reads `.pr-number` artifact first,
  falls back to `gh pr view --json number`. Fixes a bug where downstream nodes received the
  issue number instead of the PR number.
- **Smart conditional review:** `review-classify` (haiku) determines which of the 5 review
  agents to run; `code-review` always runs. `trigger_rule: one_success` on `synthesize`
  handles skipped agents gracefully.
- **`cleanup-issue-label` with `trigger_rule: all_done`:** Removes `factory:in-progress` even
  on late-stage failures so issues don't get stuck in a permanent in-progress state.
- **All-command-file rule:** No inline prompts in any AI node — all reference `.md` files.

#### Repo-Specific Assumptions
- DynaChat stack: Python (FastAPI, ruff, mypy, pytest) + React/TypeScript (tsc, biome, vitest)
- `uv` and `bun` on PATH
- `MISSION.md`, `FACTORY_RULES.md`, `CLAUDE.md` present in repo root
- Issues must be labeled `factory:accepted` to enter the pipeline
- Command files exist under `.archon/commands/dark-factory-*.md`

---

### 3. `dark-factory-triage.yaml`

**Name:** `dark-factory-triage`  
**Provider/Model:** `claude` / `sonnet`  
**Size:** ~10 KB

#### Purpose
Batch-classifies up to 10 open GitHub issues without any `factory:*` label. Each issue gets
verdict `accept` (queued for implementation) or `reject` (closed with reason). No human in
the loop — ambiguous issues are rejected and the human can reopen with more context.

#### Node IDs
| ID | Type |
|----|------|
| `fetch-issues` | `bash` |
| `fetch-rules` | `bash` |
| `fetch-open-prs` | `bash` |
| `classify` | `command` (`dark-factory-triage-classify`), model: `sonnet`, `allowed_tools: [Write]` |
| `apply-decisions` | `bash` |

#### Node Types
- `bash` (all data fetching and GitHub action application)
- `command` (single AI classification call)

#### Providers / Models
- `classify` node: `claude` / `sonnet`

#### Tools Used
- `gh` CLI (issue list, issue view, issue edit, issue comment, issue close, pr list)
- `jq` (JSON parsing throughout)
- `Write` tool (AI classifier writes `decisions.json` to `$ARTIFACTS_DIR`)

#### GitHub / GitHub CLI Dependencies
- `gh issue list` — fetch open issues, check rate-limit labels, fetch today's issues per author
- `gh issue view` — check labels on individual issues
- `gh issue edit` — add/remove labels (factory:accepted, factory:rejected, factory:rate-limited,
  priority:*, type:*)
- `gh issue comment` — post triage verdict with reasoning
- `gh issue close --reason "not planned"` — close rejected issues
- `gh pr list` — detect issues already addressed by open PRs (dedup)

#### Risky Actions
- **Closes GitHub issues** (`gh issue close`) — rejected issues are permanently closed
- **Rate-limits users** — adds `factory:rate-limited` label and comments on issues from
  non-owner accounts exceeding 3 issues/UTC day
- **Modifies labels in bulk** — strips/adds `factory:*`, `priority:*`, `type:*` labels

#### Governance Patterns Worth Preserving
- **Flood protection (§3 of FACTORY_RULES.md):** Non-owner accounts capped at 3 issues per
  UTC calendar day. Implemented via 3 steps: (1) unstick yesterday's rate-limited issues,
  (2) count today's issues per author, (3) apply `factory:rate-limited` to over-cap issues.
  Owner (`coleam00`) is exempt. Idempotent — repeated triage runs don't double-label.
- **Batch cap (10 issues per run):** Fetch is capped at 10 so classify call size is bounded.
- **JSON validation before GitHub actions:** `apply-decisions` validates `decisions.json`
  structure with `jq -e` before touching any GitHub resources.
- **Stale label removal on accept:** Existing `priority:*` and `type:*` labels that conflict
  with the new verdict are stripped before adding new ones, making triage authoritative.
- **Reads MISSION.md + FACTORY_RULES.md** before classification — classifier is grounded in
  the repo's own rules.
- **Open-PR dedup:** `fetch-open-prs` feeds the classifier so it can detect issues already
  being addressed by in-flight PRs and reject them as duplicates.
- **Two-verdict only (accept/reject):** No "needs-more-info" — ambiguous → reject with
  explanation; human reopens if they disagree.

#### Repo-Specific Assumptions
- `MISSION.md` and `FACTORY_RULES.md` must exist in repo root
- Owner login is hardcoded as `coleam00`
- GitHub labels `factory:*`, `priority:*`, `type:*` must be pre-created in the repo
- `decisions.json` is written by the `classify` AI node to `$ARTIFACTS_DIR/decisions.json`

---

### 4. `dark-factory-validate-pr.yaml`

**Name:** `dark-factory-validate-pr`  
**Provider/Model:** `claude` / `sonnet`  
**Size:** ~60 KB (largest workflow)

#### Purpose
Validates PRs labeled `factory:needs-review` under the **holdout principle** — the validator
never sees implementation rationale, only the diff and the running app. Runs static checks,
unit tests, and 4 parallel holdout reviewers (behavioral static, E2E browser, security,
code review). If verdict is `request_changes`, runs a fresh-context fix pass, then re-runs
all reviewers (pass 2). Always tears down the app, then posts the final verdict.

Combines the former `validate-pr` + `fix-pr` workflows into a single state machine.

#### Node IDs (Pass 1)
| ID | Type |
|----|------|
| `extract-pr-number` | `command` (`dark-factory-extract-pr-number`), model: `haiku` |
| `fetch-pr` | `bash` |
| `fetch-diff` | `bash` |
| `fetch-linked-issue` | `bash` |
| `fetch-base-governance` | `bash` |
| `verify-holdout-clean` | `bash` |
| `checkout-pr` | `bash` |
| `allocate-ports` | `bash` |
| `install-deps` | `bash` |
| `start-app` | `bash` |
| `static-checks-backend-p1` | `bash` |
| `static-checks-frontend-p1` | `bash` |
| `run-tests-backend-p1` | `bash` |
| `run-tests-frontend-p1` | `bash` |
| `behavioral-validation-p1` | `command` (`dark-factory-behavioral-validation`), `allowed_tools: []` |
| `behavioral-e2e-p1` | `command` (`dark-factory-behavioral-e2e`), `allowed_tools: [Bash]`, `skills: [agent-browser]` |
| `security-check-p1` | `command` (`dark-factory-security-check`), `allowed_tools: []` |
| `code-review-p1` | `command` (`archon-code-review-agent`) |
| `synthesize-verdict-pass-1` | `command` (`dark-factory-synthesize-verdict`), `trigger_rule: all_done`, `allowed_tools: []` |

#### Node IDs (Pass 2 — conditional on `request_changes` verdict)
| ID | Type |
|----|------|
| `fix-issues` | `command` (`dark-factory-fix-pr-issues`), when: verdict == `request_changes` |
| `fetch-diff-p2` | `bash` |
| `static-checks-backend-p2` | `bash` |
| `static-checks-frontend-p2` | `bash` |
| `run-tests-backend-p2` | `bash` |
| `run-tests-frontend-p2` | `bash` |
| `behavioral-validation-p2` | `command` (`dark-factory-behavioral-validation-p2`), `allowed_tools: []` |
| `behavioral-e2e-p2` | `command` (`dark-factory-behavioral-e2e`), `allowed_tools: [Bash]`, `skills: [agent-browser]` |
| `security-check-p2` | `command` (`dark-factory-security-check-p2`), `allowed_tools: []` |
| `code-review-p2` | `command` (`archon-code-review-agent`) |
| `synthesize-verdict-pass-2` | `command` (`dark-factory-synthesize-verdict-p2`), when: pass-1 was `request_changes` |

#### Node IDs (Always-run finale)
| ID | Type |
|----|------|
| `teardown-app` | `bash`, `trigger_rule: all_done` |
| `apply-verdict` | `bash` |

**Total: ~34 nodes**

#### Node Types
- `bash` (infrastructure, checks, teardown, verdict application)
- `command` (AI reviewers — all holdout-isolated, fresh context)

#### Providers / Models
- Default: `claude` / `sonnet`
- `extract-pr-number`: `haiku`

#### Tools Used
- `agent-browser` skill (E2E reviewer nodes, both passes)
- `gh` CLI (pr view, pr diff, pr checkout, pr edit, pr close, pr review, issue view,
  issue edit, issue comment, issue reopen)
- `uv` (Python backend: sync, ruff, mypy, pytest)
- `bun` (frontend: install, biome, tsc, vitest)
- `git` (fetch, reset, checkout, worktree management, clean)
- `curl` (health checks)

#### GitHub / GitHub CLI Dependencies
- `gh pr view` — fetch PR metadata (holdout: no comments, no reviews)
- `gh pr diff` — fetch diff (capped at 3000 lines)
- `gh pr checkout` — check out PR branch
- `gh pr edit` — add/remove labels (`factory:needs-review`, `factory:needs-human`,
  `factory:needs-fix`)
- `gh pr close` — close rejected PRs
- `gh pr review` — post formal GitHub review (approve / request_changes)
- `gh issue view` — fetch linked issue (holdout: title, body, labels only — NO comments)
- `gh issue edit` — add `factory:needs-human` label on escalation
- `gh issue comment` — post result comment
- `gh issue reopen` — re-queue rejected issue for another implementation attempt
- `git show origin/main:<path>` — read governance files from base branch (poison immunity)

#### Risky Actions
- `gh pr close` — closes rejected PRs permanently
- `gh issue reopen` — reopens issues after PR rejection
- `git checkout -- .archon/ .claude/` + `git checkout origin/main -- .archon/ .claude/` —
  overwrites infra files in the worktree
- `git clean -fd .archon/ .claude/` — deletes untracked infra files
- `git worktree remove --force` — removes stale worktrees
- `kill $PID` — kills backend/frontend processes on teardown
- `git reset --hard` — hard reset to specific refs

#### Governance Patterns Worth Preserving
- **Holdout Principle (6 layers):**
  1. Cross-workflow isolation (separate `$ARTIFACTS_DIR` and worktree)
  2. Holdout-safe fetches (`gh pr view` excludes comments/reviews)
  3. Poison immunity — governance files read from `origin/main` BEFORE `gh pr checkout`
  4. Fresh context + empty `allowed_tools` on behavioral/security reviewer nodes
  5. Command-file explicit prohibitions listed in each AI node's `.md` file
  6. Fix/validate session isolation — fixer's reasoning never leaks into pass-2 reviewers
- **`verify-holdout-clean` tripwire:** Fails loudly if fix-workflow artifacts (plan.md,
  investigation.md, etc.) exist in `$ARTIFACTS_DIR` before validation begins.
- **Infra-failure "Rule 0":** `synthesize-verdict` must detect and report when
  infrastructure failures (app boot failure, dep install failure) caused scenario skips,
  and use `should_escalate: true` + `reject` rather than filing false positives.
- **Stale worktree prune pattern:** Before `gh pr checkout`, the workflow prunes worktrees
  holding the PR branch (e.g., left by a prior fix-github-issue run), skipping self to
  avoid corrupting the current worktree.
- **Fixed backend port (8000) + dynamic frontend port** (range 15100–15999).
- **Mypy cache warm-up** in `install-deps`: cold mypy exceeds the bash timeout; warming the
  cache in setup makes subsequent static-check nodes fast.
- **Two-pass verdict state machine:** Pass-1 verdict → if `request_changes`, run
  `fix-issues` (fresh context) → re-run all reviewers (pass-2, fresh contexts) →
  synthesize pass-2 verdict. If pass-2 still `request_changes`, escalate to human.
- **3 verdict outcomes:** `approve` (merge), `request_changes` (fix loop), `reject`
  (close PR + re-queue issue). Reject with `should_escalate: true` leaves PR open for human.
- **Validation env (`/opt/dark-factory/validation.env`):** Same pattern as comprehensive-test;
  required secrets loaded at `start-app`; missing vars fail fast with clear message.
- **`trigger_rule: all_done` on teardown:** App always shut down even if reviewers fail.
- **Governance files injected from `origin/main`:** `.archon/` and `.claude/` directories
  synced from main after PR checkout so the validator always uses current workflow/command
  versions, not potentially stale PR branch versions.
- **PR size enforcement reference:** FACTORY_RULES.md §3 caps PRs at 500 changed lines;
  the diff fetch caps at 3000 lines as a defense-in-depth backstop.
- **RAG invariant guard** referenced in validation command (dark-factory-validate): ensures
  the video library / RAG pipeline is not regressed.

#### Repo-Specific Assumptions
- App structure: `app/backend/` (FastAPI), `app/frontend/` (Vite/React/TypeScript)
- Backend health: `GET /api/health`
- Vite proxy hardcoded to `localhost:8000`
- `uv`, `bun`, `agent-browser` on PATH on VPS
- `/opt/dark-factory/validation.env` (overridable via `$DARK_FACTORY_VALIDATION_ENV`)
- `MISSION.md`, `FACTORY_RULES.md`, `CLAUDE.md` in repo root on `main`
- PR must contain `Fixes/Closes/Resolves #N` in its body to link to an issue
- Factory label system: `factory:needs-review`, `factory:needs-human`, `factory:needs-fix`
- `agent-browser` maintains a single shared browser session per host; parallel E2E impossible

---

### 5. `minimax-smoke.yaml`

**Name:** `minimax-smoke`  
**Provider/Model:** `claude` / `sonnet`  
**Size:** ~411 bytes

#### Purpose
Minimal one-node smoke test to verify that the MiniMax M2.7 model is being routed correctly
instead of the Anthropic API. Not part of the self-healing factory pipeline.

#### Node IDs
| ID | Type |
|----|------|
| `ping` | `prompt` (inline) |

#### Node Types
- `prompt` (inline prompt, no tools)

#### Providers / Models
- Inherits `claude` / `sonnet` from root (used to verify a different model is actually
  being served)
- `maxBudgetUsd: 0.10` — hard budget cap

#### Tools Used
- None (`allowed_tools: []` implicitly via no tool grants)

#### GitHub / GitHub CLI Dependencies
- None

#### Risky Actions
- None

#### Governance Patterns Worth Preserving
- `maxBudgetUsd` hard cap on a utility/debug node — good pattern for smoke tests
- Inline prompt is acceptable for trivial, non-AI-driven checks

#### Repo-Specific Assumptions
- Only meaningful if MiniMax routing is configured in the Archon harness
- Not a production workflow — purely diagnostic

---

## Import Candidate Assessment

| Workflow | Import Candidate? | Notes |
|----------|-------------------|-------|
| `dark-factory-comprehensive-test` | **YES** | Generalizable: the self-healing regression loop (test → file issue → triage → fix → validate) is a reusable pattern. Requires adaptation: agent-browser scenarios and command files are DynaChat-specific; port/stack assumptions need updating. |
| `dark-factory-fix-github-issue` | **YES** | Drop-in replacement for `archon-fix-github-issue` for Python+Bun stacks. Key patterns (bridge-artifacts, capture-pr-number, cleanup-issue-label with all_done, all-command-file rule) are generic and worth adopting. |
| `dark-factory-triage` | **YES** | Flood protection + two-verdict triage is a strong, reusable governance pattern. Requires: MISSION.md + FACTORY_RULES.md in target repo, pre-created label taxonomy, hardcoded owner login to update. |
| `dark-factory-validate-pr` | **YES (with effort)** | Most sophisticated workflow. The holdout principle, 6-layer isolation, two-pass fix loop, and stale-worktree-prune are all highly reusable. Requires: significant adaptation for non-DynaChat stacks (static check commands, ports, validation env). |
| `minimax-smoke` | **NO** | Repo/provider-specific diagnostic. No general value. |

---

## Key Cross-Cutting Patterns

These patterns appear across multiple Dark Factory workflows and are worth standardizing in
any project that imports from this collection:

1. **All-command-file rule** — no inline prompts in AI nodes; all reference `.md` command
   files in `.archon/commands/`. Enables version control and independent evolution of prompts
   vs. DAG structure.

2. **Holdout principle** — validators never see implementation artifacts, coder rationale,
   or PR comments. Enforced via: fresh context, `allowed_tools: []` on reviewers, fetching
   governance from `origin/main` before checkout, and `verify-holdout-clean` tripwire.

3. **`trigger_rule: all_done` on teardown** — infrastructure teardown always runs regardless
   of upstream failures. Pattern: `teardown` depends on all scenario/test nodes with
   `trigger_rule: all_done`.

4. **`trigger_rule: one_success` on bridge/synthesize** — used after conditional branches
   (investigate vs. plan, or multiple optional review agents) to fan back in without
   requiring all branches to complete.

5. **Infra-failure Rule 0** — count expected evidence files before taking any destructive
   or external action (filing issues, posting reviews). If fewer than expected exist, the
   workflow self-reports an infra failure rather than propagating false results.

6. **Deterministic artifact capture** — write `.pr-number`, `.backend-port`,
   `.frontend-port` to `$ARTIFACTS_DIR` in bash nodes so downstream nodes read reliably
   rather than parsing AI output.

7. **Flood / rate-limit protection** — non-owner accounts capped per UTC day; implemented
   idempotently with label checks before applying.

8. **Validation env file pattern** — secrets loaded from an out-of-repo file at a known
   path (overridable via env var). Missing vars → fast, clear error, not silent hang.

9. **Stale worktree prune** — before `gh pr checkout`, detect and force-remove any other
   worktree holding the same branch; skip self-removal.

10. **Haiku for classification** — `classify-issue` and `review-classify` use `haiku` with
    `allowed_tools: []` and `output_format` JSON schema. Fast, cheap, structured.

---

*No local workflow YAML files were modified. No DB code was touched. No workflows were run.*
