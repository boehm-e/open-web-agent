import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Skill name validation regex: lowercase alphanumeric with single hyphen separators
const SKILL_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Validate skill name according to OpenCode spec
function validateSkillName(name: string): { valid: boolean; error?: string } {
  if (!name || name.length === 0) {
    return { valid: false, error: 'Skill name is required' };
  }
  if (name.length > 64) {
    return { valid: false, error: 'Skill name must be 1-64 characters' };
  }
  if (name.startsWith('-') || name.endsWith('-')) {
    return { valid: false, error: 'Skill name cannot start or end with a hyphen' };
  }
  if (name.includes('--')) {
    return { valid: false, error: 'Skill name cannot contain consecutive hyphens' };
  }
  if (!SKILL_NAME_REGEX.test(name)) {
    return { valid: false, error: 'Skill name must be lowercase alphanumeric with single hyphen separators' };
  }
  return { valid: true };
}

// Validate skill description
function validateDescription(description: string): { valid: boolean; error?: string } {
  if (!description || description.length === 0) {
    return { valid: false, error: 'Description is required' };
  }
  if (description.length > 1024) {
    return { valid: false, error: 'Description must be 1-1024 characters' };
  }
  return { valid: true };
}

// Generate SKILL.md content from skill data
function generateSkillContent(skill: {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  bodyContent?: string;
}): string {
  let frontmatter = '---\n';
  frontmatter += `name: ${skill.name}\n`;
  frontmatter += `description: ${skill.description}\n`;
  
  if (skill.license) {
    frontmatter += `license: ${skill.license}\n`;
  }
  if (skill.compatibility) {
    frontmatter += `compatibility: ${skill.compatibility}\n`;
  }
  if (skill.metadata && Object.keys(skill.metadata).length > 0) {
    frontmatter += 'metadata:\n';
    for (const [key, value] of Object.entries(skill.metadata)) {
      frontmatter += `  ${key}: ${value}\n`;
    }
  }
  
  frontmatter += '---\n\n';
  
  return frontmatter + (skill.bodyContent || '');
}

// Parse SKILL.md content to extract frontmatter and body
function parseSkillContent(content: string): {
  name?: string;
  description?: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  bodyContent: string;
} {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  
  if (!frontmatterMatch) {
    return { bodyContent: content };
  }
  
  const [, frontmatterStr, bodyContent] = frontmatterMatch;
  const result: {
    name?: string;
    description?: string;
    license?: string;
    compatibility?: string;
    metadata?: Record<string, string>;
    bodyContent: string;
  } = { bodyContent: bodyContent };

  
  // Simple YAML parsing for frontmatter
  const lines = frontmatterStr.split('\n');
  let inMetadata = false;
  
  for (const line of lines) {
    if (line.startsWith('metadata:')) {
      inMetadata = true;
      result.metadata = {};
      continue;
    }
    
    if (inMetadata && line.startsWith('  ')) {
      const [key, ...valueParts] = line.trim().split(':');
      if (key && valueParts.length > 0) {
        result.metadata![key.trim()] = valueParts.join(':').trim();
      }
      continue;
    } else if (inMetadata && !line.startsWith('  ')) {
      inMetadata = false;
    }
    
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      const value = valueParts.join(':').trim();
      switch (key.trim()) {
        case 'name':
          result.name = value;
          break;
        case 'description':
          result.description = value;
          break;
        case 'license':
          result.license = value;
          break;
        case 'compatibility':
          result.compatibility = value;
          break;
      }
    }
  }
  
  return result;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/skills/[id] - Get a single skill with full content
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id } = await params;
    
    const skill = await (prisma as any).skill.findUnique({
      where: { id },
    });
    
    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }
    
    if (skill.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Parse content to extract body
    const parsed = parseSkillContent(skill.content);
    
    return NextResponse.json({
      ...skill,
      bodyContent: parsed.bodyContent,
    });
  } catch (error) {
    console.error('Error fetching skill:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/skills/[id] - Update a skill
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id } = await params;
    
    const existingSkill = await (prisma as any).skill.findUnique({
      where: { id },
    });
    
    if (!existingSkill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }
    
    if (existingSkill.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const body = await request.json();
    const { name, description, license, compatibility, metadata, bodyContent, isGlobal } = body;
    
    // Validate name if changed
    if (name && name !== existingSkill.name) {
      const nameValidation = validateSkillName(name);
      if (!nameValidation.valid) {
        return NextResponse.json({ error: nameValidation.error }, { status: 400 });
      }
      
      // Check for duplicate name
      const duplicate = await (prisma as any).skill.findUnique({
        where: {
          userId_name: {
            userId: session.user.id,
            name,
          },
        },
      });
      
      if (duplicate && duplicate.id !== id) {
        return NextResponse.json({ error: 'A skill with this name already exists' }, { status: 409 });
      }
    }
    
    // Validate description if provided
    if (description) {
      const descValidation = validateDescription(description);
      if (!descValidation.valid) {
        return NextResponse.json({ error: descValidation.error }, { status: 400 });
      }
    }
    
    // Generate updated content
    const content = generateSkillContent({
      name: name || existingSkill.name,
      description: description || existingSkill.description,
      license: license ?? existingSkill.license,
      compatibility: compatibility ?? existingSkill.compatibility,
      metadata: metadata ?? (existingSkill.metadata as Record<string, string>),
      bodyContent,
    });
    
    const skill = await (prisma as any).skill.update({
      where: { id },
      data: {
        name: name || existingSkill.name,
        description: description || existingSkill.description,
        content,
        license: license ?? existingSkill.license,
        compatibility: compatibility ?? existingSkill.compatibility,
        metadata: metadata ?? existingSkill.metadata,
        isGlobal: isGlobal ?? existingSkill.isGlobal,
      },
    });
    
    const parsed = parseSkillContent(skill.content);
    
    return NextResponse.json({
      ...skill,
      bodyContent: parsed.bodyContent,
    });
  } catch (error) {
    console.error('Error updating skill:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/skills/[id] - Delete a skill
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id } = await params;
    
    const skill = await (prisma as any).skill.findUnique({
      where: { id },
    });
    
    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }
    
    if (skill.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    await (prisma as any).skill.delete({
      where: { id },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting skill:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

