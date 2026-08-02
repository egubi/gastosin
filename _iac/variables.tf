variable "postgres_admin_username" {
  description = "Administrator login for the PostgreSQL Flexible Server."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.postgres_admin_username) >= 3
    error_message = "postgres_admin_username must be at least 3 characters."
  }
}

variable "postgres_admin_password" {
  description = "Administrator password for the PostgreSQL Flexible Server. Must meet Azure complexity requirements (12+ chars, mixed case, digits, symbols)."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.postgres_admin_password) >= 12
    error_message = "postgres_admin_password must be at least 12 characters."
  }
}

variable "dev_ip" {
  description = "Home/office IP address allowed to connect to PostgreSQL."
  type        = string
  sensitive   = true

  validation {
    condition     = can(regex("^(\\d{1,3}\\.){3}\\d{1,3}$", var.dev_ip))
    error_message = "dev_ip must be a valid IPv4 address (e.g. 1.2.3.4)."
  }
}

variable "ovh_server_ip" {
  description = "OVH server static IP allowed to connect to PostgreSQL."
  type        = string
  sensitive   = true

  validation {
    condition     = can(regex("^(\\d{1,3}\\.){3}\\d{1,3}$", var.ovh_server_ip))
    error_message = "ovh_server_ip must be a valid IPv4 address (e.g. 1.2.3.4)."
  }
}

variable "aca_outbound_ip" {
  description = "ACA environment static outbound IP. Set after first ACA deploy; leave empty string to skip firewall rule creation."
  type        = string
  sensitive   = true

  validation {
    condition     = var.aca_outbound_ip == "" || can(regex("^(\\d{1,3}\\.){3}\\d{1,3}$", var.aca_outbound_ip))
    error_message = "aca_outbound_ip must be a valid IPv4 address or empty string."
  }
}
