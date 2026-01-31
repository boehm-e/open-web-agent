'use client';

import { useState, useEffect } from 'react';
import {
  Rocket,
  User,
  ChevronDown,
  LogOut,
  Plus,
  Search,
  Trash2,
  Save,
  Server,
  ArrowLeft,
  Cpu,
  Check,
  X,
  Eye,
  EyeOff,
  Sparkles,
  Info,
  AlertCircle,
  Zap,
  HelpCircle,
  Loader2,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Badge } from '@/components/ui/Badge';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';

interface LLMModel {
  id: string;
  modelId: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  isDefault: boolean;
  options?: Record<string, unknown>;
  variants?: Record<string, unknown>;
}

interface AvailableModel {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
  maxTokens?: number;
}

interface LLMProvider {
  id: string;
  name: string;
  providerId: string;
  type: string;
  baseUrl?: string;
  apiKey?: string;
  envVarName?: string;
  headers?: Record<string, string>;
  options?: Record<string, unknown>;
  isEnabled: boolean;
  isDefault: boolean;
  models: LLMModel[];
  updatedAt: Date | string;
}

interface KnownProvider {
  type: string;
  name: string;
  providerId: string;
  baseUrl?: string;
  envVarName?: string;
  defaultModels: Array<{
    modelId: string;
    name: string;
    description?: string;
  }>;
}

interface ProvidersClientProps {
  user: {
    name?: string | null;
    email?: string;
    image?: string | null;
  };
  initialProviders: LLMProvider[];
  knownProviders: KnownProvider[];
}

export default function ProvidersClient({ user, initialProviders, knownProviders }: ProvidersClientProps) {
  const router = useRouter();
  const [providers, setProviders] = useState<LLMProvider[]>(initialProviders);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [availableModels, setAvailableModels] = useState<Record<string, AvailableModel[]>>({});
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState<Record<string, string>>({});
  const [activeStep, setActiveStep] = useState<1 | 2>(1);
  const [focusedModelId, setFocusedModelId] = useState<string | null>(null);

  const filteredProviders = providers.filter((p) => {
    const query = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      p.providerId.toLowerCase().includes(query) ||
      p.type.toLowerCase().includes(query)
    );
  });

  // Categorize known providers
  const popularProviders = knownProviders.filter(kp => 
    ['ANTHROPIC', 'OPENAI', 'GOOGLE', 'GROQ'].includes(kp.type)
  );
  const otherProviders = knownProviders.filter(kp => 
    !['ANTHROPIC', 'OPENAI', 'GOOGLE', 'GROQ'].includes(kp.type)
  );

  const handleQuickAddProvider = (knownProvider: KnownProvider) => {
    const newProvider: LLMProvider = {
      id: 'new',
      name: knownProvider.name,
      providerId: knownProvider.providerId,
      type: knownProvider.type,
      baseUrl: knownProvider.baseUrl || '',
      apiKey: '',
      envVarName: knownProvider.envVarName || '',
      headers: {},
      options: {},
      isEnabled: true,
      isDefault: providers.length === 0,
      models: [], // Start with empty models to encourage two-step flow
      updatedAt: new Date(),
    };
    setSelectedProvider(newProvider);
    setIsEditing(true);
    setActiveStep(1);
    setShowQuickAdd(false);
    setValidationErrors({});
  };

  const handleCreateCustomProvider = () => {
    const newProvider: LLMProvider = {
      id: 'new',
      name: 'Custom Provider',
      providerId: 'custom-provider',
      type: 'CUSTOM',
      baseUrl: '',
      apiKey: '',
      envVarName: '',
      headers: {},
      options: {},
      isEnabled: true,
      isDefault: providers.length === 0,
      models: [],
      updatedAt: new Date(),
    };
    setSelectedProvider(newProvider);
    setIsEditing(true);
    setActiveStep(1);
    setShowQuickAdd(false);
    setValidationErrors({});
  };

  const validateProvider = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!selectedProvider) return false;
    
    if (!selectedProvider.name.trim()) {
      errors.name = 'Provider name is required';
    }
    
    if (!selectedProvider.providerId.trim()) {
      errors.providerId = 'Provider ID is required';
    } else if (!/^[a-z0-9-]+$/.test(selectedProvider.providerId)) {
      errors.providerId = 'Provider ID must contain only lowercase letters, numbers, and hyphens';
    }
    
    if (selectedProvider.baseUrl && !selectedProvider.baseUrl.startsWith('http')) {
      errors.baseUrl = 'Base URL must start with http:// or https://';
    }
    
    if (!selectedProvider.apiKey || selectedProvider.apiKey.trim() === '') {
      errors.apiKey = 'API Key is required';
    }
    
    // Validate at least one model is configured
    if (selectedProvider.id !== 'new' && activeStep === 2 && selectedProvider.models.length === 0) {
      errors.models = 'At least one model must be configured';
    }
    
    // Validate models
    selectedProvider.models.forEach((model, index) => {
      if (!model.modelId.trim()) {
        errors[`model_${index}_id`] = 'Model ID is required';
      }
      if (!model.name.trim()) {
        errors[`model_${index}_name`] = 'Model name is required';
      }
    });
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProvider = async () => {
    if (!selectedProvider) return;
    
    if (!validateProvider()) {
      return;
    }
    
    setIsSaving(true);
    try {
      const isNew = selectedProvider.id === 'new';
      const url = isNew ? '/api/providers' : `/api/providers/${selectedProvider.id}`;
      const method = isNew ? 'POST' : 'PUT';

      // Save provider
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedProvider.name,
          providerId: selectedProvider.providerId,
          type: selectedProvider.type,
          baseUrl: selectedProvider.baseUrl,
          apiKey: selectedProvider.apiKey !== '••••••••' ? selectedProvider.apiKey : undefined,
          envVarName: selectedProvider.envVarName,
          headers: selectedProvider.headers,
          options: selectedProvider.options,
          isEnabled: selectedProvider.isEnabled,
          isDefault: selectedProvider.isDefault,
          // Models are no longer sent during provider creation
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to save provider');
        return;
      }

      const savedProvider = await response.json();

      if (isNew) {
        setProviders([savedProvider, ...providers]);
        setSelectedProvider(savedProvider);
        setActiveStep(2); // Move to step 2 after saving new provider
        // Auto-fetch models for the new provider using the saved provider's ID
        if (savedProvider.baseUrl && savedProvider.apiKey) {
          setLoadingModels(true);
          try {
            const modelsResponse = await fetch(`/api/providers/${savedProvider.id}/available-models`);
            if (modelsResponse.ok) {
              const data = await modelsResponse.json();
              setAvailableModels(prev => ({ ...prev, [savedProvider.id]: data.models || [] }));
            }
          } catch (err) {
            console.error('Error fetching models:', err);
          } finally {
            setLoadingModels(false);
          }
        }
      } else {
        // For existing providers, handle model creation separately
        // Find new models (those with IDs starting with 'new-')
        const newModels = selectedProvider.models.filter(m => m.id.startsWith('new-'));
        
        // Create new models
        for (const model of newModels) {
          if (!model.modelId || !model.name) continue; // Skip incomplete models
          
          await fetch(`/api/providers/${savedProvider.id}/models`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              modelId: model.modelId,
              name: model.name,
              description: model.description,
              isEnabled: model.isEnabled,
              isDefault: model.isDefault,
              options: model.options,
              variants: model.variants,
            }),
          });
        }

        // Fetch updated provider with all models
        const updatedResponse = await fetch(`/api/providers/${savedProvider.id}`);
        if (updatedResponse.ok) {
          const updatedProvider = await updatedResponse.json();
          setProviders(providers.map((p) => (p.id === updatedProvider.id ? updatedProvider : p)));
          setSelectedProvider(updatedProvider);
        }
        setIsEditing(false); // Close editor for existing provider
      }

      setValidationErrors({});
      setShowApiKey(false);
    } catch (error) {
      console.error('Error saving provider:', error);
      alert('Failed to save provider');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProvider = async (id: string) => {
    if (!confirm('Are you sure you want to delete this provider? All associated models will be deleted.')) return;
    try {
      const response = await fetch(`/api/providers/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setProviders(providers.filter((p) => p.id !== id));
        if (selectedProvider?.id === id) {
          setSelectedProvider(null);
          setIsEditing(false);
        }
      }
    } catch (error) {
      console.error('Error deleting provider:', error);
    }
  };

  const handleAddModel = () => {
    if (!selectedProvider) return;
    const newModel: LLMModel = {
      id: 'new-' + Date.now(),
      modelId: '',
      name: '',
      description: '',
      isEnabled: true,
      isDefault: selectedProvider.models.length === 0,
      options: {},
      variants: {},
    };
    setSelectedProvider({
      ...selectedProvider,
      models: [...selectedProvider.models, newModel],
    });
  };

  const handleRemoveModel = (modelId: string) => {
    if (!selectedProvider) return;
    setSelectedProvider({
      ...selectedProvider,
      models: selectedProvider.models.filter((m) => m.id !== modelId),
    });
  };

  const handleUpdateModel = (modelId: string, updates: Partial<LLMModel>) => {
    if (!selectedProvider) return;
    setSelectedProvider({
      ...selectedProvider,
      models: selectedProvider.models.map((m) => (m.id === modelId ? { ...m, ...updates } : m)),
    });
  };

  // Fetch available models from provider API
  const fetchAvailableModels = async () => {
    if (!selectedProvider || selectedProvider.id === 'new') {
      console.log('Cannot fetch models: provider is new or not selected');
      return;
    }

    const cacheKey = selectedProvider.id;
    // Remove cache check to allow re-fetching if it failed or if user wants to refresh
    // if (availableModels[cacheKey]) return; 

    setLoadingModels(true);
    try {
      console.log(`Fetching models for provider ${selectedProvider.id}...`);
      const response = await fetch(`/api/providers/${selectedProvider.id}/available-models`);
      if (response.ok) {
        const data = await response.json();
        console.log(`Fetched ${data.models?.length || 0} models`);
        setAvailableModels(prev => ({ ...prev, [cacheKey]: data.models || [] }));
        if (!data.models || data.models.length === 0) {
          alert('No models found for this provider. Check your API key and Base URL.');
        }
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch models:', errorText);
        alert(`Failed to fetch models: ${errorText || response.statusText}`);
      }
    } catch (error) {
      console.error('Error fetching available models:', error);
      alert('Error fetching available models. See console for details.');
    } finally {
      setLoadingModels(false);
    }
  };

  // Handle selecting a suggested model
  const handleSelectSuggestedModel = (modelIndex: number, suggested: AvailableModel) => {
    if (!selectedProvider) return;

    const updatedModels = [...selectedProvider.models];
    const model = updatedModels[modelIndex];

    // Update model with suggested data
    model.modelId = suggested.id;
    model.name = suggested.name;
    model.description = suggested.description || '';
    
    // Auto-set maxTokens if available
    if (suggested.maxTokens) {
      model.options = {
        ...model.options,
        maxTokens: suggested.maxTokens
      };
    }

    setSelectedProvider({
      ...selectedProvider,
      models: updatedModels
    });

    // Clear search and focus for this model to close dropdown
    setModelSearchQuery(prev => ({ ...prev, [model.id]: '' }));
    setFocusedModelId(null);
  };

   // Don't auto-fetch - user needs to click "Fetch Models" button after entering API key

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
                <p className="text-xs text-muted-foreground">LLM Providers</p>
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
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-foreground">LLM Providers</h2>
            <p className="text-muted-foreground">Configure AI models for your OpenCode workspaces</p>
          </div>
          {providers.length > 0 && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
              <Server className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{providers.length} provider{providers.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar - Providers List */}
          <div className="lg:col-span-4 space-y-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search providers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                />
              </div>
              <Button onClick={() => setShowQuickAdd(!showQuickAdd)} size="icon">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {showQuickAdd && (
              <Card className="border-primary/50 bg-primary/5">
                <CardHeader className="p-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Quick Add Provider
                  </CardTitle>
                  <CardDescription className="text-xs">Select a known provider or create custom</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Popular</p>
                    <div className="grid grid-cols-2 gap-2">
                      {popularProviders.map((kp) => (
                        <Button
                          key={kp.type}
                          variant="outline"
                          size="sm"
                          onClick={() => handleQuickAddProvider(kp)}
                          className="justify-start text-xs h-auto py-2"
                        >
                          <Sparkles className="w-3 h-3 mr-1.5 text-primary" />
                          {kp.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  {otherProviders.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Other</p>
                      <div className="grid grid-cols-2 gap-2">
                        {otherProviders.slice(0, 4).map((kp) => (
                          <Button
                            key={kp.type}
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickAddProvider(kp)}
                            className="justify-start text-xs h-auto py-2"
                          >
                            <Server className="w-3 h-3 mr-1.5" />
                            {kp.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="pt-2 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCreateCustomProvider}
                      className="w-full justify-start text-xs"
                    >
                      <Plus className="w-3 h-3 mr-1.5" />
                      Custom Provider
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-3">
              {filteredProviders.map((provider) => (
                <Card
                  key={provider.id}
                  className={cn(
                    'cursor-pointer transition-all hover:border-primary/50',
                    selectedProvider?.id === provider.id && 'border-primary bg-primary/5',
                    !provider.isEnabled && 'opacity-50'
                  )}
                  onClick={() => {
                    setSelectedProvider(provider);
                    setIsEditing(false);
                    setShowApiKey(false);
                    setValidationErrors({});
                  }}
                >
                  <CardHeader className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-base truncate">{provider.name}</CardTitle>
                          {provider.isDefault && (
                            <Badge variant="default" className="text-xs">Default</Badge>
                          )}
                        </div>
                        <CardDescription className="text-xs">
                          {provider.providerId} • {provider.models.length} model{provider.models.length !== 1 ? 's' : ''}
                        </CardDescription>
                      </div>
                      <Server className="w-4 h-4 text-primary shrink-0" />
                    </div>
                  </CardHeader>
                </Card>
              ))}
              {filteredProviders.length === 0 && !showQuickAdd && (
                <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
                  <Server className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-2">
                    {searchQuery ? 'No providers found' : 'No providers configured'}
                  </p>
                  {!searchQuery && (
                    <Button variant="outline" size="sm" onClick={() => setShowQuickAdd(true)} className="gap-2">
                      <Plus className="w-3 h-3" />
                      Add Provider
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Main Content - Editor/Viewer */}
          <div className="lg:col-span-8">
            {selectedProvider ? (
              <Card className="h-full flex flex-col">
                <CardHeader className="border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit mb-4">
                            <button
                              onClick={() => setActiveStep(1)}
                              className={cn(
                                "px-4 py-1.5 rounded-md text-xs font-medium transition-all",
                                activeStep === 1 
                                  ? "bg-background text-foreground shadow-sm" 
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              1. Provider Setup
                            </button>
                            <button
                              onClick={() => selectedProvider.id !== 'new' && setActiveStep(2)}
                              disabled={selectedProvider.id === 'new'}
                              className={cn(
                                "px-4 py-1.5 rounded-md text-xs font-medium transition-all",
                                activeStep === 2 
                                  ? "bg-background text-foreground shadow-sm" 
                                  : "text-muted-foreground hover:text-foreground",
                                selectedProvider.id === 'new' && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              2. Model Selection
                            </button>
                          </div>
                          <div>
                            <input
                              value={selectedProvider.name}
                              onChange={(e) => {
                                setSelectedProvider({ ...selectedProvider, name: e.target.value });
                                if (validationErrors.name) {
                                  setValidationErrors({ ...validationErrors, name: '' });
                                }
                              }}
                              className={cn(
                                "text-xl font-bold bg-transparent border-none focus:outline-none w-full",
                                validationErrors.name && "text-destructive"
                              )}
                              placeholder="Provider Name"
                              disabled={activeStep === 2}
                            />
                            {validationErrors.name && (
                              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {validationErrors.name}
                              </p>
                            )}
                          </div>
                          <div>
                            <input
                              value={selectedProvider.providerId}
                              onChange={(e) => {
                                setSelectedProvider({ ...selectedProvider, providerId: e.target.value });
                                if (validationErrors.providerId) {
                                  setValidationErrors({ ...validationErrors, providerId: '' });
                                }
                              }}
                              className={cn(
                                "text-sm text-muted-foreground bg-transparent border-none focus:outline-none w-full",
                                validationErrors.providerId && "text-destructive"
                              )}
                              placeholder="provider-id (lowercase, letters, numbers, hyphens)"
                              disabled={selectedProvider.id !== 'new' || activeStep === 2}
                            />
                            {validationErrors.providerId && (
                              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {validationErrors.providerId}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-xl">{selectedProvider.name}</CardTitle>
                            {selectedProvider.isDefault && (
                              <Badge variant="default">Default</Badge>
                            )}
                            {!selectedProvider.isEnabled && (
                              <Badge variant="secondary">Disabled</Badge>
                            )}
                          </div>
                          <CardDescription className="mt-1">{selectedProvider.providerId}</CardDescription>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          {activeStep === 2 && (
                            <Button variant="ghost" onClick={() => setActiveStep(1)}>
                              <ArrowLeft className="w-4 h-4 mr-2" />
                              Back to Setup
                            </Button>
                          )}
                          <Button variant="ghost" onClick={() => {
                            setIsEditing(false);
                            setShowApiKey(false);
                            setValidationErrors({});
                            setActiveStep(1);
                          }}>Cancel</Button>
                          <Button onClick={handleSaveProvider} disabled={isSaving} className="gap-2">
                            <Save className="w-4 h-4" />
                            {isSaving ? 'Saving...' : (activeStep === 1 && selectedProvider.id === 'new' ? 'Save & Continue' : 'Save')}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="outline" onClick={() => setIsEditing(true)}>Edit</Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => handleDeleteProvider(selectedProvider.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-6 overflow-auto">
                  <div className="space-y-6">
                    {/* Step 1: Provider Configuration */}
                    {activeStep === 1 && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex gap-2">
                          <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                          <div className="text-xs text-blue-600 dark:text-blue-400">
                            <p className="font-medium mb-1">Step 1: Provider Setup</p>
                            <p>Configure your API credentials. Once saved, you can proceed to Step 2 to select models.</p>
                          </div>
                        </div>

                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          Provider Configuration
                          {isEditing && (
                            <Tooltip content="Configure the base settings for your LLM provider">
                              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                            </Tooltip>
                          )}
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Type</label>
                            {isEditing ? (
                              <select
                                value={selectedProvider.type}
                                onChange={(e) => setSelectedProvider({ ...selectedProvider, type: e.target.value })}
                                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                disabled={selectedProvider.id !== 'new'}
                              >
                                <option value="CUSTOM">Custom</option>
                                <option value="OPENAI">OpenAI</option>
                                <option value="ANTHROPIC">Anthropic</option>
                                <option value="GOOGLE">Google</option>
                                <option value="OPENROUTER">OpenRouter</option>
                                <option value="GROQ">Groq</option>
                                <option value="TOGETHER">Together AI</option>
                                <option value="MISTRAL">Mistral</option>
                                <option value="DEEPSEEK">DeepSeek</option>
                                <option value="XAI">xAI</option>
                                <option value="OLLAMA">Ollama</option>
                                <option value="LMSTUDIO">LM Studio</option>
                              </select>
                            ) : (
                              <p className="text-sm text-foreground">{selectedProvider.type}</p>
                            )}
                          </div>
                          
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Status</label>
                            {isEditing ? (
                              <div className="flex items-center gap-2 h-9">
                                <input
                                  type="checkbox"
                                  checked={selectedProvider.isEnabled}
                                  onChange={(e) => setSelectedProvider({ ...selectedProvider, isEnabled: e.target.checked })}
                                  className="w-4 h-4"
                                />
                                <span className="text-sm">Enabled</span>
                              </div>
                            ) : (
                              <p className="text-sm text-foreground">{selectedProvider.isEnabled ? 'Enabled' : 'Disabled'}</p>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1">
                            Base URL
                            {isEditing && (
                              <Tooltip content="API endpoint URL for this provider">
                                <HelpCircle className="w-3 h-3" />
                              </Tooltip>
                            )}
                          </label>
                          {isEditing ? (
                            <div>
                              <input
                                value={selectedProvider.baseUrl || ''}
                                onChange={(e) => {
                                  setSelectedProvider({ ...selectedProvider, baseUrl: e.target.value });
                                  if (validationErrors.baseUrl) {
                                    setValidationErrors({ ...validationErrors, baseUrl: '' });
                                  }
                                }}
                                className={cn(
                                  "w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono",
                                  validationErrors.baseUrl && "border-destructive focus:ring-destructive"
                                )}
                                placeholder="https://api.example.com/v1"
                              />
                              {validationErrors.baseUrl && (
                                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  {validationErrors.baseUrl}
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-foreground font-mono">{selectedProvider.baseUrl || 'Not set'}</p>
                          )}
                        </div>

                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1">
                            API Key
                            <span className="text-destructive">*</span>
                            {isEditing && (
                              <Tooltip content="Your API key will be encrypted and stored securely">
                                <HelpCircle className="w-3 h-3" />
                              </Tooltip>
                            )}
                          </label>
                          {isEditing ? (
                            <div>
                              <div className="flex gap-2">
                                <input
                                  type={showApiKey ? 'text' : 'password'}
                                  value={selectedProvider.apiKey || ''}
                                  onChange={(e) => {
                                    setSelectedProvider({ ...selectedProvider, apiKey: e.target.value });
                                    if (validationErrors.apiKey) {
                                      setValidationErrors({ ...validationErrors, apiKey: '' });
                                    }
                                  }}
                                  className={cn(
                                    "flex-1 px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono",
                                    validationErrors.apiKey && "border-destructive focus:ring-destructive"
                                  )}
                                  placeholder="sk-..."
                                />
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => setShowApiKey(!showApiKey)}
                                >
                                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </Button>
                              </div>
                              {validationErrors.apiKey && (
                                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  {validationErrors.apiKey}
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-foreground font-mono">{selectedProvider.apiKey ? '••••••••••••••••' : 'Not set'}</p>
                          )}
                        </div>

                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1">
                            Environment Variable Name
                            <span className="text-xs text-muted-foreground">(Optional)</span>
                            {isEditing && (
                              <Tooltip content="Variable name to use in OpenCode container (e.g., ANTHROPIC_API_KEY)">
                                <HelpCircle className="w-3 h-3" />
                              </Tooltip>
                            )}
                          </label>
                          {isEditing ? (
                            <input
                              value={selectedProvider.envVarName || ''}
                              onChange={(e) => setSelectedProvider({ ...selectedProvider, envVarName: e.target.value })}
                              className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                              placeholder="PROVIDER_API_KEY"
                            />
                          ) : (
                            <p className="text-sm text-foreground font-mono">{selectedProvider.envVarName || 'Not set'}</p>
                          )}
                        </div>

                        <div className={cn(
                          "flex items-center gap-2 p-3 rounded-lg border",
                          isEditing ? "bg-muted/30 border-border" : "bg-transparent border-transparent"
                        )}>
                          <input
                            type="checkbox"
                            checked={selectedProvider.isDefault}
                            onChange={(e) => isEditing && setSelectedProvider({ ...selectedProvider, isDefault: e.target.checked })}
                            disabled={!isEditing}
                            className="w-4 h-4"
                          />
                          <label className="text-sm text-foreground flex items-center gap-1.5">
                            Set as default provider
                            {isEditing && (
                              <Tooltip content="This provider will be used by default in new workspaces">
                                <HelpCircle className="w-3 h-3 text-muted-foreground" />
                              </Tooltip>
                            )}
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Step 2: Models */}
                    {activeStep === 2 && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            Model Selection
                            <span className="text-destructive">*</span>
                            {isEditing && (
                              <Tooltip content="Add the specific models you want to use from this provider">
                                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                              </Tooltip>
                            )}
                          </h3>
                          {isEditing && (
                            <Button variant="outline" size="sm" onClick={handleAddModel} className="gap-2">
                              <Plus className="w-3 h-3" />
                              Add Model
                            </Button>
                          )}
                        </div>

                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Zap className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-foreground">Provider Connected!</p>
                              <p className="text-xs text-muted-foreground">Now you can fetch available models and add them to your list.</p>
                            </div>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                fetchAvailableModels();
                              }}
                              disabled={loadingModels}
                              className="gap-2"
                            >
                              {loadingModels ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Zap className="w-3 h-3" />
                              )}
                              Fetch Models
                            </Button>
                          </div>
                        </div>

                        {validationErrors.models && (
                          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex gap-2">
                            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                            <p className="text-xs text-destructive">{validationErrors.models}</p>
                          </div>
                        )}

                        <div className="space-y-3">
                          {selectedProvider.models.map((model, index) => (
                            <Card key={model.id} className={cn(
                              "bg-muted/30",
                              validationErrors[`model_${index}_id`] || validationErrors[`model_${index}_name`] ? "border-destructive" : ""
                            )}>
                              <CardContent className="p-4">
                                {isEditing ? (
                                  <div className="space-y-3">
                                    <div className="flex gap-2">
                                      <div className="flex-1 relative">
                                        <input
                                          value={model.modelId}
                                          onChange={(e) => {
                                            handleUpdateModel(model.id, { modelId: e.target.value });
                                            setModelSearchQuery(prev => ({ ...prev, [model.id]: e.target.value }));
                                          }}
                                          onFocus={() => {
                                            setFocusedModelId(model.id);
                                            if (selectedProvider && selectedProvider.id !== 'new') {
                                              fetchAvailableModels();
                                            }
                                          }}
                                          onBlur={() => {
                                            // Delay blur to allow onMouseDown to trigger on suggestions
                                            setTimeout(() => setFocusedModelId(null), 200);
                                          }}
                                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                                          placeholder="Start typing to see suggestions..."
                                        />
                                        {validationErrors[`model_${index}_id`] && (
                                          <p className="text-xs text-destructive mt-1">{validationErrors[`model_${index}_id`]}</p>
                                        )}

                                        {/* Autocomplete Suggestions */}
                                        {focusedModelId === model.id && selectedProvider && availableModels[selectedProvider.id] && availableModels[selectedProvider.id].length > 0 && (
                                          <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-auto">
                                            {availableModels[selectedProvider.id]
                                              .filter(m => {
                                                const query = (modelSearchQuery[model.id] || '').toLowerCase();
                                                return !query || 
                                                  m.id.toLowerCase().includes(query) ||
                                                  m.name.toLowerCase().includes(query);
                                              })
                                              .slice(0, 20)
                                              .map((suggested) => (
                                                <button
                                                  key={suggested.id}
                                                  type="button"
                                                  onMouseDown={(e) => {
                                                    e.preventDefault(); // Prevent blur before click
                                                    handleSelectSuggestedModel(index, suggested);
                                                  }}
                                                  className="w-full px-3 py-2 text-left hover:bg-muted transition-colors flex items-start justify-between gap-2 border-b border-border last:border-0"
                                                >
                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-foreground truncate">{suggested.name}</p>
                                                    <p className="text-xs text-muted-foreground font-mono truncate">{suggested.id}</p>
                                                  </div>
                                                  {suggested.maxTokens && (
                                                    <div className="flex-shrink-0">
                                                      <Badge variant="outline" className="text-[10px] px-1 h-4">
                                                        {suggested.maxTokens}
                                                      </Badge>
                                                    </div>
                                                  )}
                                                </button>
                                              ))}
                                          </div>
                                        )}

                                        {loadingModels && selectedProvider?.id && (
                                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                          </div>
                                        )}
                                      </div>
                                      <Button
                                        variant="destructive"
                                        size="icon"
                                        onClick={() => handleRemoveModel(model.id)}
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </div>
                                    <div>
                                      <input
                                        value={model.name}
                                        onChange={(e) => handleUpdateModel(model.id, { name: e.target.value })}
                                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                        placeholder="Model Display Name"
                                      />
                                      {validationErrors[`model_${index}_name`] && (
                                        <p className="text-xs text-destructive mt-1">{validationErrors[`model_${index}_name`]}</p>
                                      )}
                                    </div>
                                    <input
                                      value={model.description || ''}
                                      onChange={(e) => handleUpdateModel(model.id, { description: e.target.value })}
                                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                      placeholder="Description (optional)"
                                    />
                                    
                                    {/* Max Tokens Field */}
                                    <div>
                                      <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                                        Max Tokens
                                        <Tooltip content="Maximum tokens for model output. Auto-filled from model specs.">
                                          <HelpCircle className="w-3 h-3" />
                                        </Tooltip>
                                      </label>
                                      <input
                                        type="number"
                                        value={(model.options as any)?.maxTokens || ''}
                                        onChange={(e) => {
                                          const value = e.target.value ? parseInt(e.target.value) : undefined;
                                          handleUpdateModel(model.id, {
                                            options: { ...model.options, maxTokens: value }
                                          });
                                        }}
                                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                        placeholder="e.g., 8192"
                                        min="1"
                                        max="200000"
                                      />
                                    </div>

                                    <div className="flex items-center gap-4">
                                      <label className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={model.isEnabled}
                                          onChange={(e) => handleUpdateModel(model.id, { isEnabled: e.target.checked })}
                                          className="w-4 h-4"
                                        />
                                        <span className="text-xs">Enabled</span>
                                      </label>
                                      <label className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={model.isDefault}
                                          onChange={(e) => handleUpdateModel(model.id, { isDefault: e.target.checked })}
                                          className="w-4 h-4"
                                        />
                                        <span className="text-xs">Default</span>
                                      </label>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Cpu className="w-4 h-4 text-primary" />
                                        <p className="font-semibold text-sm">{model.name}</p>
                                        {model.isDefault && <Badge variant="default" className="text-xs">Default</Badge>}
                                        {!model.isEnabled && <Badge variant="secondary" className="text-xs">Disabled</Badge>}
                                      </div>
                                      <p className="text-xs text-muted-foreground font-mono">{model.modelId}</p>
                                      {model.description && (
                                        <p className="text-xs text-muted-foreground mt-1">{model.description}</p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                          {selectedProvider.models.length === 0 && (
                            <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                              <Cpu className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                              <p className="text-xs text-muted-foreground mb-3">No models configured</p>
                              {isEditing && (
                                <Button variant="outline" size="sm" onClick={handleAddModel} className="gap-2">
                                  <Plus className="w-3 h-3" />
                                  Add Your First Model
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="h-full flex flex-col items-center justify-center py-24 border-2 border-dashed border-border rounded-2xl bg-muted/10">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <Server className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Select a provider to view or edit</h3>
                <p className="text-muted-foreground mb-8 max-w-sm text-center">
                  Configure LLM providers and models for your OpenCode workspaces. Start by adding a provider from the sidebar.
                </p>
                <Button onClick={() => setShowQuickAdd(true)} className="gap-2">
                  <Plus className="w-5 h-5" />
                  Add Your First Provider
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
