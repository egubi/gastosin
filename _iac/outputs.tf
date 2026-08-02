output "postgres_fqdn" {
  description = "Private FQDN of the PostgreSQL Flexible Server. Resolvable only within the VNet."
  value       = azurerm_postgresql_flexible_server.main.fqdn
}

output "container_app_environment_id" {
  description = "Resource ID of the Container Apps Environment. Use this when deploying individual Container Apps via separate Terraform configs or the AZ CLI."
  value       = azurerm_container_app_environment.main.id
}

output "vnet_id" {
  description = "Resource ID of the Virtual Network."
  value       = azurerm_virtual_network.main.id
}

output "resource_group_name" {
  description = "Name of the resource group hosting all gastosin infrastructure."
  value       = azurerm_resource_group.main.name
}

output "submissions_storage_account_name" {
  description = "Globally unique name of the Storage Account used for unknown-format PDF submissions."
  value       = azurerm_storage_account.submissions.name
}

output "submissions_container_name" {
  description = "Blob container name inside the submissions storage account."
  value       = azurerm_storage_container.submissions.name
}

# ---------------------------------------------------------------------------
# ACR reminder
# The Azure Container Registry is managed outside this Terraform config.
# Before deploying any Container App, grant the ACA environment's managed
# identity (or a dedicated service principal) the AcrPull role on the ACR:
#
#   az role assignment create \
#     --assignee <cae-managed-identity-client-id> \
#     --role AcrPull \
#     --scope /subscriptions/<sub-id>/resourceGroups/<acr-rg>/providers/Microsoft.ContainerRegistry/registries/<acr-name>
# ---------------------------------------------------------------------------
