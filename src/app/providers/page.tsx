import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ProvidersClient from '@/components/providers/ProvidersClient';

export default async function ProvidersPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Fetch user's providers with models
  const providers = await (prisma as any).lLMProvider.findMany({
    where: { userId: session.user.id },
    include: {
      models: {
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Fetch known providers from API route (we'll use the KNOWN_PROVIDERS constant)
  const knownProviders = [
    {
      type: 'OPENAI',
      name: 'OpenAI',
      providerId: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      envVarName: 'OPENAI_API_KEY',
      defaultModels: [
        { modelId: 'gpt-4', name: 'GPT-4', description: 'Most capable GPT-4 model' },
        { modelId: 'gpt-5', name: 'GPT-5', description: 'Latest GPT-5 model' },
        { modelId: 'gpt-5.1-codex', name: 'GPT-5.1 Codex', description: 'Optimized for code' },
      ],
    },
    {
      type: 'ANTHROPIC',
      name: 'Anthropic',
      providerId: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      envVarName: 'ANTHROPIC_API_KEY',
      defaultModels: [
        { modelId: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', description: 'Latest Claude model' },
        { modelId: 'claude-opus-4-5', name: 'Claude Opus 4.5', description: 'Most capable Claude' },
      ],
    },
    {
      type: 'GOOGLE',
      name: 'Google',
      providerId: 'google',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      envVarName: 'GOOGLE_API_KEY',
      defaultModels: [
        { modelId: 'gemini-3-pro', name: 'Gemini 3 Pro', description: 'Latest Gemini 3' },
      ],
    },
    {
      type: 'OPENROUTER',
      name: 'OpenRouter',
      providerId: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      envVarName: 'OPENROUTER_API_KEY',
      defaultModels: [
        { modelId: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Via OpenRouter' },
      ],
    },
    {
      type: 'GROQ',
      name: 'Groq',
      providerId: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      envVarName: 'GROQ_API_KEY',
      defaultModels: [
        { modelId: 'llama-3.2-90b-text-preview', name: 'Llama 3.2 90B', description: 'Large Llama model' },
      ],
    },
    {
      type: 'OLLAMA',
      name: 'Ollama (Local)',
      providerId: 'ollama',
      baseUrl: 'http://localhost:11434/v1',
      envVarName: '',
      defaultModels: [
        { modelId: 'llama3', name: 'Llama 3', description: 'Local Llama 3' },
        { modelId: 'codellama', name: 'Code Llama', description: 'Local Code Llama' },
      ],
    },
  ];

  return (
    <ProvidersClient
      user={{
        name: session.user.name,
        email: session.user.email || '',
        image: session.user.image,
      }}
      initialProviders={providers}
      knownProviders={knownProviders}
    />
  );
}
