output "lambda_function_url" {
  description = "Public URL for the gone-verification Lambda function (Supabase webhook endpoint)"
  value       = aws_lambda_function_url.gone_verification.function_url
}

output "leaderboard_table_name" {
  description = "Name of the DynamoDB leaderboard table"
  value       = aws_dynamodb_table.leaderboard.name
}

output "lambda_role_arn" {
  description = "ARN of the IAM role attached to the gone-verification Lambda function"
  value       = aws_iam_role.lambda_exec.arn
}
