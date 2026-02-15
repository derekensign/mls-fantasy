# updateGoals2026 Deployment Checklist

## Pre-Deployment Verification

- [x] Lambda function created (`updateGoals2026.js`)
- [x] Dependencies specified (`updateGoals2026-package.json`)
- [x] Documentation written (`README-GOALS-SCRAPER.md`)
- [x] Deployment script created (`deploy-updateGoals2026.sh`)
- [x] Test script created (`test-scraper-local.js`)

## Phase 1: Core Scraper Lambda

### Step 1: Create Lambda Function (AWS Console)

1. **Navigate to Lambda Console**
   - URL: https://console.aws.amazon.com/lambda/home?region=us-east-1
   - Click "Create function"

2. **Configure Function**
   ```
   Function name: updateGoals2026
   Runtime: Node.js 20.x
   Architecture: x86_64
   Execution role: Create new role (or use existing with DynamoDB permissions)
   ```

3. **Click "Create function"**

### Step 2: Prepare and Upload Code

```bash
cd /Users/derekensing/soccer-projects/mls-fantasy/backend/lambda

# Copy package.json
cp updateGoals2026-package.json package.json

# Install production dependencies
npm install --production

# Create deployment package
zip -r updateGoals2026.zip updateGoals2026.js node_modules/

# Verify package size (should be ~2-5 MB)
ls -lh updateGoals2026.zip
```

### Step 3: Upload to Lambda

**Option A: AWS Console**
1. In Lambda function, go to "Code" tab
2. Click "Upload from" → ".zip file"
3. Select `updateGoals2026.zip`
4. Click "Save"

**Option B: AWS CLI** (requires credentials)
```bash
# Set credentials
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_PROFILE AWS_DEFAULT_PROFILE
export AWS_ACCESS_KEY_ID="your-key-from-env-local"
export AWS_SECRET_ACCESS_KEY="your-secret-from-env-local"
export AWS_DEFAULT_REGION="us-east-1"

# Upload code
aws lambda update-function-code \
  --function-name updateGoals2026 \
  --zip-file fileb://updateGoals2026.zip
```

### Step 4: Configure Lambda Settings

**General Configuration** (in AWS Console):
- Memory: `512 MB`
- Timeout: `2 minutes` (120 seconds)
- Ephemeral storage: `512 MB` (default)

**Environment Variables**:
```
PLAYERS_TABLE = Players_2026
SEASON = 2026
```

**IAM Role Permissions**:

Add this policy to the Lambda execution role:

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
    }
  ]
}
```

### Step 5: Test Lambda Function

**AWS Console Test**:
1. Click "Test" tab
2. Create test event:
   - Event name: `TestInvocation`
   - Event JSON: `{}`
3. Click "Test"
4. Verify response shows successful execution

**Expected Output**:
```json
{
  "statusCode": 200,
  "body": "{\"message\":\"Goal update completed\",\"scraped\":600,\"matched\":580,\"updated\":45,\"noChange\":535,\"errors\":0,\"unmatchedCount\":20}"
}
```

**Check CloudWatch Logs**:
- Click "Monitor" tab → "View CloudWatch logs"
- Look for `goal_update_complete` event
- Verify no errors

### Step 6: Verify Database Updates

**Option A: DynamoDB Console**
1. Go to DynamoDB Console: https://console.aws.amazon.com/dynamodb
2. Select `Players_2026` table
3. Click "Explore table items"
4. Check a few players have `goals_2026` values
5. Verify `last_updated` timestamp is recent

**Option B: Check API Response**
Visit: https://emp47nfi83.execute-api.us-east-1.amazonaws.com/prod/golden-boot-table/1

Verify goal counts are current (compare with https://www.mlssoccer.com/stats/players/)

---

## Phase 2: Alerts & Monitoring

### Step 1: Create SNS Topic for Alerts

```bash
# Create topic
aws sns create-topic --name mls-fantasy-alerts

# Output will show ARN:
# arn:aws:sns:us-east-1:853443719819:mls-fantasy-alerts

# Subscribe your email
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:853443719819:mls-fantasy-alerts \
  --protocol email \
  --notification-endpoint YOUR_EMAIL@example.com

# ⚠️  CHECK YOUR EMAIL and click confirmation link!
```

### Step 2: Create CloudWatch Alarms

**Alarm 1: Lambda Errors**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name updateGoals2026-errors \
  --alarm-description "Alert when updateGoals2026 Lambda has errors" \
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

**Alarm 2: Lambda Duration (Performance)**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name updateGoals2026-slow \
  --alarm-description "Alert when updateGoals2026 takes > 90 seconds" \
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

**Alarm 3: No Invocations (Scheduling Failure)**
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

### Step 3: Test Alerts

**Trigger test alert**:
```bash
# Publish test message to SNS
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:853443719819:mls-fantasy-alerts \
  --subject "Test Alert: MLS Fantasy Goals Scraper" \
  --message "This is a test alert. If you receive this, SNS is working correctly."

# Check your email for the test message
```

**Verify alarm is active**:
- Go to CloudWatch Console: https://console.aws.amazon.com/cloudwatch
- Navigate to "Alarms" → "All alarms"
- Verify 3 alarms exist and are in "OK" state

---

## Phase 3: Scheduling

### Step 1: Create EventBridge Rules

**Weekend Rule (Sat/Sun 1pm-11pm ET)**

1. Navigate to EventBridge Console: https://console.aws.amazon.com/events
2. Click "Create rule"
3. Configure:
   ```
   Name: update-mls-goals-weekend
   Description: Update MLS goals every 15min on Sat/Sun during match windows
   Event bus: default
   Rule type: Schedule
   ```
4. Schedule pattern:
   ```
   Cron expression: 0,15,30,45 17-03 * * 6,0
   Timezone: UTC
   ```
5. Target:
   ```
   Target type: AWS service
   Select a target: Lambda function
   Function: updateGoals2026
   ```
6. Click "Create"

**Midweek Rule (Wed 7pm-10pm ET)**

1. Click "Create rule"
2. Configure:
   ```
   Name: update-mls-goals-midweek
   Description: Update MLS goals every 15min on Wed during match windows
   Event bus: default
   Rule type: Schedule
   ```
3. Schedule pattern:
   ```
   Cron expression: 0,15,30,45 19-02 * * 3
   Timezone: UTC
   ```
4. Target:
   ```
   Target type: AWS service
   Select a target: Lambda function
   Function: updateGoals2026
   ```
5. Click "Create"

### Step 2: Add Lambda Permissions for EventBridge

```bash
# Permission for weekend rule
aws lambda add-permission \
  --function-name updateGoals2026 \
  --statement-id AllowEventBridgeWeekend \
  --action 'lambda:InvokeFunction' \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:us-east-1:853443719819:rule/update-mls-goals-weekend

# Permission for midweek rule
aws lambda add-permission \
  --function-name updateGoals2026 \
  --statement-id AllowEventBridgeMidweek \
  --action 'lambda:InvokeFunction' \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:us-east-1:853443719819:rule/update-mls-goals-midweek
```

### Step 3: Test Scheduled Execution

**Option A: Manual trigger (immediate)**
```bash
# Manually invoke Lambda to simulate scheduled execution
aws lambda invoke \
  --function-name updateGoals2026 \
  --output json \
  response.json

# Check response
cat response.json | jq
```

**Option B: Temporarily adjust schedule**
1. Edit one of the EventBridge rules
2. Change cron to trigger in 5 minutes (use current UTC time + 5 min)
3. Wait for trigger
4. Check CloudWatch logs
5. Restore original cron expression

**Option C: Wait for next scheduled window**
- Weekend: Next Saturday 1pm ET
- Midweek: Next Wednesday 7pm ET

### Step 4: Verify Scheduled Invocations

**Check EventBridge rule history**:
- Go to EventBridge Console
- Select rule (e.g., `update-mls-goals-weekend`)
- Click "Metrics" tab
- Verify "Invocations" graph shows activity

**Check Lambda invocations**:
- Go to Lambda Console → `updateGoals2026`
- Click "Monitor" tab
- Verify "Invocations" graph shows scheduled triggers

---

## Phase 4: Off-Season Management (Optional - Week 2)

This can be implemented after initial deployment is working.

**Manual Management**:
1. After MLS Cup (late October):
   - Go to EventBridge Console
   - Disable both rules: `update-mls-goals-weekend` and `update-mls-goals-midweek`
2. Before season kickoff (mid-February):
   - Re-enable both rules

**Automated Management** (future enhancement):
- Create `manageSeasonSchedule.js` Lambda
- Schedule weekly checks of MLS season dates
- Auto-enable/disable EventBridge rules

---

## Verification & Testing

### End-to-End Verification

1. **Trigger Lambda manually** (if not yet scheduled)
   ```bash
   aws lambda invoke --function-name updateGoals2026 response.json
   cat response.json
   ```

2. **Check CloudWatch Logs**
   - Look for `goal_update_complete` event
   - Verify `metrics.updated > 0` (players with goal changes)
   - No errors in logs

3. **Verify DynamoDB Updates**
   - Check `Players_2026` table
   - Verify `goals_2026` values are current
   - Check `last_updated` timestamps

4. **Test Frontend**
   - Visit https://mls-fantasy.vercel.app/league/1/table
   - Verify goal counts match MLSSoccer.com
   - Check top scorers are correct

5. **Verify API Response**
   ```bash
   curl https://emp47nfi83.execute-api.us-east-1.amazonaws.com/prod/golden-boot-table/1 | jq
   ```

### Troubleshooting

**Issue: `scrapedPlayers: 0`**
- MLSSoccer.com HTML changed
- 2026 season not started (will fallback to 2025 roster)
- Fix: Update CSS selectors in `scrapeMLSStats()`

**Issue: High unmatched rate**
- Player names differ between MLSSoccer.com and DynamoDB
- Fix: Add entries to `NAME_OVERRIDES` constant
- Redeploy Lambda

**Issue: Lambda timeout**
- MLSSoccer.com slow or unresponsive
- Fix: Increase timeout to 3 minutes

**Issue: No scheduled invocations**
- EventBridge rules disabled
- Lambda permissions missing
- Fix: Re-enable rules, verify permissions

---

## Post-Deployment Monitoring

### Daily (during match days)
- Check CloudWatch logs for errors
- Verify goal counts updated after matches

### Weekly (during season)
- Review unmatched names in logs
- Add name overrides as needed
- Check alarm status in CloudWatch

### End of Season
- Disable EventBridge rules
- Archive logs (optional)

### Start of New Season
- Update `SEASON` environment variable
- Update `PLAYERS_TABLE` if needed
- Re-enable EventBridge rules
- Test with manual invocation

---

## Success Criteria

- [x] Lambda function deployed and running
- [ ] Manual test invocation succeeds
- [ ] CloudWatch logs show successful execution
- [ ] Players_2026 table updated with current goals
- [ ] SNS topic created and email subscribed
- [ ] CloudWatch alarms created (3 alarms)
- [ ] Test alert received via email
- [ ] EventBridge rules created (weekend + midweek)
- [ ] Lambda permissions added for EventBridge
- [ ] Scheduled execution verified (logs show automatic trigger)
- [ ] Frontend displays updated goal counts
- [ ] No errors in CloudWatch logs after 24 hours

---

## Cost Estimate

**Monthly costs** (during season):
- Lambda: ~$1.00 (320 invocations × 30 seconds)
- DynamoDB: ~$0.24 (192,000 writes)
- CloudWatch: ~$0.50 (logs + alarms + custom metrics)
- SNS: Free (< 1,000 emails)
- EventBridge: Free (< 1M invocations)

**Total: ~$1.74/month** (likely $0 first year with AWS Free Tier)

---

## Support

- **Documentation**: `README-GOALS-SCRAPER.md`
- **Test Script**: `test-scraper-local.js` (requires Node.js 20+)
- **Deployment Script**: `deploy-updateGoals2026.sh`
- **CloudWatch Logs**: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252FupdateGoals2026
