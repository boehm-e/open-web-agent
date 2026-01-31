'use client';

import { useState } from 'react';
import {
  Rocket,
  User,
  ChevronDown,
  LogOut,
  Plus,
  Search,
  Trash2,
  Save,
  Wand2,
  Brain,
  ArrowLeft,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/utils';

interface Skill {
  id: string;
  name: string;
  description: string;
  content: string;
  updatedAt: Date | string;
}

interface SkillsClientProps {
  user: {
    name?: string | null;
    email?: string;
    image?: string | null;
  };
  initialSkills: Skill[];
}

export default function SkillsClient({ user, initialSkills }: SkillsClientProps) {
  const router = useRouter();
  const [skills, setSkills] = useState<Skill[]>(initialSkills);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const filteredSkills = skills.filter((s) => {
    const query = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(query) ||
      s.description.toLowerCase().includes(query)
    );
  });

  const handleCreateSkill = () => {
    const newSkill: Skill = {
      id: 'new',
      name: 'New Skill',
      description: 'Describe what this skill does...',
      content: '---\nname: New Skill\ndescription: Describe what this skill does...\n---\n\n# New Skill\n\nWrite your skill logic here...',
      updatedAt: new Date(),
    };
    setSelectedSkill(newSkill);
    setIsEditing(true);
  };

  const handleSaveSkill = async () => {
    if (!selectedSkill) return;
    setIsSaving(true);
    try {
      const isNew = selectedSkill.id === 'new';
      const url = isNew ? '/api/skills' : `/api/skills/${selectedSkill.id}`;
      const method = isNew ? 'POST' : 'PUT';

      // Extract body content from the full content
      const frontmatterMatch = selectedSkill.content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
      const bodyContent = frontmatterMatch ? frontmatterMatch[1] : selectedSkill.content;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedSkill.name,
          description: selectedSkill.description,
          content: selectedSkill.content,
          bodyContent: bodyContent,
        }),
      });


      if (response.ok) {
        const savedSkill = await response.json();
        if (isNew) {
          setSkills([savedSkill, ...skills]);
        } else {
          setSkills(skills.map((s) => (s.id === savedSkill.id ? savedSkill : s)));
        }
        setSelectedSkill(savedSkill);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error saving skill:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSkill = async (id: string) => {
    if (!confirm('Are you sure you want to delete this skill?')) return;
    try {
      const response = await fetch(`/api/skills/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setSkills(skills.filter((s) => s.id !== id));
        if (selectedSkill?.id === id) {
          setSelectedSkill(null);
          setIsEditing(false);
        }
      }
    } catch (error) {
      console.error('Error deleting skill:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/dashboard')}>
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Rocket className="w-5 h-5 text-primary" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-foreground">Open Web Agent</h1>
                <p className="text-xs text-muted-foreground">Skills Manager</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle className="hidden sm:flex" />
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted transition-colors"
                >
                  {user.image ? (
                    <img src={user.image} alt={user.name || 'User'} className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <span className="hidden md:block text-sm font-medium text-foreground">
                    {user.name || user.email}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>

                {isUserMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-lg shadow-lg z-50 animate-slide-down">
                      <div className="p-2">
                        <div className="px-2 py-3 border-b border-border mb-2">
                          <p className="text-sm font-medium text-foreground">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        <button
                          onClick={() => signOut({ callbackUrl: '/login' })}
                          className="w-full flex items-center gap-2 px-2 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-foreground">AI Skills</h2>
            <p className="text-muted-foreground">Manage custom skills for your OpenCode AI agent</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar - Skills List */}
          <div className="lg:col-span-4 space-y-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search skills..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                />
              </div>
              <Button onClick={handleCreateSkill} size="icon">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3">
              {filteredSkills.map((skill) => (
                <Card
                  key={skill.id}
                  className={cn(
                    'cursor-pointer transition-all hover:border-primary/50',
                    selectedSkill?.id === skill.id && 'border-primary bg-primary/5'
                  )}
                  onClick={() => {
                    setSelectedSkill(skill);
                    setIsEditing(false);
                  }}
                >
                  <CardHeader className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{skill.name}</CardTitle>
                        <CardDescription className="text-xs line-clamp-2 mt-1">
                          {skill.description}
                        </CardDescription>
                      </div>
                      <Brain className="w-4 h-4 text-primary shrink-0" />
                    </div>
                  </CardHeader>
                </Card>
              ))}
              {filteredSkills.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
                  <Wand2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No skills found</p>
                </div>
              )}
            </div>
          </div>

          {/* Main Content - Editor/Viewer */}
          <div className="lg:col-span-8">
            {selectedSkill ? (
              <Card className="h-full flex flex-col">
                <CardHeader className="border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      {isEditing ? (
                        <input
                          value={selectedSkill.name}
                          onChange={(e) => setSelectedSkill({ ...selectedSkill, name: e.target.value })}
                          className="text-xl font-bold bg-transparent border-none focus:outline-none w-full"
                          placeholder="Skill Name"
                        />
                      ) : (
                        <CardTitle className="text-xl">{selectedSkill.name}</CardTitle>
                      )}
                      {isEditing ? (
                        <input
                          value={selectedSkill.description}
                          onChange={(e) => setSelectedSkill({ ...selectedSkill, description: e.target.value })}
                          className="text-sm text-muted-foreground bg-transparent border-none focus:outline-none w-full mt-1"
                          placeholder="Skill Description"
                        />
                      ) : (
                        <CardDescription className="mt-1">{selectedSkill.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                          <Button onClick={handleSaveSkill} disabled={isSaving} className="gap-2">
                            <Save className="w-4 h-4" />
                            {isSaving ? 'Saving...' : 'Save Skill'}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="outline" onClick={() => setIsEditing(true)}>Edit</Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => handleDeleteSkill(selectedSkill.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-0">
                  {isEditing ? (
                    <textarea
                      value={selectedSkill.content}
                      onChange={(e) => setSelectedSkill({ ...selectedSkill, content: e.target.value })}
                      className="w-full h-[500px] p-6 font-mono text-sm bg-muted/30 focus:outline-none resize-none"
                      placeholder="Write your skill logic in Markdown with frontmatter..."
                    />
                  ) : (
                    <div className="p-6 prose prose-sm dark:prose-invert max-w-none">
                      <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-[500px]">
                        <code>{selectedSkill.content}</code>
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="h-full flex flex-col items-center justify-center py-24 border-2 border-dashed border-border rounded-2xl bg-muted/10">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <Brain className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Select a skill to view or edit</h3>
                <p className="text-muted-foreground mb-8 max-w-sm text-center">
                  Skills allow you to extend OpenCode's capabilities with custom logic and tools.
                </p>
                <Button onClick={handleCreateSkill} className="gap-2">
                  <Plus className="w-5 h-5" />
                  Create New Skill
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
