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
   * Get all SATGURU conversations for the current user
   */
  static async getConversations(): Promise<AIConversation[]> {
    const { data, error } = await supabase
      .from('satguru_ai_conversations')
      .select('*')
      .eq('is_archived', false)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch conversations: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get messages for a specific SATGURU conversation
   */
  static async getConversationMessages(conversationId: string): Promise<AIMessage[]> {
    const { data, error } = await supabase
      .from('satguru_ai_messages')
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
   * Create a new SATGURU conversation
   */
  static async createConversation(
    title: string,
    contextType: string = 'general'
  ): Promise<AIConversation> {
    // Get user's organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .single();

    const { data, error } = await supabase
      .from('satguru_ai_conversations')
      .insert({
        title,
        context_type: contextType,
        organization_id: profile?.organization_id,
        manufacturing_context: {},
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create conversation: ${error.message}`);
    }

    return data;
  }

  /**
   * Update SATGURU conversation title
   */
  static async updateConversationTitle(conversationId: string, title: string) {
    const { error } = await supabase
      .from('satguru_ai_conversations')
      .update({ title })
      .eq('id', conversationId);

    if (error) {
      throw new Error(`Failed to update conversation: ${error.message}`);
    }
  }

  /**
   * Archive a SATGURU conversation
   */
  static async archiveConversation(conversationId: string) {
    const { error } = await supabase
      .from('satguru_ai_conversations')
      .update({ is_archived: true })
      .eq('id', conversationId);

    if (error) {
      throw new Error(`Failed to archive conversation: ${error.message}`);
    }
  }

  /**
   * Get SATGURU AI insights for the current user
   */
  static async getInsights(insightType?: string): Promise<AIInsight[]> {
    let query = supabase
      .from('satguru_ai_insights')
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
   * Mark a SATGURU insight as read
   */
  static async markInsightAsRead(insightId: string) {
    const { error } = await supabase
      .from('satguru_ai_insights')
      .update({ is_read: true })
      .eq('id', insightId);

    if (error) {
      throw new Error(`Failed to mark insight as read: ${error.message}`);
    }
  }

  /**
   * Generate SATGURU manufacturing insights based on current data
   */
  static async generateManufacturingInsights() {
    // Get user's organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .single();

    // Get real manufacturing context for insights
    const { data: manufacturingContext } = await supabase
      .rpc('get_manufacturing_context_for_ai', { 
        p_user_id: (await supabase.auth.getUser()).data.user?.id 
      });

    // Type the manufacturing context properly
    const context = manufacturingContext as any;

    // Generate real insights based on manufacturing data
    const insights = [];

    // Stock optimization insight
    if (context?.stock_summary?.low_stock_count > 0) {
      insights.push({
        insight_type: 'inventory_optimization',
        title: 'Low Stock Alert',
        description: `${context.stock_summary.low_stock_count} items below reorder level`,
        data: {
          low_stock_count: context.stock_summary.low_stock_count,
          total_items: context.stock_summary.total_items,
          affected_items: context.low_stock_items?.slice(0, 3) || [],
          recommended_action: 'Review and place purchase orders for critical items'
        },
        confidence_score: 0.95,
        manufacturing_context: context
      });
    }

    // Process efficiency insight
    if (context?.recent_orders?.length > 0) {
      insights.push({
        insight_type: 'process_efficiency',
        title: 'Production Activity',
        description: `${context.recent_orders.length} active manufacturing orders`,
        data: {
          active_orders: context.recent_orders.length,
          recent_orders: context.recent_orders.slice(0, 5),
          recommended_action: 'Monitor order progress and optimize workflow'
        },
        confidence_score: 0.88,
        manufacturing_context: context
      });
    }

    // Cost analysis insight
    if (context?.stock_summary?.total_value) {
      insights.push({
        insight_type: 'cost_analysis',
        title: 'Inventory Valuation',
        description: `Total inventory value: ₹${context.stock_summary.total_value.toLocaleString()}`,
        data: {
          total_value: context.stock_summary.total_value,
          inventory_turnover: 'Monitor for optimal turnover',
          recommended_action: 'Analyze slow-moving items to reduce carrying costs'
        },
        confidence_score: 0.82,
        manufacturing_context: context
      });
    }

    if (insights.length === 0) {
      // Fallback insights if no data available
      insights.push({
        insight_type: 'process_optimization',
        title: 'System Ready',
        description: 'AI analytics ready to provide insights as data becomes available',
        data: {
          status: 'ready',
          recommended_action: 'Continue operations and data collection'
        },
        confidence_score: 0.75,
        manufacturing_context: {}
      });
    }

    // Insert insights into SATGURU database
    const insightRecords = insights.map(insight => ({
      ...insight,
      organization_id: profile?.organization_id
    }));

    const { error } = await supabase
      .from('satguru_ai_insights')
      .insert(insightRecords);

    if (error) {
      throw new Error(`Failed to generate insights: ${error.message}`);
    }

    return insights;
  }

  /**
   * Get SATGURU usage analytics for the current user
   */
  static async getUsageAnalytics() {
    const { data, error } = await supabase
      .from('satguru_ai_usage_analytics')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(`Failed to fetch usage analytics: ${error.message}`);
    }

    return data || [];
  }
}