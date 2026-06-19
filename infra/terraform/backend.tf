# Remote state in Azure Storage so the state is shared and locked (blob lease)
# instead of living on one laptop. The storage account + container are created
# once by ./bootstrap (chicken-and-egg: the backend can't create its own home).
#
# Values are intentionally left as a PARTIAL config — supply them at init time
# with `terraform init -backend-config=backend.hcl` (see backend.hcl.example).
# That keeps the globally-unique storage account name out of version control.
terraform {
  backend "azurerm" {
    container_name = "tfstate"
    key            = "prod.terraform.tfstate"
  }
}
