import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Gauge, Zap, Save, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import type { ProcessedFrame, AnalysisResult, RepMetrics } from '@/lib/barbell-physics';
import { calculateMetrics, detectRepetitions, calculateRepMetrics } from '@/lib/barbell-physics';

interface ReviewStateProps {
  processedData: ProcessedFrame[];
  mass: number;
  onSave: (result: AnalysisResult) => void;
  onReset: () => void;
}

export function ReviewState({
  processedData,
  mass,
  onSave,
  onReset,
}: ReviewStateProps) {
  const [startTrim, setStartTrim] = useState(0);
  const [endTrim, setEndTrim] = useState(1);
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const [showRepDetails, setShowRepDetails] = useState(true);

  // Calculate time range
  const timeRange = useMemo(() => {
    if (processedData.length === 0) return { min: 0, max: 1 };
    return {
      min: processedData[0].time,
      max: processedData[processedData.length - 1].time,
    };
  }, [processedData]);

  // Convert trim percentages to actual times
  const trimTimes = useMemo(() => ({
    start: timeRange.min + (timeRange.max - timeRange.min) * startTrim,
    end: timeRange.min + (timeRange.max - timeRange.min) * endTrim,
  }), [timeRange, startTrim, endTrim]);

  // Calculate overall metrics for trimmed region
  const metrics = useMemo(() => {
    return calculateMetrics(processedData, trimTimes.start, trimTimes.end);
  }, [processedData, trimTimes]);

  // Detect repetitions and calculate per-rep metrics
  const repMetrics = useMemo((): RepMetrics[] => {
    // Filter data to trimmed region first
    const trimmedData = processedData.filter(
      p => p.time >= trimTimes.start && p.time <= trimTimes.end
    );
    
    if (trimmedData.length === 0) return [];
    
    const reps = detectRepetitions(trimmedData);
    return calculateRepMetrics(trimmedData, reps);
  }, [processedData, trimTimes]);

  // Chart data
  const chartData = useMemo(() => {
    return processedData.map((frame) => ({
      time: frame.time.toFixed(2),
      velocity: Math.max(0, frame.velocity), // Only show positive velocity
      force: frame.force,
      inRange: frame.time >= trimTimes.start && frame.time <= trimTimes.end,
    }));
  }, [processedData, trimTimes]);

  // Handle chart click for trimming
  const handleChartClick = useCallback((data: any) => {
    if (!data || !data.activePayload) return;
    
    const clickedTime = parseFloat(data.activePayload[0]?.payload?.time || '0');
    const normalizedTime = (clickedTime - timeRange.min) / (timeRange.max - timeRange.min);
    
    // Determine if closer to start or end trim
    const distToStart = Math.abs(normalizedTime - startTrim);
    const distToEnd = Math.abs(normalizedTime - endTrim);
    
    if (distToStart < distToEnd) {
      setStartTrim(Math.min(normalizedTime, endTrim - 0.05));
    } else {
      setEndTrim(Math.max(normalizedTime, startTrim + 0.05));
    }
  }, [timeRange, startTrim, endTrim]);

  // Handle save
  const handleSave = () => {
    const trimmedData = processedData.filter(
      (p) => p.time >= trimTimes.start && p.time <= trimTimes.end
    );
    
    onSave({
      meanVelocity: metrics.meanVelocity,
      peakForce: metrics.peakForce,
      velocityDataArray: trimmedData,
      reps: repMetrics,
    });
  };

  // Default to full video range (no auto-detection)
  // Start and end trim are already initialized to 0 and 1 (0% to 100%)

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h2 className="text-lg font-medium text-foreground mb-1">Review & Trim</h2>
        <p className="text-muted-foreground text-sm">
          Click on the chart to adjust the analysis region
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-secondary/50 rounded-lg p-4 text-center border border-border">
          <Gauge className="w-6 h-6 mx-auto mb-2 text-tool-red" />
          <p className="text-muted-foreground text-xs mb-0.5">Mean Velocity</p>
          <p className="text-xl font-semibold text-foreground">
            {metrics.meanVelocity.toFixed(2)}
          </p>
          <p className="text-muted-foreground text-xs">m/s</p>
        </div>

        <div className="bg-secondary/50 rounded-lg p-4 text-center border border-border">
          <Zap className="w-6 h-6 mx-auto mb-2 text-tool-red" />
          <p className="text-muted-foreground text-xs mb-0.5">Peak Force</p>
          <p className="text-xl font-semibold text-foreground">
            {Math.round(metrics.peakForce)}
          </p>
          <p className="text-muted-foreground text-xs">N</p>
        </div>

        <div className="bg-secondary/50 rounded-lg p-4 text-center border border-border">
          <Zap className="w-6 h-6 mx-auto mb-2 text-tool-red" />
          <p className="text-muted-foreground text-xs mb-0.5">Peak Force</p>
          <p className="text-xl font-semibold text-foreground">
            {Math.round(metrics.peakForce * 0.224809)}
          </p>
          <p className="text-muted-foreground text-xs">lbf</p>
        </div>
      </div>

      {/* Velocity Chart */}
      <div className="bg-secondary/30 rounded-lg p-4 border border-border">
        <p className="text-sm text-muted-foreground mb-3">Velocity vs Time</p>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              onClick={handleChartClick}
              margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis 
                dataKey="time" 
                stroke="hsl(220, 10%, 55%)"
                fontSize={10}
                tickLine={false}
              />
              <YAxis 
                stroke="hsl(220, 10%, 55%)"
                fontSize={10}
                tickLine={false}
                domain={[0, 'auto']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(220, 20%, 10%)',
                  border: '1px solid hsl(220, 15%, 18%)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: 'hsl(220, 15%, 95%)' }}
              />
              
              {/* Highlighted region */}
              <ReferenceArea
                x1={trimTimes.start.toFixed(2)}
                x2={trimTimes.end.toFixed(2)}
                fill="hsl(0, 30%, 55%)"
                fillOpacity={0.1}
              />
              
              {/* Trim lines */}
              <ReferenceLine
                x={trimTimes.start.toFixed(2)}
                stroke="hsl(0, 30%, 55%)"
                strokeWidth={2}
                strokeDasharray="4 4"
              />
              <ReferenceLine
                x={trimTimes.end.toFixed(2)}
                stroke="hsl(0, 30%, 55%)"
                strokeWidth={2}
                strokeDasharray="4 4"
              />

              <Line
                type="monotone"
                dataKey="velocity"
                stroke="hsl(0, 30%, 55%)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: 'hsl(0, 30%, 55%)' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trim Slider Controls */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Start: {trimTimes.start.toFixed(2)}s</span>
          <span>End: {trimTimes.end.toFixed(2)}s</span>
        </div>
        <div className="relative h-6 bg-secondary rounded-full">
          {/* Track */}
          <div 
            className="absolute h-full bg-tool-red/30 rounded-full"
            style={{
              left: `${startTrim * 100}%`,
              width: `${(endTrim - startTrim) * 100}%`,
            }}
          />
          
          {/* Start handle */}
          <input
            type="range"
            min={0}
            max={100}
            value={startTrim * 100}
            onChange={(e) => {
              const val = parseInt(e.target.value) / 100;
              setStartTrim(Math.min(val, endTrim - 0.05));
            }}
            className="absolute w-full h-full opacity-0 cursor-pointer"
          />
          
          {/* End handle */}
          <input
            type="range"
            min={0}
            max={100}
            value={endTrim * 100}
            onChange={(e) => {
              const val = parseInt(e.target.value) / 100;
              setEndTrim(Math.max(val, startTrim + 0.05));
            }}
            className="absolute w-full h-full opacity-0 cursor-pointer"
          />
          
          {/* Visual handles */}
          <div 
            className="absolute w-4 h-4 bg-tool-red rounded-full top-1 -translate-x-1/2 shadow-md"
            style={{ left: `${startTrim * 100}%` }}
          />
          <div 
            className="absolute w-4 h-4 bg-tool-red rounded-full top-1 -translate-x-1/2 shadow-md"
            style={{ left: `${endTrim * 100}%` }}
          />
        </div>
      </div>

      {/* Info */}
      <p className="text-muted-foreground text-xs text-center">
        Mass: {mass}kg • Duration: {(trimTimes.end - trimTimes.start).toFixed(2)}s • {repMetrics.length} rep{repMetrics.length !== 1 ? 's' : ''} detected
      </p>

      {/* Per-Rep Metrics */}
      {repMetrics.length > 0 && (
        <div className="bg-secondary/30 rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setShowRepDetails(!showRepDetails)}
            className="w-full flex items-center justify-between p-3 text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors"
          >
            <span>Rep-by-Rep Analysis</span>
            {showRepDetails ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          
          {showRepDetails && (
            <div className="border-t border-border">
              {/* Header */}
              <div className="grid grid-cols-4 gap-2 px-3 py-2 text-xs text-muted-foreground bg-secondary/20">
                <span>Rep</span>
                <span className="text-center">Velocity</span>
                <span className="text-center">Peak Force (N)</span>
                <span className="text-center">Peak Force (lbf)</span>
              </div>
              
              {/* Rep rows */}
              {repMetrics.map((rep) => (
                <div
                  key={rep.repNumber}
                  className="grid grid-cols-4 gap-2 px-3 py-2 text-sm border-t border-border/50 hover:bg-secondary/20 transition-colors"
                >
                  <span className="text-foreground font-medium">#{rep.repNumber}</span>
                  <span className="text-center text-foreground">{rep.meanVelocity.toFixed(2)} m/s</span>
                  <span className="text-center text-foreground font-semibold">{Math.round(rep.peakForce)}</span>
                  <span className="text-center text-foreground font-semibold">{Math.round(rep.peakForce * 0.224809)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          onClick={onReset}
          className="flex-1 border-border"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset
        </Button>
        <Button
          onClick={handleSave}
          className="flex-1 bg-tool-red hover:bg-tool-red/90 text-white"
        >
          <Save className="w-4 h-4 mr-2" />
          Save Analysis
        </Button>
      </div>
    </div>
  );
}
