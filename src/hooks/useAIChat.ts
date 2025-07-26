import { useState, useEffect } from 'react';
import { AIService, AIMessage, AIConversation } from '@/services/aiService';
import { useToast } from '@/hooks/use-toast';

export function useAIChat(conversationId?: string) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<AIConversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const { toast } = useToast();

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Load messages when conversation changes
  useEffect(() => {
    if (conversationId) {
      loadConversationMessages(conversationId);
    } else {
      setMessages([]);
      setCurrentConversation(null);
    }
  }, [conversationId]);

  const loadConversations = async () => {
    try {
      const data = await AIService.getConversations();
      setConversations(data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive",
      });
    }
  };

  const loadConversationMessages = async (id: string) => {
    try {
      setIsLoading(true);
      const [messagesData, conversationsData] = await Promise.all([
        AIService.getConversationMessages(id),
        AIService.getConversations()
      ]);
      
      setMessages(messagesData);
      setConversations(conversationsData);
      
      const conversation = conversationsData.find(c => c.id === id);
      setCurrentConversation(conversation || null);
    } catch (error) {
      console.error('Failed to load messages:', error);
      toast({
        title: "Error",
        description: "Failed to load conversation",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (
    content: string,
    contextType: 'general' | 'manufacturing' | 'inventory' | 'analytics' = 'general'
  ) => {
    if (!content.trim()) return;

    const userMessage: AIMessage = {
      role: 'user',
      content: content.trim(),
    };

    // Add user message to UI immediately
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const messagesToSend = [...messages, userMessage];
      
      const response = await AIService.sendChatMessage(messagesToSend, {
        conversationId: currentConversation?.id,
        contextType,
      });

      // Add assistant response to messages
      setMessages(prev => [...prev, response.message]);
      
      // Update conversation ID if this was a new conversation
      if (!currentConversation && response.conversationId) {
        await loadConversations();
        const newConversation = conversations.find(c => c.id === response.conversationId);
        setCurrentConversation(newConversation || null);
      }

    } catch (error) {
      console.error('Failed to send message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
      
      // Remove the user message from UI on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsTyping(false);
    }
  };

  const createNewConversation = async (
    title: string = 'New Chat',
    contextType: string = 'general'
  ) => {
    try {
      const newConversation = await AIService.createConversation(title, contextType);
      setConversations(prev => [newConversation, ...prev]);
      setCurrentConversation(newConversation);
      setMessages([]);
      return newConversation;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      toast({
        title: "Error",
        description: "Failed to create new conversation",
        variant: "destructive",
      });
      return null;
    }
  };

  const archiveConversation = async (id: string) => {
    try {
      await AIService.archiveConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      
      if (currentConversation?.id === id) {
        setCurrentConversation(null);
        setMessages([]);
      }
      
      toast({
        title: "Success",
        description: "Conversation archived",
      });
    } catch (error) {
      console.error('Failed to archive conversation:', error);
      toast({
        title: "Error",
        description: "Failed to archive conversation",
        variant: "destructive",
      });
    }
  };

  const updateConversationTitle = async (id: string, title: string) => {
    try {
      await AIService.updateConversationTitle(id, title);
      setConversations(prev => 
        prev.map(c => c.id === id ? { ...c, title } : c)
      );
      
      if (currentConversation?.id === id) {
        setCurrentConversation(prev => prev ? { ...prev, title } : null);
      }
    } catch (error) {
      console.error('Failed to update conversation title:', error);
      toast({
        title: "Error",
        description: "Failed to update conversation title",
        variant: "destructive",
      });
    }
  };

  return {
    messages,
    conversations,
    currentConversation,
    isLoading,
    isTyping,
    sendMessage,
    createNewConversation,
    archiveConversation,
    updateConversationTitle,
    loadConversations,
  };
}