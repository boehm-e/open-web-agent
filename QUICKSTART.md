# Quick Start Guide

Get your Open Web Agent platform running in 5 minutes!

## Prerequisites

- Docker & Docker Compose installed
- GitHub account
- Node.js 20+ (for local development)

## Step 1: GitHub OAuth Setup (2 minutes)

1. Go to https://github.com/settings/developers
2. Click **"New OAuth App"**
3. Fill in:
   - **Application name**: `Open Web Agent`
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Click **"Register application"**
5. **Copy the Client ID**
6. Click **"Generate a new client secret"** and **copy it**

## Step 2: Clone & Configure (1 minute)

```bash
# Clone the repository
git clone <your-repo-url>
cd open-web-agent-2

# Copy environment file
cp .env.example .env

# Edit .env and add your GitHub credentials
nano .env  # or use your favorite editor
```

Update these values in `.env`:
```env
GITHUB_ID=your_github_client_id_here
GITHUB_SECRET=your_github_client_secret_here
NEXTAUTH_SECRET=$(openssl rand -base64 32)
```

## Step 3: Run Setup Script (2 minutes)

```bash
# Make setup script executable
chmod +x scripts/setup.sh

# Run setup
./scripts/setup.sh
```

The script will:
- ✅ Check Docker installation
- ✅ Set up Traefik SSL certificates
- ✅ Pull Docker images
- ✅ Start infrastructure services
- ✅ Install dependencies
- ✅ Set up database
- ✅ Start the application

## Step 4: Access the Application

Open your browser and go to:
- **Application**: http://localhost:3000
- **Traefik Dashboard**: http://localhost:8080

## Step 5: Create Your First Workspace

1. Click **"Sign in with GitHub"**
2. Authorize the application
3. Click **"New Workspace"**
4. Select a repository
5. Enter a workspace name
6. Click **"Create Workspace"**

Wait 30-60 seconds for the workspace to launch. You'll see loading screens while containers start, then:
- **Left panel**: OpenCode AI agent (with workspace pre-loaded)
- **Right panel**: VS Code editor (opens directly to your code)

### Workspace Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+1` | Show both panels |
| `Alt+2` | Show OpenCode only |
| `Alt+3` | Show VS Code only |
| `Alt+H` | Toggle header |
| `Alt+L` | Toggle layout (horizontal/vertical) |
| `Alt+R` | Refresh panels |
| `Alt+F` | Toggle fullscreen |

### Theme Options

Click the theme toggle in the header to switch between:
- 🌙 **Dark mode** (default)
- ☀️ **Light mode**
- 💻 **System** (follows OS preference)

## Troubleshooting

### "Cannot connect to Docker daemon"
```bash
# Start Docker service
sudo systemctl start docker

# Or on macOS
open -a Docker
```

### "Port already in use"
```bash
# Check what's using the port
sudo lsof -i :80  # or :443, :5432, :8080

# Stop the conflicting service or change ports in docker-compose.yml
```

Note: Workspace containers don't require exposed ports - they use Traefik hostname-based routing.

### "Database connection failed"
```bash
# Restart PostgreSQL
docker-compose restart postgres

# Check logs
docker-compose logs postgres
```

### Workspace won't start
```bash
# Check Docker logs
docker-compose logs -f

# Check workspace container logs
docker logs opencode-<workspace-id>
docker logs code-server-<workspace-id>
```

### Workspace shows "Starting..." but never loads
The workspace UI waits for containers to be ready before showing iframes. If it takes too long:
```bash
# Check if containers are running
docker ps | grep <workspace-id>

# Check container health
curl http://opencode-<workspace-id>.localhost:3000
curl http://vscode-<workspace-id>.localhost:3000
```

## Manual Setup (Alternative)

If you prefer manual setup:

```bash
# 1. Set up environment
cp .env.example .env
# Edit .env with your credentials

# 2. Set Traefik permissions
chmod 600 traefik/acme.json

# 3. Start services
docker-compose up -d

# 4. Install dependencies
npm install

# 5. Set up database
npm run db:generate
npm run db:push
```

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Check the [Architecture Plan](plans/plan.md) for system design
- Explore the API endpoints in `src/app/api/`
- Customize the UI in `src/components/`

## Need Help?

- Check the logs: `docker-compose logs -f`
- View running containers: `docker-compose ps`
- Restart everything: `docker-compose restart`
- Clean slate: `docker-compose down -v && docker-compose up -d`

Happy coding! 🚀
