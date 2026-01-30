import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const service = searchParams.get('service');

    if (!service || !['opencode', 'vscode'].includes(service)) {
      return NextResponse.json({ error: 'Invalid service parameter' }, { status: 400 });
    }

    // Verify workspace belongs to user
    const workspace = await prisma.workspace.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Check if container is ready by trying to connect via Docker network
    // Containers are accessible by their container name on the Docker network
    // Note: vscode container is named 'code-server-{id}' not 'vscode-{id}'
    const containerName = service === 'opencode' 
      ? `opencode-${workspace.id}`
      : `code-server-${workspace.id}`;
    
    const port = service === 'opencode' ? 3001 : 8443;
    const url = `http://${containerName}:${port}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(url, {
        signal: controller.signal,
        method: 'HEAD',
      });
      
      clearTimeout(timeoutId);
      
      // Consider any response (even error pages) as "ready"
      // because it means the container's web server is up
      return NextResponse.json({ ready: true });
    } catch (fetchError) {
      // Container not ready yet
      return NextResponse.json({ ready: false });
    }
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 });
  }
}
