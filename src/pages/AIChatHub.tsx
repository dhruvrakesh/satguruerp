import React, { useState } from 'react';
import { ChatInterface } from '@/components/ai/ChatInterface';
import { AIInsightPanel } from '@/components/ai/AIInsightPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AIConversation } from '@/services/aiService';
import { 
  Brain, 
  MessageSquare, 
  Factory, 
  Package, 
  BarChart3,
  Lightbulb,
  Zap,
  TrendingUp
} from 'lucide-react';

export default function AIChatHub() {
  const [selectedConversation, setSelectedConversation] = useState<AIConversation | null>(null);
  const [activeContextType, setActiveContextType] = useState<'general' | 'manufacturing' | 'inventory' | 'analytics'>('general');

  const contextTypes = [
    {
      id: 'general' as const,
      label: 'General',
      icon: MessageSquare,
      description: 'General questions and system guidance',
      color: 'bg-gray-500'
    },
    {
      id: 'manufacturing' as const,
      label: 'Manufacturing',
      icon: Factory,
      description: 'Production processes and quality control',
      color: 'bg-blue-500'
    },
    {
      id: 'inventory' as const,
      label: 'Inventory',
      icon: Package,
      description: 'Stock management and optimization',
      color: 'bg-green-500'
    },
    {
      id: 'analytics' as const,
      label: 'Analytics',
      icon: BarChart3,
      description: 'Data insights and reporting',
      color: 'bg-purple-500'
    }
  ];

  const quickActions = [
    {
      title: 'Analyze Production Efficiency',
      description: 'Get AI insights on current production metrics',
      icon: TrendingUp,
      context: 'manufacturing' as const,
      prompt: "Analyze my current production efficiency and suggest improvements"
    },
    {
      title: 'Stock Optimization',
      description: 'Review inventory levels and reorder suggestions',
      icon: Package,
      context: 'inventory' as const,
      prompt: "Review my current stock levels and provide optimization recommendations"
    },
    {
      title: 'Quality Control Review',
      description: 'Check recent quality metrics and trends',
      icon: Zap,
      context: 'manufacturing' as const,
      prompt: "Review recent quality control data and identify any concerning trends"
    },
    {
      title: 'Performance Dashboard',
      description: 'Generate insights from recent analytics data',
      icon: BarChart3,
      context: 'analytics' as const,
      prompt: "Create a performance summary based on recent analytics data"
    }
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            AI Chat Hub
          </h1>
          <p className="text-muted-foreground mt-1">
            Intelligent assistance for your manufacturing operations
          </p>
        </div>
      </div>

      <Tabs defaultValue="chat" className="space-y-4">
        <TabsList>
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Chat Interface
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            AI Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="space-y-4">
          {/* Context Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Choose AI Context</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {contextTypes.map((context) => {
                  const IconComponent = context.icon;
                  const isActive = activeContextType === context.id;
                  
                  return (
                    <Card 
                      key={context.id}
                      className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                        isActive ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => setActiveContextType(context.id)}
                    >
                      <CardContent className="p-4 text-center">
                        <div className={`w-12 h-12 rounded-full ${context.color} flex items-center justify-center mx-auto mb-3`}>
                          <IconComponent className="h-6 w-6 text-white" />
                        </div>
                        <h3 className="font-medium mb-1">{context.label}</h3>
                        <p className="text-xs text-muted-foreground">
                          {context.description}
                        </p>
                        {isActive && (
                          <Badge className="mt-2">Active</Badge>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quickActions.map((action, index) => {
                  const IconComponent = action.icon;
                  
                  return (
                    <Card 
                      key={index}
                      className="cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() => {
                        setActiveContextType(action.context);
                        // Note: In a real implementation, you'd trigger the prompt here
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <IconComponent className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium mb-1">{action.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              {action.description}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Chat Interface */}
          <ChatInterface
            contextType={activeContextType}
            selectedConversationId={selectedConversation?.id}
            onConversationSelect={setSelectedConversation}
          />
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="max-w-4xl mx-auto">
            <AIInsightPanel className="h-96" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}