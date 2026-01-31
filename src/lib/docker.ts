import Docker from 'dockerode';
import { prisma } from './prisma';

// Initialize Docker client - connect to docker-socket-proxy via TCP
const docker = new Docker({
  host: process.env.DOCKER_SOCKET_PROXY?.replace(':2375', '') || 'docker-socket-proxy',
  port: 2375,
});

// Helper function to pull an image if not present
async function pullImageIfNeeded(imageName: string): Promise<void> {
  try {
    // Check if image exists locally
    const images = await docker.listImages({
      filters: { reference: [imageName] }
    });

    if (images.length > 0) {
      console.log(`Image ${imageName} already exists locally`);
      return;
    }
  } catch {
    // If listing fails, try to pull anyway
  }

  console.log(`Pulling image ${imageName}...`);

  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    docker.pull(imageName, (err: Error | null, stream: any) => {
      if (err) {
        reject(err);
        return;
      }

      // Follow the pull progress
      docker.modem.followProgress(stream, (pullErr: Error | null) => {
        if (pullErr) {
          reject(pullErr);
        } else {
          console.log(`Successfully pulled ${imageName}`);
          resolve();
        }
      });
    });
  });
}

export interface WorkspaceContainerConfig {
  workspaceId: string;
  userId: string;
  githubRepo: string;
  githubBranch?: string;
  githubToken?: string;
  // Ports are no longer needed - Traefik routes via Docker network
}

export async function createWorkspaceContainer(config: WorkspaceContainerConfig) {
  const {
    workspaceId,
    userId,
    githubRepo,
    githubBranch = 'main',
    githubToken,
  } = config;

  const networkName = `workspace-${workspaceId}`;
  const mainNetwork = 'open-web-agent-2_web';
  const volumeName = `workspace-${workspaceId}-data`;
  const opencodeDataVolume = `workspace-${workspaceId}-opencode`;

  // Clone repository URL with token if provided
  const repoUrl = githubToken
    ? githubRepo.replace('https://', `https://${githubToken}@`)
    : githubRepo;

  const domain = process.env.DOMAIN || 'localhost';

  // Image names
  const gitImage = 'alpine/git:latest';
  const codeServerImage = 'codercom/code-server:latest';
  const opencodeImage = 'ghcr.io/anomalyco/opencode:0.0.0-beta-202601311004';
  // const opencodeImage = 'ghcr.io/anomalyco/opencode:latest';

  try {
    // Pull all required images first
    console.log('Pulling required images...');
    await Promise.all([
      pullImageIfNeeded(gitImage),
      pullImageIfNeeded(codeServerImage),
      pullImageIfNeeded(opencodeImage),
    ]);
    console.log('All images pulled successfully');

    // Create Docker volume for workspace data
    await docker.createVolume({
      Name: volumeName,
      Driver: 'local',
      Labels: {
        'workspace.id': workspaceId,
      },
    });

    // Create Docker volume for OpenCode data (conversation history, sessions)
    await docker.createVolume({
      Name: opencodeDataVolume,
      Driver: 'local',
      Labels: {
        'workspace.id': workspaceId,
      },
    });

    // Fetch user's skills from database
    const skills = await (prisma as any).skill.findMany({
      where: { userId },
    });

    // Fetch user's LLM providers and models from database
    const providers = await (prisma as any).lLMProvider.findMany({
      where: { userId, isEnabled: true },
      include: {
        models: {
          where: { isEnabled: true },
        },
      },
    });

    // Create dedicated network for this workspace
    await docker.createNetwork({
      Name: networkName,
      Driver: 'bridge',
    });

    // Build skills setup commands for the opencode container
    // Skills are placed in ~/.config/opencode/skills/<name>/SKILL.md (global config location)
    const skillsSetupCommands = skills.length > 0
      ? skills.map((skill: { name: string; content: string }) => {
        const skillDir = `/root/.config/opencode/skills/${skill.name}`;
        // Use base64 to handle complex content with special characters
        const escapedContent = Buffer.from(skill.content).toString('base64');
        return `mkdir -p ${skillDir} && echo '${escapedContent}' | base64 -d > ${skillDir}/SKILL.md`;
      }).join(' && ')
      : '';

    // Build opencode.json configuration for LLM providers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opencodeConfig: any = {
      $schema: 'https://opencode.ai/config.json',
      provider: {},
      enabled_providers: [],
      disabled_providers: [],
    };

    // Find default model across all providers
    const defaultProvider = providers.find((p: { isDefault: boolean }) => p.isDefault);
    const defaultModel = defaultProvider?.models.find((m: { isDefault: boolean }) => m.isDefault);

    if (defaultModel && defaultProvider) {
      // Use the native provider name and model ID
      const providerKey = defaultProvider.providerId.toLowerCase();
      opencodeConfig.model = `${providerKey}/${defaultModel.modelId}`;
    }

    // Build provider configuration using native OpenCode providers
    if (providers.length > 0) {
      for (const provider of providers) {
        const providerKey = provider.providerId.toLowerCase();
        
        // Add to enabled providers
        opencodeConfig.enabled_providers.push(providerKey);

        // Configure provider options
        opencodeConfig.provider[providerKey] = {
          options: {}
        };

        if (provider.baseUrl) {
          opencodeConfig.provider[providerKey].options.baseURL = provider.baseUrl;
        }

        if (provider.envVarName) {
          opencodeConfig.provider[providerKey].options.apiKey = `{env:${provider.envVarName}}`;
        }

        // Add any custom headers
        if (provider.headers && Object.keys(provider.headers).length > 0) {
          const customHeaders = { ...provider.headers };
          delete customHeaders.Authorization;
          
          if (Object.keys(customHeaders).length > 0) {
            opencodeConfig.provider[providerKey].options.headers = 
              opencodeConfig.provider[providerKey].options.headers || {};
            Object.assign(opencodeConfig.provider[providerKey].options.headers, customHeaders);
          }
        }

        // Note: We don't explicitly list models here anymore as OpenCode 
        // will use the enabled providers to discover them or use the default model string.
      }

      // Explicitly disable common providers that aren't enabled to avoid confusion
      const allPossibleProviders = ["openai", "anthropic", "google", "groq", "openrouter", "mistral", "together", "deepseek", "xai", "ollama", "lmstudio"];
      opencodeConfig.disabled_providers = allPossibleProviders.filter(p => !opencodeConfig.enabled_providers.includes(p));
    }

    // Generate opencode.json content
    const opencodeConfigJson = JSON.stringify(opencodeConfig, null, 2);
    const opencodeConfigBase64 = Buffer.from(opencodeConfigJson).toString('base64');

    // Command to write opencode.json to ~/.config/opencode/
    const opencodeConfigCommand = `mkdir -p /root/.config/opencode && echo '${opencodeConfigBase64}' | base64 -d > /root/.config/opencode/opencode.json`;

    // Create and run an init container to clone the repository
    const initContainer = await docker.createContainer({
      name: `init-${workspaceId}`,
      Image: gitImage,
      Entrypoint: ['sh', '-c'],
      Cmd: [
        // Clone repo only - skills are set up in the opencode container
        `git clone --branch ${githubBranch} ${repoUrl} /workspace`
      ],
      HostConfig: {
        Binds: [
          `${volumeName}:/workspace`
        ],
        AutoRemove: false,
      },
      Labels: {
        'workspace.id': workspaceId,
        'workspace.type': 'init',
      },
    });


    // Start init container and wait for completion
    await initContainer.start();

    // Wait for the init container to complete
    const initResult = await initContainer.wait();

    if (initResult.StatusCode !== 0) {
      // Get logs for debugging
      const logs = await initContainer.logs({ stdout: true, stderr: true });
      console.error('Init container logs:', logs.toString());
      throw new Error(`Failed to clone repository. Exit code: ${initResult.StatusCode}`);
    }

    // Remove the init container after successful clone
    await initContainer.remove();

    // VS Code settings to disable welcome page and configure the editor
    const vscodeSettings = {
      "workbench.startupEditor": "none",
      "workbench.welcomePage.walkthroughs.openOnInstall": false,
      "workbench.tips.enabled": false,
      "security.workspace.trust.enabled": false,
      "security.workspace.trust.startupPrompt": "never",
      "git.openRepositoryInParentFolders": "always",
      "workbench.colorTheme": "Default Dark Modern",
      "window.autoDetectColorScheme": true,
      "telemetry.telemetryLevel": "off",
      "update.mode": "none",
      "extensions.autoUpdate": false,
      // Disable secondary sidebar (agent tab)
      "workbench.secondarySideBar.visible": false,
      "workbench.secondarySideBar.defaultVisibility": "hidden",
      "workbench.activityBar.location": "default",
      // Clean UI
      "breadcrumbs.enabled": true,
      "editor.minimap.enabled": false,
      "workbench.layoutControl.enabled": false
    };

    // Create code-server container using codercom/code-server for better settings support
    const codeServerContainer = await docker.createContainer({
      name: `code-server-${workspaceId}`,
      Image: 'codercom/code-server:latest',
      User: '1000:1000',
      Entrypoint: ['sh', '-c'],
      Cmd: [
        // Create settings directory, write settings, then start code-server
        `mkdir -p /home/coder/.local/share/code-server/User && ` +
        `echo '${JSON.stringify(vscodeSettings)}' > /home/coder/.local/share/code-server/User/settings.json && ` +
        `exec code-server --bind-addr 0.0.0.0:8443 --auth none /home/coder/workspace`
      ],
      Env: [
        `TZ=UTC`,
      ],
      ExposedPorts: {
        '8443/tcp': {},
      },
      HostConfig: {
        // No PortBindings - Traefik routes via Docker network, no host ports needed
        Binds: [`${volumeName}:/home/coder/workspace`],
        NetworkMode: networkName,
        RestartPolicy: {
          Name: 'unless-stopped',
        },
        Memory: 2 * 1024 * 1024 * 1024, // 2GB
        NanoCpus: 2 * 1000000000, // 2 CPUs
      },
      Labels: {
        'traefik.enable': 'true',
        'traefik.docker.network': mainNetwork,
        [`traefik.http.routers.vscode-${workspaceId}.rule`]: `Host(\`vscode-${workspaceId}.${domain}\`)`,
        [`traefik.http.services.vscode-${workspaceId}.loadbalancer.server.port`]: '8443',
        [`traefik.http.routers.vscode-${workspaceId}.entrypoints`]: 'web',
        'workspace.id': workspaceId,
      },
    });

    // Build environment variables for opencode container
    const opencodeEnv: string[] = [];
    if (githubToken) {
      opencodeEnv.push(`GITHUB_TOKEN=${githubToken}`);
      opencodeEnv.push(`GH_TOKEN=${githubToken}`); // gh cli uses this
    }

    // Add API keys from providers as environment variables
    for (const provider of providers) {
      if (provider.apiKey && provider.envVarName) {
        opencodeEnv.push(`${provider.envVarName}=${provider.apiKey}`);
      }
    }

    // Create OpenCode container
    // Exposes port 3001 for OpenCode web UI and port 3000 for dev server preview
    const opencodeContainer = await docker.createContainer({
      name: `opencode-${workspaceId}`,
      Image: opencodeImage,
      Env: opencodeEnv,
      Entrypoint: ['sh', '-c'],
      Cmd: [
        // Install git, github-cli, nodejs/npm for running dev servers, and sqlite for session queries
        // Git credentials are configured via GITHUB_TOKEN/GH_TOKEN env vars
        // LLM provider API keys are configured via environment variables
        `apk add --no-cache git github-cli nodejs npm python3 sqlite` +
        ` && ${opencodeConfigCommand}` +
        (skillsSetupCommands ? ` && ${skillsSetupCommands}` : '') +
        ` && cd /workspace && exec opencode web --port 3001 --hostname 0.0.0.0`
      ],
      ExposedPorts: {
        '3001/tcp': {},
        '3000/tcp': {}, // Preview port for dev servers
      },
      HostConfig: {
        // No PortBindings - Traefik routes via Docker network, no host ports needed
        // Skills are set up in ~/.config/opencode/skills/ during container startup
        Binds: [
          `${volumeName}:/workspace`,
          `${opencodeDataVolume}:/root/.local/share/opencode`  // Persist conversation history
        ],
        NetworkMode: networkName,
        RestartPolicy: {
          Name: 'unless-stopped',
        },
        Memory: 4 * 1024 * 1024 * 1024,
        NanoCpus: 2 * 1000000000,
      },

      Labels: {
        'traefik.enable': 'true',
        'traefik.docker.network': mainNetwork,
        // OpenCode web UI router (port 3001)
        [`traefik.http.routers.opencode-${workspaceId}.rule`]:
          `Host(\`opencode-${workspaceId}.${domain}\`)`,
        [`traefik.http.routers.opencode-${workspaceId}.service`]:
          `opencode-${workspaceId}`,
        [`traefik.http.routers.opencode-${workspaceId}.entrypoints`]: 'web',
        [`traefik.http.services.opencode-${workspaceId}.loadbalancer.server.port`]:
          '3001',
        // Preview router for dev server (port 3000)
        [`traefik.http.routers.preview-${workspaceId}.rule`]:
          `Host(\`preview-${workspaceId}.${domain}\`)`,
        [`traefik.http.routers.preview-${workspaceId}.service`]:
          `preview-${workspaceId}`,
        [`traefik.http.routers.preview-${workspaceId}.entrypoints`]: 'web',
        [`traefik.http.services.preview-${workspaceId}.loadbalancer.server.port`]:
          '3000',
        // Middleware to remove X-Frame-Options so preview can be embedded in iframe
        [`traefik.http.middlewares.preview-headers-${workspaceId}.headers.customResponseHeaders.X-Frame-Options`]: '',
        [`traefik.http.middlewares.preview-headers-${workspaceId}.headers.customResponseHeaders.Content-Security-Policy`]: '',
        [`traefik.http.routers.preview-${workspaceId}.middlewares`]: `preview-headers-${workspaceId}`,
        'workspace.id': workspaceId,
      },
    });

    // Connect containers to the main web network so Traefik can route to them
    const webNetwork = docker.getNetwork(mainNetwork);
    await webNetwork.connect({
      Container: `code-server-${workspaceId}`,
    });
    await webNetwork.connect({
      Container: `opencode-${workspaceId}`,
    });

    // Start containers
    await codeServerContainer.start();
    await opencodeContainer.start();

    return {
      codeServerContainerId: codeServerContainer.id,
      opencodeContainerId: opencodeContainer.id,
      networkName,
      volumeName,
    };
  } catch (error) {
    console.error('Error creating workspace container:', error);
    // Cleanup on error
    try {
      await cleanupWorkspace(workspaceId);
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError);
    }
    throw error;
  }
}

export async function stopWorkspaceContainer(workspaceId: string) {
  try {
    const codeServerContainer = docker.getContainer(`code-server-${workspaceId}`);
    const opencodeContainer = docker.getContainer(`opencode-${workspaceId}`);

    await Promise.all([
      codeServerContainer.stop().catch(() => { }),
      opencodeContainer.stop().catch(() => { }),
    ]);

    return { success: true };
  } catch (error) {
    console.error('Error stopping workspace container:', error);
    throw error;
  }
}

export async function startWorkspaceContainer(workspaceId: string) {
  try {
    const codeServerContainer = docker.getContainer(`code-server-${workspaceId}`);
    const opencodeContainer = docker.getContainer(`opencode-${workspaceId}`);

    await Promise.all([
      codeServerContainer.start().catch(() => { }),
      opencodeContainer.start().catch(() => { }),
    ]);

    return { success: true };
  } catch (error) {
    console.error('Error starting workspace container:', error);
    throw error;
  }
}

export async function removeWorkspaceContainer(workspaceId: string) {
  try {
    await stopWorkspaceContainer(workspaceId);

    const codeServerContainer = docker.getContainer(`code-server-${workspaceId}`);
    const opencodeContainer = docker.getContainer(`opencode-${workspaceId}`);

    await Promise.all([
      codeServerContainer.remove({ force: true }).catch(() => { }),
      opencodeContainer.remove({ force: true }).catch(() => { }),
    ]);

    await cleanupWorkspace(workspaceId);

    return { success: true };
  } catch (error) {
    console.error('Error removing workspace container:', error);
    throw error;
  }
}

async function cleanupWorkspace(workspaceId: string) {
  const networkName = `workspace-${workspaceId}`;
  const volumeName = `workspace-${workspaceId}-data`;
  const opencodeDataVolume = `workspace-${workspaceId}-opencode`;

  try {
    // Try to remove init container if it still exists
    const initContainer = docker.getContainer(`init-${workspaceId}`);
    await initContainer.remove({ force: true }).catch(() => { });
  } catch {
    // Init container might not exist
  }

  try {
    const network = docker.getNetwork(networkName);
    await network.remove().catch(() => { });
  } catch {
    // Network might not exist
  }

  try {
    const volume = docker.getVolume(volumeName);
    await volume.remove().catch(() => { });
  } catch {
    // Volume might not exist
  }

  try {
    const opencodeVolume = docker.getVolume(opencodeDataVolume);
    await opencodeVolume.remove().catch(() => { });
  } catch {
    // Volume might not exist
  }
}


export async function getContainerStatus(workspaceId: string) {
  try {
    const codeServerContainer = docker.getContainer(`code-server-${workspaceId}`);
    const opencodeContainer = docker.getContainer(`opencode-${workspaceId}`);

    const [codeServerInfo, opencodeInfo] = await Promise.all([
      codeServerContainer.inspect().catch(() => null),
      opencodeContainer.inspect().catch(() => null),
    ]);

    return {
      codeServer: codeServerInfo?.State,
      opencode: opencodeInfo?.State,
    };
  } catch (error) {
    console.error('Error getting container status:', error);
    return null;
  }
}

export { docker };
