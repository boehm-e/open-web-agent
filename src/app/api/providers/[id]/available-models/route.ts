import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Fetch models from provider API
async function fetchModelsFromProvider(
  baseUrl: string,
  apiKey: string,
  providerType: string
): Promise<Array<{ id: string; name: string; description?: string; contextLength?: number; maxTokens?: number }>> {
  try {
    let url = `${baseUrl}/models`;
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Adjust URL and headers based on provider type
    const type = providerType.toUpperCase();
    
    if (type === 'ANTHROPIC') {
      url = `${baseUrl}/v1/models`; // Anthropic usually uses /v1/models
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else if (type === 'GOOGLE') {
      // Google Gemini uses a different approach, often via API key in URL
      url = `${baseUrl}/models?key=${apiKey}`;
    } else {
      // OpenAI compatible
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch models from ${providerType} (${response.status}):`, errorText);
      return [];
    }

    const data = await response.json();

    // Parse response based on provider type
    
    // OpenAI-compatible APIs return: { data: [ { id: string, ...}, ... ] }
    if (data.data && Array.isArray(data.data)) {
      return data.data.map((model: any) => ({
        id: model.id,
        name: model.id,
        description: model.description,
        contextLength: model.context_length,
        maxTokens: model.max_tokens || (model.context_length ? Math.floor(model.context_length / 2) : 8192),
      }));
    }

    // Anthropic API format: { data: [ { id: string, display_name: string, ... }, ... ] }
    if (data.data && type === 'ANTHROPIC' && Array.isArray(data.data)) {
      return data.data.map((model: any) => ({
        id: model.id,
        name: model.display_name || model.id,
        description: model.description,
        contextLength: model.context_window,
        maxTokens: model.max_output_tokens || 8192,
      }));
    }

    // Google API format: { models: [ { name: string, displayName: string, ... }, ... ] }
    if (data.models && Array.isArray(data.models)) {
      return data.models.map((model: any) => ({
        id: model.name.replace('models/', ''),
        name: model.displayName || model.name,
        description: model.description,
        contextLength: model.inputTokenLimit,
        maxTokens: model.outputTokenLimit || 8192,
      }));
    }

    return [];
  } catch (error) {
    console.error(`Error fetching models from ${providerType}:`, error);
    return [];
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get provider to determine type and credentials
    const provider = await (prisma as any).lLMProvider.findUnique({
      where: { id },
    });

    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    // Verify ownership
    if (provider.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch models from the provider's API if credentials are available
    if (provider.baseUrl) {
      // Use the stored API key if it exists
      const apiKey = provider.apiKey;
      
      const models = await fetchModelsFromProvider(provider.baseUrl, apiKey || '', provider.type || 'openai');
      return NextResponse.json({ models });
    }

    // Return empty array if no credentials
    return NextResponse.json({ models: [] });
  } catch (error) {
    console.error('Error fetching available models:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
