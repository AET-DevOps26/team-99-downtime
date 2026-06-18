output "public_ip" {
  description = "Public IP of the VM. Use as the Ansible inventory host / VM_HOST secret."
  value       = azurerm_public_ip.main.ip_address
}

output "fqdn" {
  description = "Public DNS name (only when dns_label is set), else null."
  value       = azurerm_public_ip.main.fqdn
}

output "ssh_command" {
  description = "Ready-to-run SSH command."
  value       = "ssh ${var.admin_username}@${azurerm_public_ip.main.ip_address}"
}

output "app_host" {
  description = "Host Ansible/Caddy should treat as the public origin (FQDN if set, else IP)."
  value       = azurerm_public_ip.main.fqdn != null ? azurerm_public_ip.main.fqdn : azurerm_public_ip.main.ip_address
}
