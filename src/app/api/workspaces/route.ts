import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createWorkspaceContainer } from '@/lib/docker';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaces = await prisma.workspace.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ workspaces });
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workspaces' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, githubRepo, githubBranch = 'main' } = body;

    if (!name || !githubRepo) {
      return NextResponse.json(
        { error: 'Name and GitHub repository are required' },
        { status: 400 }
      );
    }

    // Create workspace in database
    const workspace = await prisma.workspace.create({
      data: {
        name,
        githubRepo,
        githubBranch,
        userId: session.user.id,
        status: 'pending',
      },
    });

    try {
      // Update workspace status to starting
      await prisma.workspace.update({
        where: { id: workspace.id },
        data: { status: 'starting' },
      });

      // Create Docker containers
      // No ports needed - Traefik routes via Docker network using container labels
      const containerInfo = await createWorkspaceContainer({
        workspaceId: workspace.id,
        githubRepo,
        githubBranch,
        githubToken: session.user.githubToken || undefined,
      });

      // Update workspace with container info
      const updatedWorkspace = await prisma.workspace.update({
        where: { id: workspace.id },
        data: {
          containerId: containerInfo.opencodeContainerId,
          status: 'running',
        },
      });

      return NextResponse.json({ workspace: updatedWorkspace });
    } catch (error) {
      // Update workspace status to error
      await prisma.workspace.update({
        where: { id: workspace.id },
        data: { status: 'error' },
      });
      throw error;
    }
  } catch (error) {
    console.error('Error creating workspace:', error);
    return NextResponse.json(
      { error: 'Failed to create workspace' },
      { status: 500 }
    );
  }
}
