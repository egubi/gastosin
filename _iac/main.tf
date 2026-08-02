terraform {
  required_version = ">= 1.7.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "azurerm" {
  features {}
}

locals {
  tags = {
    project     = "gastosin"
    environment = "production"
  }
}

# ---------------------------------------------------------------------------
# Resource Group
# ---------------------------------------------------------------------------

resource "azurerm_resource_group" "main" {
  name     = "rg-gastosin"
  location = "Southeast Asia"
  tags     = local.tags
}

# ---------------------------------------------------------------------------
# Virtual Network
# ---------------------------------------------------------------------------

resource "azurerm_virtual_network" "main" {
  name                = "vnet-gastosin"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  address_space       = ["10.10.0.0/16"]
  tags                = local.tags
}

# Subnet for Azure Container Apps Environment
resource "azurerm_subnet" "aca" {
  name                 = "aca-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.10.1.0/24"]

  delegation {
    name = "aca-delegation"
    service_delegation {
      name = "Microsoft.App/environments"
      actions = [
        "Microsoft.Network/virtualNetworks/subnets/join/action",
      ]
    }
  }
}

# ---------------------------------------------------------------------------
# PostgreSQL Flexible Server
# Public access with IP firewall — simpler and cheaper than VNet injection
# (no private DNS zone, no delegated subnet required).
# Burstable B1ms: cheapest tier that still supports extensions.
# Zone redundancy and HA disabled — acceptable for a ~$100/mo budget.
# ---------------------------------------------------------------------------

resource "azurerm_postgresql_flexible_server" "main" {
  name                   = "psql-gastosin"
  resource_group_name    = azurerm_resource_group.main.name
  location               = azurerm_resource_group.main.location
  version                = "16"
  administrator_login    = var.postgres_admin_username
  administrator_password = var.postgres_admin_password

  # Burstable is ~$15–20/mo; General Purpose would be 3–4× more expensive
  sku_name = "B_Standard_B1ms"

  storage_mb            = 32768 # 32 GB — minimum tier, sufficient for early production
  backup_retention_days = 7

  # No zone redundancy saves ~50% on the compute cost
  zone = "1"

  public_network_access_enabled = true

  # HA omitted entirely — absence means disabled, saves ~50% on compute
  tags = local.tags
}

# Firewall: allow known static IPs only; no wildcard rules
resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_dev" {
  name             = "allow-dev"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = var.dev_ip
  end_ip_address   = var.dev_ip
}

resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_ovh" {
  name             = "allow-ovh"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = var.ovh_server_ip
  end_ip_address   = var.ovh_server_ip
}

# Omitted until ACA is deployed and its outbound IP is known
resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_aca" {
  count            = var.aca_outbound_ip != "" ? 1 : 0
  name             = "allow-aca"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = var.aca_outbound_ip
  end_ip_address   = var.aca_outbound_ip
}

# SSL enforcement — always on regardless of network topology
resource "azurerm_postgresql_flexible_server_configuration" "require_ssl" {
  name      = "require_secure_transport"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "on"
}

# Enable pgcrypto and uuid-ossp via the azure.extensions server parameter
resource "azurerm_postgresql_flexible_server_configuration" "extensions" {
  name      = "azure.extensions"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "PGCRYPTO,UUID-OSSP"
}

# ---------------------------------------------------------------------------
# Log Analytics Workspace (required by Container Apps Environment)
# Free tier covers 5 GB/day — more than enough for a small deployment
# ---------------------------------------------------------------------------

resource "azurerm_log_analytics_workspace" "main" {
  name                = "law-gastosin"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 30 # minimum; reduce to 30 to keep log storage costs low
  tags                = local.tags
}

# ---------------------------------------------------------------------------
# Resource provider registrations
# Microsoft.App is not registered by default on new subscriptions.
# ---------------------------------------------------------------------------

resource "azurerm_resource_provider_registration" "app" {
  name = "Microsoft.App"
}

# ---------------------------------------------------------------------------
# Azure Container Apps Environment
# Internal-only is false so that container apps can expose public ingress.
# ACR pull access must be granted separately — see outputs.tf note.
# ---------------------------------------------------------------------------

resource "azurerm_container_app_environment" "main" {
  name                       = "cae-gastosin"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  # Attach to the ACA subnet for VNet integration
  infrastructure_subnet_id       = azurerm_subnet.aca.id
  internal_load_balancer_enabled = false # false = public ingress allowed

  depends_on = [azurerm_resource_provider_registration.app]

  tags = local.tags
}

# ---------------------------------------------------------------------------
# Storage Account — unknown CC format submissions
# Stores PDFs voluntarily uploaded by users who hit an unrecognised statement
# format. Upload is always explicit and user-initiated — never automatic.
# LRS replication: non-critical data, cheapest option (~$2/mo for light use).
# ---------------------------------------------------------------------------

# 4 random lowercase chars to satisfy the global-uniqueness requirement
resource "random_string" "storage_suffix" {
  length  = 4
  lower   = true
  upper   = false
  numeric = true
  special = false
}

resource "azurerm_storage_account" "submissions" {
  name                = "stgastosin${random_string.storage_suffix.result}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  account_tier             = "Standard"
  account_replication_type = "LRS" # cheapest; submissions are non-critical
  access_tier              = "Hot"

  # No anonymous access — submitted PDFs are private by definition
  allow_nested_items_to_be_public = false
  public_network_access_enabled   = false

  https_traffic_only_enabled = true
  min_tls_version            = "TLS1_2"

  tags = local.tags
}

resource "azurerm_storage_container" "submissions" {
  name                  = "submissions"
  storage_account_id    = azurerm_storage_account.submissions.id
  container_access_type = "private" # no anonymous read under any circumstance
}
