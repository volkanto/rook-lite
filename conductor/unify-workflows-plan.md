# Unify Release and Deployment Workflows, Add PR CI Checks & Automate Versioning

## Objective
1. Consolidate `.github/workflows/deploy-cloudflare.yml` and `.github/workflows/release.yml` into a single, unified release pipeline.
2. Ensure releases trigger strictly when tags start with `v*` (dropping other regexes).
3. Automate `package.json` version bumps with support for **both**:
   - **Local CLI**: `npm run release:<patch|minor|major>` script that bumps `package.json`, commits, tags, and pushes.
   - **GitHub UI**: `workflow_dispatch` trigger in Actions allowing users to choose `patch`, `minor`, or `major`, which bumps `package.json`, pushes the commit & tag, and continues the release.
4. Add a CI workflow (`.github/workflows/ci.yml`) that runs tests, typechecks, and build verification on all Pull Requests targeting `main` to block merging when checks fail.
5. Delete `.github/workflows/deploy-cloudflare.yml`.
6. Implement all changes on branch `chore/unify-release-workflows`.

## Key Files
- `Modify`: `package.json` (add release scripts)
- `Create`: `.github/workflows/ci.yml` (PR check workflow)
- `Modify`: `.github/workflows/release.yml` (unified versioning, test, Docker release, and Cloudflare deploy pipeline)
- `Delete`: `.github/workflows/deploy-cloudflare.yml`
- `Doc`: `conductor/unify-workflows-plan.md`

## Detailed Implementation Steps

### 1. Update `package.json`
Add convenience release scripts:
```json
"release:patch": "npm version patch && git push --follow-tags",
"release:minor": "npm version minor && git push --follow-tags",
"release:major": "npm version major && git push --follow-tags"
```

### 2. Create CI workflow (`.github/workflows/ci.yml`)
- Trigger:
  ```yaml
  on:
    pull_request:
      branches: [ main ]
    push:
      branches: [ main ]
  ```
- Steps:
  - Checkout repository (`actions/checkout@v4`)
  - Setup Node.js 22 with npm cache (`actions/setup-node@v4`)
  - `npm ci`
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
- Produces a failing status check if any step fails, blocking PR merges when enforced in branch protection.

### 3. Update Unified Release Workflow (`.github/workflows/release.yml`)
- Triggers:
  ```yaml
  on:
    push:
      tags:
        - 'v*'
    workflow_dispatch:
      inputs:
        bump:
          description: 'Version bump type (when running manually without pre-existing tag)'
          required: true
          default: 'patch'
          type: choice
          options:
            - patch
            - minor
            - major
  ```
- Permissions:
  ```yaml
  permissions:
    contents: write
    packages: write
  ```
- **Job 1: `prepare-version`**
  - If `workflow_dispatch`:
    - Checks out `main`
    - Sets git user (`github-actions[bot]`)
    - Runs `npm version ${{ inputs.bump }} -m "chore(release): %s [skip ci]"`
    - Pushes commit and tag to `main` via `git push origin HEAD:main --follow-tags`
    - Outputs new tag name
  - If `push` (tag already created via `npm run release:*`):
    - Outputs `tag = github.ref_name`
- **Job 2: `test`** (`needs: prepare-version`)
  - Checks out ref `${{ needs.prepare-version.outputs.tag }}`
  - Sets up Node.js 22, runs `npm ci`, `npm run typecheck`, `npm test`, `npm run build`
  - Uploads `dist` folder via `actions/upload-artifact@v4` with name `app-dist` (retention-days: 1)
- **Job 3: `docker-release`** (`needs: [prepare-version, test]`)
  - Checks out ref `${{ needs.prepare-version.outputs.tag }}`
  - Sets up QEMU & Docker Buildx
  - Logs in to GHCR
  - Extracts Docker metadata using the version tag
  - Builds & pushes multi-arch Docker image (`linux/amd64,linux/arm64`)
  - Creates GitHub Release via `softprops/action-gh-release@v2` targeting `${{ needs.prepare-version.outputs.tag }}`
- **Job 4: `cloudflare-deploy`** (`needs: docker-release`)
  - Downloads `app-dist` artifact to `dist/`
  - Verifies `dist/index.html` exists
  - Runs `cloudflare/wrangler-action@v4` to deploy `dist` to Cloudflare Pages
  - Concurrency group `cloudflare-pages` ensures orderly deployments

### 4. Remove Redundant Workflow
- Remove `.github/workflows/deploy-cloudflare.yml`.

## Verification Plan
1. Local lint/syntax validation of YAML workflow files.
2. Run `npm run typecheck` and `npm test` locally to ensure no pre-existing issues.
3. Review branch git diff to verify all secrets, permissions, tag triggers, and job dependencies are wired properly.
