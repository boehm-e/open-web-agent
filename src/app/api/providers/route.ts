import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Known providers with their default configurations (no default models - fetched dynamically)
const KNOWN_PROVIDERS = {
  OPENAI: {
    name: 'OpenAI',
    providerId: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    envVarName: 'OPENAI_API_KEY',
  },
  ANTHROPIC: {
    name: 'Anthropic',
    providerId: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    envVarName: 'ANTHROPIC_API_KEY',
  },
  GOOGLE: {
    name: 'Google',
    providerId: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    envVarName: 'GOOGLE_API_KEY',
  },
  OPENROUTER: {
    name: 'OpenRouter',
    providerId: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    envVarName: 'OPENROUTER_API_KEY',
  },
  GROQ: {
    name: 'Groq',
    providerId: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    envVarName: 'GROQ_API_KEY',
  },
  TOGETHER: {
    name: 'Together AI',
    providerId: 'together',
    baseUrl: 'https://api.together.xyz/v1',
    envVarName: 'TOGETHER_API_KEY',
  },
  MISTRAL: {
    name: 'Mistral AI',
    providerId: 'mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    envVarName: 'MISTRAL_API_KEY',
  },
  DEEPSEEK: {
    name: 'DeepSeek',
    providerId: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    envVarName: 'DEEPSEEK_API_KEY',
  },
  XAI: {
    name: 'xAI',
    providerId: 'xai',
    baseUrl: 'https://api.x.ai/v1',
    envVarName: 'XAI_API_KEY',
  },
  OLLAMA: {
    name: 'Ollama (Local)',
    providerId: 'ollama',
    baseUrl: 'http://localhost:11434/v1',
    envVarName: null,
  },
  LMSTUDIO: {
    name: 'LM Studio (Local)',
    providerId: 'lmstudio',
    baseUrl: 'http://localhost:1234/v1',
    envVarName: null,
  },
  AZURE_OPENAI: {
    name: 'Azure OpenAI',
    providerId: 'azure',
    baseUrl: null, // User must provide
    envVarName: 'AZURE_OPENAI_API_KEY',
  },
  AWS_BEDROCK: {
    name: 'AWS Bedrock',
    providerId: 'bedrock',
    baseUrl: null, // AWS SDK handles this
    envVarName: null, // Uses AWS credentials
  },
} as const;

// Provider ID validation
function validateProviderId(providerId: string): { valid: boolean; error?: string } {
  if (!providerId || providerId.length === 0) {
    return { valid: false, error: 'Provider ID is required' };
  }
  if (providerId.length > 64) {
    return { valid: false, error: 'Provider ID must be 1-64 characters' };
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(providerId)) {
    return { valid: false, error: 'Provider ID must be lowercase alphanumeric with single hyphen separators' };
  }
  return { valid: true };
}

// GET /api/providers - List all providers for current user
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const providers = await (prisma as any).lLMProvider.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        models: {
          orderBy: { name: 'asc' },
        },
      },
    });
    
    // Don't return API keys in response
    const safeProviders = providers.map((p: { apiKey?: string }) => ({
      ...p,
      apiKey: p.apiKey ? '••••••••' : null,
    }));
    
    return NextResponse.json({
      providers: safeProviders,
      knownProviders: Object.entries(KNOWN_PROVIDERS).map(([type, config]) => ({
        type,
        ...config,
      })),
    });
  } catch (error) {
    console.error('Error fetching providers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/providers - Create a new provider
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { 
      name, 
      providerId, 
      type = 'CUSTOM', 
      baseUrl, 
      apiKey, 
      envVarName,
      headers,
      options,
      isEnabled = true,
      isDefault = false,
      models = [],
    } = body;
    
    // Validate provider ID
    const idValidation = validateProviderId(providerId);
    if (!idValidation.valid) {
      return NextResponse.json({ error: idValidation.error }, { status: 400 });
    }
    
    // Validate name
    if (!name || name.length === 0) {
      return NextResponse.json({ error: 'Provider name is required' }, { status: 400 });
    }
    
    // For custom providers, base URL is required
    if (type === 'CUSTOM' && !baseUrl) {
      return NextResponse.json({ error: 'Base URL is required for custom providers' }, { status: 400 });
    }
    
    // Check for duplicate provider ID
    const existing = await (prisma as any).lLMProvider.findUnique({
      where: {
        userId_providerId: {
          userId: session.user.id,
          providerId,
        },
      },
    });
    
    if (existing) {
      return NextResponse.json({ error: 'A provider with this ID already exists' }, { status: 409 });
    }
    
    // If setting as default, unset other defaults
    if (isDefault) {
      await (prisma as any).lLMProvider.updateMany({
        where: { userId: session.user.id, isDefault: true },
        data: { isDefault: false },
      });
    }
    
    // Create provider
    const provider = await (prisma as any).lLMProvider.create({
      data: {
        name,
        providerId,
        type,
        baseUrl,
        apiKey,
        envVarName,
        headers: headers || {},
        options: options || {},
        isEnabled,
        isDefault,
        userId: session.user.id,
      },
    });
    
    // Fetch the complete provider
    const completeProvider = await (prisma as any).lLMProvider.findUnique({
      where: { id: provider.id },
      include: { models: true },
    });
    
    return NextResponse.json({
      ...completeProvider,
      apiKey: completeProvider.apiKey ? '••••••••' : null,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating provider:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
