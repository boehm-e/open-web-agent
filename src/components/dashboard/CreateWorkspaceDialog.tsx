'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Search,
  Loader2,
  Github,
  GitBranch,
  Star,
  Code,
  ArrowLeft,
  Rocket,
  Bot,
  Sparkles,
} from 'lucide-react';
import type { Workspace } from '@prisma/client';
import type { GitHubRepository } from '@/lib/github';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

interface CreateWorkspaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onWorkspaceCreated: (workspace: Workspace) => void;
}

export default function CreateWorkspaceDialog({
  isOpen,
  onClose,
  onWorkspaceCreated,
}: CreateWorkspaceDialogProps) {
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [step, setStep] = useState<'select' | 'configure'>('select');

  useEffect(() => {
    if (isOpen) {
      fetchRepositories();
      setStep('select');
    }
  }, [isOpen]);

  useEffect(() => {
    // Close on escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  const fetchRepositories = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/github/repos');
      const data = await response.json();
      setRepositories(data.repositories || []);
    } catch (error) {
      console.error('Error fetching repositories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!selectedRepo || !workspaceName) {
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: workspaceName,
          githubRepo: selectedRepo.clone_url,
          githubBranch: selectedRepo.default_branch,
        }),
      });

      if (response.ok) {
        const { workspace } = await response.json();
        onWorkspaceCreated(workspace);
        resetForm();
      }
    } catch (error) {
      console.error('Error creating workspace:', error);
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setSelectedRepo(null);
    setWorkspaceName('');
    setSearchQuery('');
    setStep('select');
  };

  const handleSelectRepo = (repo: GitHubRepository) => {
    setSelectedRepo(repo);
    setWorkspaceName(repo.name);
    setStep('configure');
  };

  const filteredRepos = repositories.filter((repo) =>
    repo.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            {step === 'configure' && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setStep('select')}
                className="mr-1"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              {step === 'select' ? (
                <Github className="w-5 h-5 text-primary" />
              ) : (
                <Rocket className="w-5 h-5 text-primary" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {step === 'select' ? 'Select Repository' : 'Configure Workspace'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {step === 'select'
                  ? 'Choose a repository to create a workspace from'
                  : 'Set up your development environment'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-180px)] scrollbar-thin">
          {step === 'select' ? (
            <div className="p-6">
              {/* Search */}
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search repositories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                  autoFocus
                />
              </div>

              {/* Repository List */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Loading your repositories...
                  </p>
                </div>
              ) : filteredRepos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-foreground font-medium mb-1">No repositories found</p>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery
                      ? 'Try adjusting your search query'
                      : 'No repositories available'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredRepos.map((repo, index) => (
                    <button
                      key={repo.id}
                      onClick={() => handleSelectRepo(repo)}
                      className={cn(
                        'w-full text-left p-4 border border-border rounded-lg transition-all duration-200 animate-fade-in group',
                        'hover:border-primary/50 hover:bg-primary/5 hover:shadow-md'
                      )}
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Github className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                              {repo.full_name}
                            </span>
                          </div>
                          {repo.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {repo.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2 mt-3">
                            {repo.language && (
                              <Badge variant="secondary" className="gap-1">
                                <Code className="w-3 h-3" />
                                {repo.language}
                              </Badge>
                            )}
                            <Badge variant="secondary" className="gap-1">
                              <GitBranch className="w-3 h-3" />
                              {repo.default_branch}
                            </Badge>
                            {repo.stargazers_count > 0 && (
                              <Badge variant="secondary" className="gap-1">
                                <Star className="w-3 h-3" />
                                {repo.stargazers_count}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Selected Repository */}
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Github className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {selectedRepo?.full_name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="gap-1">
                        <GitBranch className="w-3 h-3" />
                        {selectedRepo?.default_branch}
                      </Badge>
                      {selectedRepo?.language && (
                        <Badge variant="secondary" className="gap-1">
                          <Code className="w-3 h-3" />
                          {selectedRepo.language}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Workspace Name */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Workspace Name
                </label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="w-full px-4 py-3 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                  placeholder="Enter workspace name"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-2">
                  This will be the display name for your workspace
                </p>
              </div>

              {/* Features Preview */}
              <div className="p-4 bg-muted/30 rounded-lg border border-border">
                <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Your workspace will include
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Bot className="w-4 h-4 text-primary" />
                    <span>OpenCode AI Agent</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Code className="w-4 h-4 text-primary" />
                    <span>VS Code Editor</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border bg-muted/20">
          <div className="text-sm text-muted-foreground">
            {step === 'select' && filteredRepos.length > 0 && (
              <span>{filteredRepos.length} repositories available</span>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            {step === 'configure' && (
              <Button
                onClick={handleCreateWorkspace}
                disabled={!workspaceName || creating}
                isLoading={creating}
                className="gap-2"
              >
                {!creating && <Rocket className="w-4 h-4" />}
                {creating ? 'Creating...' : 'Create Workspace'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
