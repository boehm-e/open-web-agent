# Open Web Agent Platform - Architecture & Implementation Plan

## Overview

A web-based IDE platform similar to OpenHands that allows users to:
1. Authenticate via GitHub OAuth
2. Select a GitHub project from their repositories
3. Launch a sandbox environment with:
   - OpenCode (AI coding agent) in a Docker container
   - VS Code (code-server) for file editing
   - Both accessible via iframes in a split-pane workspace

## System Architecture

```mermaid
graph TB
    subgraph User Browser
        FE[Next.js Frontend]
        WS[Workspace Page /workspace/{id}]
        I1[iFrame - OpenCode]
        I2[iFrame - VS Code]
    end
    
    subgraph Reverse Proxy - Traefik
        RP[Traefik Reverse Proxy]
    end
    
    subgraph API Server
        API[Next.js API Routes]
        AUTH[NextAuth.js]
        DOCKER[Docker Socket Proxy]
    end
    
    subgraph Dynamic Workspaces
        WC1[Workspace Container 1]
        OC1[OpenCode Instance]
        VS1[VS Code Server]
    end
    
    subgraph Database
        DB[(PostgreSQL - Users/Workspaces)]
    end
    
    subgraph GitHub
        GH[GitHub API]
    end
    
    FE --> RP
    WS --> I1
    WS --> I2
    RP --> API
    API --> AUTH
    API --> DOCKER
    DOCKER --> WC1
    WC1 --> OC1
    WC1 --> VS1
    AUTH --> GH
    API --> DB
```

## Technology Stack

### Core Application
- **Framework**: Next.js 15 (App Router)
- **Authentication**: NextAuth.js v5 with GitHub OAuth
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS + shadcn/ui

### Docker Infrastructure
- **Container Runtime**: Docker + Docker Compose
- **Sandbox Containers**: 
  - OpenCode: `ghcr.io/anomalyco/opencode:latest`
  - VS Code: `lscr.io/linuxserver/code-server:latest`
- **Reverse Proxy**: Traefik v3
- **Docker Socket Proxy**: Tecnativa/docker-socket-proxy

### Communication
- **WebSocket**: Real-time communication between iframes
- **REST API**: Container management and status

## Project Structure

```
open-web-agent/
├── docker-compose.yml
├── .env.example
├── traefik/
│   ├── traefik.yml
│   ├── acme.json
│   └── dynamic/
│       └── middlewares.yml
├── apps/
│   └── web/
│       ├── Dockerfile
│       ├── next.config.js
│       ├── package.json
│       ├── tsconfig.json
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       ├── .env.local
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx
│       │   │   ├── globals.css
│       │   │   ├── api/
│       │   │   │   ├── auth/
│       │   │   │   │   └── [...nextauth]/
│       │   │   │   │       └── route.ts
│       │   │   │   ├── workspaces/
│       │   │   │   │   ├── route.ts
│       │   │   │   │   └── [id]/
│       │   │   │   │       └── route.ts
│       │   │   │   ├── containers/
│       │   │   │   │   └── route.ts
│       │   │   │   └── github/
│       │   │   │       └── repos/
│       │   │   │           └── route.ts
│       │   │   ├── dashboard/
│       │   │   │   └── page.tsx
│       │   │   ├── workspace/
│       │   │   │   └── [workspaceId]/
│       │   │   │       └── page.tsx
│       │   │   └── login/
│       │   │       └── page.tsx
│       │   ├── components/
│       │   │   ├── ui/
│       │   │   ├── auth/
│       │   │   ├── workspace/
│       │   │   │   ├── WorkspaceLayout.tsx
│       │   │   │   ├── OpenCodeFrame.tsx
│       │   │   │   ├── VSCodeFrame.tsx
│       │   │   │   ├── SplitPane.tsx
│       │   │   │   └── ContainerManager.tsx
│       │   │   └── dashboard/
│       │   │       ├── ProjectList.tsx
│       │   │       └── LaunchButton.tsx
│       │   ├── lib/
│       │   │   ├── auth.ts
│       │   │   ├── docker.ts
│       │   │   ├── prisma.ts
│       │   │   └── github.ts
│       │   ├── hooks/
│       │   │   ├── useWorkspace.ts
│       │   │   └── useDocker.ts
│       │   └── types/
│       │       └── index.ts
│       └── prisma/
│           └── schema.prisma
└── scripts/
    └── generate-env.ts
```

## Database Schema

```prisma
// prisma/schema.prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  githubId      String    @unique
  githubToken   String?
  workspaces    Workspace[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Workspace {
  id            String    @id @default(cuid())
  name          String
  userId        String
  user          User      @relation(fields: [userId], references: [id])
  githubRepo    String
  containerId   String?
  containerUrl  String?
  opencodePort  Int?
  vscodePort    Int?
  status        String    @default("pending") // pending, starting, running, stopped, error
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

## Implementation Steps

### Step 1: Project Setup & Configuration

1. Initialize Next.js 15 project with TypeScript
2. Configure Tailwind CSS + shadcn/ui
3. Set up Prisma with PostgreSQL
4. Create environment variables template

### Step 2: Authentication (NextAuth.js)

1. Configure GitHub OAuth provider
2. Create Prisma adapter
3. Implement session management
4. Protect routes with middleware

### Step 3: GitHub Integration

1. Fetch user's repositories
2. Display project list with filtering
3. Store selected repo info

### Step 4: Docker Container Management

1. Set up Docker Socket Proxy for secure container control
2. Create API endpoints for:
   - Creating workspace containers
   - Starting/stopping containers
   - Getting container status
3. Implement container lifecycle management

### Step 5: Workspace Container Setup

1. Create Docker container template with:
   - OpenCode installed
   - VS Code (code-server) installed
   - Git clone on startup
   - Proper port exposure
2. Configure container networking
3. Set up authentication for VS Code

### Step 6: Workspace UI

1. Create workspace page layout
2. Implement split-pane component
3. Add OpenCode iframe
4. Add VS Code iframe
5. Handle iframe communication via postMessage

### Step 7: Traefik Configuration

1. Set up Traefik as reverse proxy
2. Configure dynamic routing for workspaces
3. Set up SSL with Let's Encrypt
4. Configure middleware (auth, rate limiting)

### Step 8: Security Hardening

1. Implement container resource limits
2. Add network isolation
3. Set up proper CORS policies
4. Secure Docker socket access
5. Add rate limiting

## Docker Compose Configuration

```yaml
version: '3.8'

services:
  traefik:
    image: traefik:v3.0
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--log.level=INFO"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik/traefik.yml:/traefik.yml:ro
      - ./traefik/acme.json:/acme.json
      - traefik-certificates:/certificates
    networks:
      - web
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`traefik.${DOMAIN}`)"
      - "traefik.http.routers.api.service=api@internal"

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - web
    labels:
      - "traefik.enable=false"

  docker-socket-proxy:
    image: tecnativa/docker-socket-proxy:latest
    environment:
      CONTAINERS: 1
      IMAGES: 1
      NETWORKS: 1
      SERVICES: 1
      TASKS: 1
      POST: 0
      BUILD: 0
      COMMIT: 0
      CONFIGS: 0
      DISTRIBUTION: 0
      EXEC: 0
      IMAGES: 1
      INFO: 1
      NODES: 1
      PLUGINS: 1
      SECRETS: 0
      SWARM: 0
      SYSTEM: 0
      TASKS: 1
      VOLUMES: 1
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - web
    labels:
      - "traefik.enable=false"

  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
    environment:
      NEXTAUTH_URL: https://${DOMAIN}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      GITHUB_ID: ${GITHUB_ID}
      GITHUB_SECRET: ${GITHUB_SECRET}
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      DOCKER_SOCKET_PROXY: docker-socket-proxy:2375
    networks:
      - web
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.web.rule=Host(`${DOMAIN}`)"
      - "traefik.http.routers.web.tls.certresolver=letsencrypt"

networks:
  web:
    external: false

volumes:
  postgres-data:
  traefik-certificates:
```

## Environment Variables

```bash
# App
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-super-secret-key

# GitHub OAuth
GITHUB_ID=your-github-client-id
GITHUB_SECRET=your-github-client-secret

# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=secure-password
POSTGRES_DB=open_web_agent

# Docker
DOCKER_SOCKET_PROXY=docker-socket-proxy:2375

# Domain
DOMAIN=your-domain.com
```

## Workspace Container Template

```yaml
# workspace template (generated dynamically)
services:
  workspace-${workspaceId}:
    image: ghcr.io/anomalyco/opencode:latest
    container_name: workspace-${workspaceId}
    command: >
      bash -c "
        git clone ${githubRepo} /workspace/project &&
        cd /workspace/project &&
        opencode serve --port 3001 --host 0.0.0.0
      "
    ports:
      - "${opencodePort}:3001"
    volumes:
      - workspace-data-${workspaceId}:/workspace
    networks:
      - web
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.opencode-${workspaceId}.rule=Host(`opencode-${workspaceId}.${DOMAIN}`)"
      - "traefik.http.services.opencode-${workspaceId}.loadbalancer.server.port=3001"

  code-server-${workspaceId}:
    image: lscr.io/linuxserver/code-server:latest
    container_name: code-server-${workspaceId}
    environment:
      PASSWORD: ${vscodePassword}
      PROXY_DOMAIN: vscode-${workspaceId}.${DOMAIN}
    volumes:
      - workspace-data-${workspaceId}:/config/workspace
    ports:
      - "${vscodePort}:8443"
    networks:
      - web
    depends_on:
      - workspace-${workspaceId}
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.vscode-${workspaceId}.rule=Host(`vscode-${workspaceId}.${DOMAIN}`)"
      - "traefik.http.services.vscode-${workspaceId}.loadbalancer.server.port=8443"
```

## Security Considerations

1. **Docker Socket Proxy**: Only expose necessary Docker API permissions
2. **Container Isolation**: Use separate networks for each workspace
3. **Resource Limits**: Set memory and CPU limits on workspace containers
4. **Authentication**: All API endpoints require valid session
5. **CORS**: Restrict iframe embedding to same origin
6. **Rate Limiting**: Implement request rate limiting on API routes
7. **Secrets**: Never commit secrets to version control

## Communication Flow

```mermaid
sequenceDiagram
    participant User
    participant NextJS
    participant DockerAPI
    participant WorkspaceContainer
    participant OpenCode
    participant VSCode

    User->>NextJS: Click "Launch Sandbox"
    NextJS->>DockerAPI: Create container with OpenCode + VS Code
    DockerAPI->>WorkspaceContainer: Clone repo, install tools
    WorkspaceContainer->>OpenCode: Start on port 3001
    WorkspaceContainer->>VSCode: Start on port 8443
    
    NextJS->>User: Redirect to /workspace/{id}
    User->>OpenCode: Open iframe to opencode-{id}.domain
    User->>VSCode: Open iframe to vscode-{id}.domain
    
    loop Real-time
        OpenCode<->>User: postMessage communication
        VSCode<->>User: postMessage communication
    end
```

## Next Steps

1. Review and approve this architecture plan
2. Switch to Code mode to start implementation
3. Begin with Step 1: Project setup
4. Iterate through each step systematically
5. Test thoroughly at each milestone
