import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchUserRepositories } from '@/lib/github';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const githubToken = session.user.githubToken;

    if (!githubToken) {
      return NextResponse.json({ error: 'GitHub token not found' }, { status: 400 });
    }

    const repositories = await fetchUserRepositories(githubToken);

    return NextResponse.json({ repositories });
  } catch (error) {
    console.error('Error fetching repositories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repositories' },
      { status: 500 }
    );
  }
}
