# MLS 2026 Goals Scraper - Automated Lambda Function

## Overview

This Lambda function automatically scrapes player goal statistics from MLSSoccer.com and updates the `Players_2026` DynamoDB table. It runs on a schedule during MLS match days to keep goal counts current for the fantasy league.

## Architecture

```
EventBridge Schedule → updateGoals2026 Lambda
                            ↓
                    HTTP GET MLSSoccer.com
                            ↓
                    Parse HTML (cheerio)
                            ↓
                    Match players (fuzzy matching)
                            ↓
                    UpdateCommand per player
                            ↓
                    CloudWatch Logs + Metrics
```

## Files

- **`updateGoals2026.js`** - Main Lambda function
- **`updateGoals2026-package.json`** - Dependencies for npm install
- **`updateGoals2026.zip`** - Deployment package (created during deployment)

## Schedule

The function runs every 15 minutes during MLS match windows:

- **Weekend matches**: Saturday/Sunday, 1pm-11pm ET
- **Midweek matches**: Wednesday, 7pm-10pm ET

### EventBridge Cron Schedules

```
Weekend: cron(0,15,30,45 17-03 * * 6,0)
Midweek: cron(0,15,30,45 19-02 * * 3)
```

## Deployment Instructions

### 1. Prepare Deployment Package

```bash
cd /Users/derekensing/soccer-projects/mls-fantasy/backend/lambda

# Copy package.json to correct name
cp updateGoals2026-package.json package.json

# Install dependencies
npm install --production

# Create deployment package
zip -r updateGoals2026.zip updateGoals2026.js node_modules/

# Verify package size (should be < 10MB)
ls -lh updateGoals2026.zip
```

### 2. Create Lambda Function (AWS Console)

1. Go to AWS Lambda Console: https://console.aws.amazon.com/lambda
2. Click **Create function**
3. Configure:
   - **Function name**: `updateGoals2026`
   - **Runtime**: Node.js 20.x
   - **Architecture**: x86_64
   - **Execution role**: Create new role or use existing role with DynamoDB permissions
4. Click **Create function**

### 3. Upload Code

1. In the **Code** tab, click **Upload from** → **.zip file**
2. Select `updateGoals2026.zip`
3. Click **Save**

### 4. Configure Lambda Settings

**General Configuration**:
- **Memory**: 512 MB
- **Timeout**: 2 minutes
- **Ephemeral storage**: 512 MB (default)

**Environment Variables**:
- `PLAYERS_TABLE` = `Players_2026`
- `SEASON` = `2026`

**IAM Permissions** (add to execution role):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:Scan",
        "dynamodb:UpdateItem",
        "dynamodb:GetItem"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:853443719819:table/Players_2026"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:us-east-1:853443719819:log-group:/aws/lambda/updateGoals2026:*"
    }
  ]
}
```

### 5. Test Lambda Function

1. In Lambda console, click **Test** tab
2. Create new test event:
   - **Event name**: `TestEvent`
   - **Event JSON**: `{}`
3. Click **Test**
4. Check execution results and CloudWatch Logs

**Expected Output**:
```json
{
  "statusCode": 200,
  "body": "{\"message\":\"Goal update completed\",\"scraped\":600,\"matched\":580,\"updated\":45,\"noChange\":535,\"errors\":0,\"unmatchedCount\":20}"
}
```

### 6. Create EventBridge Rules

**Weekend Rule**:
1. Go to EventBridge Console: https://console.aws.amazon.com/events
2. Click **Create rule**
3. Configure:
   - **Name**: `update-mls-goals-weekend`
   - **Description**: Update MLS goals every 15min on Sat/Sun during match windows
   - **Event bus**: default
   - **Rule type**: Schedule
   - **Schedule pattern**: Cron expression
   - **Cron expression**: `0,15,30,45 17-03 * * 6,0`
   - **Timezone**: UTC
4. Click **Next**
5. **Target**:
   - **Target type**: AWS service
   - **Select a target**: Lambda function
   - **Function**: updateGoals2026
6. Click **Next** → **Next** → **Create rule**

**Midweek Rule**:
- Repeat above steps with:
  - **Name**: `update-mls-goals-midweek`
  - **Cron expression**: `0,15,30,45 19-02 * * 3`

### 7. Add Lambda Permissions

EventBridge needs permission to invoke the Lambda:

```bash
# Set AWS credentials
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_PROFILE
export AWS_ACCESS_KEY_ID="your-key"
export AWS_SECRET_ACCESS_KEY="your-secret"
export AWS_DEFAULT_REGION="us-east-1"

# Add permission for weekend rule
aws lambda add-permission \
  --function-name updateGoals2026 \
  --statement-id AllowEventBridgeWeekend \
  --action 'lambda:InvokeFunction' \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:us-east-1:853443719819:rule/update-mls-goals-weekend

# Add permission for midweek rule
aws lambda add-permission \
  --function-name updateGoals2026 \
  --statement-id AllowEventBridgeMidweek \
  --action 'lambda:InvokeFunction' \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:us-east-1:853443719819:rule/update-mls-goals-midweek
```

## Monitoring & Alerts

### CloudWatch Logs

View logs: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252FupdateGoals2026

**Key log events**:
- `goal_update_started` - Function invocation
- `goal_update_complete` - Successful completion with metrics
- `goal_update_failed` - Error occurred

### CloudWatch Metrics

Custom metrics logged in structured JSON:
- `metrics.updated` - Number of players with goal changes
- `metrics.matched` - Players successfully matched
- `metrics.unmatchedCount` - Players not found in database
- `duration_ms` - Execution time

### Setting Up Alerts (Phase 2)

See **Phase 2: Alerts & Monitoring** section below for SNS setup.

## Troubleshooting

### Common Issues

**1. No players scraped (`scrapedPlayers: 0`)**
- **Cause**: MLSSoccer.com HTML structure changed
- **Fix**: Inspect page source, update CSS selectors in `scrapeMLSStats()`
- **Check**: Visit https://www.mlssoccer.com/stats/players/ manually

**2. High unmatched rate (>10%)**
- **Cause**: Player name format changed or new players added
- **Fix**: Add entries to `NAME_OVERRIDES` constant
- **Example**: `"Héctor Herrera": "Hector Herrera"`

**3. Lambda timeout (>120 seconds)**
- **Cause**: MLSSoccer.com slow response or large player list
- **Fix**: Increase timeout to 3 minutes in Lambda configuration

**4. DynamoDB throttling errors**
- **Cause**: Too many concurrent writes
- **Fix**: Enable on-demand billing or increase provisioned capacity

**5. No updates during known match days**
- **Cause**: EventBridge rules disabled or permissions missing
- **Check**: Verify rules are "Enabled" in EventBridge console
- **Check**: Lambda has `lambda:InvokeFunction` permission for EventBridge

### Manual Testing

Test scraper locally:
```bash
cd backend/lambda

# Install dependencies
npm install

# Set AWS credentials
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_DEFAULT_REGION="us-east-1"

# Run function locally (requires AWS credentials for DynamoDB access)
node -e "require('./updateGoals2026').handler({}).then(console.log)"
```

### Debugging Unmatched Names

Check CloudWatch logs for `unmatchedNames` array:
```json
{
  "unmatchedNames": [
    "João Silva (MIA)",
    "Héctor Herrera (HOU)"
  ]
}
```

Add overrides:
```javascript
const NAME_OVERRIDES = {
  "João Silva": "Joao Silva",
  "Héctor Herrera": "Hector Herrera",
};
```

Redeploy Lambda with updated code.

## Off-Season Management

### Disabling During Off-Season

The scheduler should be disabled after MLS Cup (late October) and re-enabled before season kickoff (mid-February).

**Manual disable**:
1. Go to EventBridge Console
2. Select rule (e.g., `update-mls-goals-weekend`)
3. Click **Disable**

**Automated management** (Phase 4):
- Create `manageSeasonSchedule.js` Lambda
- Automatically enable/disable rules based on MLS calendar
- Run weekly to check season status

### Updating for 2027 Season

1. Update environment variable: `SEASON=2027`
2. Update table name: `PLAYERS_TABLE=Players_2027`
3. Update MLS_STATS_URL in code to use `season=2027`
4. Redeploy Lambda function

## Performance & Costs

**Typical execution**:
- Duration: 30-45 seconds
- Memory used: ~200 MB
- Invocations: ~320/month (80/week during season)

**Monthly costs**:
- Lambda: ~$1.00 (within free tier)
- DynamoDB: ~$0.24 (on-demand writes)
- CloudWatch: ~$0.50 (logs + custom metrics)
- **Total**: ~$1.74/month (likely $0 first year with free tier)

## Phase 2: Alerts & Monitoring Setup

### Create SNS Topic

```bash
# Create SNS topic for alerts
aws sns create-topic --name mls-fantasy-alerts

# Subscribe your email
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:853443719819:mls-fantasy-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com

# Confirm subscription via email link
```

### Create CloudWatch Alarms

**1. Lambda Errors Alarm**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name updateGoals2026-errors \
  --alarm-description "Alert when updateGoals2026 has errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 900 \
  --threshold 3 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=FunctionName,Value=updateGoals2026 \
  --alarm-actions arn:aws:sns:us-east-1:853443719819:mls-fantasy-alerts
```

**2. Lambda Duration Alarm**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name updateGoals2026-slow \
  --alarm-description "Alert when updateGoals2026 is slow" \
  --metric-name Duration \
  --namespace AWS/Lambda \
  --statistic Average \
  --period 900 \
  --threshold 90000 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=FunctionName,Value=updateGoals2026 \
  --alarm-actions arn:aws:sns:us-east-1:853443719819:mls-fantasy-alerts
```

**3. No Invocations Alarm** (detects scheduling failures)
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name updateGoals2026-not-running \
  --alarm-description "Alert when updateGoals2026 hasn't run in 24 hours" \
  --metric-name Invocations \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 86400 \
  --threshold 1 \
  --comparison-operator LessThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=FunctionName,Value=updateGoals2026 \
  --alarm-actions arn:aws:sns:us-east-1:853443719819:mls-fantasy-alerts
```

## Maintenance

### Regular Tasks

**Weekly** (during season):
- Check CloudWatch logs for errors or warnings
- Review unmatched names, add overrides if needed

**After each MLS match day**:
- Verify goal counts updated correctly
- Compare top scorers with MLSSoccer.com

**End of season**:
- Disable EventBridge rules
- Archive logs to S3 (optional)

**Start of new season**:
- Update SEASON environment variable
- Update PLAYERS_TABLE if using new table
- Re-enable EventBridge rules
- Test with manual invocation

### Updating the Function

```bash
# Make code changes to updateGoals2026.js

# Recreate deployment package
cd /Users/derekensing/soccer-projects/mls-fantasy/backend/lambda
zip -r updateGoals2026.zip updateGoals2026.js node_modules/

# Upload via AWS Console or CLI
aws lambda update-function-code \
  --function-name updateGoals2026 \
  --zip-file fileb://updateGoals2026.zip
```

## Related Files

- `backend/goldenbota2025/scrapeMLS2026.js` - Original Playwright-based scraper
- `backend/lambda/getGoldenBootTable.js` - Consumes goals_2026 data
- `backend/lambda/dropPlayer.js` - Transfer window logic with goals tracking

## Support

For issues or questions:
1. Check CloudWatch logs first
2. Review this README troubleshooting section
3. Test scraper locally with manual invocation
4. Open issue at GitHub repository (if applicable)
