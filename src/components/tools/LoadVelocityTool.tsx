import { useState } from "react";
import { Plus, Trash2, TrendingDown, Info } from "lucide-react";
import BackButton from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface LoadVelocityToolProps {
  onBack: () => void;
}

interface DataPoint {
  id: string;
  load: string;
  velocity: string;
}

const LoadVelocityTool = ({ onBack }: LoadVelocityToolProps) => {
  const [useKg, setUseKg] = useState(true);
  const [mvt, setMvt] = useState("0.3"); // Minimum velocity threshold
  const [showFormulas, setShowFormulas] = useState(false);
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([
    { id: crypto.randomUUID(), load: "", velocity: "" },
    { id: crypto.randomUUID(), load: "", velocity: "" },
  ]);

  const unitLabel = useKg ? "kg" : "lbs";

  const addDataPoint = () => {
    setDataPoints([
      ...dataPoints,
      { id: crypto.randomUUID(), load: "", velocity: "" },
    ]);
  };

  const removeDataPoint = (id: string) => {
    if (dataPoints.length > 2) {
      setDataPoints(dataPoints.filter((p) => p.id !== id));
    }
  };

  const updateDataPoint = (id: string, field: "load" | "velocity", value: string) => {
    setDataPoints(
      dataPoints.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  // Get valid data points for regression
  const validPoints = dataPoints
    .map((p) => ({
      load: parseFloat(p.load),
      velocity: parseFloat(p.velocity),
    }))
    .filter((p) => !isNaN(p.load) && !isNaN(p.velocity) && p.load > 0 && p.velocity > 0);

  // Linear regression: velocity = slope * load + intercept
  const calculateRegression = () => {
    if (validPoints.length < 2) return null;

    const n = validPoints.length;
    const sumX = validPoints.reduce((sum, p) => sum + p.load, 0);
    const sumY = validPoints.reduce((sum, p) => sum + p.velocity, 0);
    const sumXY = validPoints.reduce((sum, p) => sum + p.load * p.velocity, 0);
    const sumX2 = validPoints.reduce((sum, p) => sum + p.load * p.load, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // R-squared calculation
    const meanY = sumY / n;
    const ssTotal = validPoints.reduce((sum, p) => sum + Math.pow(p.velocity - meanY, 2), 0);
    const ssResidual = validPoints.reduce(
      (sum, p) => sum + Math.pow(p.velocity - (slope * p.load + intercept), 2),
      0
    );
    const rSquared = 1 - ssResidual / ssTotal;

    return { slope, intercept, rSquared };
  };

  const regression = calculateRegression();

  // Calculate predicted 1RM at MVT
  const mvtValue = parseFloat(mvt) || 0.3;
  const predicted1RM = regression
    ? (mvtValue - regression.intercept) / regression.slope
    : null;

  // Calculate load at various velocities
  const getLoadAtVelocity = (velocity: number) => {
    if (!regression) return null;
    return (velocity - regression.intercept) / regression.slope;
  };

  // Chart data
  const chartData = validPoints.length >= 2 && regression
    ? (() => {
        const minLoad = Math.min(...validPoints.map((p) => p.load)) * 0.8;
        const maxLoad = predicted1RM && predicted1RM > 0 
          ? Math.max(...validPoints.map((p) => p.load), predicted1RM) * 1.1
          : Math.max(...validPoints.map((p) => p.load)) * 1.2;
        
        const points = [];
        for (let load = minLoad; load <= maxLoad; load += (maxLoad - minLoad) / 50) {
          points.push({
            load: Math.round(load * 10) / 10,
            velocity: regression.slope * load + regression.intercept,
          });
        }
        return points;
      })()
    : [];

  const scatterData = validPoints.map((p) => ({
    load: p.load,
    velocity: p.velocity,
    isActual: true,
  }));

  return (
    <main className="container mx-auto px-4 py-10 max-w-3xl">
      <BackButton onClick={onBack} />

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-tool-indigo" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Load-Velocity Profile</h1>
        </div>
        <p className="text-muted-foreground">
          Plot your load-velocity relationship to predict 1RM and track training readiness.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center justify-between">
              Data Points
              <div className="flex items-center gap-2 text-sm font-normal">
                <span className={!useKg ? "text-foreground" : "text-muted-foreground"}>lbs</span>
                <Switch checked={useKg} onCheckedChange={setUseKg} />
                <span className={useKg ? "text-foreground" : "text-muted-foreground"}>kg</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dataPoints.map((point, index) => (
              <div
                key={point.id}
                className="flex items-center gap-2"
              >
                <span className="text-xs text-muted-foreground w-4">{index + 1}.</span>
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder={`Load (${unitLabel})`}
                    value={point.load}
                    onChange={(e) => updateDataPoint(point.id, "load", e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="Velocity (m/s)"
                    value={point.velocity}
                    onChange={(e) => updateDataPoint(point.id, "velocity", e.target.value)}
                    className="h-9"
                    step="0.01"
                  />
                </div>
                {dataPoints.length > 2 && (
                  <button
                    onClick={() => removeDataPoint(point.id)}
                    className="text-destructive hover:text-destructive/80 transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            <Button
              variant="outline"
              onClick={addDataPoint}
              className="w-full mt-2"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Data Point
            </Button>

            <div className="pt-4 border-t border-border">
              <Label htmlFor="mvt" className="text-sm">
                Minimum Velocity Threshold (m/s)
              </Label>
              <Input
                id="mvt"
                type="number"
                value={mvt}
                onChange={(e) => setMvt(e.target.value)}
                className="mt-1.5 h-9"
                step="0.05"
                placeholder="0.3"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Typical MVT: Squat 0.30, Bench 0.17, Deadlift 0.15
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Profile Results</CardTitle>
          </CardHeader>
          <CardContent>
            {validPoints.length < 2 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Enter at least 2 data points to generate your profile.</p>
                <p className="text-sm mt-2">
                  Tip: Use 3-5 loads across your working range for best accuracy.
                </p>
              </div>
            ) : regression ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-secondary/50 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Predicted 1RM</p>
                    <p className="text-2xl font-bold text-tool-indigo">
                      {predicted1RM && predicted1RM > 0
                        ? `${predicted1RM.toFixed(1)}`
                        : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">{unitLabel}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/50 text-center">
                    <p className="text-xs text-muted-foreground mb-1">R² Fit</p>
                    <p className="text-2xl font-bold text-foreground">
                      {(regression.rSquared * 100).toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {regression.rSquared > 0.95 ? "Excellent" : regression.rSquared > 0.85 ? "Good" : "Fair"}
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-secondary/30 space-y-2">
                  <p className="text-sm font-medium text-foreground">Load Predictions</p>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">@0.5 m/s:</span>
                      <span className="ml-1 font-medium">
                        {getLoadAtVelocity(0.5)?.toFixed(1) ?? "—"} {unitLabel}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">@0.75 m/s:</span>
                      <span className="ml-1 font-medium">
                        {getLoadAtVelocity(0.75)?.toFixed(1) ?? "—"} {unitLabel}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">@1.0 m/s:</span>
                      <span className="ml-1 font-medium">
                        {getLoadAtVelocity(1.0)?.toFixed(1) ?? "—"} {unitLabel}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  <p>
                    Equation: v = {regression.slope.toFixed(5)} × load + {regression.intercept.toFixed(3)}
                  </p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {validPoints.length >= 2 && regression && (
        <Card className="mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Load-Velocity Curve</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="load"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    label={{ value: `Load (${unitLabel})`, position: 'bottom', offset: -5, fill: 'hsl(var(--muted-foreground))' }}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis
                    dataKey="velocity"
                    type="number"
                    domain={[0, 'auto']}
                    label={{ value: 'Velocity (m/s)', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))' }}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelFormatter={(value) => `${value} ${unitLabel}`}
                    formatter={(value: number) => [`${value.toFixed(3)} m/s`, 'Velocity']}
                  />
                  <ReferenceLine
                    y={mvtValue}
                    stroke="hsl(var(--destructive))"
                    strokeDasharray="5 5"
                    label={{ value: 'MVT', position: 'right', fill: 'hsl(var(--destructive))' }}
                  />
                  <Line
                    data={chartData}
                    type="linear"
                    dataKey="velocity"
                    stroke="hsl(var(--tool-indigo))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    data={scatterData}
                    type="linear"
                    dataKey="velocity"
                    stroke="transparent"
                    dot={{ fill: 'hsl(var(--tool-indigo))', r: 6, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Collapsible open={showFormulas} onOpenChange={setShowFormulas} className="mt-6">
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Info className="w-4 h-4" />
          {showFormulas ? "Hide" : "Show"} methodology
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-4 text-sm">
              <div>
                <h4 className="font-semibold text-foreground mb-2">Load-Velocity Profiling</h4>
                <p className="text-muted-foreground">
                  The load-velocity (L-V) relationship is highly linear and individual. By plotting 
                  bar velocity against load, we can predict your 1RM as the load where velocity 
                  equals your minimum velocity threshold (MVT).
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-2">How to Use</h4>
                <p className="text-muted-foreground">
                  Perform 2-5 sets at different loads (e.g., 50%, 70%, 85%, 95% of estimated max) 
                  and record the mean concentric velocity. More data points = better accuracy.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-2">Applications</h4>
                <p className="text-muted-foreground">
                  Track readiness (profile shifts indicate fatigue), auto-regulate training 
                  (stop when velocity drops), and predict daily 1RM without maximal attempts.
                </p>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </main>
  );
};

export default LoadVelocityTool;
