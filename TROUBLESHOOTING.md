# Troubleshooting Guide

## GitHub OAuth Setup

### Step 1: Create GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in the details:
   - **Application name**: `Open Web Agent` (or any name you prefer)
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Click "Register application"
5. You'll see your **Client ID** - copy it
6. Click "Generate a new client secret" - copy the secret immediately (you won't see it again)

### Step 2: Update .env File

Edit your `.env` file and add:

```env
GITHUB_ID=your_client_id_here
GITHUB_SECRET=your_client_secret_here
NEXTAUTH_SECRET=your_generated_secret_here
```

To generate NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```

### Step 3: Restart the Application

```bash
# Stop containers
docker-compose down

# Rebuild and start
docker-compose up -d --build
```

## Common Issues

### Issue: "AdapterError: Cannot read properties of undefined"

**Solution**: The database schema needs to be updated.

```bash
# Stop containers
docker-compose down -v

# This will delete the database volume
# Run setup again
./scripts/setup.sh
```

### Issue: "UntrustedHost" Error

**Solution**: Make sure `AUTH_TRUST_HOST=true` is set in docker-compose.yml (already configured)

### Issue: "Prisma failed to detect libssl/openssl"

**Solution**: Already fixed in Dockerfile with OpenSSL installation

### Issue: Port 3000 already in use

**Solution**: Stop the conflicting service or change the port in docker-compose.yml

```bash
# Find what's using port 3000
sudo lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Issue: GitHub OAuth not working

**Checklist**:
1. ✅ GitHub OAuth App created
2. ✅ Callback URL is exactly: `http://localhost:3000/api/auth/callback/github`
3. ✅ GITHUB_ID and GITHUB_SECRET in .env file
4. ✅ NEXTAUTH_SECRET generated and in .env file
5. ✅ Containers restarted after .env changes
6. ✅ Database schema updated (run cleanup + setup)

## Verify Setup

### 1. Check Environment Variables

```bash
docker-compose exec web env | grep -E "GITHUB|NEXTAUTH|AUTH_TRUST"
```

Should show:
- GITHUB_ID=your_id
- GITHUB_SECRET=your_secret
- NEXTAUTH_SECRET=your_secret
- AUTH_TRUST_HOST=true
- NEXTAUTH_URL=http://localhost:3000

### 2. Check Database Connection

```bash
docker-compose exec web npx prisma db push
```

Should succeed without errors.

### 3. Check Logs

```bash
# Watch all logs
docker-compose logs -f

# Watch only web logs
docker-compose logs -f web
```

### 4. Test Authentication Flow

1. Go to http://localhost:3000
2. Should redirect to /login
3. Click "Sign in with GitHub"
4. Should redirect to GitHub
5. Authorize the app
6. Should redirect back to http://localhost:3000/dashboard

## Fresh Start

If nothing works, start completely fresh:

```bash
# 1. Stop and remove everything
docker-compose down -v

# 2. Remove node_modules
rm -rf node_modules

# 3. Install dependencies
npm install

# 4. Generate Prisma client
npm run db:generate

# 5. Run setup
./scripts/setup.sh
```

## Still Having Issues?

Check the logs for specific errors:

```bash
docker-compose logs web | tail -100
```

Common error patterns:
- `AdapterError` → Database schema issue → Run cleanup + setup
- `UntrustedHost` → AUTH_TRUST_HOST not set → Check docker-compose.yml
- `Cannot read properties` → Session/user undefined → Database not initialized
- `ECONNREFUSED` → Database not running → Check postgres container

## Need More Help?

Share the output of:

```bash
# 1. Container status
docker-compose ps

# 2. Environment variables
docker-compose exec web env | grep -E "GITHUB|NEXTAUTH|AUTH_TRUST|DATABASE"

# 3. Recent logs
docker-compose logs web | tail -50
```
