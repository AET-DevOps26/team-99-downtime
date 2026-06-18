variable "prefix" {
  type        = string
  description = "Short name prefix for all resources."
  default     = "t99"
}

variable "location" {
  type        = string
  description = "Azure region to deploy into. Azure-for-Students allows: austriaeast, spaincentral, germanywestcentral, uaenorth, italynorth. Most small SKUs are capacity-restricted except in spaincentral zone 2."
  default     = "spaincentral"
}

variable "availability_zone" {
  type        = string
  description = "Availability zone for the VM and its public IP. spaincentral has capacity in zone 2 for the student subscription."
  default     = "2"
}

variable "resource_group_name" {
  type        = string
  description = "Resource group that holds the VM and its network."
  default     = "t99-prod-rg"
}

variable "vm_size" {
  type        = string
  description = <<-EOT
    VM size. The stack runs three JVM services + Postgres + genai + auth + client,
    so 8 GB of RAM is a sensible floor. Standard_D2s_v3 = 2 vCPU / 8 GB. Note most
    burstable B-series SKUs are capacity-restricted for the student subscription.
  EOT
  default     = "Standard_D2s_v3"
}

variable "admin_username" {
  type        = string
  description = "Admin user created on the VM (used by Ansible over SSH)."
  default     = "azureuser"
}

variable "ssh_public_key" {
  type        = string
  description = "SSH public key authorized for admin_username (contents of your .pub file)."
}

variable "dns_label" {
  type        = string
  description = <<-EOT
    Optional DNS label. If set, the VM gets the public FQDN
    <dns_label>.<location>.cloudapp.azure.com — handy for Caddy automatic HTTPS.
    Leave empty to use the bare public IP.
  EOT
  default     = ""
}

variable "os_disk_size_gb" {
  type        = number
  description = "OS disk size in GB."
  default     = 30
}

variable "allowed_ssh_cidr" {
  type        = string
  description = <<-EOT
    CIDR allowed to reach SSH (port 22). Defaults to the whole internet for
    convenience; tighten to your IP/32 or the GitHub Actions ranges in real use.
  EOT
  default     = "0.0.0.0/0"
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to every resource."
  default = {
    project = "team-99-downtime"
    env     = "prod"
    managed = "terraform"
  }
}
