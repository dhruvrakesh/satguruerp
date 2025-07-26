import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      messages, 
      conversationId, 
      contextType = 'general',
      model = 'gpt-4o-mini',
      temperature = 0.7 
    } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      throw new Error('Messages array is required');
    }

    // Get user from auth token
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authorization header is required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authentication token');
    }

    // Add system context based on contextType
    const systemMessages = {
      general: "You are a helpful AI assistant for a manufacturing ERP system. You help with general questions and provide guidance on using the system effectively.",
      manufacturing: "You are an AI assistant specialized in manufacturing processes. You help with production planning, quality control, and process optimization in a flexible packaging manufacturing environment.",
      inventory: "You are an AI assistant specialized in inventory management. You help with stock analysis, reorder suggestions, and inventory optimization.",
      analytics: "You are an AI assistant specialized in data analytics. You help interpret business data, generate insights, and create meaningful reports."
    };

    const systemMessage = {
      role: 'system',
      content: systemMessages[contextType as keyof typeof systemMessages] || systemMessages.general
    };

    const fullMessages = [systemMessage, ...messages];

    // Make OpenAI API call
    console.log('Making OpenAI API call with model:', model);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: fullMessages,
        temperature,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message;

    // Save conversation to database
    let savedConversationId = conversationId;
    
    if (!savedConversationId) {
      // Create new conversation
      const { data: newConversation, error: convError } = await supabase
        .from('ai_conversations')
        .insert({
          user_id: user.id,
          title: messages[0]?.content?.substring(0, 50) || 'New Chat',
          context_type: contextType
        })
        .select('id')
        .single();

      if (convError) {
        console.error('Error creating conversation:', convError);
        throw new Error('Failed to create conversation');
      }

      savedConversationId = newConversation.id;
    }

    // Save user message and assistant response
    const messagesToSave = [
      {
        conversation_id: savedConversationId,
        role: messages[messages.length - 1].role,
        content: messages[messages.length - 1].content,
        metadata: { timestamp: new Date().toISOString() }
      },
      {
        conversation_id: savedConversationId,
        role: 'assistant',
        content: assistantMessage.content,
        metadata: {
          model,
          tokens_used: data.usage?.total_tokens || 0,
          finish_reason: data.choices[0].finish_reason
        }
      }
    ];

    const { error: messageError } = await supabase
      .from('ai_messages')
      .insert(messagesToSave);

    if (messageError) {
      console.error('Error saving messages:', messageError);
      // Don't throw error here, just log it
    }

    // Log usage analytics
    const { error: usageError } = await supabase
      .from('ai_usage_analytics')
      .insert({
        user_id: user.id,
        feature_type: 'chat',
        tokens_used: data.usage?.total_tokens || 0,
        cost_estimate: (data.usage?.total_tokens || 0) * 0.0001 // Rough estimate
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
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});