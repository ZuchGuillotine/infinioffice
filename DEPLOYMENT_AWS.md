# InfiniOffice AWS App Runner Deployment Guide

## Overview

This guide covers deploying InfiniOffice as a containerized application on AWS App Runner with integrated frontend and backend services.

## Architecture

- **Single Container**: Backend serves API and frontend static files
- **Port**: 3000 (configurable via PORT env var)
- **Frontend**: React SPA served as static files
- **Backend**: Fastify server with WebSocket support
- **Database**: PostgreSQL (via DATABASE_URL)
- **Webhooks**: Twilio voice webhooks at `/voice`

## Local Development

### Quick Start
```bash
# Start both backend and frontend in development mode
npm run dev

# This will start:
# - Backend server on http://localhost:3001  
# - Frontend dev server on http://localhost:5173

# In another terminal, expose for Twilio webhooks:
npm run dev:ngrok
```

### Manual Development Setup
```bash
# Backend only (port 3001)
npm run dev:backend

# Frontend only (port 5173)  
npm run dev:frontend

# Ngrok tunnel for Twilio webhooks
npm run dev:ngrok
```

## Production Build

### Local Production Build
```bash
# Build everything for production
npm run build

# Start production server
npm start
```

### Docker Build
```bash
# Build Docker image
npm run build:docker

# Run container locally
docker run -p 3000:3000 --env-file .env infinioffice
```

## AWS App Runner Deployment

### 1. Prepare Environment Variables

Create these environment variables in App Runner:

**Required:**
```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your-secret-key-here

# API Keys
DEEPGRAM_API_KEY=your-deepgram-key
OPENAI_API_KEY=your-openai-key

# Twilio Configuration  
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=your-twilio-number

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
```

**Optional:**
```bash
FRONTEND_URL=https://your-domain.com
DEFAULT_ORG_ID=uuid-for-default-org
```

### 2. Deploy to App Runner

#### Option A: Direct from GitHub

1. Connect App Runner to your GitHub repository
2. Use the included `apprunner.yaml` configuration
3. Set environment variables in App Runner console
4. Deploy

#### Option B: Container Registry

1. Build and push to ECR:
```bash
# Build image
docker build -t infinioffice .

# Tag for ECR
docker tag infinioffice:latest 123456789012.dkr.ecr.region.amazonaws.com/infinioffice:latest

# Push to ECR
docker push 123456789012.dkr.ecr.region.amazonaws.com/infinioffice:latest
```

2. Create App Runner service from ECR image
3. Set environment variables
4. Deploy

### 3. Configure Twilio Webhooks

Once deployed, update your Twilio phone number configuration:

1. Go to Twilio Console → Phone Numbers
2. Select your phone number  
3. Set webhook URL to: `https://your-app-runner-url.com/voice`
4. Set HTTP method to `POST`
5. Save configuration

## API Endpoints

### Public Endpoints
- `GET /health` - Health check
- `GET /metrics` - Performance metrics  
- `POST /voice` - Twilio webhook
- `GET /*` - React app (production only)

### API Endpoints  
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/google` - Google OAuth
- `GET /api/auth/verify` - Token verification
- All other `/api/*` routes require authentication

### WebSocket
- `ws://host/` - Twilio Media Streams WebSocket

## Environment Configuration

### Development (.env.local)
```bash
NODE_ENV=development
PORT=3001

# Database (optional - app runs without it)
DATABASE_URL=postgresql://localhost:5432/infinioffice_dev

# API Keys  
DEEPGRAM_API_KEY=your-dev-key
OPENAI_API_KEY=your-dev-key
TWILIO_ACCOUNT_SID=your-dev-sid
TWILIO_AUTH_TOKEN=your-dev-token
TWILIO_PHONE_NUMBER=your-dev-number

JWT_SECRET=your-dev-secret
GOOGLE_CLIENT_ID=your-dev-google-client-id
```

### Production (App Runner Environment Variables)
- Set all required environment variables through App Runner console
- Never commit production secrets to version control
- Use AWS Secrets Manager for sensitive values if needed

## Monitoring & Troubleshooting

### Health Checks
```bash
curl https://your-app-runner-url.com/health
```

Response should be:
```json
{
  "status": "healthy", 
  "timestamp": "2025-01-09T...",
  "services": {
    "deepgram": true,
    "openai": true, 
    "database": true
  }
}
```

### Performance Metrics
```bash
curl https://your-app-runner-url.com/metrics
```

### Logs
- App Runner provides built-in logging
- Check App Runner logs for application output
- Set `NODE_ENV=development` temporarily for verbose logging

### Common Issues

**1. "Health check failed"**
- Check environment variables are set
- Verify app starts without errors
- Check port configuration (should be 3000)

**2. "Frontend not loading"**  
- Ensure frontend build completed successfully
- Check static file serving configuration
- Verify CORS settings for your domain

**3. "API calls failing"**
- Check API endpoints return correct responses
- Verify authentication token handling
- Check CORS configuration

**4. "Twilio webhook timeout"**
- Verify webhook URL is correct
- Check `/voice` endpoint responds quickly
- Verify App Runner service is running

**5. "Database connection failed"**
- Check DATABASE_URL format
- Verify database is accessible from App Runner
- App runs in fallback mode without database

## Scaling & Performance

### App Runner Scaling
- App Runner automatically scales based on traffic
- Configure minimum/maximum instances as needed
- Monitor CPU and memory usage

### Database Optimization
- Use connection pooling
- Monitor query performance
- Consider read replicas for high traffic

### CDN & Static Assets
- Consider CloudFront for static assets
- App Runner includes basic caching
- Optimize bundle sizes

## Security Considerations

### Environment Variables
- Never commit secrets to version control
- Use App Runner environment variable encryption
- Rotate API keys regularly

### Network Security
- App Runner provides HTTPS by default
- Configure proper CORS policies
- Use Twilio request validation in production

### Authentication
- JWT tokens expire in 24h
- Implement proper session management
- Use secure cookie settings in production

## Support & Maintenance

### Deployment Updates
- Push to GitHub triggers automatic deployment
- Use App Runner deployment rollback if needed
- Test in staging environment first

### Monitoring
- Set up CloudWatch alarms
- Monitor App Runner metrics
- Track application performance metrics

### Backup & Recovery
- Regular database backups
- Version control for code
- Document deployment procedures

---

## Quick Reference Commands

```bash
# Development
npm run dev                 # Start dev servers
npm run dev:ngrok          # Expose for webhooks

# Production  
npm run build              # Build for production
npm start                  # Start production server
npm run build:docker       # Build Docker image

# Testing
npm test                   # Run tests
npm run test:coverage      # Coverage report

# Utilities
npm run verify-audio-pipeline  # Test voice pipeline
```

For additional support, check the logs and health endpoints, or refer to the main DEPLOYMENT.md for voice pipeline specific guidance.