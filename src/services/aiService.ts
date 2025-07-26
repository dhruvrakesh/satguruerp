import { supabase } from '@/integrations/supabase/client';

export interface AIMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
  created_at?: string;
}

export interface AIConversation {
  id: string;
  title: string;
  context_type: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
}

export interface AIInsight {
  id?: string;
  insight_type: string;
  title: string;
  description?: string;
  data: Record<string, any>;
  confidence_score?: number;
  is_read?: boolean;
  created_at?: string;
}

export class AIService {
  /**
   * Send a message to the AI chat completion endpoint
   */
  static async sendChatMessage(
    messages: AIMessage[],
    options: {
      conversationId?: string;
      contextType?: 'general' | 'manufacturing' | 'inventory' | 'analytics';
      model?: 'gpt-4o-mini' | 'gpt-4o';
      temperature?: number;
    } = {}
  ) {
    const { data, error } = await supabase.functions.invoke('ai-chat-completion', {
      body: {
        messages,
        conversationId: options.conversationId,
        contextType: options.contextType || 'general',
        model: options.model || 'gpt-4o-mini',
        temperature: options.temperature || 0.7
      }
    });

    if (error) {
      throw new Error(`AI Chat Error: ${error.message}`);
    }

    return data;
  }

  /**
   * Get all conversations for the current user
   */
  static async getConversations(): Promise<AIConversation[]> {
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('is_archived', false)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch conversations: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get messages for a specific conversation
   */
  static async getConversationMessages(conversationId: string): Promise<AIMessage[]> {
    const { data, error } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    return (data || []).map(msg => ({
      ...msg,
      role: msg.role as 'user' | 'assistant' | 'system',
      metadata: msg.metadata as Record<string, any>
    }));
  }

  /**
   * Create a new conversation
   */
  static async createConversation(
    title: string,
    contextType: string = 'general'
  ): Promise<AIConversation> {
    const { data, error } = await supabase
      .from('ai_conversations')
      .insert({
        title,
        context_type: contextType
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create conversation: ${error.message}`);
    }

    return data;
  }

  /**
   * Update conversation title
   */
  static async updateConversationTitle(conversationId: string, title: string) {
    const { error } = await supabase
      .from('ai_conversations')
      .update({ title })
      .eq('id', conversationId);

    if (error) {
      throw new Error(`Failed to update conversation: ${error.message}`);
    }
  }

  /**
   * Archive a conversation
   */
  static async archiveConversation(conversationId: string) {
    const { error } = await supabase
      .from('ai_conversations')
      .update({ is_archived: true })
      .eq('id', conversationId);

    if (error) {
      throw new Error(`Failed to archive conversation: ${error.message}`);
    }
  }

  /**
   * Get AI insights for the current user
   */
  static async getInsights(insightType?: string): Promise<AIInsight[]> {
    let query = supabase
      .from('ai_insights')
      .select('*')
      .order('created_at', { ascending: false });

    if (insightType) {
      query = query.eq('insight_type', insightType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch insights: ${error.message}`);
    }

    return (data || []).map(insight => ({
      ...insight,
      data: insight.data as Record<string, any>
    }));
  }

  /**
   * Mark an insight as read
   */
  static async markInsightAsRead(insightId: string) {
    const { error } = await supabase
      .from('ai_insights')
      .update({ is_read: true })
      .eq('id', insightId);

    if (error) {
      throw new Error(`Failed to mark insight as read: ${error.message}`);
    }
  }

  /**
   * Generate manufacturing insights based on current data
   */
  static async generateManufacturingInsights() {
    // This would analyze manufacturing data and generate insights
    // For now, return a placeholder implementation
    const insights = [
      {
        insight_type: 'process_optimization',
        title: 'Gravure Printing Efficiency',
        description: 'Consider optimizing print speed for better throughput',
        data: { 
          current_efficiency: 78, 
          target_efficiency: 85,
          improvement_potential: '9% throughput increase'
        },
        confidence_score: 0.85
      },
      {
        insight_type: 'quality_control',
        title: 'Color Consistency Alert',
        description: 'Recent color measurements show variance in Cyan values',
        data: {
          affected_orders: 3,
          variance_percentage: 12,
          recommended_action: 'Recalibrate spectrophotometer'
        },
        confidence_score: 0.92
      }
    ];

    // Insert insights into database
    const { error } = await supabase
      .from('ai_insights')
      .insert(insights);

    if (error) {
      throw new Error(`Failed to generate insights: ${error.message}`);
    }

    return insights;
  }

  /**
   * Get usage analytics for the current user
   */
  static async getUsageAnalytics() {
    const { data, error } = await supabase
      .from('ai_usage_analytics')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(`Failed to fetch usage analytics: ${error.message}`);
    }

    return data || [];
  }
}