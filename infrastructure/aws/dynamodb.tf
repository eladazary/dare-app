resource "aws_dynamodb_table" "leaderboard" {
  name         = "gone-leaderboard"
  billing_mode = "PAY_PER_REQUEST"

  hash_key  = "cityDate"
  range_key = "userId"

  attribute {
    name = "cityDate"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "score"
    type = "N"
  }

  global_secondary_index {
    name            = "score-index"
    hash_key        = "cityDate"
    range_key       = "score"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Project     = "gone"
    Environment = "production"
  }
}
