# Open Web Agent

A cloud-based IDE platform similar to OpenHands that allows users to launch containerized development environments with OpenCode AI agent and VS Code in the browser.

## Features

- 🔐 **GitHub OAuth Authentication** - Secure login with GitHub
- 🚀 **One-Click Workspace Launch** - Create development environments from your GitHub repositories
- 🤖 **OpenCode AI Agent** - AI-powered coding assistant in a containerized environment
- 💻 **VS Code in Browser** - Full-featured code editor accessible from anywhere
- 🐳 **Docker-Based Isolation** - Each workspace runs in its own secure container
- 🔄 **Automatic Routing** - Traefik reverse proxy with hostname-based routing (no exposed ports)
- 📊 **Workspace Management** - Start, stop, and delete workspaces easily
- 🎨 **Modern UI** - Dark/light themes, resizable panels, keyboard shortcuts
- 📱 **Responsive Design** - Works on desktop and tablet devices

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Browser                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Next.js Frontend (Dashboard & Workspace UI)         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Traefik Reverse Proxy                     │
│              (Automatic SSL & Dynamic Routing)               │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        ▼                                       ▼
┌──────────────────┐              ┌──────────────────────────┐
│   Next.js API    │              │  Dynamic Workspaces      │
│   - Auth         │              │  ┌────────────────────┐  │
│   - Workspaces   │              │  │ OpenCode Container │  │
│   - Docker Mgmt  │              │  └────────────────────┘  │
└──────────────────┘              │  ┌────────────────────┐  │
        │                         │  │ VS Code Container  │  │
        ▼                         │  └────────────────────┘  │
┌──────────────────┐              └──────────────────────────┘
│   PostgreSQL     │
│   (User Data)    │
└──────────────────┘
```

## Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development)
- GitHub OAuth App credentials

## Quick Start

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd open-web-agent-2
```

### 2. Set Up GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the details:
   - **Application name**: Open Web Agent
   - **Homepage URL**: `http://localhost:3000` (or your domain)
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Click "Register application"
5. Copy the **Client ID** and generate a **Client Secret**

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-super-secret-key-change-this
GITHUB_ID=your-github-client-id
GITHUB_SECRET=your-github-client-secret
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/open_web_agent
```

Generate a secure `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
```

### 4. Set Traefik Permissions

```bash
chmod 600 traefik/acme.json
```

### 5. Start the Application

```bash
docker-compose up -d
```

This will start:
- Traefik reverse proxy (ports 80, 443, 8080)
- PostgreSQL database
- Docker Socket Proxy (for secure Docker API access)
- Next.js web application

### 6. Run Database Migrations

```bash
# Install dependencies locally (if not already done)
npm install

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push
```

### 7. Access the Application

Open your browser and navigate to:
- **Application**: http://localhost:3000
- **Traefik Dashboard**: http://localhost:8080

## Development

### Local Development (without Docker)

1. Start PostgreSQL:
```bash
docker-compose up -d postgres
```

2. Install dependencies:
```bash
npm install
```

3. Set up database:
```bash
npm run db:generate
npm run db:push
```

4. Start development server:
```bash
npm run dev
```

### Project Structure

```
open-web-agent-2/
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── api/               # API routes
│   │   │   ├── workspaces/    # Workspace CRUD + health checks
│   │   │   ├── github/        # GitHub API integration
│   │   │   └── auth/          # NextAuth endpoints
│   │   ├── dashboard/         # Dashboard page
│   │   ├── workspace/         # Workspace pages
│   │   └── login/             # Login page
│   ├── components/            # React components
│   │   ├── dashboard/         # Dashboard components
│   │   ├── workspace/         # Workspace IDE components
│   │   ├── ui/                # Reusable UI components
│   │   │   ├── Button.tsx     # Button component
│   │   │   ├── Card.tsx       # Card component
│   │   │   ├── Badge.tsx      # Badge component
│   │   │   ├── ThemeToggle.tsx # Dark/light theme toggle
│   │   │   └── ResizablePanel.tsx # Resizable panel component
│   │   └── providers/         # Context providers
│   │       └── ThemeProvider.tsx # Theme context
│   └── lib/                   # Utilities
│       ├── auth.ts           # NextAuth configuration
│       ├── docker.ts         # Docker management
│       ├── github.ts         # GitHub API
│       ├── prisma.ts         # Prisma client
│       └── utils.ts          # Utility functions (cn, etc.)
├── prisma/
│   └── schema.prisma         # Database schema
├── docker-compose.yml        # Docker services
├── Dockerfile                # Next.js container
└── traefik/                  # Traefik configuration
```

## Production Deployment

### 1. Update Environment Variables

```env
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-production-secret
GITHUB_ID=your-github-client-id
GITHUB_SECRET=your-github-client-secret
DOMAIN=your-domain.com
```

### 2. Update GitHub OAuth Callback

Update your GitHub OAuth App callback URL to:
```
https://your-domain.com/api/auth/callback/github
```

### 3. Deploy with Docker Compose

```bash
docker-compose up -d
```

Traefik will automatically:
- Obtain SSL certificates from Let's Encrypt
- Route traffic to the correct containers
- Handle HTTPS redirects

## Usage

### Creating a Workspace

1. Sign in with GitHub
2. Click "New Workspace"
3. Select a repository from your GitHub account
4. Enter a workspace name
5. Click "Create Workspace"

The system will:
- Create a Docker network and volume for the workspace
- Clone your repository
- Start OpenCode AI agent
- Start VS Code server
- Redirect you to the workspace page

### Workspace Features

- **Left Panel**: OpenCode AI agent for AI-assisted coding
- **Right Panel**: VS Code editor for manual code editing
- Both panels share the same workspace volume
- Changes are synchronized in real-time

### UI Features

- **Resizable Panels**: Drag the divider to resize OpenCode and VS Code panels
- **Layout Modes**: Toggle between horizontal (side-by-side) and vertical (stacked) layouts
- **Focus Mode**: Hide the header for maximum coding space
- **Theme Toggle**: Switch between light, dark, and system themes
- **Keyboard Shortcuts**:
  - `Alt+1` - Show both panels
  - `Alt+2` - Show OpenCode only
  - `Alt+3` - Show VS Code only
  - `Alt+H` - Toggle header visibility
  - `Alt+L` - Toggle layout (horizontal/vertical)
  - `Alt+R` - Refresh panels
  - `Alt+F` - Toggle fullscreen

### Managing Workspaces

- **Start/Stop**: Control workspace containers to save resources
- **Delete**: Remove workspace and all associated containers
- **Open**: Access the workspace IDE

## API Endpoints

### Authentication
- `GET /api/auth/[...nextauth]` - NextAuth.js endpoints

### GitHub
- `GET /api/github/repos` - Fetch user's repositories

### Workspaces
- `GET /api/workspaces` - List all workspaces
- `POST /api/workspaces` - Create new workspace
- `GET /api/workspaces/[id]` - Get workspace details
- `PATCH /api/workspaces/[id]` - Update workspace (start/stop)
- `DELETE /api/workspaces/[id]` - Delete workspace
- `GET /api/workspaces/[id]/health` - Check container health status

## Security Considerations

- Docker Socket Proxy limits Docker API access
- Each workspace runs in isolated Docker network
- Resource limits prevent container abuse (2GB RAM, 2 CPUs per container)
- Authentication required for all operations
- GitHub tokens stored securely in database
- **No exposed ports** - All workspace containers are accessed via Traefik reverse proxy using hostname-based routing (e.g., `opencode-{id}.domain.com`, `vscode-{id}.domain.com`)

## Troubleshooting

### Containers won't start

Check Docker logs:
```bash
docker-compose logs -f
```

### Database connection issues

Ensure PostgreSQL is running:
```bash
docker-compose ps postgres
```

### Traefik routing issues

Check Traefik dashboard at http://localhost:8080

### Port conflicts

Ensure ports 80, 443, 5432, and 8080 are available. Note: Workspace containers don't require exposed ports - they're accessed via Traefik hostname routing.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT License - see LICENSE file for details
