import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/providers/[id] - Get a specific provider
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
    
    const provider = await (prisma as any).lLMProvider.findUnique({
      where: { id },
      include: { models: true },
    });
    
    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }
    
    // Verify ownership
    if (provider.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    return NextResponse.json({
      ...provider,
      apiKey: provider.apiKey ? '••••••••' : null,
    });
  } catch (error) {
    console.error('Error fetching provider:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/providers/[id] - Update a provider
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id } = await params;
    
    // Check if provider exists and belongs to user
    const existing = await (prisma as any).lLMProvider.findUnique({
      where: { id },
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }
    
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const body = await request.json();
    const { 
      name,
      baseUrl, 
      apiKey, 
      envVarName,
      headers,
      options,
      isEnabled,
      isDefault,
    } = body;
    
    // If setting as default, unset other defaults
    if (isDefault && !existing.isDefault) {
      await (prisma as any).lLMProvider.updateMany({
        where: { userId: session.user.id, isDefault: true },
        data: { isDefault: false },
      });
    }
    
    // Build update data - only include fields that were provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (baseUrl !== undefined) updateData.baseUrl = baseUrl;
    // Only update API key if a new one is provided (not the masked value)
    if (apiKey !== undefined && apiKey !== '••••••••') updateData.apiKey = apiKey;
    if (envVarName !== undefined) updateData.envVarName = envVarName;
    if (headers !== undefined) updateData.headers = headers;
    if (options !== undefined) updateData.options = options;
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled;
    if (isDefault !== undefined) updateData.isDefault = isDefault;
    
    const provider = await (prisma as any).lLMProvider.update({
      where: { id },
      data: updateData,
      include: { models: true },
    });
    
    return NextResponse.json({
      ...provider,
      apiKey: provider.apiKey ? '••••••••' : null,
    });
  } catch (error) {
    console.error('Error updating provider:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/providers/[id] - Delete a provider
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id } = await params;
    
    // Check if provider exists and belongs to user
    const existing = await (prisma as any).lLMProvider.findUnique({
      where: { id },
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }
    
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    // Delete provider (cascade will delete models)
    await (prisma as any).lLMProvider.delete({
      where: { id },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting provider:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
