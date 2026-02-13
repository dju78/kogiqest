# GitHub Pages Deployment Setup Guide

## Issue
The application works locally but shows a loading spinner on GitHub Pages because the Supabase environment variables are not available in the deployed version.

## Solution
You need to add your Supabase credentials as GitHub repository secrets so they can be used during the build process.

## Steps to Fix

### 1. Go to Your GitHub Repository
Navigate to: `https://github.com/dju78/kogiqest`

### 2. Open Repository Settings
1. Click on **Settings** (top menu)
2. In the left sidebar, click on **Secrets and variables** → **Actions**

### 3. Add Repository Secrets
Click **New repository secret** and add these two secrets:

#### Secret 1: VITE_SUPABASE_URL
- **Name**: `VITE_SUPABASE_URL`
- **Value**: `https://xnsvxgqvamjaqrexiash.supabase.co`

#### Secret 2: VITE_SUPABASE_ANON_KEY
- **Name**: `VITE_SUPABASE_ANON_KEY`
- **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhuc3Z4Z3F2YW1qYXFyZXhpYXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODIzMTAsImV4cCI6MjA4NjU1ODMxMH0.8WCoJLCUu4LObxPkE8QzdbVcyhzmGz-4r4AsQjs8p3U`

### 4. Trigger a New Deployment
After adding the secrets, you need to trigger a new deployment. You can do this by:

**Option 1**: Push a new commit
```bash
git commit --allow-empty -m "Trigger deployment with Supabase secrets"
git push origin main
```

**Option 2**: Re-run the workflow
1. Go to **Actions** tab in your repository
2. Click on the latest workflow run
3. Click **Re-run all jobs**

### 5. Verify Deployment
After the workflow completes:
1. Visit your GitHub Pages URL: `https://dju78.github.io/kogiqest/`
2. The application should now load questions from Supabase
3. Check the browser console - there should be no Supabase configuration errors

## What Changed
- Updated `.github/workflows/deploy.yml` to use `secrets` instead of `vars`
- The build process now injects Supabase credentials at build time
- The deployed application will have access to your Supabase database

## Security Note
✅ Using GitHub Secrets is secure - they are encrypted and not visible in logs
✅ The anon key is safe to use in client-side applications (it's designed for public use)
✅ Row Level Security (RLS) on your Supabase tables protects your data
