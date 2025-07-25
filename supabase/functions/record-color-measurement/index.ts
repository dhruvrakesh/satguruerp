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

    const { session_id, measured_l, measured_a, measured_b, measurement_notes } = await req.json();

    console.log('Recording color measurement for session:', session_id);

    // Get session details with target values
    const { data: session, error: sessionError } = await supabase
      .from('qc_sessions')
      .select('uiorn, target_l, target_a, target_b, delta_e_tolerance')
      .eq('id', session_id)
      .eq('status', 'active')
      .single();

    if (sessionError || !session) {
      throw new Error(`Active QC session not found: ${session_id}`);
    }

    // Calculate Delta E using the database function
    const { data: deltaEResult, error: deltaEError } = await supabase
      .rpc('calculate_delta_e_2000', {
        l1: session.target_l,
        a1: session.target_a,
        b1: session.target_b,
        l2: measured_l,
        a2: measured_a,
        b2: measured_b
      });

    if (deltaEError) {
      throw new Error(`Failed to calculate Delta E: ${deltaEError.message}`);
    }

    const delta_e = deltaEResult;
    const is_pass = delta_e <= (session.delta_e_tolerance || 2.0);

    // Record the measurement
    const { data: measurement, error: measurementError } = await supabase
      .from('color_measurements_log')
      .insert({
        session_id,
        measured_l,
        measured_a,
        measured_b,
        delta_e,
        is_pass,
        measurement_notes
      })
      .select()
      .single();

    if (measurementError) {
      throw new Error(`Failed to record measurement: ${measurementError.message}`);
    }

    // Update orders_dashboard_se with latest measurement
    const { error: updateError } = await supabase
      .from('orders_dashboard_se')
      .update({
        xrite_l: measured_l,
        xrite_a: measured_a,
        xrite_b: measured_b,
        xrite_de: delta_e,
        xrite_status: is_pass ? 'PASS' : 'FAIL'
      })
      .eq('uiorn', session.uiorn);

    if (updateError) {
      console.error('Failed to update orders dashboard:', updateError);
      // Don't throw - measurement is still recorded
    }

    console.log('Color measurement recorded successfully:', measurement.id);

    return new Response(JSON.stringify({
      success: true,
      measurement_id: measurement.id,
      delta_e,
      is_pass,
      status: is_pass ? 'PASS' : 'FAIL',
      measured_l,
      measured_a,
      measured_b,
      target_l: session.target_l,
      target_a: session.target_a,
      target_b: session.target_b,
      tolerance: session.delta_e_tolerance
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in record-color-measurement:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});