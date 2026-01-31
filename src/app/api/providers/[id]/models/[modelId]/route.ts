import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Helper to verify provider ownership
async function verifyProviderOwnership(providerId: string, userId: string) {
  const provider = await (prisma as any).lLMProvider.findUnique({
    where: { id: providerId },
  });
  
  if (!provider) {
    return { error: 'Provider not found', status: 404 };
  }
  
  if (provider.userId !== userId) {
    return { error: 'Unauthorized', status: 403 };
  }
  
  return { provider };
}

// GET /api/providers/[id]/models/[modelId] - Get a specific model
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; modelId: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id, modelId } = await params;
    
    const ownershipCheck = await verifyProviderOwnership(id, session.user.id);
    if ('error' in ownershipCheck) {
      return NextResponse.json({ error: ownershipCheck.error }, { status: ownershipCheck.status });
    }
    
    const model = await (prisma as any).lLMModel.findUnique({
      where: { id: modelId },
    });
    
    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }
    
    // Verify model belongs to the provider
    if (model.providerId !== id) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }
    
    return NextResponse.json(model);
  } catch (error) {
    console.error('Error fetching model:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/providers/[id]/models/[modelId] - Update a model
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; modelId: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id, modelId } = await params;
    
    const ownershipCheck = await verifyProviderOwnership(id, session.user.id);
    if ('error' in ownershipCheck) {
      return NextResponse.json({ error: ownershipCheck.error }, { status: ownershipCheck.status });
    }
    
    const existing = await (prisma as any).lLMModel.findUnique({
      where: { id: modelId },
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }
    
    if (existing.providerId !== id) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }
    
    const body = await request.json();
    const { 
      name, 
      description, 
      isEnabled, 
      isDefault,
      options,
      variants,
    } = body;
    
    // If setting as default, unset other defaults for this provider
    if (isDefault && !existing.isDefault) {
      await (prisma as any).lLMModel.updateMany({
        where: { providerId: id, isDefault: true },
        data: { isDefault: false },
      });
    }
    
    // Build update data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled;
    if (isDefault !== undefined) updateData.isDefault = isDefault;
    if (options !== undefined) updateData.options = options;
    if (variants !== undefined) updateData.variants = variants;
    
    const model = await (prisma as any).lLMModel.update({
      where: { id: modelId },
      data: updateData,
    });
    
    return NextResponse.json(model);
  } catch (error) {
    console.error('Error updating model:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/providers/[id]/models/[modelId] - Delete a model
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; modelId: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id, modelId } = await params;
    
    const ownershipCheck = await verifyProviderOwnership(id, session.user.id);
    if ('error' in ownershipCheck) {
      return NextResponse.json({ error: ownershipCheck.error }, { status: ownershipCheck.status });
    }
    
    const existing = await (prisma as any).lLMModel.findUnique({
      where: { id: modelId },
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }
    
    if (existing.providerId !== id) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }
    
    await (prisma as any).lLMModel.delete({
      where: { id: modelId },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting model:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
