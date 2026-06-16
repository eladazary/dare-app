locals {
  leaderboard_table_arn = "arn:aws:dynamodb:${var.aws_region}:*:table/gone-leaderboard"
  ssm_parameter_arn     = "arn:aws:ssm:${var.aws_region}:*:parameter/gone/*"
  bedrock_model_arn     = "arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-20240307-v1:0"
}

# Lambda execution role

resource "aws_iam_role" "lambda_exec" {
  name = "gone-lambda-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# Attach AWS managed policy for basic Lambda execution (CloudWatch Logs)

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Inline policy with application-specific permissions

resource "aws_iam_policy" "lambda_permissions" {
  name        = "gone-lambda-permissions"
  description = "Application permissions for the gone-verification Lambda function"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Rekognition"
        Effect = "Allow"
        Action = [
          "rekognition:DetectLabels",
          "rekognition:DetectText",
          "rekognition:DetectModerationLabels",
        ]
        Resource = "*"
      },
      {
        Sid    = "Bedrock"
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
        ]
        Resource = local.bedrock_model_arn
      },
      {
        Sid    = "DynamoDB"
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:UpdateItem",
        ]
        Resource = local.leaderboard_table_arn
      },
      {
        Sid    = "SSM"
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
        ]
        Resource = local.ssm_parameter_arn
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = "*"
      },
    ]
  })

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "lambda_permissions" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_permissions.arn
}
