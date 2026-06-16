variable "aws_region" {
  description = "AWS region to deploy resources into"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (e.g. production, staging)"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project name used for tagging and resource naming"
  type        = string
  default     = "gone"
}
