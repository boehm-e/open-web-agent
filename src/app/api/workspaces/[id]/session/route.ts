import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// This endpoint manages the OpenCode session ID for a workspace
// We store the session ID in the containerUrl field (repurposed, not used for Traefik-based routing)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: workspaceId } = await params;

  // Get workspace
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId, userId: session.user.id },
  });

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  // Return session ID if stored in containerUrl (repurposed field)
  // Format: "opencode-session:{sessionId}" to distinguish from other potential uses
  const containerUrl = workspace.containerUrl;
  let sessionId = null;
  if (containerUrl?.startsWith('opencode-session:')) {
    sessionId = containerUrl.replace('opencode-session:', '');
  }

  return NextResponse.json({ sessionId });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: workspaceId } = await params;
  const body = await request.json();
  const { sessionId } = body;

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  // Get workspace
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId, userId: session.user.id },
  });

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  // Store session ID in containerUrl field
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      containerUrl: `opencode-session:${sessionId}`,
    },
  });

  return NextResponse.json({ success: true, sessionId });
}
