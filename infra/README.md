# Infrastructure & Deployment

Single Azure VM, **Terraform → Ansible → Docker Compose**:

- `infra/terraform` — provisions the VM + network (run manually).
- `infra/ansible` — installs Docker, renders the prod stack, runs it via a systemd unit.
- `.github/workflows/cd.yml` (`deploy` job) — re-runs Ansible on every release.

## Provision the VM (one-time)

```bash
# 1. state backend (creates the storage account for remote state)
cd infra/terraform/bootstrap
terraform init && terraform apply -var storage_account_name=t99tfstate$RANDOM
# copy the printed values into ../backend.hcl

# 2. the VM itself
cd infra/terraform
echo 'ssh_public_key = "ssh-ed25519 AAAA... you@host"' > terraform.tfvars
terraform init -backend-config=backend.hcl
terraform apply
terraform output                               # public_ip, ssh_command
```

Azure auth: `az login` (local) or a service principal via `ARM_*` env vars.

## Required GitHub Actions secrets

| Secret                                      | Purpose                                         |
| ------------------------------------------- | ----------------------------------------------- |
| `VM_HOST`                                   | VM public IP (Terraform `public_ip`).           |
| `VM_SSH_PRIVATE_KEY`                        | Private key matching `ssh_public_key`.          |
| `POSTGRES_PASSWORD`                         | DB password.                                    |
| `BETTER_AUTH_SECRET`                        | Better Auth signing secret.                     |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google login (optional; needs an HTTPS domain). |

GHCR pull uses the job's built-in `GITHUB_TOKEN`. Optional repo variable `APP_DOMAIN`
(must match Terraform `dns_label`) enables Caddy HTTPS.

## Operations

```bash
ssh azureuser@<vm-ip>
cd /opt/t99 && sudo docker compose ps
sudo systemctl restart t99      # re-up the stack
```
