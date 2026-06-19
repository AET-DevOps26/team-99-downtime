# Authenticates via a service principal. In CI these come from the
# AZURE_CREDENTIALS secret, exported as ARM_CLIENT_ID / ARM_CLIENT_SECRET /
# ARM_SUBSCRIPTION_ID / ARM_TENANT_ID before `terraform` runs. Locally you can
# instead just `az login` and Terraform will pick up that session.
provider "azurerm" {
  features {}
}
