'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Code,
  Bot,
  ExternalLink,
  Settings,
  RotateCcw,
  Layout,
  Monitor,
  ChevronDown,
  RefreshCw,
  Keyboard,
  AlertCircle,
} from 'lucide-react';
import type { Workspace } from '@prisma/client';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/ResizablePanel';
import { cn } from '@/lib/utils';

interface WorkspaceClientProps {
  workspace: Workspace;
}

type ActivePanel = 'both' | 'opencode' | 'vscode';
type LayoutMode = 'horizontal' | 'vertical';

// Base64 encode "/workspace" for OpenCode URL
const WORKSPACE_PATH_ENCODED = btoa('/workspace').replace(/=/g, '');

export default function WorkspaceClient({ workspace }: WorkspaceClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>('both');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('horizontal');
  const [showHeader, setShowHeader] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [opencodeReady, setOpencodeReady] = useState(false);
  const [vscodeReady, setVscodeReady] = useState(false);
  const opencodeCheckRef = useRef<NodeJS.Timeout | null>(null);
  const vscodeCheckRef = useRef<NodeJS.Timeout | null>(null);

  const domain = process.env.NEXT_PUBLIC_DOMAIN || 'localhost';
  
  // URLs are based on workspace ID, not ports (Traefik routes by hostname)
  const opencodeBaseUrl = `http://opencode-${workspace.id}.${domain}`;
  // OpenCode URL with workspace path (base64 encoded)
  const opencodeUrl = `${opencodeBaseUrl}/${WORKSPACE_PATH_ENCODED}/session`;
  
  const vscodeUrl = `http://vscode-${workspace.id}.${domain}`;

  const copyPassword = async () => {
    if (workspace.vscodePassword) {
      await navigator.clipboard.writeText(workspace.vscodePassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const refreshIframes = () => {
    setOpencodeReady(false);
    setVscodeReady(false);
    setIframeKey((prev) => prev + 1);
  };

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === '1') {
        e.preventDefault();
        setActivePanel('both');
      }
      if (e.altKey && e.key === '2') {
        e.preventDefault();
        setActivePanel('opencode');
      }
      if (e.altKey && e.key === '3') {
        e.preventDefault();
        setActivePanel('vscode');
      }
      if (e.altKey && e.key === 'h') {
        e.preventDefault();
        setShowHeader((prev) => !prev);
      }
      if (e.altKey && e.key === 'l') {
        e.preventDefault();
        setLayoutMode((prev) => (prev === 'horizontal' ? 'vertical' : 'horizontal'));
      }
      if (e.altKey && e.key === 'r') {
        e.preventDefault();
        refreshIframes();
      }
      if (e.altKey && e.key === 'f') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFullscreen]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Check workspace status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/workspaces/${workspace.id}`);
        const data = await response.json();

        if (data.workspace.status === 'running') {
          setLoading(false);
        } else if (data.workspace.status === 'error') {
          setError('Workspace failed to start');
          setLoading(false);
        }
      } catch (err) {
        setError('Failed to check workspace status');
        setLoading(false);
      }
    };

    const interval = setInterval(checkStatus, 3000);
    checkStatus();

    return () => clearInterval(interval);
  }, [workspace.id]);

  // Check if OpenCode is ready by polling via backend proxy
  useEffect(() => {
    if (loading) return;

    const checkOpencode = async () => {
      try {
        const response = await fetch(`/api/workspaces/${workspace.id}/health?service=opencode`);
        const data = await response.json();
        if (data.ready) {
          setOpencodeReady(true);
          if (opencodeCheckRef.current) {
            clearInterval(opencodeCheckRef.current);
          }
        }
      } catch {
        // Still loading
      }
    };

    // Start polling
    opencodeCheckRef.current = setInterval(checkOpencode, 2000);
    checkOpencode();

    return () => {
      if (opencodeCheckRef.current) {
        clearInterval(opencodeCheckRef.current);
      }
    };
  }, [loading, workspace.id]);

  // Check if VS Code is ready via backend proxy
  useEffect(() => {
    if (loading) return;

    const checkVscode = async () => {
      try {
        const response = await fetch(`/api/workspaces/${workspace.id}/health?service=vscode`);
        const data = await response.json();
        if (data.ready) {
          setVscodeReady(true);
          if (vscodeCheckRef.current) {
            clearInterval(vscodeCheckRef.current);
          }
        }
      } catch {
        // Still loading
      }
    };

    vscodeCheckRef.current = setInterval(checkVscode, 2000);
    checkVscode();

    return () => {
      if (vscodeCheckRef.current) {
        clearInterval(vscodeCheckRef.current);
      }
    };
  }, [loading, workspace.id]);

  // Auto-mark as ready after a timeout (fallback)
  useEffect(() => {
    if (loading) return;
    
    const timeout = setTimeout(() => {
      setOpencodeReady(true);
      setVscodeReady(true);
    }, 30000); // 30 seconds max wait for containers to fully start

    return () => clearTimeout(timeout);
  }, [loading, iframeKey]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center animate-fade-in">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto mb-6 relative" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">
            Launching Workspace
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Setting up your containerized development environment...
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">Launch Failed</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <Button onClick={() => window.location.reload()}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header
        className={cn(
          'bg-card border-b border-border transition-all duration-300 ease-in-out',
          showHeader ? 'h-12 opacity-100' : 'h-0 opacity-0 overflow-hidden'
        )}
      >
        <div className="h-12 px-3 flex items-center justify-between gap-2">
          {/* Left section */}
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => router.push('/dashboard')}
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="hidden sm:block min-w-0">
              <h1 className="font-medium text-sm text-foreground truncate">
                {workspace.name}
              </h1>
            </div>
            <Badge variant="success" className="hidden md:flex items-center gap-1 text-[10px] px-1.5 py-0.5">
              <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse-dot" />
              Running
            </Badge>
          </div>

          {/* Center section - Panel tabs with open links */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setActivePanel('both')}
              className={cn(
                'px-2 py-1 text-xs rounded transition-all duration-200 flex items-center gap-1.5',
                activePanel === 'both'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="Both panels (Alt+1)"
            >
              <Layout className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Both</span>
            </button>
            
            <div className="flex items-center">
              <button
                onClick={() => setActivePanel('opencode')}
                className={cn(
                  'px-2 py-1 text-xs rounded-l transition-all duration-200 flex items-center gap-1.5',
                  activePanel === 'opencode'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="OpenCode (Alt+2)"
              >
                <Bot className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">OpenCode</span>
              </button>
              <a
                href={opencodeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-1 py-1 text-muted-foreground hover:text-foreground transition-colors"
                title="Open OpenCode in new tab"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex items-center">
              <button
                onClick={() => setActivePanel('vscode')}
                className={cn(
                  'px-2 py-1 text-xs rounded-l transition-all duration-200 flex items-center gap-1.5',
                  activePanel === 'vscode'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="VS Code (Alt+3)"
              >
                <Code className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">VS Code</span>
              </button>
              <a
                href={vscodeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-1 py-1 text-muted-foreground hover:text-foreground transition-colors"
                title="Open VS Code in new tab"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Right section */}
          <div className="flex items-center gap-1">
            {/* VS Code Password */}
            {workspace.vscodePassword && (
              <div className="hidden lg:flex items-center gap-1.5 bg-muted px-2 py-1 rounded text-xs">
                <span className="text-muted-foreground">pw:</span>
                <code className="font-mono text-foreground">{workspace.vscodePassword}</code>
                <button
                  onClick={copyPassword}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title={copied ? 'Copied!' : 'Copy password'}
                >
                  {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            )}

            {/* Quick actions */}
            <Button variant="ghost" size="icon-sm" onClick={refreshIframes} title="Refresh (Alt+R)">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setLayoutMode((prev) => (prev === 'horizontal' ? 'vertical' : 'horizontal'))}
              title="Toggle layout (Alt+L)"
            >
              <Monitor className={cn('w-3.5 h-3.5 transition-transform', layoutMode === 'vertical' && 'rotate-90')} />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={toggleFullscreen} title="Fullscreen (Alt+F)">
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </Button>
            
            <ThemeToggle className="hidden sm:flex scale-90" />
            
            {/* Settings dropdown */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowSettings(!showSettings)}
                title="Settings & shortcuts"
              >
                <Settings className="w-3.5 h-3.5" />
              </Button>
              
              {showSettings && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
                  <div className="absolute right-0 top-full mt-2 w-64 bg-card border border-border rounded-lg shadow-lg z-50 animate-in fade-in-0 slide-in-from-top-2 duration-150">
                    <div className="p-3">
                      <h3 className="font-medium text-sm text-foreground mb-2 flex items-center gap-2">
                        <Keyboard className="w-4 h-4" />
                        Shortcuts
                      </h3>
                      <div className="space-y-1.5 text-xs">
                        {[
                          ['Both panels', 'Alt+1'],
                          ['OpenCode', 'Alt+2'],
                          ['VS Code', 'Alt+3'],
                          ['Header', 'Alt+H'],
                          ['Layout', 'Alt+L'],
                          ['Refresh', 'Alt+R'],
                          ['Fullscreen', 'Alt+F'],
                        ].map(([label, key]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-muted-foreground">{label}</span>
                            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">{key}</kbd>
                          </div>
                        ))}
                      </div>
                      
                      {workspace.vscodePassword && (
                        <div className="mt-3 pt-3 border-t border-border lg:hidden">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">VS Code Password</span>
                            <div className="flex items-center gap-1.5">
                              <code className="font-mono text-xs">{workspace.vscodePassword}</code>
                              <button onClick={copyPassword}>
                                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Toggle header button when hidden */}
      {!showHeader && (
        <button
          onClick={() => setShowHeader(true)}
          className="absolute top-1 left-1/2 -translate-x-1/2 z-50 bg-card/90 backdrop-blur-sm border border-border rounded-full px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-all hover:bg-card animate-fade-in flex items-center gap-1"
        >
          <ChevronDown className="w-2.5 h-2.5" />
          Alt+H
        </button>
      )}

      {/* Main content with resizable panels */}
      <div className="flex-1 overflow-hidden">
        {activePanel === 'both' ? (
          <ResizablePanelGroup orientation={layoutMode} className="h-full">
            <ResizablePanel defaultSize={50} minSize={20}>
              <IframePanel
                url={opencodeUrl}
                isReady={opencodeReady}
                iframeKey={iframeKey}
                title="OpenCode"
                icon={<Bot className="w-4 h-4" />}
              />
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={50} minSize={20}>
              <IframePanel
                url={vscodeUrl}
                isReady={vscodeReady}
                iframeKey={iframeKey}
                title="VS Code"
                icon={<Code className="w-4 h-4" />}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="h-full animate-fade-in">
            {activePanel === 'opencode' ? (
              <IframePanel
                url={opencodeUrl}
                isReady={opencodeReady}
                iframeKey={iframeKey}
                title="OpenCode"
                icon={<Bot className="w-4 h-4" />}
              />
            ) : (
              <IframePanel
                url={vscodeUrl}
                isReady={vscodeReady}
                iframeKey={iframeKey}
                title="VS Code"
                icon={<Code className="w-4 h-4" />}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface IframePanelProps {
  url: string;
  isReady: boolean;
  iframeKey: number;
  title: string;
  icon: React.ReactNode;
}

function IframePanel({ url, isReady, iframeKey, title, icon }: IframePanelProps) {
  return (
    <div className="h-full w-full relative bg-background">
      {/* Loading overlay - shown until container is ready */}
      {!isReady && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="relative mb-4">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <div className="relative w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                {icon}
              </div>
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              Starting {title}
            </p>
            <p className="text-xs text-muted-foreground">
              This may take a moment...
            </p>
            <div className="mt-4 flex justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
      
      {/* Iframe - only renders when container is ready */}
      {isReady && (
        <iframe
          key={iframeKey}
          src={url}
          className="w-full h-full border-0"
          title={title}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
        />
      )}
    </div>
  );
}
