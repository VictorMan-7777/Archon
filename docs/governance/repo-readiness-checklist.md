# Repo Readiness Checklist

Purpose: ensure a repository is safe, governed, and operationally clean before Archon workflows or automation begin.

## Core principle

Filesystem hygiene before Git trust.

A repository is not Archon-ready until contamination artifacts are removed or quarantined, ownership/permissions are validated, Git trust is established, remotes are verified, and execution boundaries are defined.

## Checklist

1. Verify intended repo path and canonical storage location.
2. Scan for `.DS_Store`, `._*`, `@eaDir`, `*.swp`, `*.swo`, and `*~`.
3. Preserve a quarantine/evidence list before bulk cleanup.
4. Validate ownership and permissions.
5. Confirm `.git` exists and `git fsck --no-dangling` passes.
6. Configure `safe.directory` inside any containerized Git execution surface before registering or running the repo.
7. Validate no stale or cross-environment credential helpers remain.
8. Verify remotes:
   - `origin` = governed fork
   - `upstream` = canonical upstream
9. Review all untracked/modified files and classify them before committing.
10. Configure repo-local commit identity.
11. Push to the governed fork and verify branch tracking.

## Operational lessons

- NAS is canonical storage and container runtime.
- Mac Studio is the primary GitHub/Git execution surface when NAS DNS/build/network is unreliable.
- Containerized Git may need `safe.directory`.
- Synology metadata contamination is a routine preflight concern.
- Readiness gates must happen before Archon workflow execution.
