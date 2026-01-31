import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

// Fetch models from provider API
async function fetchModelsFromProvider(
  baseUrl: string,
  apiKey: string,
  providerType: string
): Promise<Array<{ id: string; name: string; description?: string; contextLength?: number; maxTokens?: number }>> {
  try {
    // Make API call to provider's models endpoint
    const url = `${baseUrl}/models`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch models from ${providerType}:`, response.statusText);
      return [];
    }

    const data = await response.json();
    
    // Parse response based on provider type
    // OpenAI-compatible APIs return: { data: [ { id: string, ...}, ... ] }
    if (data.data && Array.isArray(data.data)) {
      return data.data.map((model: any) => ({
        id: model.id,
        name: model.id, // Use ID as name by default
        description: model.description,
        contextLength: model.context_length,
        maxTokens: model.max_tokens || (model.context_length ? Math.floor(model.context_length / 2) : 8192),
      }));
    }

    // Anthropic API format
    if (data.models && Array.isArray(data.models)) {
      return data.models.map((model: any) => ({
        id: model.id,
        name: model.display_name || model.id,
        description: model.description,
        contextLength: model.context_window,
        maxTokens: model.max_output_tokens || 8192,
      }));
    }

    return [];
  } catch (error) {
    console.error(`Error fetching models from ${providerType}:`, error);
    return [];
  }
}

// GET /api/providers/available-models?baseUrl=...&apiKey=...&type=... - Fetch models from provider
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const baseUrl = searchParams.get('baseUrl');
    const apiKey = searchParams.get('apiKey');
    const providerType = searchParams.get('type') || 'openai';

    if (!baseUrl || !apiKey) {
      return NextResponse.json({ 
        error: 'baseUrl and apiKey are required parameters',
        models: []
      }, { status: 400 });
    }

    // Fetch models from the provider's API
    const models = await fetchModelsFromProvider(baseUrl, apiKey, providerType);

    return NextResponse.json({ models });
  } catch (error) {
    console.error('Error fetching available models:', error);
    return NextResponse.json({ error: 'Internal server error', models: [] }, { status: 500 });
  }
}
