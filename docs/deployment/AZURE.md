# Azure VM Deployment

The Azure environment is a **single VM** running the whole stack under Docker
Compose, provisioned with Terraform and configured with Ansible. It is
independent of the Kubernetes deployment - same images, different target.

```
Terraform  ──▶  Azure VM (Ubuntu, Standard_D2s_v3)
                  │
Ansible    ──▶    ├── Docker Engine + compose plugin
                  ├── /opt/t99/{docker-compose.yml, .env, Caddyfile}
                  └── systemd unit "t99"  ──▶  docker compose up -d
                                                 │
                                                 ├── caddy      :80 / :443  (TLS, reverse proxy)
                                                 ├── client, auth, transaction,
                                                 │   budget, notification, genai
                                                 └── postgres   (named volume)
```

Caddy is the only container with published ports. Everything else talks over the
internal `team99` network, so the services are not reachable from the internet
directly.

Live: <https://expenseflow.spaincentral.cloudapp.azure.com>

## Prerequisites

| Tool            | Used for                                           |
| --------------- | -------------------------------------------------- |
| `az` CLI        | Azure auth (`az login`)                            |
| Terraform ≥ 1.5 | Provisioning the VM and its network                |
| Ansible         | Configuring the VM and deploying (`ansible-core`)  |
| An SSH key pair | VM admin access; the public half goes to Terraform |

Azure auth is either `az login` locally, or a service principal via the `ARM_*`
environment variables.

## One-time provisioning

### 1. State backend

Terraform state lives in Azure Storage rather than on one laptop. The storage
account cannot create itself, so a small bootstrap stack does it first.

```sh
cd infra/terraform/bootstrap
terraform init
terraform apply -var storage_account_name=t99tfstate$RANDOM
```

Copy the printed `backend_config` output into `infra/terraform/backend.hcl`:

```hcl
resource_group_name  = "..."
storage_account_name = "..."
```

### 2. The VM

```sh
cd infra/terraform
echo 'ssh_public_key = "ssh-ed25519 AAAA... you@host"' > terraform.tfvars
terraform init -backend-config=backend.hcl
terraform apply
terraform output          # public_ip, fqdn, app_host, ssh_command
```

Defaults worth knowing (`infra/terraform/variables.tf`):

| Variable            | Default           | Note                                                           |
| ------------------- | ----------------- | -------------------------------------------------------------- |
| `location`          | `spaincentral`    | Azure-for-Students is capacity-restricted in most regions      |
| `availability_zone` | `2`               | The zone with capacity for the student subscription            |
| `vm_size`           | `Standard_D2s_v3` | 2 vCPU / 8 GB - the floor for three JVM services plus Postgres |
| `admin_username`    | `azureuser`       | The user Ansible connects as                                   |
| `dns_label`         | `""`              | Set it to get a public FQDN; see [HTTPS](#networking--https)   |
| `allowed_ssh_cidr`  | `0.0.0.0/0`       | Tighten to your own IP for anything real                       |

The network security group opens **22, 80 and 443** only.

The Terraform layout itself:

| Path                         | What                                                     |
| ---------------------------- | -------------------------------------------------------- |
| `infra/terraform/bootstrap/` | Storage account + container for remote state (run once)  |
| `infra/terraform/`           | Resource group, VNet, NSG, public IP, VM                 |
| `backend.tf`                 | Partial azurerm backend - values supplied at `init` time |
| `variables.tf`               | Region, VM size, SSH key, DNS label, allowed SSH CIDR    |
| `outputs.tf`                 | `public_ip`, `fqdn`, `app_host`, `ssh_command`           |

### 3. Point GitHub at the VM

Add the secrets and variable below, and every release deploys itself.

## Required GitHub Actions secrets

| Secret                 | Value                                                     |
| ---------------------- | --------------------------------------------------------- |
| `VM_HOST`              | The VM's public IP (Terraform output `public_ip`)         |
| `VM_SSH_PRIVATE_KEY`   | Private key matching the `ssh_public_key` you provisioned |
| `POSTGRES_PASSWORD`    | Database password                                         |
| `BETTER_AUTH_SECRET`   | Better Auth signing secret (`openssl rand -base64 32`)    |
| `GOOGLE_CLIENT_ID`     | Google login - optional, needs an HTTPS origin            |
| `GOOGLE_CLIENT_SECRET` | Google login - optional                                   |
| `LLM_API_KEY`          | Logos gateway key for genai-service                       |

Pulling the images from GHCR uses the job's built-in `GITHUB_TOKEN` - no secret
needed for that.

**Repository variable** `APP_DOMAIN` (not a secret): the VM's public FQDN. It
drives both Caddy's TLS and the browser-facing origin. See below.

## Application configuration

There is no `.env` to write by hand. Ansible renders `/opt/t99/.env` on the VM
from `infra/ansible/roles/app/templates/app.env.j2`, filling it with the
`--extra-vars` that the deploy workflow passes from the secrets above. The file
is written `0600` and marked `no_log`, so it never lands in CI output.

Non-secret defaults live in `infra/ansible/roles/app/defaults/main.yml`
(`app_dir`, `registry`, `postgres_user`, ...) and rarely change.

`PUBLIC_ORIGIN` is derived, not configured: it becomes `https://<APP_DOMAIN>`
when the domain is set, and `http://<vm-ip>` otherwise. Better Auth uses it for
OAuth redirects, cookies and as the token issuer.

## CI/CD

`cd.yml` runs on every push to `main`. It builds and publishes the images to
GHCR, cuts a release, then calls the reusable `deploy.yml`, which:

1. installs Ansible and writes the SSH key from `VM_SSH_PRIVATE_KEY`
2. generates an inventory pointing at `VM_HOST`
3. runs `infra/ansible/playbook.yml` with the release tag and the secrets

The playbook is **idempotent** - a run with no image or config change leaves the
stack untouched. The `app` role renders the compose file, `.env`, `Caddyfile` and
a `t99` systemd unit, logs in to GHCR, pulls the released images, and restarts
the stack only if something actually changed.

## Manual deploy and rollback

Both go through the same workflow. In GitHub Actions, run **Deploy to Azure VM**
and give it an image tag:

- a specific version to roll back or forward: `0.3.1`
- `latest` (the default) to redeploy the newest release

Or from a laptop with the SSH key and Azure access:

```sh
cd infra/ansible
cat > inventory.ini <<'EOF'
[t99]
<vm-ip>

[t99:vars]
ansible_user=azureuser
ansible_ssh_private_key_file=~/.ssh/id_ed25519
EOF

ansible-playbook playbook.yml \
  --extra-vars "app_image_tag=0.3.1" \
  --extra-vars "domain=$APP_DOMAIN" \
  --extra-vars "postgres_password=..." \
  --extra-vars "better_auth_secret=..." \
  --extra-vars "llm_api_key=..." \
  --extra-vars "ghcr_user=<github-user>" \
  --extra-vars "ghcr_token=<github-pat-with-read:packages>"
```

## Operations

```sh
ssh azureuser@<vm-ip>

cd /opt/t99
sudo docker compose ps                        # what is running
sudo docker compose logs -f caddy             # or any service
sudo docker compose logs --since 15m auth-service

sudo systemctl restart t99                    # re-up the whole stack
sudo systemctl status t99
```

The stack is a systemd unit, so it comes back on reboot. `docker compose down`
by hand will be undone by the unit on the next restart - use `systemctl stop t99`
if you really want it down.

### Troubleshooting

| Symptom                           | Cause and fix                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| Every `/api/auth/*` route 404s    | `APP_DOMAIN` has a scheme. Use the bare hostname, no `https://`                                  |
| Browser shows a TLS warning       | DNS is not pointing at the VM yet, so Caddy could not complete the ACME challenge. Check port 80 |
| `docker compose pull` fails in CI | The GHCR login step failed; the images are private and need `packages: read`                     |
| A service restarts in a loop      | `sudo docker compose logs <service>` - usually a missing secret in `.env`                        |
| Postgres data vanished            | Only `docker compose down -v` removes the `postgres_data` volume. Never pass `-v` on the VM      |

## Networking & HTTPS

Terraform's `dns_label` gives the public IP an Azure FQDN:

```
<dns_label>.<location>.cloudapp.azure.com
```

Set the same value as the **`APP_DOMAIN`** repository variable. Ansible then
renders the Caddyfile with that hostname as the site address, and Caddy
provisions a Let's Encrypt certificate automatically on first request,
redirecting `:80` to `:443`.

> `APP_DOMAIN` must be the **bare hostname**. A value like
> `https://expenseflow.spaincentral.cloudapp.azure.com` is written straight into
> the Caddyfile as a site address, where the scheme breaks routing and every
> Better Auth route answers 404.

Leave `APP_DOMAIN` empty and Caddy serves plain HTTP on the bare IP, which is
fine for a smoke test but not for Google login - OAuth requires HTTPS.

## Where things live

| Path                           | What                                        |
| ------------------------------ | ------------------------------------------- |
| `infra/terraform/`             | VM, network, NSG, public IP                 |
| `infra/terraform/bootstrap/`   | The storage account holding Terraform state |
| `infra/ansible/`               | `docker` and `app` roles, playbook          |
| `docker-compose.prod.yaml`     | The stack Ansible copies to the VM          |
| `.github/workflows/deploy.yml` | The reusable deploy job                     |

See [KUBERNETES.md](KUBERNETES.md) for the cluster deployment.
