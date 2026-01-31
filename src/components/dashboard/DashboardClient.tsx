'use client';

import { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import {
  Plus,
  LogOut,
  Rocket,
  Trash2,
  Play,
  Square,
  Code,
  Bot,
  Github,
  Activity,
  Clock,
  Search,
  LayoutGrid,
  List,
  MoreVertical,
  ExternalLink,
  Settings,
  User,
  ChevronDown,
  Brain,
} from 'lucide-react';

import { useRouter } from 'next/navigation';
import type { Workspace } from '@prisma/client';
import CreateWorkspaceDialog from './CreateWorkspaceDialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';

interface DashboardClientProps {
  user: {
    name?: string | null;
    email?: string;
    image?: string | null;
  };
  initialWorkspaces: Workspace[];
}

type ViewMode = 'grid' | 'list';
type SortBy = 'recent' | 'name' | 'status';

export default function DashboardClient({ user, initialWorkspaces }: DashboardClientProps) {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const filteredWorkspaces = workspaces
    .filter((w) => {
      const query = searchQuery.toLowerCase();
      return (
        w.name.toLowerCase().includes(query) ||
        w.githubRepo?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'status':
          return a.status.localeCompare(b.status);
        case 'recent':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  const stats = {
    total: workspaces.length,
    running: workspaces.filter((w) => w.status === 'running').length,
    stopped: workspaces.filter((w) => w.status === 'stopped').length,
  };

  const handleDeleteWorkspace = async (workspaceId: string) => {
    if (!confirm('Are you sure you want to delete this workspace? This action cannot be undone.')) {
      return;
    }

    setLoadingStates((prev) => ({ ...prev, [workspaceId]: true }));
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setWorkspaces(workspaces.filter((w) => w.id !== workspaceId));
      }
    } catch (error) {
      console.error('Error deleting workspace:', error);
    } finally {
      setLoadingStates((prev) => ({ ...prev, [workspaceId]: false }));
    }
  };

  const handleWorkspaceAction = async (workspaceId: string, action: 'start' | 'stop') => {
    setLoadingStates((prev) => ({ ...prev, [workspaceId]: true }));
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        const { workspace } = await response.json();
        setWorkspaces(workspaces.map((w) => (w.id === workspaceId ? workspace : w)));
      }
    } catch (error) {
      console.error('Error updating workspace:', error);
    } finally {
      setLoadingStates((prev) => ({ ...prev, [workspaceId]: false }));
    }
  };

  const handleWorkspaceCreated = (workspace: Workspace) => {
    setWorkspaces([workspace, ...workspaces]);
    setIsCreateDialogOpen(false);
    router.push(`/workspace/${workspace.id}`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <Badge variant="success" className="gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-dot" />
            Running
          </Badge>
        );
      case 'stopped':
        return (
          <Badge variant="secondary" className="gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            Stopped
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="error" className="gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="warning" className="gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Rocket className="w-5 h-5 text-primary" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-foreground">Open Web Agent</h1>
                <p className="text-xs text-muted-foreground">Cloud IDE Platform</p>
              </div>
            </div>

            {/* Right section */}
            <div className="flex items-center gap-3">
              <ThemeToggle className="hidden sm:flex" />
              
              {/* User menu */}
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted transition-colors"
                >
                  {user.image ? (
                    <img
                      src={user.image}
                      alt={user.name || 'User'}
                      className="w-8 h-8 rounded-full"
                    />
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
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-lg shadow-lg z-50 animate-slide-down">
                      <div className="p-2">
                        <div className="px-2 py-3 border-b border-border mb-2">
                          <p className="text-sm font-medium text-foreground">
                            {user.name}
                          </p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        <div className="sm:hidden mb-2">
                          <ThemeToggle className="w-full justify-center" />
                        </div>
                        <button
                          onClick={() => router.push('/skills')}
                          className="w-full flex items-center gap-2 px-2 py-2 text-sm text-foreground hover:bg-muted rounded-md transition-colors"
                        >
                          <Brain className="w-4 h-4 text-primary" />
                          AI Skills
                        </button>
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

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-card/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Workspaces
                  </p>
                  <p className="text-3xl font-bold text-foreground">{stats.total}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <LayoutGrid className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Running</p>
                  <p className="text-3xl font-bold text-green-500">{stats.running}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Activity className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Stopped</p>
                  <p className="text-3xl font-bold text-muted-foreground">{stats.stopped}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Clock className="w-6 h-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card 
            className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-500/20 hover:border-purple-500/40 cursor-pointer transition-all"
            onClick={() => router.push('/skills')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-500">
                    AI Skills
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Configure agent behaviors</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Brain className="w-6 h-6 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search workspaces..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            >
              <option value="recent">Most Recent</option>
              <option value="name">Name</option>
              <option value="status">Status</option>
            </select>
            <div className="flex border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-2 transition-colors',
                  viewMode === 'grid'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                )}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-2 transition-colors',
                  viewMode === 'list'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Workspace</span>
            </Button>
          </div>
        </div>

        {/* Workspaces */}
        {filteredWorkspaces.length === 0 ? (
          <div className="text-center py-16 animate-fade-in">
            {workspaces.length === 0 ? (
              <>
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <Rocket className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  No workspaces yet
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Create your first cloud development environment with OpenCode AI and VS Code
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)} size="lg" className="gap-2">
                  <Plus className="w-5 h-5" />
                  Create Workspace
                </Button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No matching workspaces
                </h3>
                <p className="text-muted-foreground">
                  Try adjusting your search query
                </p>
              </>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredWorkspaces.map((workspace, index) => (
              <Card
                key={workspace.id}
                className="group relative overflow-hidden animate-fade-in hover:shadow-lg transition-all duration-300"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{workspace.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1.5 mt-1">
                        <Github className="w-3.5 h-3.5" />
                        <span className="truncate">{workspace.githubRepo}</span>
                      </CardDescription>
                    </div>
                    {getStatusBadge(workspace.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Quick info */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Bot className="w-4 h-4" />
                      <span>OpenCode</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Code className="w-4 h-4" />
                      <span>VS Code</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => router.push(`/workspace/${workspace.id}`)}
                      className="flex-1 gap-2"
                      disabled={workspace.status !== 'running'}
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open
                    </Button>
                    {workspace.status === 'running' ? (
                      <Tooltip content="Stop workspace">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleWorkspaceAction(workspace.id, 'stop')}
                          disabled={loadingStates[workspace.id]}
                        >
                          {loadingStates[workspace.id] ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </Button>
                      </Tooltip>
                    ) : (
                      <Tooltip content="Start workspace">
                        <Button
                          variant="success"
                          size="icon"
                          onClick={() => handleWorkspaceAction(workspace.id, 'start')}
                          disabled={loadingStates[workspace.id]}
                        >
                          {loadingStates[workspace.id] ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                      </Tooltip>
                    )}
                    <Tooltip content="Delete workspace">
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDeleteWorkspace(workspace.id)}
                        disabled={loadingStates[workspace.id]}
                      >
                        {loadingStates[workspace.id] ? (
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </Tooltip>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredWorkspaces.map((workspace, index) => (
              <Card
                key={workspace.id}
                className="animate-fade-in hover:shadow-md transition-all duration-300"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Code className="w-6 h-6 text-muted-foreground" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-foreground truncate">
                          {workspace.name}
                        </h3>
                        {getStatusBadge(workspace.status)}
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <Github className="w-3.5 h-3.5" />
                        <span className="truncate">{workspace.githubRepo}</span>
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        onClick={() => router.push(`/workspace/${workspace.id}`)}
                        size="sm"
                        disabled={workspace.status !== 'running'}
                      >
                        Open
                      </Button>
                      {workspace.status === 'running' ? (
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => handleWorkspaceAction(workspace.id, 'stop')}
                          disabled={loadingStates[workspace.id]}
                        >
                          {loadingStates[workspace.id] ? (
                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Square className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="success"
                          size="icon-sm"
                          onClick={() => handleWorkspaceAction(workspace.id, 'start')}
                          disabled={loadingStates[workspace.id]}
                        >
                          {loadingStates[workspace.id] ? (
                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        onClick={() => handleDeleteWorkspace(workspace.id)}
                        disabled={loadingStates[workspace.id]}
                      >
                        {loadingStates[workspace.id] ? (
                          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Create Workspace Dialog */}
      <CreateWorkspaceDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onWorkspaceCreated={handleWorkspaceCreated}
      />
    </div>
  );
}
