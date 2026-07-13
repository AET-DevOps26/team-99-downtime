# Terraform (Azure VM)

Terraform provisions the Azure VM that the Compose stack runs on. For the full
picture - provisioning, deploying, secrets, operations, HTTPS - see
**[AZURE.md](AZURE.md)**. This page covers the Terraform layout only.

## Layout

| Path                         | What                                                     |
| ---------------------------- | -------------------------------------------------------- |
| `infra/terraform/bootstrap/` | Storage account + container for remote state (run once)  |
| `infra/terraform/`           | Resource group, VNet, NSG, public IP, VM                 |
| `backend.tf`                 | Partial azurerm backend - values supplied at `init` time |
| `variables.tf`               | Region, VM size, SSH key, DNS label, allowed SSH CIDR    |
| `outputs.tf`                 | `public_ip`, `fqdn`, `app_host`, `ssh_command`           |

State lives in Azure Storage so it is shared and lease-locked instead of sitting
on one laptop. The backend cannot create its own home, hence the separate
bootstrap stack.

## Apply

```bash
# 1. state backend (creates the storage account for remote state)
cd infra/terraform/bootstrap
terraform init && terraform apply -var storage_account_name=t99tfstate$RANDOM
# copy the printed backend_config into ../backend.hcl

# 2. the VM itself
cd infra/terraform
echo 'ssh_public_key = "ssh-ed25519 AAAA... you@host"' > terraform.tfvars
terraform init -backend-config=backend.hcl
terraform apply
terraform output                               # public_ip, fqdn, ssh_command
```

Azure auth: `az login` (local) or a service principal via `ARM_*` env vars.

## Notes

- `location` defaults to `spaincentral` zone 2 - most other regions and SKUs are
  capacity-restricted on the Azure-for-Students subscription.
- `dns_label` is optional. Setting it gives the VM an
  `<dns_label>.<location>.cloudapp.azure.com` FQDN, which Caddy needs for
  automatic HTTPS. Feed the same value to the `APP_DOMAIN` repository variable.
- `allowed_ssh_cidr` defaults to `0.0.0.0/0`. Tighten it for anything real.
- The NSG opens 22, 80 and 443 only.
