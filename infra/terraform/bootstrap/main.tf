# One-time bootstrap: creates the Azure Storage account + container that holds
# the REMOTE state for the main configuration (../). This config itself uses
# LOCAL state (committed nowhere — see .gitignore) because it has to exist
# before a remote backend can.
#
# Run once:
#   cd infra/terraform/bootstrap
#   terraform init && terraform apply
#   # then copy the printed values into ../backend.hcl

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

provider "azurerm" {
  features {}
}

variable "location" {
  type    = string
  default = "germanywestcentral"
}

variable "resource_group_name" {
  type    = string
  default = "t99-tfstate-rg"
}

variable "storage_account_name" {
  type        = string
  description = <<-EOT
    Globally-unique storage account name: 3-24 chars, lowercase letters/digits
    only. e.g. "t99tfstate" + a few random chars.
  EOT
}

resource "azurerm_resource_group" "tfstate" {
  name     = var.resource_group_name
  location = var.location
}

resource "azurerm_storage_account" "tfstate" {
  name                            = var.storage_account_name
  resource_group_name             = azurerm_resource_group.tfstate.name
  location                        = azurerm_resource_group.tfstate.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false

  blob_properties {
    versioning_enabled = true
  }

  # Restrict public network access. Add ip_rules or virtual_network_subnet_ids
  # here if CI runners need to reach this storage account directly (e.g. for
  # remote state operations from outside Azure).
  network_rules {
    default_action = "Deny"
    bypass         = ["AzureServices"]
  }
}

resource "azurerm_storage_container" "tfstate" {
  name                  = "tfstate"
  storage_account_id    = azurerm_storage_account.tfstate.id
  container_access_type = "private"
}

output "backend_config" {
  description = "Paste these into ../backend.hcl"
  value       = <<-EOT
    resource_group_name  = "${azurerm_resource_group.tfstate.name}"
    storage_account_name = "${azurerm_storage_account.tfstate.name}"
  EOT
}
