import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { uiorn } = await req.json();

    console.log('Starting QC session for UIORN:', uiorn);

    // Get order details and item code
    const { data: order, error: orderError } = await supabase
      .from('orders_dashboard_se')
      .select('item_code')
      .eq('uiorn', uiorn)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found for UIORN: ${uiorn}`);
    }

    // Get color standards from artwork master
    const { data: artwork, error: artworkError } = await supabase
      .from('master_data_artworks_se')
      .select('target_l, target_a, target_b, delta_e_tolerance')
      .eq('item_code', order.item_code)
      .single();

    if (artworkError || !artwork) {
      throw new Error(`Color standards not found for item: ${order.item_code}`);
    }

    // Create QC session
    const { data: session, error: sessionError } = await supabase
      .from('qc_sessions')
      .insert({
        uiorn,
        item_code: order.item_code,
        operator_id: req.headers.get('authorization')?.split(' ')[1] || null,
        target_l: artwork.target_l,
        target_a: artwork.target_a,
        target_b: artwork.target_b,
        delta_e_tolerance: artwork.delta_e_tolerance || 2.0,
        status: 'active'
      })
      .select()
      .single();

    if (sessionError) {
      throw new Error(`Failed to create QC session: ${sessionError.message}`);
    }

    console.log('QC session created successfully:', session.id);

    return new Response(JSON.stringify({
      success: true,
      session_id: session.id,
      item_code: order.item_code,
      target_l: artwork.target_l,
      target_a: artwork.target_a,
      target_b: artwork.target_b,
      delta_e_tolerance: artwork.delta_e_tolerance || 2.0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in start-qc-session:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});