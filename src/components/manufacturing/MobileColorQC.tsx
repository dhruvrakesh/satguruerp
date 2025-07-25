import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useColorMeasurement } from "@/hooks/useColorMeasurement";
import { ColorBadge } from "@/components/ui/color-badge";
import { 
  Palette, 
  Target, 
  Play, 
  Square, 
  ScanLine, 
  Smartphone, 
  CheckCircle, 
  XCircle,
  TrendingUp
} from "lucide-react";

interface MobileColorQCProps {
  uiorn: string;
}

export function MobileColorQC({ uiorn }: MobileColorQCProps) {
  const [measurementForm, setMeasurementForm] = useState({
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
    useColorStatus
  } = useColorMeasurement();

  const { data: activeSession } = useActiveQCSession(uiorn);
  const { data: measurements = [] } = useColorMeasurements(activeSession?.id || "");
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

  const handleQuickScan = () => {
    // Mock quick scan functionality - would integrate with barcode scanner
    if (uiorn) {
      handleStartSession();
    }
  };

  const getLatestDeltaE = () => {
    if (measurements.length === 0) return currentColorStatus?.xrite_de || 0;
    return measurements[0].delta_e;
  };

  const calculatePassRate = () => {
    if (measurements.length === 0) return 0;
    const passCount = measurements.filter(m => m.is_pass).length;
    return Math.round((passCount / measurements.length) * 100);
  };

  const getTargetProgress = () => {
    const deltaE = getLatestDeltaE();
    const tolerance = activeSession?.delta_e_tolerance || 2.0;
    return Math.max(0, Math.min(100, ((tolerance - deltaE) / tolerance) * 100));
  };

  return (
    <div className="max-w-md mx-auto space-y-4 p-4">
      {/* Header Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Smartphone className="h-5 w-5 text-blue-600" />
            Mobile Color QC
          </CardTitle>
          <div className="text-sm text-muted-foreground">Order: {uiorn}</div>
        </CardHeader>
      </Card>

      {/* Quick Status Card */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {getLatestDeltaE().toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground">Latest ΔE</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {calculatePassRate()}%
              </div>
              <div className="text-xs text-muted-foreground">Pass Rate</div>
            </div>
          </div>
          <div className="mt-3">
            <ColorBadge status={currentColorStatus?.xrite_status as any} className="w-full" />
          </div>
        </CardContent>
      </Card>

      {/* Session Control */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4" />
            Session Control
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!activeSession ? (
            <div className="space-y-3">
              <Button 
                onClick={handleQuickScan}
                className="w-full h-12 text-base"
                disabled={startQCSession.isPending}
              >
                <ScanLine className="h-5 w-5 mr-2" />
                {startQCSession.isPending ? "Starting..." : "Quick Scan & Start"}
              </Button>
              <Button 
                onClick={handleStartSession}
                variant="outline"
                className="w-full"
                disabled={startQCSession.isPending}
              >
                <Play className="h-4 w-4 mr-2" />
                Manual Start Session
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-sm font-medium text-green-800">Session Active</div>
                <div className="text-xs text-green-600 mt-1">
                  Started: {new Date(activeSession.start_time).toLocaleTimeString()}
                </div>
                <div className="text-xs text-green-600">
                  Measurements: {measurements.length}
                </div>
              </div>
              <Button 
                onClick={handleEndSession}
                variant="outline"
                className="w-full"
                disabled={endQCSession.isPending}
              >
                <Square className="h-4 w-4 mr-2" />
                {endQCSession.isPending ? "Ending..." : "End Session"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Target Values */}
      {activeSession && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Target Values</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-sm font-medium">{activeSession.target_l.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">L*</div>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-sm font-medium">{activeSession.target_a.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">a*</div>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-sm font-medium">{activeSession.target_b.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">b*</div>
              </div>
            </div>
            <div className="mt-3 text-center">
              <div className="text-sm">
                <span className="text-muted-foreground">Tolerance:</span>
                <span className="ml-2 font-medium">ΔE ≤ {activeSession.delta_e_tolerance.toFixed(1)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Measurement */}
      {activeSession && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Record Measurement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">L*</label>
                <Input
                  type="number"
                  step="0.01"
                  value={measurementForm.measured_l}
                  onChange={(e) => setMeasurementForm(prev => ({ ...prev, measured_l: e.target.value }))}
                  placeholder="L*"
                  className="text-center"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">a*</label>
                <Input
                  type="number"
                  step="0.01"
                  value={measurementForm.measured_a}
                  onChange={(e) => setMeasurementForm(prev => ({ ...prev, measured_a: e.target.value }))}
                  placeholder="a*"
                  className="text-center"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">b*</label>
                <Input
                  type="number"
                  step="0.01"
                  value={measurementForm.measured_b}
                  onChange={(e) => setMeasurementForm(prev => ({ ...prev, measured_b: e.target.value }))}
                  placeholder="b*"
                  className="text-center"
                />
              </div>
            </div>

            <Input
              value={measurementForm.measurement_notes}
              onChange={(e) => setMeasurementForm(prev => ({ ...prev, measurement_notes: e.target.value }))}
              placeholder="Optional notes..."
              className="text-sm"
            />

            <Button 
              onClick={handleRecordMeasurement}
              disabled={!measurementForm.measured_l || !measurementForm.measured_a || !measurementForm.measured_b || recordColorMeasurement.isPending}
              className="w-full h-11"
            >
              <Palette className="h-4 w-4 mr-2" />
              {recordColorMeasurement.isPending ? "Recording..." : "Record Measurement"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Progress Indicator */}
      {activeSession && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Accuracy Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span>Target Achievement</span>
                <span className="font-medium">{getTargetProgress().toFixed(0)}%</span>
              </div>
              <Progress value={getTargetProgress()} className="h-2" />
              <div className="text-xs text-muted-foreground text-center">
                Current ΔE: {getLatestDeltaE().toFixed(2)} | Target: ≤{activeSession.delta_e_tolerance.toFixed(1)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Measurements */}
      {measurements.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Measurements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {measurements.slice(0, 5).map((measurement, index) => (
                <div key={measurement.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium">#{measurements.length - index}</div>
                    <div className="text-xs">
                      ΔE: {measurement.delta_e.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-muted-foreground">
                      {new Date(measurement.captured_at).toLocaleTimeString().slice(0, 5)}
                    </div>
                    {measurement.is_pass ? (
                      <CheckCircle className="h-3 w-3 text-green-600" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}