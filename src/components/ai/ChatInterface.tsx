import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAIChat } from '@/hooks/useAIChat';
import { useToast } from '@/hooks/use-toast';
import { AIMessage, AIConversation } from '@/services/aiService';
import { Send, Plus, Archive, Edit2, Bot, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInterfaceProps {
  contextType?: 'general' | 'manufacturing' | 'inventory' | 'analytics';
  selectedConversationId?: string;
  onConversationSelect?: (conversation: AIConversation) => void;
}

export function ChatInterface({ 
  contextType = 'general', 
  selectedConversationId,
  onConversationSelect 
}: ChatInterfaceProps) {
  const [inputMessage, setInputMessage] = useState('');
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const {
    messages,
    conversations,
    currentConversation,
    isLoading,
    isTyping,
    sendMessage,
    createNewConversation,
    archiveConversation,
    updateConversationTitle,
  } = useAIChat(selectedConversationId);
  
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isTyping) return;

    try {
      await sendMessage(inputMessage, contextType);
      setInputMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      toast({
        title: "Chat Error",
        description: "Failed to send message. Please check if OpenAI API key is configured.",
        variant: "destructive",
      });
    }
  };

  const handleNewConversation = async () => {
    const conversation = await createNewConversation('New Chat', contextType);
    if (conversation && onConversationSelect) {
      onConversationSelect(conversation);
    }
  };

  const handleArchive = async (conversationId: string) => {
    await archiveConversation(conversationId);
  };

  const handleTitleEdit = (conversation: AIConversation) => {
    setEditingTitle(conversation.id);
    setNewTitle(conversation.title);
  };

  const handleTitleSave = async (conversationId: string) => {
    if (newTitle.trim()) {
      await updateConversationTitle(conversationId, newTitle.trim());
    }
    setEditingTitle(null);
    setNewTitle('');
  };

  const getContextBadgeColor = (context: string) => {
    switch (context) {
      case 'manufacturing': return 'bg-blue-500';
      case 'inventory': return 'bg-green-500';
      case 'analytics': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const formatMessageTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4">
      {/* Conversation Sidebar */}
      <div className="w-80 flex flex-col border-r bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">AI Conversations</CardTitle>
            <Button onClick={handleNewConversation} size="sm" variant="outline">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <Badge variant="outline" className={cn("w-fit", getContextBadgeColor(contextType))}>
            {contextType.charAt(0).toUpperCase() + contextType.slice(1)}
          </Badge>
        </CardHeader>
        
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <Card 
                key={conversation.id}
                className={cn(
                  "cursor-pointer transition-colors hover:bg-muted/50 p-3",
                  currentConversation?.id === conversation.id && "bg-muted"
                )}
                onClick={() => onConversationSelect?.(conversation)}
              >
                <div className="flex items-center justify-between">
                  {editingTitle === conversation.id ? (
                    <Input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onBlur={() => handleTitleSave(conversation.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleTitleSave(conversation.id);
                        if (e.key === 'Escape') setEditingTitle(null);
                      }}
                      className="text-sm"
                      autoFocus
                    />
                  ) : (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {conversation.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(conversation.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex space-x-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTitleEdit(conversation);
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArchive(conversation.id);
                      }}
                    >
                      <Archive className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            {currentConversation?.title || 'AI Assistant'}
            {currentConversation && (
              <Badge variant="outline" className="text-xs">
                {currentConversation.context_type}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.length === 0 && !isLoading && (
                <div className="text-center py-8">
                  <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
                  <p className="text-muted-foreground">
                    Ask me anything about your manufacturing operations, inventory, or analytics.
                  </p>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex gap-3 max-w-[80%]",
                    message.role === 'user' ? "ml-auto" : "mr-auto"
                  )}
                >
                  <div className={cn(
                    "p-3 rounded-lg",
                    message.role === 'user' 
                      ? "bg-primary text-primary-foreground ml-auto" 
                      : "bg-muted"
                  )}>
                    <div className="flex items-start gap-2">
                      {message.role === 'assistant' && <Bot className="h-4 w-4 mt-0.5" />}
                      {message.role === 'user' && <User className="h-4 w-4 mt-0.5" />}
                      <div className="flex-1">
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        {message.created_at && (
                          <p className="text-xs opacity-70 mt-1">
                            {formatMessageTime(message.created_at)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-3 max-w-[80%]">
                  <div className="bg-muted p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4" />
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">AI is typing...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Message Input */}
          <div className="border-t p-4">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type your message..."
                disabled={isTyping}
                className="flex-1"
              />
              <Button type="submit" disabled={!inputMessage.trim() || isTyping}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </CardContent>
      </div>
    </div>
  );
}