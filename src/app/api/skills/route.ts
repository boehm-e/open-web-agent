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

// GET /api/skills - List all skills for current user
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const skills = await (prisma as any).skill.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        license: true,
        compatibility: true,
        metadata: true,
        isGlobal: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    return NextResponse.json(skills);
  } catch (error) {
    console.error('Error fetching skills:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/skills - Create a new skill
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { name, description, license, compatibility, metadata, bodyContent, isGlobal } = body;
    
    // Validate name
    const nameValidation = validateSkillName(name);
    if (!nameValidation.valid) {
      return NextResponse.json({ error: nameValidation.error }, { status: 400 });
    }
    
    // Validate description
    const descValidation = validateDescription(description);
    if (!descValidation.valid) {
      return NextResponse.json({ error: descValidation.error }, { status: 400 });
    }
    
    // Check for duplicate name
    const existing = await (prisma as any).skill.findUnique({
      where: {
        userId_name: {
          userId: session.user.id,
          name,
        },
      },
    });
    
    if (existing) {
      return NextResponse.json({ error: 'A skill with this name already exists' }, { status: 409 });
    }
    
    // Generate full SKILL.md content
    const content = generateSkillContent({
      name,
      description,
      license,
      compatibility,
      metadata,
      bodyContent,
    });
    
    const skill = await (prisma as any).skill.create({
      data: {
        name,
        description,
        content,
        license,
        compatibility,
        metadata: metadata || {},
        isGlobal: isGlobal ?? false,
        userId: session.user.id,
      },
    });
    
    return NextResponse.json(skill, { status: 201 });
  } catch (error) {
    console.error('Error creating skill:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


