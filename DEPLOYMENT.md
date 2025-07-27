# 🚀 Deploying Dental Brain AI to Render

This guide will walk you through deploying your Dental Brain AI application to Render.

## Prerequisites

1. A GitHub account
2. A Render account (sign up at https://render.com)
3. Your OpenAI API key

## Step-by-Step Deployment Guide

### 1. Create a New Git Repository

```bash
# Navigate to your project directory
cd /Users/salimcherkaoui/Desktop/WORK/AGENT-DENT/CLAUDE-CODE/FOCUS_SEQUENCE_TRAITEMENT/dental-app

# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Dental Brain AI application"

# Create a new repository on GitHub
# Go to https://github.com/new
# Name it something like "dental-brain-ai"
# Don't initialize with README, .gitignore, or license

# Add the remote origin (replace with your repository URL)
git remote add origin https://github.com/YOUR_USERNAME/dental-brain-ai.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 2. Deploy to Render

#### Option A: Deploy with render.yaml (Recommended)

1. Go to https://dashboard.render.com/
2. Click "New +" → "Blueprint"
3. Connect your GitHub account if not already connected
4. Select your "dental-brain-ai" repository
5. Render will detect the `render.yaml` file
6. Review the services:
   - Web Service: dental-brain-app
   - PostgreSQL Database: dental-brain-db
7. Click "Apply"

#### Option B: Manual Setup

If you prefer to set up manually:

1. **Create PostgreSQL Database:**
   - Go to Dashboard → New → PostgreSQL
   - Name: `dental-brain-db`
   - Database: `dental_brain_db`
   - User: `dental_brain_user`
   - Region: Oregon (or your preference)
   - Plan: Starter (Free)
   - Click "Create Database"

2. **Create Web Service:**
   - Go to Dashboard → New → Web Service
   - Connect your GitHub repository
   - Name: `dental-brain-app`
   - Region: Same as database
   - Branch: `main`
   - Runtime: Python
   - Build Command: `./build.sh`
   - Start Command: `gunicorn run:app --bind 0.0.0.0:$PORT`
   - Plan: Starter (Free)
   - Click "Create Web Service"

### 3. Configure Environment Variables

After deployment starts, go to your web service dashboard and set these environment variables:

1. Click on "Environment" in the left sidebar
2. Add the following:
   - `OPENAI_API_KEY`: Your OpenAI API key (required)
   - `SECRET_KEY`: Will be auto-generated if using render.yaml
   - `DATABASE_URL`: Will be auto-connected if using render.yaml
   - `FLASK_ENV`: `production` (should be set by render.yaml)

### 4. Initialize the Database

After your first deployment:

1. Go to your web service dashboard
2. Click "Shell" in the left sidebar
3. Run these commands:

```bash
# Create admin user
python init_db.py

# Verify database
python -c "from app import create_app, db; app = create_app('production'); app.app_context().push(); print('Database ready!')"
```

### 5. Access Your Application

Once deployment is complete:
- Your app will be available at: `https://dental-brain-app.onrender.com`
- Login with:
  - Username: `admin`
  - Password: `changeme123!`
- **IMPORTANT**: Change the admin password immediately!

## Post-Deployment Steps

### 1. Change Admin Password
1. Login to your application
2. Go to user settings
3. Change the password immediately

### 2. Monitor Your Application
- Check the "Logs" tab in Render dashboard for any errors
- Monitor the "Metrics" tab for performance

### 3. Set Up Custom Domain (Optional)
1. Go to Settings → Custom Domains
2. Add your domain
3. Update your DNS records as instructed

## Troubleshooting

### Database Connection Issues
- Ensure DATABASE_URL is properly set
- Check that web service and database are in the same region
- Verify PostgreSQL is running in Render dashboard

### Build Failures
- Check build logs in Render dashboard
- Ensure all dependencies are in requirements.txt
- Verify Python version compatibility

### Application Errors
- Check runtime logs in Render dashboard
- Ensure OPENAI_API_KEY is set correctly
- Verify all environment variables are configured

### RAG System Issues
- The knowledge base will be initialized during build
- Check build logs for any indexing errors
- Ensure DATA/ directory is included in repository

## Updating Your Application

To deploy updates:

```bash
# Make your changes
git add .
git commit -m "Description of changes"
git push origin main
```

Render will automatically detect the push and redeploy your application.

## Cost Considerations

With Render's free tier:
- Web Service: 750 hours/month (sleeps after 15 min inactivity)
- PostgreSQL: 1GB storage, 90 days retention
- For production use, consider upgrading to paid plans

## Security Best Practices

1. **Use strong passwords** for all user accounts
2. **Keep your OpenAI API key secure** - never commit it to git
3. **Enable 2FA** on your GitHub and Render accounts
4. **Regularly update dependencies** for security patches
5. **Monitor usage** to detect any unusual activity

## Support

- Render Documentation: https://render.com/docs
- Render Community: https://community.render.com
- Application Issues: Check CLAUDE.md for troubleshooting