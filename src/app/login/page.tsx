'use client';

import { signIn } from 'next-auth/react';
import { Github, Rocket, Code, Bot, Sparkles, Zap, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Left side - Hero */}
      <div className="hidden lg:flex lg:flex-1 relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-background">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full filter blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-primary/10 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center p-12 lg:p-16">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center">
                <Rocket className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Open Web Agent</h1>
                <p className="text-muted-foreground">Cloud IDE Platform</p>
              </div>
            </div>
            <p className="text-xl text-muted-foreground max-w-lg leading-relaxed">
              Launch containerized development environments with AI-powered coding assistance and a full VS Code experience in seconds.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-6">
            <Feature
              icon={<Bot className="w-5 h-5" />}
              title="AI-Powered Development"
              description="OpenCode AI agent helps you write, debug, and refactor code intelligently"
            />
            <Feature
              icon={<Code className="w-5 h-5" />}
              title="Full VS Code Experience"
              description="Complete development environment with extensions and terminal access"
            />
            <Feature
              icon={<Zap className="w-5 h-5" />}
              title="Instant Workspaces"
              description="Clone any GitHub repository and start coding in under a minute"
            />
            <Feature
              icon={<Shield className="w-5 h-5" />}
              title="Secure & Isolated"
              description="Each workspace runs in its own secure container"
            />
          </div>
        </div>
      </div>

      {/* Right side - Login */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Rocket className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Open Web Agent</h1>
            <p className="text-muted-foreground">Cloud IDE Platform</p>
          </div>

          {/* Login card */}
          <div className="bg-card border border-border rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Welcome</h2>
              <p className="text-muted-foreground">
                Sign in to create and manage your cloud development workspaces
              </p>
            </div>

            <Button
              onClick={() => signIn('github', { callbackUrl: '/dashboard' })}
              size="xl"
              className="w-full gap-3"
            >
              <Github className="w-5 h-5" />
              Continue with GitHub
            </Button>

            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-center text-xs text-muted-foreground">
                By signing in, you agree to our{' '}
                <a href="#" className="text-primary hover:underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#" className="text-primary hover:underline">
                  Privacy Policy
                </a>
              </p>
            </div>
          </div>

          {/* Mobile features */}
          <div className="lg:hidden mt-8 space-y-4">
            <FeatureCompact
              icon={<Bot className="w-4 h-4" />}
              title="AI-Powered"
            />
            <FeatureCompact
              icon={<Code className="w-4 h-4" />}
              title="VS Code Editor"
            />
            <FeatureCompact
              icon={<Zap className="w-4 h-4" />}
              title="Instant Setup"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4 group">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        {icon}
      </div>
      <div>
        <h3 className="font-medium text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function FeatureCompact({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <span className="text-primary">{icon}</span>
      <span>{title}</span>
    </div>
  );
}
