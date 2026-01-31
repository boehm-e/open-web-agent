import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import SkillsClient from '@/components/skills/SkillsClient';

export default async function SkillsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Fetch user's skills
  const skills = await (prisma as any).skill.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
  });


  return (
    <SkillsClient
      user={{
        name: session.user.name,
        email: session.user.email!,
        image: session.user.image,
      }}
      initialSkills={skills}
    />
  );
}
