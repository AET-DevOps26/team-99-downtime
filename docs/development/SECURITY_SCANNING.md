# Security Scanning

Security scanning runs in [`security-pr.yml`](../../.github/workflows/security-pr.yml) on every pull request and in [`security-nightly.yml`](../../.github/workflows/security-nightly.yml) nightly and on manual dispatch. Findings appear in the GitHub **Security → Code Scanning** tab and as inline annotations on PR diffs.

## Tools

| Tool                                                         | Job            | Category                          | Blocks merge        |
| ------------------------------------------------------------ | -------------- | --------------------------------- | ------------------- |
| [typos](https://github.com/crate-ci/typos)                   | `spelling`     | Spell checking                    | Yes                 |
| [actionlint](https://github.com/rhysd/actionlint)            | `workflows`    | Workflow correctness              | Yes                 |
| [Zizmor](https://github.com/woodruffw/zizmor)                | `workflows`    | Workflow security                 | Yes                 |
| [Hadolint](https://github.com/hadolint/hadolint)             | `containers`   | Dockerfile lint                   | Yes                 |
| [tflint](https://github.com/terraform-linters/tflint)        | `iac`          | Terraform lint                    | Yes                 |
| [KICS](https://github.com/Checkmarx/kics)                    | `iac`          | IaC misconfiguration              | Yes (high/critical) |
| [GitLeaks](https://github.com/gitleaks/gitleaks)             | `secrets`      | Secret detection (git history)    | No — report only    |
| [Trivy](https://github.com/aquasecurity/trivy) (secret mode) | `secrets`      | Secret detection (filesystem)     | No — report only    |
| [Semgrep](https://github.com/semgrep/semgrep)                | `sast`         | SAST                              | No — report only    |
| [Trivy](https://github.com/aquasecurity/trivy) (vuln mode)   | `dependencies` | Dependency vulnerabilities + SBOM | No — report only    |

### Why each tool was chosen

**typos** — Fast binary with near-zero false positives. Catches typos in code identifiers, comments, and docs before they end up in published APIs or user-facing strings.

**actionlint** — Statically checks workflow YAML for syntax errors, invalid expressions, wrong `needs` references, and incorrect context usage. Catches issues the GitHub Actions parser won't surface until runtime.

**Zizmor** — Security-focused companion to actionlint. Detects script injection via untrusted PR inputs (e.g. `${{ github.event.pull_request.title }}` in `run:` steps), excessive token permissions, and unpinned action references.

**Hadolint** — Lints `Dockerfile` authoring best practices (pinned base images, no `apt-get upgrade`, correct `COPY` usage, etc.). Trivy scans the _built_ image for vulnerabilities; Hadolint prevents the bad practices from entering the `Dockerfile` in the first place.

**tflint** — Terraform linter with the `azurerm` provider ruleset. Catches provider-specific issues like deprecated resource types and invalid argument combinations that `terraform validate` misses.

**KICS** — Scans all IaC formats in the repo (Terraform, Helm, Docker Compose, raw K8s YAML) for security misconfigurations against a large rule library. More IaC-focused than Trivy's misconfiguration scanner.

**GitLeaks** — Scans the full git history for accidentally committed secrets. Complements Trivy's point-in-time filesystem scan by catching secrets that were introduced and then removed in later commits.

**Trivy (secret)** — Point-in-time secret scanner on the current filesystem state. Complements GitLeaks.

**Semgrep** — SAST tool that matches code patterns against security rule packs for Java, TypeScript, and Python. Catches issues like SQL injection patterns, unsafe deserialization, and XSS sinks that dependency scanners cannot find.

**Trivy (vuln + SBOM)** — Scans all package manifests (Java/Gradle, Python/uv, Node/bun) for known CVEs via the NVD and OSV databases. Also produces a source-level CycloneDX SBOM as a workflow artifact. This is complementary to (not a replacement for) the image-level SBOM generated in `cd.yml` — see below.

**Trivy + Cosign in `cd.yml`** — After each release build, Trivy scans every built container image _by digest_ and generates a CycloneDX SBOM reflecting what actually ended up in the image. Cosign attaches it to the image in GHCR using keyless signing (GitHub OIDC — no key management required). Verifiable with `cosign verify-attestation --type cyclonedx ghcr.io/<image>@<digest>`.

## Verifying attestations

Every container image released by `cd.yml` receives two attestations attached to its digest in GHCR:

| Attestation      | Tool                        | Predicate type                   | What it proves                                                     |
| ---------------- | --------------------------- | -------------------------------- | ------------------------------------------------------------------ |
| Build provenance | `actions/attest` + Sigstore | `https://slsa.dev/provenance/v1` | This digest was built by `cd.yml` on `main` from a specific commit |
| SBOM             | Trivy + cosign (keyless)    | `https://cyclonedx.org/bom`      | Full CycloneDX bill of materials for what ended up in the image    |

### Verify build provenance

```sh
gh attestation verify \
  oci://ghcr.io/aet-devops26/team-99-downtime/<image>@<digest> \
  --repo aet-devops26/team-99-downtime \
  --signer-workflow .github/workflows/cd.yml
```

Add `--format json | jq '.[0].verificationResult'` to see the full certificate fields (workflow path, commit SHA, run URL, timestamp).

### Inspect the SBOM

Install cosign if needed:

```sh
brew install cosign
```

Verify the SBOM attestation and decode it:

```sh
cosign verify-attestation \
  --type cyclonedx \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp "^https://github.com/AET-DevOps26/team-99-downtime/.github/workflows/cd\\.yml@" \
  ghcr.io/aet-devops26/team-99-downtime/<image>@<digest> \
  | jq -r '.payload | @base64d | fromjson | .predicate'
```

List all components and versions:

```sh
cosign verify-attestation \
  --type cyclonedx \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp "^https://github.com/AET-DevOps26/team-99-downtime/.github/workflows/cd\\.yml@" \
  ghcr.io/aet-devops26/team-99-downtime/<image>@<digest> \
  | jq -r '.payload | @base64d | fromjson | .predicate.components[] | "\(.name) \(.version)"'
```

Save the SBOM to a file (e.g. for upload to [Dependency-Track](https://dependencytrack.org/)):

```sh
cosign verify-attestation \
  --type cyclonedx \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp "^https://github.com/AET-DevOps26/team-99-downtime/.github/workflows/cd\\.yml@" \
  ghcr.io/aet-devops26/team-99-downtime/<image>@<digest> \
  | jq -r '.payload | @base64d | fromjson | .predicate' > sbom.cdx.json
```

### Find the digest for a released image

```sh
docker buildx imagetools inspect ghcr.io/aet-devops26/team-99-downtime/<image>:v1.2.3 \
  --format '{{json .Manifest}}' | jq -r '.digest'
```

Replace `v1.2.3` with the actual release tag. The canonical digest is also listed in the **Released Images** table in the `cd` workflow run summary.

## Trigger strategy

| Tier     | Jobs                                         | Triggers     | Merge behaviour                                                     |
| -------- | -------------------------------------------- | ------------ | ------------------------------------------------------------------- |
| 1 — fast | `spelling`, `workflows`, `containers`, `iac` | PR + nightly | Block on any finding                                                |
| 2 — deep | `secrets`, `sast`, `dependencies`            | PR + nightly | Report only (`continue-on-error: true` keeps findings non-blocking) |

The current blocking and report-only settings are defined separately in [`security-pr.yml`](../../.github/workflows/security-pr.yml) and [`security-nightly.yml`](../../.github/workflows/security-nightly.yml).

## Where findings appear

- **Security → Code Scanning tab** — persistent alerts, dismissible with a justification note. SARIF-producing tools (Hadolint, KICS, Trivy, Semgrep) upload here automatically.
- **PR Checks tab** — per-job pass/fail with log output.
- **PR diff annotations** — inline comments on lines touched by the PR (only for findings in changed files).

Tools without SARIF output (tflint, actionlint) write GitHub Actions annotations directly, which appear in the Checks tab and as PR annotations.

## Suppressing false positives

### typos

Add project-specific words to [`config/typos.toml`](../../config/typos.toml):

```toml
[default.extend-words]
# Identity mapping keeps the word as-is (both sides must match).
JULI = "JULI"  # German month name in test fixture data
```

Inline suppression is not supported; add to the config file instead.

### actionlint

Inline suppression on the line after the flagged expression:

```yaml
run: echo "${{ github.event.pull_request.title }}"
# actionlint ignore: expression-syntax
```

### Zizmor

Inline suppression with a comment on the flagged line:

```yaml
- run: echo "${{ github.event.pull_request.title }}" # zizmor: ignore[template-injection]
```

### Hadolint

Inline suppression above the flagged instruction:

```dockerfile
# hadolint ignore=DL3008
RUN apt-get install -y curl
```

Or add to a `.hadolint.yaml` file:

```yaml
ignore:
  - DL3008
```

### tflint

Inline annotation above the flagged block:

```hcl
# tflint-ignore: azurerm_resource_type_invalid
resource "azurerm_some_resource" "example" { ... }
```

### KICS

Inline suppression on the flagged line:

```yaml
# kics-scan ignore-line
some_insecure_field: value
```

Or suppress an entire file by adding a comment at the top:

```yaml
# kics-scan ignore-block
```

### GitLeaks

Inline suppression on the line with the false positive:

```
some_value = "not-actually-a-secret" # gitleaks:allow
```

To suppress historical findings on first run, generate a baseline and commit it:

```sh
gitleaks detect --source . --report-format json --report-path .gitleaks-baseline.json
```

Then reference it in the action via `--baseline-path .gitleaks-baseline.json`.

### Trivy

Add finding IDs (such as CVE, misconfiguration, or secret rule IDs) to an optional `.trivyignore` file at the repository root. Create it only when a real suppression is required:

```
# Accepted risk: no fix available upstream
CVE-2024-12345
```

### Semgrep

Inline suppression on the flagged line:

```java
String query = "SELECT * FROM users WHERE id = " + id; // nosemgrep: java.sql.injection
```

## Running tools locally

All tools can be installed locally to check before pushing.

```sh
# Spell check
cargo install typos-cli
typos

# Dockerfile lint
brew install hadolint
hadolint apps/*/Dockerfile

# Terraform lint
brew install tflint
cd infra/terraform && tflint --init && tflint

# Workflow lint
brew install actionlint
actionlint

# Zizmor
cargo install zizmor
zizmor .github/workflows/

# Secret scan
brew install gitleaks
gitleaks detect --source .

# SAST
pip install semgrep
semgrep scan --config p/java-security-audit --config p/typescript --config p/python .

# Vulnerability scan
brew install trivy
trivy fs .

# IaC scan (Docker image, ~1 GB)
docker run --rm -v "$(pwd):/path" checkmarx/kics:latest scan -p /path
```
