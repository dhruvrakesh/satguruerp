import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useColorMeasurement } from "@/hooks/useColorMeasurement";
import { MobileColorQC } from "./MobileColorQC";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Palette, Target, TrendingUp, CheckCircle, XCircle, Play, Square, Smartphone } from "lucide-react";

interface ColorQualityPanelProps {
  uiorn: string;
}

interface MeasurementForm {
  measured_l: string;
  measured_a: string;
  measured_b: string;
  measurement_notes: string;
}

export function ColorQualityPanel({ uiorn }: ColorQualityPanelProps) {
  const [measurementForm, setMeasurementForm] = useState<MeasurementForm>({
    measured_l: "",
    measured_a: "",
    measured_b: "",
    measurement_notes: ""
  });

  const {
    startQCSession,
    recordColorMeasurement,
    endQCSession,
    useActiveQCSession,
    useColorMeasurements,
    useColorTrends,
    useColorStatus
  } = useColorMeasurement();

  const { data: activeSession } = useActiveQCSession(uiorn);
  const { data: measurements = [] } = useColorMeasurements(activeSession?.id || "");
  const { data: colorTrends = [] } = useColorTrends(uiorn);
  const { data: currentColorStatus } = useColorStatus(uiorn);

  const handleStartSession = () => {
    startQCSession.mutate(uiorn);
  };

  const handleEndSession = () => {
    if (activeSession) {
      endQCSession.mutate(activeSession.id);
    }
  };

  const handleRecordMeasurement = () => {
    if (!activeSession) return;

    const measurement = {
      session_id: activeSession.id,
      measured_l: parseFloat(measurementForm.measured_l),
      measured_a: parseFloat(measurementForm.measured_a),
      measured_b: parseFloat(measurementForm.measured_b),
      measurement_notes: measurementForm.measurement_notes || undefined
    };

    recordColorMeasurement.mutate(measurement);
    
    // Reset form
    setMeasurementForm({
      measured_l: "",
      measured_a: "",
      measured_b: "",
      measurement_notes: ""
    });
  };

  const getColorStatusBadge = (status: string | null) => {
    switch (status) {
      case 'PASS':
        return <Badge className="bg-green-100 text-green-800 border-green-200">PASS</Badge>;
      case 'FAIL':
        return <Badge variant="destructive">FAIL</Badge>;
      default:
        return <Badge variant="outline">NOT MEASURED</Badge>;
    }
  };

  const calculatePassRate = () => {
    if (measurements.length === 0) return 0;
    const passCount = measurements.filter(m => m.is_pass).length;
    return Math.round((passCount / measurements.length) * 100);
  };

  const getLatestDeltaE = () => {
    if (measurements.length === 0) return currentColorStatus?.xrite_de || 0;
    return measurements[0].delta_e;
  };

  const getTargetProgress = () => {
    const deltaE = getLatestDeltaE();
    const tolerance = activeSession?.delta_e_tolerance || 2.0;
    return Math.max(0, Math.min(100, ((tolerance - deltaE) / tolerance) * 100));
  };

  // Prepare trend data for chart
  const trendData = colorTrends.map((measurement, index) => ({
    measurement: index + 1,
    delta_e: measurement.delta_e,
    tolerance: activeSession?.delta_e_tolerance || 2.0
  }));

  return (
    <div className="space-y-6">
      {/* Mobile/Desktop Toggle */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Color Quality Control</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const mobileView = document.getElementById('mobile-color-qc');
              const desktopView = document.getElementById('desktop-color-qc');
              if (mobileView && desktopView) {
                if (mobileView.style.display === 'none') {
                  mobileView.style.display = 'block';
                  desktopView.style.display = 'none';
                } else {
                  mobileView.style.display = 'none';
                  desktopView.style.display = 'block';
                }
              }
            }}
          >
            <Smartphone className="h-4 w-4 mr-1" />
            Toggle Mobile View
          </Button>
        </div>
      </div>

      {/* Mobile View */}
      <div id="mobile-color-qc" style={{ display: 'none' }}>
        <MobileColorQC uiorn={uiorn} />
      </div>

      {/* Desktop View */}
      <div id="desktop-color-qc" className="space-y-6">
      {/* Current Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Color Quality Status - {uiorn}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Current Status</div>
              {getColorStatusBadge(currentColorStatus?.xrite_status)}
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Latest ΔE</div>
              <div className="text-2xl font-bold">
                {getLatestDeltaE().toFixed(2)}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Pass Rate</div>
              <div className="text-2xl font-bold text-green-600">
                {calculatePassRate()}%
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Session</div>
              <div className="flex items-center gap-2">
                {activeSession ? (
                  <Badge className="bg-green-100 text-green-800 border-green-200">ACTIVE</Badge>
                ) : (
                  <Badge variant="outline">INACTIVE</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Control Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Color Measurement Control
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Session Controls */}
            <div className="flex gap-2">
              <Button 
                onClick={handleStartSession}
                disabled={!!activeSession || startQCSession.isPending}
                className="flex-1"
              >
                <Play className="h-4 w-4 mr-2" />
                {startQCSession.isPending ? "Starting..." : "Start QC Session"}
              </Button>
              <Button 
                onClick={handleEndSession}
                disabled={!activeSession || endQCSession.isPending}
                variant="outline"
                className="flex-1"
              >
                <Square className="h-4 w-4 mr-2" />
                {endQCSession.isPending ? "Ending..." : "End Session"}
              </Button>
            </div>

            {/* Target Values Display */}
            {activeSession && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <h4 className="font-medium mb-2">Target Color Values</h4>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">L*:</span>
                    <span className="ml-2 font-medium">{activeSession.target_l.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">a*:</span>
                    <span className="ml-2 font-medium">{activeSession.target_a.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">b*:</span>
                    <span className="ml-2 font-medium">{activeSession.target_b.toFixed(2)}</span>
                  </div>
                </div>
                <div className="mt-2 text-sm">
                  <span className="text-muted-foreground">Tolerance:</span>
                  <span className="ml-2 font-medium">ΔE ≤ {activeSession.delta_e_tolerance.toFixed(1)}</span>
                </div>
              </div>
            )}

            {/* Measurement Form */}
            {activeSession && (
              <div className="space-y-3">
                <h4 className="font-medium">Record New Measurement</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">L*</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={measurementForm.measured_l}
                      onChange={(e) => setMeasurementForm(prev => ({ ...prev, measured_l: e.target.value }))}
                      placeholder="L* value"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">a*</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={measurementForm.measured_a}
                      onChange={(e) => setMeasurementForm(prev => ({ ...prev, measured_a: e.target.value }))}
                      placeholder="a* value"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">b*</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={measurementForm.measured_b}
                      onChange={(e) => setMeasurementForm(prev => ({ ...prev, measured_b: e.target.value }))}
                      placeholder="b* value"
                    />
                  </div>
                </div>
                <Textarea
                  value={measurementForm.measurement_notes}
                  onChange={(e) => setMeasurementForm(prev => ({ ...prev, measurement_notes: e.target.value }))}
                  placeholder="Optional notes about this measurement..."
                  rows={2}
                />
                <Button 
                  onClick={handleRecordMeasurement}
                  disabled={!measurementForm.measured_l || !measurementForm.measured_a || !measurementForm.measured_b || recordColorMeasurement.isPending}
                  className="w-full"
                >
                  {recordColorMeasurement.isPending ? "Recording..." : "Record Measurement"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delta E Progress & Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Color Accuracy Monitoring
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Delta E Progress */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Current ΔE Target</span>
                <span className="text-sm text-muted-foreground">
                  ≤ {activeSession?.delta_e_tolerance.toFixed(1) || '2.0'}
                </span>
              </div>
              <Progress value={getTargetProgress()} className="h-3" />
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Measured: {getLatestDeltaE().toFixed(2)}</span>
                <span>{getTargetProgress().toFixed(0)}% within target</span>
              </div>
            </div>

            {/* Trend Chart */}
            {trendData.length > 0 && (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="measurement" />
                    <YAxis domain={[0, 'dataMax']} />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        name === 'delta_e' ? `ΔE: ${value.toFixed(2)}` : `Target: ${value.toFixed(1)}`,
                        name === 'delta_e' ? 'Measured' : 'Tolerance'
                      ]}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="delta_e" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="tolerance" 
                      stroke="hsl(var(--destructive))" 
                      strokeDasharray="5 5" 
                      strokeWidth={1}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Measurements */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Measurements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {measurements.slice(0, 10).map((measurement, index) => (
              <div key={measurement.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="text-sm font-medium">#{measurements.length - index}</div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <span>L*: {measurement.measured_l.toFixed(2)}</span>
                    <span>a*: {measurement.measured_a.toFixed(2)}</span>
                    <span>b*: {measurement.measured_b.toFixed(2)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">ΔE: {measurement.delta_e.toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground">
                    {new Date(measurement.captured_at).toLocaleTimeString()}
                  </div>
                  {measurement.is_pass ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
              </div>
            ))}
            {measurements.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {activeSession ? "No measurements recorded yet" : "Start a QC session to begin recording measurements"}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}