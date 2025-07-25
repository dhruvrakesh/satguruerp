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

    const { session_id } = await req.json();

    console.log('Ending QC session:', session_id);

    // Update session status to completed
    const { data: session, error: sessionError } = await supabase
      .from('qc_sessions')
      .update({
        status: 'completed',
        end_time: new Date().toISOString()
      })
      .eq('id', session_id)
      .select()
      .single();

    if (sessionError || !session) {
      throw new Error(`Failed to end QC session: ${session_id}`);
    }

    // Get session statistics
    const { data: measurements, error: statsError } = await supabase
      .from('color_measurements_log')
      .select('is_pass, delta_e')
      .eq('session_id', session_id);

    if (statsError) {
      console.error('Failed to get session statistics:', statsError);
    }

    const totalMeasurements = measurements?.length || 0;
    const passedMeasurements = measurements?.filter(m => m.is_pass).length || 0;
    const failedMeasurements = totalMeasurements - passedMeasurements;
    const passRate = totalMeasurements > 0 ? (passedMeasurements / totalMeasurements) * 100 : 0;
    const avgDeltaE = totalMeasurements > 0 
      ? measurements?.reduce((sum, m) => sum + m.delta_e, 0) / totalMeasurements 
      : 0;

    console.log('QC session ended successfully:', session_id);

    return new Response(JSON.stringify({
      success: true,
      session_id,
      end_time: session.end_time,
      statistics: {
        total_measurements: totalMeasurements,
        passed_measurements: passedMeasurements,
        failed_measurements: failedMeasurements,
        pass_rate: Math.round(passRate),
        average_delta_e: Math.round(avgDeltaE * 100) / 100
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in end-qc-session:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});