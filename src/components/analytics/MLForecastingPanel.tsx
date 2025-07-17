import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Brain, TrendingUp, AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { useMLForecasting, useAdvancedForecasting, useConsumptionAnomalies } from "@/hooks/useMLForecasting";
import { format } from "date-fns";

export const MLForecastingPanel = () => {
  const [selectedItemCode, setSelectedItemCode] = useState<string>("");
  const [forecastHorizon, setForecastHorizon] = useState<number>(3);
  const [confidenceLevel, setConfidenceLevel] = useState<number>(0.95);
  const [thresholdFactor, setThresholdFactor] = useState<number>(2.0);

  const { data: mlForecasts, isLoading: mlLoading } = useMLForecasting({
    itemCode: selectedItemCode,
    forecastHorizon,
    confidenceLevel,
  });

  const { data: advancedForecasts, isLoading: advancedLoading } = useAdvancedForecasting({
    itemCode: selectedItemCode,
    forecastHorizon,
  });

  const { data: anomalies, isLoading: anomaliesLoading } = useConsumptionAnomalies(
    selectedItemCode || undefined,
    thresholdFactor
  );

  const formatChartData = () => {
    if (!mlForecasts || !advancedForecasts) return [];
    
    const mlMap = new Map();
    mlForecasts.forEach(forecast => {
      const period = format(new Date(forecast.forecast_period), 'MMM yyyy');
      if (!mlMap.has(period)) {
        mlMap.set(period, { period, algorithms: {} });
      }
      mlMap.get(period).algorithms[forecast.algorithm] = {
        predicted: forecast.predicted_demand,
        lower: forecast.confidence_interval_lower,
        upper: forecast.confidence_interval_upper,
        accuracy: forecast.model_accuracy,
      };
    });

    return Array.from(mlMap.values());
  };

  const formatAdvancedChartData = () => {
    if (!advancedForecasts) return [];
    
    return advancedForecasts.map(forecast => ({
      period: format(new Date(forecast.forecast_month), 'MMM yyyy'),
      movingAverage: forecast.simple_moving_average,
      exponentialSmoothing: forecast.exponential_smoothing,
      linearTrend: forecast.linear_trend,
      seasonalAdjusted: forecast.seasonal_adjusted,
      recommended: forecast.recommended_forecast,
      confidence: forecast.confidence_score * 100,
    }));
  };

  const getBestAlgorithm = () => {
    if (!mlForecasts) return null;
    
    const algorithms = [...new Set(mlForecasts.map(f => f.algorithm))];
    return algorithms.reduce((best, current) => {
      const currentAccuracy = mlForecasts.find(f => f.algorithm === current)?.model_accuracy || 0;
      const bestAccuracy = mlForecasts.find(f => f.algorithm === best)?.model_accuracy || 0;
      return currentAccuracy > bestAccuracy ? current : best;
    }, algorithms[0]);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            ML-Powered Demand Forecasting
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <Label htmlFor="itemCode">Item Code</Label>
              <Input
                id="itemCode"
                value={selectedItemCode}
                onChange={(e) => setSelectedItemCode(e.target.value)}
                placeholder="Enter item code"
              />
            </div>
            <div>
              <Label htmlFor="horizon">Forecast Horizon (months)</Label>
              <Select value={forecastHorizon.toString()} onValueChange={(v) => setForecastHorizon(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 months</SelectItem>
                  <SelectItem value="6">6 months</SelectItem>
                  <SelectItem value="12">12 months</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="confidence">Confidence Level</Label>
              <Select value={confidenceLevel.toString()} onValueChange={(v) => setConfidenceLevel(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.90">90%</SelectItem>
                  <SelectItem value="0.95">95%</SelectItem>
                  <SelectItem value="0.99">99%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="threshold">Anomaly Threshold</Label>
              <Input
                id="threshold"
                type="number"
                step="0.1"
                value={thresholdFactor}
                onChange={(e) => setThresholdFactor(Number(e.target.value))}
              />
            </div>
          </div>

          <Tabs defaultValue="ml-algorithms" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="ml-algorithms">ML Algorithms</TabsTrigger>
              <TabsTrigger value="advanced-methods">Advanced Methods</TabsTrigger>
              <TabsTrigger value="anomalies">Anomaly Detection</TabsTrigger>
            </TabsList>

            <TabsContent value="ml-algorithms" className="mt-6">
              {mlLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : mlForecasts && mlForecasts.length > 0 ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 mb-4">
                    <Badge variant="secondary">
                      Best Algorithm: {getBestAlgorithm()}
                    </Badge>
                    <Badge variant="outline">
                      {mlForecasts.length} predictions
                    </Badge>
                  </div>

                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={formatChartData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-3 border rounded shadow">
                                <p className="font-semibold">{label}</p>
                                {Object.entries(data.algorithms).map(([alg, values]: [string, any]) => (
                                  <div key={alg} className="mt-2">
                                    <p className="text-sm font-medium">{alg}</p>
                                    <p className="text-sm">Predicted: {values.predicted?.toFixed(2)}</p>
                                    <p className="text-sm">Range: {values.lower?.toFixed(2)} - {values.upper?.toFixed(2)}</p>
                                    <p className="text-sm">Accuracy: {(values.accuracy * 100).toFixed(1)}%</p>
                                  </div>
                                ))}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...new Set(mlForecasts.map(f => f.algorithm))].map(algorithm => {
                      const algoData = mlForecasts.filter(f => f.algorithm === algorithm);
                      const avgAccuracy = algoData.reduce((sum, f) => sum + f.model_accuracy, 0) / algoData.length;
                      
                      return (
                        <Card key={algorithm}>
                          <CardContent className="p-4">
                            <h4 className="font-semibold text-sm mb-2">{algorithm}</h4>
                            <div className="space-y-1 text-xs">
                              <p>Accuracy: {(avgAccuracy * 100).toFixed(1)}%</p>
                              <p>Predictions: {algoData.length}</p>
                              <Badge variant={avgAccuracy > 0.85 ? "default" : "secondary"} className="text-xs">
                                {avgAccuracy > 0.85 ? "High" : avgAccuracy > 0.75 ? "Medium" : "Low"} Confidence
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Enter an item code to view ML forecasting results
                </div>
              )}
            </TabsContent>

            <TabsContent value="advanced-methods" className="mt-6">
              {advancedLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : advancedForecasts && advancedForecasts.length > 0 ? (
                <div className="space-y-6">
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={formatAdvancedChartData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="recommended" 
                        stroke="#8884d8" 
                        strokeWidth={3}
                        name="Recommended Forecast"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="movingAverage" 
                        stroke="#82ca9d" 
                        strokeDasharray="5 5"
                        name="Moving Average"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="exponentialSmoothing" 
                        stroke="#ffc658" 
                        strokeDasharray="5 5"
                        name="Exponential Smoothing"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="linearTrend" 
                        stroke="#ff7300" 
                        strokeDasharray="5 5"
                        name="Linear Trend"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="seasonalAdjusted" 
                        stroke="#8dd1e1" 
                        strokeDasharray="5 5"
                        name="Seasonal Adjusted"
                      />
                    </LineChart>
                  </ResponsiveContainer>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {formatAdvancedChartData().map((forecast, index) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <h4 className="font-semibold text-sm mb-2">{forecast.period}</h4>
                          <div className="space-y-1 text-xs">
                            <p>Recommended: {forecast.recommended.toFixed(2)}</p>
                            <p>Confidence: {forecast.confidence.toFixed(1)}%</p>
                            <Badge variant={forecast.confidence > 80 ? "default" : "secondary"} className="text-xs">
                              {forecast.confidence > 80 ? "High" : "Medium"} Confidence
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Enter an item code to view advanced forecasting methods
                </div>
              )}
            </TabsContent>

            <TabsContent value="anomalies" className="mt-6">
              {anomaliesLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : anomalies && anomalies.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    <span className="font-semibold">
                      {anomalies.length} consumption anomalies detected
                    </span>
                  </div>

                  <div className="grid gap-4">
                    {anomalies.slice(0, 10).map((anomaly, index) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold">{anomaly.item_name}</h4>
                              <p className="text-sm text-muted-foreground">{anomaly.item_code}</p>
                            </div>
                            <Badge 
                              variant={anomaly.anomaly_type === 'high_consumption' ? "destructive" : "secondary"}
                            >
                              {anomaly.anomaly_type.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Date:</span>
                              <p>{format(new Date(anomaly.anomaly_date), 'MMM dd, yyyy')}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Expected:</span>
                              <p>{anomaly.expected_consumption.toFixed(2)}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Actual:</span>
                              <p>{anomaly.actual_consumption.toFixed(2)}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Deviation:</span>
                              <p>{anomaly.deviation_factor.toFixed(2)}σ</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No consumption anomalies detected
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};