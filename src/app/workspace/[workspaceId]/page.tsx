import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import WorkspaceClient from '@/components/workspace/WorkspaceClient';

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const { workspaceId } = await params;
  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      userId: session.user.id,
    },
  });

  if (!workspace) {
    redirect('/dashboard');
  }

  return <WorkspaceClient workspace={workspace} />;
}
