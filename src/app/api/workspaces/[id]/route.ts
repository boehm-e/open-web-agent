import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  stopWorkspaceContainer,
  startWorkspaceContainer,
  removeWorkspaceContainer,
  getContainerStatus,
} from '@/lib/docker';

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
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Get container status
    const containerStatus = await getContainerStatus(workspace.id);

    return NextResponse.json({ workspace, containerStatus });
  } catch (error) {
    console.error('Error fetching workspace:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workspace' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'stop') {
      await stopWorkspaceContainer(workspace.id);
      const updatedWorkspace = await prisma.workspace.update({
        where: { id: workspace.id },
        data: { status: 'stopped' },
      });
      return NextResponse.json({ workspace: updatedWorkspace });
    }

    if (action === 'start') {
      await startWorkspaceContainer(workspace.id);
      const updatedWorkspace = await prisma.workspace.update({
        where: { id: workspace.id },
        data: { status: 'running' },
      });
      return NextResponse.json({ workspace: updatedWorkspace });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating workspace:', error);
    return NextResponse.json(
      { error: 'Failed to update workspace' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Remove Docker containers
    await removeWorkspaceContainer(workspace.id);

    // Delete workspace from database
    await prisma.workspace.delete({
      where: { id: workspace.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting workspace:', error);
    return NextResponse.json(
      { error: 'Failed to delete workspace' },
      { status: 500 }
    );
  }
}
