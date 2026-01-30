export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  private: boolean;
  default_branch: string;
  updated_at: string;
  language: string | null;
  stargazers_count: number;
}

export async function fetchUserRepositories(accessToken: string): Promise<GitHubRepository[]> {
  try {
    const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const repos: GitHubRepository[] = await response.json();
    return repos;
  } catch (error) {
    console.error('Error fetching GitHub repositories:', error);
    throw error;
  }
}

export async function fetchRepository(accessToken: string, owner: string, repo: string): Promise<GitHubRepository> {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const repository: GitHubRepository = await response.json();
    return repository;
  } catch (error) {
    console.error('Error fetching GitHub repository:', error);
    throw error;
  }
}
