terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# SSM Parameter data sources

data "aws_ssm_parameter" "supabase_url" {
  name = "/gone/supabase_url"
}

data "aws_ssm_parameter" "supabase_service_key" {
  name            = "/gone/supabase_service_key"
  with_decryption = true
}

data "aws_ssm_parameter" "anthropic_api_key" {
  name            = "/gone/anthropic_api_key"
  with_decryption = true
}

data "aws_ssm_parameter" "dynamodb_table" {
  name = "/gone/dynamodb_table"
}

data "aws_ssm_parameter" "r2_account_id" {
  name = "/gone/r2_account_id"
}

data "aws_ssm_parameter" "r2_access_key_id" {
  name            = "/gone/r2_access_key_id"
  with_decryption = true
}

data "aws_ssm_parameter" "r2_secret_access_key" {
  name            = "/gone/r2_secret_access_key"
  with_decryption = true
}

data "aws_ssm_parameter" "r2_bucket_name" {
  name = "/gone/r2_bucket_name"
}

data "aws_ssm_parameter" "r2_public_url" {
  name = "/gone/r2_public_url"
}

# Lambda function

resource "aws_lambda_function" "gone_verification" {
  function_name = "gone-verification"
  role          = aws_iam_role.lambda_exec.arn
  runtime       = "nodejs20.x"
  handler       = "dist/handler.handler"
  timeout       = 30
  memory_size   = 512

  # Placeholder — actual code is deployed via GitHub Actions
  filename = "${path.module}/placeholder.zip"

  environment {
    variables = {
      SUPABASE_URL            = data.aws_ssm_parameter.supabase_url.value
      SUPABASE_SERVICE_KEY    = data.aws_ssm_parameter.supabase_service_key.value
      AWS_REGION              = var.aws_region
      ANTHROPIC_API_KEY       = data.aws_ssm_parameter.anthropic_api_key.value
      DYNAMODB_TABLE          = data.aws_ssm_parameter.dynamodb_table.value
      R2_ACCOUNT_ID           = data.aws_ssm_parameter.r2_account_id.value
      R2_ACCESS_KEY_ID        = data.aws_ssm_parameter.r2_access_key_id.value
      R2_SECRET_ACCESS_KEY    = data.aws_ssm_parameter.r2_secret_access_key.value
      R2_BUCKET_NAME          = data.aws_ssm_parameter.r2_bucket_name.value
      R2_PUBLIC_URL           = data.aws_ssm_parameter.r2_public_url.value
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_cloudwatch_log_group.gone_verification,
  ]

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# Function URL for Supabase webhook endpoint
# Secured by checking a shared secret header inside the Lambda handler,
# not via IAM (auth_type = NONE makes the URL publicly reachable).

resource "aws_lambda_function_url" "gone_verification" {
  function_name      = aws_lambda_function.gone_verification.function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = false
    allow_origins     = ["*"]
    allow_methods     = ["POST"]
    allow_headers     = ["Content-Type", "x-webhook-secret"]
    max_age           = 300
  }
}

# CloudWatch log group

resource "aws_cloudwatch_log_group" "gone_verification" {
  name              = "/aws/lambda/gone-verification"
  retention_in_days = 7

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}
