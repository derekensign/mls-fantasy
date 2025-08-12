# AWS Infrastructure Sync Setup Guide

This guide helps you sync your existing AWS Lambda functions and infrastructure with your codebase using AWS SAM.

## 🚀 Quick Start

### 1. Install AWS SAM CLI
```bash
# On macOS
brew install aws-sam-cli

# Verify installation
sam --version
```

### 2. Create S3 Bucket for SAM Artifacts
```bash
npm run aws:create-bucket
```

### 3. Discover Your Current Lambda Functions
```bash
npm run aws:pull-functions
```
This will list all your existing Lambda functions and their configurations.

### 4. Update Function Mappings
Edit `scripts/pull-lambda-functions.js` and update the `FUNCTION_MAPPINGS` object with your actual AWS function names.

### 5. Validate and Deploy
```bash
# Validate your SAM template
npm run sam:validate

# Build the application
npm run sam:build

# Deploy to AWS
npm run sam:deploy
```

## 🔄 Daily Workflow

### Development with Live Sync
```bash
# Start live sync - automatically deploys changes
npm run sam:sync

# For development environment
npm run sam:sync:dev
```

### Manual Deployment
```bash
# Deploy to production
npm run deploy:full

# Deploy to development
npm run deploy:dev

# Deploy to staging
npm run deploy:staging
```

### Monitoring and Debugging
```bash
# View logs in real-time
npm run sam:logs

# Start local API Gateway
npm run sam:local:api

# Start local Lambda runtime
npm run sam:local:lambda
```

## 📁 Directory Structure

Your Lambda functions should be organized as follows:

```
backend/
├── lambda/                    # General Lambda functions
│   ├── draftPlayer.js
│   ├── joinDraftSession.js
│   ├── getDraftSettings.js
│   └── ...
├── goldenbota2025/           # Player-related functions
│   ├── fetchPlayers2025.js
│   └── ...
└── transfer-window/          # Transfer window functions (new)
    ├── startTransferWindow.js
    ├── getTransferWindow.js
    └── ...
```

## 🏗️ What Gets Managed

The SAM template manages:

### DynamoDB Tables
- `Draft` - Draft session data
- `Fantasy_Players` - User team data
- `Players_2024` - Player statistics
- `Golden_Boot_Players` - Golden boot standings
- `League_Settings` - League configuration
- `Transfer_Windows` - Transfer window data (new)

### Lambda Functions
- All existing draft and league functions
- New transfer window functions
- Automatic API Gateway integration

### API Gateway
- RESTful API with proper CORS
- Automatic endpoint mapping
- Environment-specific deployments

## 🔧 Configuration

### Environment Variables
Lambda functions automatically get these environment variables:
- `DRAFT_TABLE`
- `FANTASY_PLAYERS_TABLE`
- `PLAYERS_TABLE`
- `GOLDEN_BOOT_PLAYERS_TABLE`
- `TRANSFER_WINDOW_TABLE`

### Multiple Environments
- **Development**: `npm run deploy:dev`
- **Staging**: `npm run deploy:staging`
- **Production**: `npm run deploy:full`

## 🚨 Migration Steps

### From Manual AWS to SAM

1. **Backup Current Setup**
   ```bash
   npm run aws:backup-current
   ```

2. **List Current Functions**
   ```bash
   npm run aws:pull-functions
   ```

3. **Update Template**
   - Edit `template.yaml` with your actual function names
   - Update `samconfig.toml` with your preferences

4. **Test Deployment**
   ```bash
   npm run sam:deploy:dev
   ```

5. **Switch Production**
   ```bash
   npm run deploy:full
   ```

### Adding New Transfer Window Functions

The template already includes placeholders for transfer window functions:
- `StartTransferWindowFunction`
- `GetTransferWindowFunction`
- `DropPlayerFunction`
- `PickupPlayerFunction`
- `CompleteTransferFunction`
- `AdvanceTransferTurnFunction`
- `GetPlayerGoalsFunction`

Create these files in `backend/lambda/` and they'll be automatically deployed.

## 🔗 Benefits

### Infrastructure as Code
- ✅ Version control for AWS resources
- ✅ Reproducible deployments
- ✅ Environment consistency
- ✅ Automated rollbacks

### Development Workflow
- ✅ Live code sync during development
- ✅ Local testing capabilities
- ✅ Automatic deployments
- ✅ Integrated logging

### Team Collaboration
- ✅ Shared infrastructure definitions
- ✅ No more manual AWS console changes
- ✅ Clear deployment history
- ✅ Easy environment management

## 🛠️ Troubleshooting

### Common Issues

1. **S3 Bucket Already Exists**
   ```bash
   # Use existing bucket, update samconfig.toml
   s3_bucket = "your-existing-bucket-name"
   ```

2. **Function Names Don't Match**
   ```bash
   # Update FUNCTION_MAPPINGS in scripts/pull-lambda-functions.js
   ```

3. **Permission Issues**
   ```bash
   # Ensure AWS credentials are configured
   aws configure
   ```

4. **Stack Already Exists**
   ```bash
   # Use update instead of create
   sam deploy --parameter-overrides Environment=prod
   ```

## 📚 Next Steps

1. **Set up CI/CD**: Integrate with GitHub Actions for automatic deployments
2. **Monitoring**: Add CloudWatch alarms and dashboards
3. **Security**: Implement proper IAM roles and policies
4. **Testing**: Add unit and integration tests for Lambda functions
5. **Documentation**: Document each Lambda function's purpose and API

## 🔧 Advanced Commands

```bash
# Delete a stack
sam delete --stack-name mls-fantasy-dev

# Package for manual deployment
sam package --s3-bucket mls-fantasy-sam-artifacts

# Generate events for testing
sam local generate-event apigateway aws-proxy

# Invoke function locally
sam local invoke GetAllPlayersFunction --event events/test-event.json
``` 