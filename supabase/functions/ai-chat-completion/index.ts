import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('AI Chat Completion function called:', req.method, req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting ai-chat-completion function');
    
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    console.log('OpenAI API Key configured:', !!openAIApiKey);
    
    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY is not configured');
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    console.log('Supabase URL configured:', !!supabaseUrl);
    console.log('Supabase Service Role Key configured:', !!supabaseKey);
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    let requestBody;
    try {
      requestBody = await req.json();
      console.log('Request body parsed successfully');
    } catch (error) {
      console.error('Failed to parse request body:', error);
      throw new Error('Invalid JSON in request body');
    }

    const { 
      messages, 
      conversationId, 
      contextType = 'general',
      model = 'gpt-4.1-2025-04-14',
      temperature = 0.7 
    } = requestBody;
    
    console.log('Request params:', { 
      messageCount: messages?.length, 
      conversationId, 
      contextType, 
      model 
    });

    if (!messages || !Array.isArray(messages)) {
      console.error('Invalid messages array:', messages);
      throw new Error('Messages array is required');
    }

    // Get user from auth token
    const authHeader = req.headers.get('authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('No authorization header found');
      throw new Error('Authorization header is required');
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('Attempting to get user with token');
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError) {
      console.error('Auth error:', authError);
      throw new Error(`Authentication failed: ${authError.message}`);
    }
    
    if (!user) {
      console.error('No user found');
      throw new Error('Invalid authentication token');
    }
    
    console.log('User authenticated:', user.id);

    // Make sure user has valid SATGURU org
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id, organizations!inner(code)')
      .eq('id', user.id)
      .single();
    
    if (profileError || !profile) {
      console.error('Profile error:', profileError);
      throw new Error('User profile not found');
    }
    
    // Verify user is from SATGURU organization
    if (profile.organizations.code !== 'SATGURU') {
      console.error('User not authorized for SATGURU AI:', profile.organizations.code);
      throw new Error('Access denied: SATGURU organization required');
    }
    
    console.log('SATGURU user profile loaded:', profile);

    // Get manufacturing context for AI
    let manufacturingContext = {};
    try {
      const { data: contextData, error: contextError } = await supabase
        .rpc('get_manufacturing_context_for_ai', { p_user_id: user.id });
      
      if (contextError) {
        console.warn('Failed to get manufacturing context:', contextError);
      } else {
        manufacturingContext = contextData || {};
        console.log('Manufacturing context loaded:', manufacturingContext);
      }
    } catch (error) {
      console.warn('Error loading manufacturing context:', error);
    }

    // Add system context based on contextType with manufacturing data
    const systemMessages = {
      general: `You are a helpful AI assistant for Satguru Engravures, a flexible packaging manufacturing company. You help with general questions and provide guidance on using the ERP system effectively.

Current Context:
- Total Items in Inventory: ${manufacturingContext.stock_summary?.total_items || 'N/A'}
- Low Stock Items: ${manufacturingContext.stock_summary?.low_stock_count || 'N/A'}
- Recent Orders: ${manufacturingContext.recent_orders?.length || 0}

You can help with inventory management, manufacturing processes, and business operations.`,

      manufacturing: `You are an AI assistant specialized in manufacturing processes for Satguru Engravures, a flexible packaging company. You help with production planning, quality control, and process optimization.

Current Manufacturing Context:
- Total Items in Inventory: ${manufacturingContext.stock_summary?.total_items || 'N/A'}
- Low Stock Items: ${manufacturingContext.stock_summary?.low_stock_count || 'N/A'}
- Recent Manufacturing Orders: ${manufacturingContext.recent_orders?.length || 0}
${manufacturingContext.low_stock_items?.length > 0 ? 
  `\nLow Stock Alert Items:\n${manufacturingContext.low_stock_items.slice(0, 5).map(item => 
    `- ${item.item_name} (${item.item_code}): ${item.current_qty} remaining`
  ).join('\n')}` : ''
}

You specialize in gravure printing, lamination, slitting, and packaging operations.`,

      inventory: `You are an AI assistant specialized in inventory management for Satguru Engravures. You help with stock analysis, reorder suggestions, and inventory optimization.

Current Inventory Status:
- Total Items: ${manufacturingContext.stock_summary?.total_items || 'N/A'}
- Low Stock Items: ${manufacturingContext.stock_summary?.low_stock_count || 'N/A'}
- Total Inventory Value: ₹${manufacturingContext.stock_summary?.total_value?.toLocaleString() || 'N/A'}
${manufacturingContext.low_stock_items?.length > 0 ? 
  `\nItems Needing Attention:\n${manufacturingContext.low_stock_items.slice(0, 5).map(item => 
    `- ${item.item_name} (${item.item_code}): ${item.current_qty} units (Reorder at: ${item.reorder_level})`
  ).join('\n')}` : ''
}

You can help analyze stock levels, suggest reorders, and optimize inventory management.`,

      analytics: `You are an AI assistant specialized in data analytics for Satguru Engravures manufacturing operations. You help interpret business data, generate insights, and create meaningful reports.

Current Analytics Overview:
- Total Inventory Items: ${manufacturingContext.stock_summary?.total_items || 'N/A'}
- Inventory Valuation: ₹${manufacturingContext.stock_summary?.total_value?.toLocaleString() || 'N/A'}
- Active Manufacturing Orders: ${manufacturingContext.recent_orders?.length || 0}
- Stock Efficiency: ${manufacturingContext.stock_summary?.low_stock_count > 0 ? 'Needs Attention' : 'Good'}

You can help analyze manufacturing KPIs, inventory turnover, production efficiency, and generate business insights.`
    };

    const systemMessage = {
      role: 'system',
      content: systemMessages[contextType as keyof typeof systemMessages] || systemMessages.general
    };

    const fullMessages = [systemMessage, ...messages];

    // Make OpenAI API call
    console.log('Making OpenAI API call with model:', model);
    console.log('Message count for OpenAI:', fullMessages.length);
    
    const openAIPayload = {
      model,
      messages: fullMessages,
      temperature,
      max_tokens: 1000,
    };
    
    console.log('OpenAI request payload:', JSON.stringify(openAIPayload, null, 2));
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(openAIPayload),
    });
    
    console.log('OpenAI response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message;

    // Save conversation to SATGURU database
    let savedConversationId = conversationId;
    
    if (!savedConversationId) {
      // Create new SATGURU conversation
      const { data: newConversation, error: convError } = await supabase
        .from('satguru_ai_conversations')
        .insert({
          user_id: user.id,
          organization_id: profile.organization_id,
          title: messages[0]?.content?.substring(0, 50) || 'New Manufacturing Chat',
          context_type: contextType,
          manufacturing_context: manufacturingContext
        })
        .select('id')
        .single();

      if (convError) {
        console.error('Error creating SATGURU conversation:', convError);
        throw new Error('Failed to create conversation');
      }

      savedConversationId = newConversation.id;
      console.log('New SATGURU conversation created:', savedConversationId);
    }

    // Save user message and assistant response to SATGURU tables
    const messagesToSave = [
      {
        conversation_id: savedConversationId,
        role: messages[messages.length - 1].role,
        content: messages[messages.length - 1].content,
        metadata: { timestamp: new Date().toISOString() },
        manufacturing_data: manufacturingContext
      },
      {
        conversation_id: savedConversationId,
        role: 'assistant',
        content: assistantMessage.content,
        metadata: {
          model,
          tokens_used: data.usage?.total_tokens || 0,
          finish_reason: data.choices[0].finish_reason
        },
        manufacturing_data: manufacturingContext
      }
    ];

    const { error: messageError } = await supabase
      .from('satguru_ai_messages')
      .insert(messagesToSave);

    if (messageError) {
      console.error('Error saving SATGURU messages:', messageError);
      // Don't throw error here, just log it
    }

    // Store manufacturing context data
    if (Object.keys(manufacturingContext).length > 0) {
      const { error: contextError } = await supabase
        .from('satguru_ai_context_data')
        .insert({
          conversation_id: savedConversationId,
          context_type: 'stock_levels',
          context_data: manufacturingContext
        });

      if (contextError) {
        console.error('Error saving context data:', contextError);
      }
    }

    // Log usage analytics to SATGURU table
    const { error: usageError } = await supabase
      .from('satguru_ai_usage_analytics')
      .insert({
        user_id: user.id,
        organization_id: profile.organization_id,
        feature_type: 'chat',
        tokens_used: data.usage?.total_tokens || 0,
        cost_estimate: (data.usage?.total_tokens || 0) * 0.0001, // Rough estimate
        session_data: {
          model,
          context_type: contextType,
          message_count: messages.length,
          manufacturing_context_available: Object.keys(manufacturingContext).length > 0
        }
      });

    if (usageError) {
      console.error('Error logging usage:', usageError);
    }

    return new Response(JSON.stringify({
      message: assistantMessage,
      conversationId: savedConversationId,
      usage: data.usage
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-chat-completion function:', error);
    console.error('Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      type: error.constructor.name,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});