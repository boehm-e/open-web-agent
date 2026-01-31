import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/providers/[id]/models - List all models for a provider
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
    
    // Verify provider exists and belongs to user
    const provider = await (prisma as any).lLMProvider.findUnique({
      where: { id },
    });
    
    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }
    
    if (provider.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const models = await (prisma as any).lLMModel.findMany({
      where: { providerId: id },
      orderBy: { name: 'asc' },
    });
    
    return NextResponse.json(models);
  } catch (error) {
    console.error('Error fetching models:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/providers/[id]/models - Add a model to a provider
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id } = await params;
    
    // Verify provider exists and belongs to user
    const provider = await (prisma as any).lLMProvider.findUnique({
      where: { id },
    });
    
    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }
    
    if (provider.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const body = await request.json();
    const { 
      modelId, 
      name, 
      description, 
      isEnabled = true, 
      isDefault = false,
      options,
      variants,
    } = body;
    
    // Validate model ID
    if (!modelId || modelId.length === 0) {
      return NextResponse.json({ error: 'Model ID is required' }, { status: 400 });
    }
    
    // Validate name
    if (!name || name.length === 0) {
      return NextResponse.json({ error: 'Model name is required' }, { status: 400 });
    }
    
    // Check for duplicate model ID within this provider
    const existing = await (prisma as any).lLMModel.findUnique({
      where: {
        providerId_modelId: {
          providerId: id,
          modelId,
        },
      },
    });
    
    if (existing) {
      return NextResponse.json({ error: 'A model with this ID already exists for this provider' }, { status: 409 });
    }
    
    // If setting as default, unset other defaults for this provider
    if (isDefault) {
      await (prisma as any).lLMModel.updateMany({
        where: { providerId: id, isDefault: true },
        data: { isDefault: false },
      });
    }
    
    const model = await (prisma as any).lLMModel.create({
      data: {
        modelId,
        name,
        description: description || '',
        providerId: id,
        isEnabled,
        isDefault,
        options: options || {},
        variants: variants || {},
      },
    });
    
    return NextResponse.json(model, { status: 201 });
  } catch (error) {
    console.error('Error creating model:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
