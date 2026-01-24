/**
 * BARBELL VELOCITY TRACKER
 * 
 * A complete barbell velocity tracking tool using template matching.
 * Tracks barbell movement from video and calculates velocity/force metrics.
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Activity, Upload, Play, Pause, Ruler, Target, RefreshCw, ChevronRight, Info, History, Save, Trash2, RotateCcw, TrendingUp } from 'lucide-react';
import BackButton from '@/components/ui/back-button';

// ============================================================================
// ANIMATED NUMBER COMPONENT
// ============================================================================

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  className?: string;
  suffix?: string;
}

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 1000,
  decimals = 0,
  className = '',
  suffix = '',
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const startValue = displayValue;
    const diff = value - startValue;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startValue + diff * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return (
    <span className={className}>
      {displayValue.toFixed(decimals)}{suffix}
    </span>
  );
};

// ============================================================================
// VELOCITY GAUGE COMPONENT
// ============================================================================

interface VelocityGaugeProps {
  velocity: number;
  maxVelocity?: number;
  size?: number;
}

const VelocityGauge: React.FC<VelocityGaugeProps> = ({
  velocity,
  maxVelocity = 2.0,
  size = 120,
}) => {
  const clampedVelocity = Math.min(Math.max(velocity, 0), maxVelocity);
  const percentage = (clampedVelocity / maxVelocity) * 100;
  const angle = -135 + (percentage / 100) * 270;
  
  const getColor = () => {
    if (velocity < 0.5) return '#ef4444';
    if (velocity < 1.0) return '#eab308';
    return '#22c55e';
  };

  const strokeWidth = size * 0.08;
  const radius = (size - strokeWidth) / 2 - 10;
  const center = size / 2;
  
  const startAngle = -135 * (Math.PI / 180);
  const endAngle = 135 * (Math.PI / 180);
  
  const startX = center + radius * Math.cos(startAngle);
  const startY = center + radius * Math.sin(startAngle);
  const endX = center + radius * Math.cos(endAngle);
  const endY = center + radius * Math.sin(endAngle);

  const activeAngleDeg = -135 + (Math.min(percentage, 100) / 100) * 270;
  const activeAngleRad = activeAngleDeg * (Math.PI / 180);
  const activeEndX = center + radius * Math.cos(activeAngleRad);
  const activeEndY = center + radius * Math.sin(activeAngleRad);
  const largeArcFlag = percentage > 50 ? 1 : 0;

  // Needle color matches the current zone
  const needleColor = getColor();

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Gauge */}
      <div className="relative" style={{ width: size, height: size }}>
        <div className="absolute inset-0 bg-black/80 rounded-full backdrop-blur-sm" />
        <svg width={size} height={size} className="relative z-10">
          {/* Background arc */}
          <path
            d={`M ${startX} ${startY} A ${radius} ${radius} 0 1 1 ${endX} ${endY}`}
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Active arc - no transition to prevent distortion */}
          {percentage > 0 && (
            <path
              d={`M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${activeEndX} ${activeEndY}`}
              fill="none"
              stroke={getColor()}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
          )}
          {/* Needle - colored to match zone */}
          <g transform={`rotate(${angle} ${center} ${center})`}>
            <line 
              x1={center} 
              y1={center} 
              x2={center} 
              y2={center - radius + 15} 
              stroke={needleColor} 
              strokeWidth={3} 
              strokeLinecap="round" 
            />
            <circle cx={center} cy={center} r={6} fill={needleColor} />
          </g>
          {/* Zone labels */}
          <text x={12} y={size - 12} className="text-[8px] font-bold" fill="#ef4444">STR</text>
          <text x={center - 8} y={18} className="text-[8px] font-bold" fill="#eab308">HYP</text>
          <text x={size - 28} y={size - 12} className="text-[8px] font-bold" fill="#22c55e">PWR</text>
        </svg>
      </div>
      {/* Velocity display - separate field below gauge */}
      <div 
        className="px-3 py-1.5 rounded-lg text-center min-w-[80px]"
        style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
      >
        <span 
          className="text-lg font-bold font-mono block"
          style={{ color: needleColor }}
        >
          {velocity.toFixed(2)}
        </span>
        <span className="text-[10px] text-white/70 uppercase font-medium">m/s</span>
      </div>
    </div>
  );
};

// ============================================================================
// ENHANCED CHART COMPONENT
// ============================================================================

interface ChartDataPoint {
  t: number;
  [key: string]: number | undefined;
}

interface EnhancedChartProps {
  data: ChartDataPoint[];
  dataKey: string;
  color: string;
  gradientId: string;
  label: string;
  unit: string;
  height?: number;
}

const EnhancedChart: React.FC<EnhancedChartProps> = ({
  data,
  dataKey,
  color,
  gradientId,
  label,
  unit,
  height = 180,
}) => {
  if (!data || data.length === 0) return null;

  const width = 600;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const values = data.map(d => (d[dataKey] as number) || 0);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values, 0);
  const range = (maxVal - minVal) || 1;
  const startTime = data[0].t;
  const timeRange = data[data.length - 1].t - startTime || 1;

  const getX = (t: number) => ((t - startTime) / timeRange) * chartWidth + padding.left;
  const getY = (val: number) => chartHeight - ((val - minVal) / range) * chartHeight + padding.top;

  const linePath = data.map((d, i) => {
    const x = getX(d.t);
    const y = getY((d[dataKey] as number) || 0);
    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
  }).join(' ');

  const areaPath = linePath + ` L ${getX(data[data.length - 1].t)} ${getY(minVal)} L ${getX(data[0].t)} ${getY(minVal)} Z`;

  const peakIndex = values.indexOf(maxVal);
  const peakX = getX(data[peakIndex].t);
  const peakY = getY(maxVal);

  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = minVal + (range / 4) * i;
    return { val, y: getY(val) };
  });

  const xTicks = Array.from({ length: 5 }, (_, i) => {
    const t = startTime + (timeRange / 4) * i;
    return { t, x: getX(t) };
  });

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-foreground mb-3">{label}</h4>
      <div className="bg-card border border-border rounded-xl p-4 overflow-hidden">
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {yTicks.map((tick, i) => (
            <line key={i} x1={padding.left} y1={tick.y} x2={width - padding.right} y2={tick.y} stroke="hsl(var(--border))" strokeWidth={1} strokeDasharray={i === 0 ? "0" : "4,4"} />
          ))}
          {yTicks.map((tick, i) => (
            <text key={`y-${i}`} x={padding.left - 8} y={tick.y + 4} textAnchor="end" className="text-[10px] fill-muted-foreground">
              {tick.val.toFixed(dataKey === 'v' ? 1 : 0)}
            </text>
          ))}
          {xTicks.map((tick, i) => (
            <text key={`x-${i}`} x={tick.x} y={height - 8} textAnchor="middle" className="text-[10px] fill-muted-foreground">
              {(tick.t - startTime).toFixed(1)}s
            </text>
          ))}
          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={peakX} cy={peakY} r={6} fill={color} stroke="hsl(var(--card))" strokeWidth={2} />
          <text x={peakX} y={peakY - 12} textAnchor="middle" className="text-[10px] font-bold" fill={color}>
            Peak: {maxVal.toFixed(dataKey === 'v' ? 2 : 0)} {unit}
          </text>
        </svg>
      </div>
    </div>
  );
};

// ============================================================================
// SESSION HISTORY HOOK
// ============================================================================

interface SessionData {
  id: string;
  date: string;
  weight: number;
  unit: 'kg' | 'lbs';
  reps: number;
  meanVelocity: number;
  peakForceN: number;
  estimated1RM?: number;
}

const STORAGE_KEY = 'barbell-velocity-sessions';

const useSessionHistory = () => {
  const [sessions, setSessions] = useState<SessionData[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { setSessions(JSON.parse(stored)); } catch (e) { console.error('Failed to parse session history:', e); }
    }
  }, []);

  const saveSessions = (newSessions: SessionData[]) => {
    setSessions(newSessions);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSessions));
  };

  const addSession = (session: Omit<SessionData, 'id' | 'date'>) => {
    const newSession: SessionData = { ...session, id: crypto.randomUUID(), date: new Date().toISOString() };
    saveSessions([newSession, ...sessions].slice(0, 50));
  };

  const deleteSession = (id: string) => saveSessions(sessions.filter(s => s.id !== id));
  const clearHistory = () => saveSessions([]);

  return { sessions, addSession, deleteSession, clearHistory };
};

const estimate1RM = (weight: number, meanVelocity: number, unit: 'kg' | 'lbs' = 'kg'): number => {
  const weightKg = unit === 'lbs' ? weight * 0.453592 : weight;
  const slope = -0.05;
  const maxVelocity = 1.5;
  const percentOf1RM = Math.min(100, Math.max(50, ((meanVelocity - maxVelocity) / slope)));
  const estimated1RMkg = weightKg / (percentOf1RM / 100);
  return unit === 'lbs' ? estimated1RMkg / 0.453592 : estimated1RMkg;
};

// ============================================================================
// TYPES
// ============================================================================

interface Position { x: number; y: number; }
interface TrackingPoint { time: number; x: number; y: number; }
interface Velocity { x: number; y: number; }
interface DebugPreviews { template: string | null; match: string | null; diff: number; }
interface PhysicsData { t: number; y: number; x: number; vy?: number; vx?: number; ay?: number; ax?: number; f?: number; v?: number; [key: string]: number | undefined; }
interface RepMetric { id: number; meanVelocity: number; peakForceN: number; peakForceLbs: number; duration: number; }
interface AnalysisResults { metrics: { meanVelocity: string; peakForceN: string; peakForceLbs: string; forceUnit: string; }; chartData: PhysicsData[]; repMetrics: RepMetric[]; }

type AppStep = 'upload' | 'setup' | 'tracking' | 'results';
type MassUnit = 'kg' | 'lbs';
type TrackingStatus = 'idle' | 'ok' | 'lost';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface BarbellVelocityTrackerProps {
  onBack?: () => void;
}

export default function BarbellVelocityTracker({ onBack }: BarbellVelocityTrackerProps) {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  const [isVideoReady, setIsVideoReady] = useState(false);
  
  const [step, setStep] = useState<AppStep>('upload');
  const [weight, setWeight] = useState(100);
  const [unit, setUnit] = useState<MassUnit>('kg');
  const [forceScale, setForceScale] = useState(1.0);
  const [fps, setFps] = useState(30);
  const [showHistory, setShowHistory] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [currentVelocity, setCurrentVelocity] = useState(0);
  
  const { sessions, addSession, deleteSession, clearHistory } = useSessionHistory();
  
  const [calibrationStart, setCalibrationStart] = useState<Position | null>(null);
  const [calibrationEnd, setCalibrationEnd] = useState<Position | null>(null);
  const [isDraggingCal, setIsDraggingCal] = useState(false);
  const [pixelsPerMeter, setPixelsPerMeter] = useState<number | null>(null);
  
  const [trackerPos, setTrackerPos] = useState<Position | null>(null);
  const [trackingData, setTrackingData] = useState<TrackingPoint[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [templateData, setTemplateData] = useState<ImageData | null>(null);
  
  const [debugPreviews, setDebugPreviews] = useState<DebugPreviews>({ template: null, match: null, diff: 0 });
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>('idle');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  
  const trackerPosRef = useRef<Position | null>(null);
  const velocityRef = useRef<Velocity>({ x: 0, y: 0 });
  const trajectoryRef = useRef<Velocity>({ x: 0, y: 1 });

  // When the sleeve reverses direction at the bottom of a rep, instantaneous velocity can be ~0
  // while displacement between frames is still large (high acceleration). These refs let us
  // keep the search window large enough to survive that reversal and avoid permanently freezing.
  const lostFramesRef = useRef(0);
  const lastGoodSpeedRef = useRef(0);
  const lostLogCounterRef = useRef(0);
  
  const templateDataRef = useRef<ImageData | null>(null);
  const initialTemplateRef = useRef<ImageData | null>(null);
  const trackingDataRef = useRef<TrackingPoint[]>([]);
  const isTrackingRef = useRef(false);
  const loopIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isTracking) {
      trackerPosRef.current = trackerPos;
      velocityRef.current = { x: 0, y: 0 };
      trajectoryRef.current = { x: 0, y: 1 };
    }
  }, [trackerPos, isTracking]);

  useEffect(() => { isTrackingRef.current = isTracking; }, [isTracking]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setStep('setup');
      setIsVideoReady(false);
      setCalibrationStart(null);
      setCalibrationEnd(null);
      setPixelsPerMeter(null);
      setTrackingData([]);
      trackingDataRef.current = [];
      setTrackerPos(null);
      trackerPosRef.current = null;
      templateDataRef.current = null;
      initialTemplateRef.current = null;
      setTemplateData(null);
      setDebugPreviews({ template: null, match: null, diff: 0 });
      setTrackingStatus('idle');
      setIsTracking(false);
    }
  };

  const handleVideoLoad = () => {
    if (videoRef.current) {
      setVideoDimensions({ width: videoRef.current.videoWidth, height: videoRef.current.videoHeight });
      setIsVideoReady(true);
      setTimeout(drawFrame, 100);
    }
  };

  const drawFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (canvas.width !== video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    ctx.drawImage(video, 0, 0);
    if (step === 'setup') drawCalibration(ctx);
    else if (step === 'tracking') drawTracker(ctx);
  };

  const drawCalibration = (ctx: CanvasRenderingContext2D) => {
    if (calibrationStart && calibrationEnd) {
      const radius = Math.sqrt(Math.pow(calibrationEnd.x - calibrationStart.x, 2) + Math.pow(calibrationEnd.y - calibrationStart.y, 2));
      ctx.strokeStyle = 'hsl(var(--primary))';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(calibrationStart.x, calibrationStart.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(calibrationStart.x - 10, calibrationStart.y);
      ctx.lineTo(calibrationStart.x + 10, calibrationStart.y);
      ctx.moveTo(calibrationStart.x, calibrationStart.y - 10);
      ctx.lineTo(calibrationStart.x, calibrationStart.y + 10);
      ctx.stroke();
      ctx.fillStyle = 'hsl(var(--primary))';
      ctx.font = '20px sans-serif';
      ctx.fillText("50mm", calibrationStart.x + radius + 10, calibrationStart.y);
    }
  };

  const drawTracker = (ctx: CanvasRenderingContext2D) => {
    const currentPos = trackerPosRef.current;
    const currentVel = velocityRef.current;
    const currentPath = trackingDataRef.current;
    const rail = trajectoryRef.current;

    if (currentPos) {
      const predX = currentPos.x + currentVel.x;
      const predY = currentPos.y + currentVel.y;
      const speed = Math.sqrt(currentVel.x ** 2 + currentVel.y ** 2);
      const searchRadius = Math.max(35, Math.min(80, speed * 2.5));
      const searchW = searchRadius * 2;
      const searchH = searchRadius * 2;
      const searchX = predX - (searchW / 2);
      const searchY = predY - (searchH / 2);

      ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
      ctx.lineWidth = 3;
      ctx.strokeRect(searchX, searchY, searchW, searchH);

      ctx.strokeStyle = 'hsl(var(--primary))';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < currentPath.length; i++) {
        const p = currentPath[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      ctx.fillStyle = 'hsl(var(--primary))';
      ctx.beginPath();
      ctx.arc(currentPos.x, currentPos.y, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2;
      const railLen = 100;
      ctx.beginPath();
      ctx.moveTo(currentPos.x - rail.x * railLen, currentPos.y - rail.y * railLen);
      ctx.lineTo(currentPos.x + rail.x * railLen, currentPos.y + rail.y * railLen);
      ctx.stroke();
    }
  };

  const getVideoCoords = (e: React.MouseEvent<HTMLCanvasElement>): Position | null => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return null;
    const rect = canvas.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width;
    const yPct = (e.clientY - rect.top) / rect.height;
    return { x: xPct * video.videoWidth, y: yPct * video.videoHeight };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getVideoCoords(e);
    if (!coords) return;
    if (step === 'setup') {
      setIsDraggingCal(true);
      setCalibrationStart(coords);
      setCalibrationEnd(coords);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getVideoCoords(e);
    if (!coords) return;
    if (step === 'setup' && isDraggingCal) {
      setCalibrationEnd(coords);
      drawFrame();
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (step === 'setup' && isDraggingCal) {
      setIsDraggingCal(false);
      const coords = getVideoCoords(e);
      if (calibrationStart && coords) {
        const dx = coords.x - calibrationStart.x;
        const dy = coords.y - calibrationStart.y;
        const radius = Math.sqrt(dx * dx + dy * dy);
        const diameter = radius * 2;
        const ppm = diameter / 0.05;
        setPixelsPerMeter(ppm);
        setCalibrationEnd(coords);
        drawFrame();
      }
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (step === 'tracking') {
      const coords = getVideoCoords(e);
      if (coords) {
        setTrackerPos(coords);
        trackerPosRef.current = coords;
        velocityRef.current = { x: 0, y: 0 };
        trajectoryRef.current = { x: 0, y: 1 };
        captureTemplate(coords.x, coords.y);
        drawFrame();
      }
    }
  };

  const getPreviewUrl = (imageData: ImageData | null): string | null => {
    if (!imageData) return null;
    const c = document.createElement('canvas');
    c.width = imageData.width;
    c.height = imageData.height;
    c.getContext('2d')?.putImageData(imageData, 0, 0);
    return c.toDataURL();
  };

  const captureTemplate = (cx: number, cy: number) => {
    const video = videoRef.current;
    if (!video) return;
    const pCanvas = processingCanvasRef.current;
    pCanvas.width = video.videoWidth;
    pCanvas.height = video.videoHeight;
    const pCtx = pCanvas.getContext('2d');
    if (!pCtx) return;
    pCtx.drawImage(video, 0, 0);
    const size = 60;
    const sx = Math.max(0, Math.min(cx - size / 2, video.videoWidth - size));
    const sy = Math.max(0, Math.min(cy - size / 2, video.videoHeight - size));
    const imageData = pCtx.getImageData(sx, sy, size, size);
    templateDataRef.current = imageData;
    initialTemplateRef.current = imageData;
    setTemplateData(imageData);
    setDebugPreviews(prev => ({ ...prev, template: getPreviewUrl(imageData), match: null, diff: 0 }));
    setTrackingStatus('ok');
  };

  const findTemplate = (
    cx: number,
    cy: number,
    vx: number,
    vy: number,
    trajectory: Velocity
  ): { pos: Position; matchImg: ImageData | null; diff: number; isLost: boolean } => {
    const adaptiveTemplate = templateDataRef.current;
    const initialTemplate = initialTemplateRef.current;
    if (!adaptiveTemplate || !videoRef.current) return { pos: { x: cx, y: cy }, matchImg: null, diff: 0, isLost: false };
    
    const video = videoRef.current;
    const pCanvas = processingCanvasRef.current;
    const pCtx = pCanvas.getContext('2d');
    if (!pCtx) return { pos: { x: cx, y: cy }, matchImg: null, diff: 0, isLost: false };

    const speed = Math.sqrt(vx * vx + vy * vy);
    // Use recent "good" speed to keep search radius large during reversals (speed briefly dips).
    const effectiveSpeed = Math.max(speed, lastGoodSpeedRef.current * (lostFramesRef.current > 0 ? 0.95 : 0.75));
    // Boost search during *any* reversal (top or bottom): current speed small, but recent speed was high.
    const reversalBoost = speed < 10 && lastGoodSpeedRef.current > 25 ? 1.9 : 1;
    const lostBoost = lostFramesRef.current > 0 ? 1.5 : 1;
    const searchRadius = Math.max(55, Math.min(180, effectiveSpeed * 2.9 * reversalBoost * lostBoost));

    const tWidth = adaptiveTemplate.width;
    const tHeight = adaptiveTemplate.height;

    const cIdx = ((tHeight / 2) * tWidth + (tWidth / 2)) * 4;
    const rRef = initialTemplate ? initialTemplate.data[cIdx] : 0;
    const gRef = initialTemplate ? initialTemplate.data[cIdx + 1] : 0;
    const bRef = initialTemplate ? initialTemplate.data[cIdx + 2] : 0;

    // Keep prediction simple, but allow the larger search window to handle high acceleration.
    const predX = cx + vx;
    const predY = cy + vy;

    const startX = Math.floor(Math.max(0, predX - searchRadius));
    const startY = Math.floor(Math.max(0, predY - searchRadius));
    const endX = Math.floor(Math.min(video.videoWidth, predX + searchRadius + tWidth));
    const endY = Math.floor(Math.min(video.videoHeight, predY + searchRadius + tHeight));
    const searchWidth = endX - startX;
    const searchHeight = endY - startY;

     if (searchWidth <= 0 || searchHeight <= 0) return { pos: { x: cx, y: cy }, matchImg: null, diff: 0, isLost: false };

    pCanvas.width = searchWidth;
    pCanvas.height = searchHeight;
    pCtx.drawImage(video, startX, startY, searchWidth, searchHeight, 0, 0, searchWidth, searchHeight);

    const searchData = pCtx.getImageData(0, 0, searchWidth, searchHeight);
    let minScore = Infinity;
    let bestX = 0;
    let bestY = 0;
    let bestDiff = 0;

    for (let y = 0; y <= searchHeight - tHeight; y += 2) {
      for (let x = 0; x <= searchWidth - tWidth; x += 2) {
        let diffAdaptive = 0;
        let diffInitial = 0;

        for (let ty = 0; ty < tHeight; ty += 4) {
          for (let tx = 0; tx < tWidth; tx += 4) {
            const tIndex = (ty * tWidth + tx) * 4;
            const sIndex = ((y + ty) * searchWidth + (x + tx)) * 4;

            const rA = Math.abs(searchData.data[sIndex] - adaptiveTemplate.data[tIndex]);
            const gA = Math.abs(searchData.data[sIndex + 1] - adaptiveTemplate.data[tIndex + 1]);
            const bA = Math.abs(searchData.data[sIndex + 2] - adaptiveTemplate.data[tIndex + 2]);
            diffAdaptive += rA + gA + bA;

            if (initialTemplate) {
              const rI = Math.abs(searchData.data[sIndex] - initialTemplate.data[tIndex]);
              const gI = Math.abs(searchData.data[sIndex + 1] - initialTemplate.data[tIndex + 1]);
              const bI = Math.abs(searchData.data[sIndex + 2] - initialTemplate.data[tIndex + 2]);
              diffInitial += rI + gI + bI;
            }
          }
        }

        const diff = (diffAdaptive * 0.6) + (diffInitial * 0.4);

        const candidateX = startX + x + tWidth / 2;
        const candidateY = startY + y + tHeight / 2;

        const offX = candidateX - cx;
        const offY = candidateY - cy;
        const perpDist = Math.abs(offX * trajectory.y - offY * trajectory.x);
        // When reacquiring, be less strict about staying on the prior rail.
        const pathPenalty = perpDist * (lostFramesRef.current > 0 ? 7.5 : 25.0);

        const centerX = x + Math.floor(tWidth / 2);
        const centerY = y + Math.floor(tHeight / 2);
        const scIdx = (centerY * searchWidth + centerX) * 4;
        const rC = searchData.data[scIdx];
        const gC = searchData.data[scIdx + 1];
        const bC = searchData.data[scIdx + 2];
        const centerDiff = Math.abs(rC - rRef) + Math.abs(gC - gRef) + Math.abs(bC - bRef);
        // Center color can shift with motion blur/lighting; reduce its influence during reversals/loss.
        const centerPenaltyMultiplier = (lostFramesRef.current > 0 || reversalBoost > 1) ? 12 : 50;
        const centerPenalty = centerDiff * centerPenaltyMultiplier;

        const edgeThreshold = 15;
        const distL = candidateX - (tWidth / 2);
        const distR = video.videoWidth - (candidateX + tWidth / 2);
        const distT = candidateY - (tHeight / 2);
        const distB = video.videoHeight - (candidateY + tHeight / 2);
        let edgePenalty = 0;
        if (distL < edgeThreshold || distR < edgeThreshold || distT < edgeThreshold || distB < edgeThreshold) {
          edgePenalty = 50000;
        }

        const score = diff + pathPenalty + edgePenalty + centerPenalty;

        if (score < minScore) {
          minScore = score;
          bestDiff = diff;
          bestX = x;
          bestY = y;
        }
      }
    }

    const matchData = pCtx.getImageData(bestX, bestY, tWidth, tHeight);
    let foundX = startX + bestX + tWidth / 2;
    let foundY = startY + bestY + tHeight / 2;

    const dx = foundX - predX;
    const dy = foundY - predY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Allow larger corrections when the search window is large (typical at the bottom reversal).
    const maxStep = Math.max(40, Math.min(120, searchRadius * 0.7));

    if (dist > maxStep) {
      const ratio = maxStep / dist;
      foundX = predX + dx * ratio;
      foundY = predY + dy * ratio;
    }

    const pixelsChecked = (tWidth * tHeight) / 16;
    const avgDiff = bestDiff / (pixelsChecked * 3);
    
    // Dynamic loss threshold: tolerate higher diff during fast movement / reversal.
    // (Motion blur at the top/bottom can inflate avgDiff significantly.)
    const lostThreshold = 95 + Math.min(110, effectiveSpeed * 0.9) + (reversalBoost > 1 ? 25 : 0);
    const isLost = avgDiff > lostThreshold;
    if (isLost) {
      lostFramesRef.current = Math.min(10, lostFramesRef.current + 1);
      setTrackingStatus('lost');
      // IMPORTANT: don't freeze on loss; keep moving via prediction.
      // Also: do NOT jump to the "best" match when it's above the loss threshold—
      // that's how we drift to a wrong feature (often at the top of reps).
      if (lostLogCounterRef.current < 5) {
        lostLogCounterRef.current += 1;
        console.info('[BarSpeed] tracking lost', {
          avgDiff: Number(avgDiff.toFixed(1)),
          lostThreshold: Number(lostThreshold.toFixed(1)),
          speed: Number(speed.toFixed(1)),
          effectiveSpeed: Number(effectiveSpeed.toFixed(1)),
          reversalBoost,
          searchRadius: Number(searchRadius.toFixed(1)),
          lostFrames: lostFramesRef.current,
        });
      }
      return { pos: { x: predX, y: predY }, matchImg: matchData, diff: avgDiff, isLost: true };
    }

    // Good lock
    lostFramesRef.current = 0;
    lastGoodSpeedRef.current = speed;
    lostLogCounterRef.current = 0;
    setTrackingStatus('ok');

    if (avgDiff > 5 && avgDiff < 65 && speed > 2) {
      const initialDiff = calculateDiff(matchData, initialTemplateRef.current);
      const initialAvgDiff = initialDiff / (pixelsChecked * 3 * 16);
      if (initialAvgDiff < 100) {
        templateDataRef.current = matchData;
      }
    }

    return { pos: { x: foundX, y: foundY }, matchImg: matchData, diff: avgDiff, isLost: false };
  };

  const calculateDiff = (img1: ImageData | null, img2: ImageData | null): number => {
    let diff = 0;
    if (!img1 || !img2) return 999999;
    for (let i = 0; i < img1.data.length; i += 16) {
      diff += Math.abs(img1.data[i] - img2.data[i]);
    }
    return diff;
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onFrame = () => {
      if (!isTrackingRef.current) return;
      const prevPos = trackerPosRef.current;
      const prevVel = velocityRef.current;
      const prevTraj = trajectoryRef.current;

      if (prevPos) {
        const result = findTemplate(prevPos.x, prevPos.y, prevVel.x, prevVel.y, prevTraj);
        const newPos = result.pos;
        setDebugPreviews(prev => ({ ...prev, match: getPreviewUrl(result.matchImg), diff: result.diff }));

        const rawVx = newPos.x - prevPos.x;
        const rawVy = newPos.y - prevPos.y;
        const speed = Math.sqrt(rawVx * rawVx + rawVy * rawVy);
        let safeVx = rawVx;
        let safeVy = rawVy;

        if (speed > 60) {
          const ratio = 60 / speed;
          safeVx *= ratio;
          safeVy *= ratio;
        }

        // If we're in a "lost" frame, avoid collapsing velocity to ~0 (which shrinks the
        // search window next frame and can cause permanent loss).
        const blend = result.isLost ? 0.25 : 0.7;
        const newVx = (prevVel.x * (1 - blend)) + (safeVx * blend);
        const newVy = (prevVel.y * (1 - blend)) + (safeVy * blend);
        velocityRef.current = { x: newVx, y: newVy };
        
        if (pixelsPerMeter) {
          const velMps = Math.abs(newVy) / pixelsPerMeter * fps;
          setCurrentVelocity(velMps);
        }

        if (speed > 3) {
          const dirX = rawVx / speed;
          const dirY = rawVy / speed;
          const dot = dirX * prevTraj.x + dirY * prevTraj.y;
          let alignX = dirX;
          let alignY = dirY;
          if (dot < 0) { alignX = -alignX; alignY = -alignY; }

          const newTrajX = prevTraj.x * 0.98 + alignX * 0.02;
          const newTrajY = prevTraj.y * 0.98 + alignY * 0.02;
          const len = Math.sqrt(newTrajX * newTrajX + newTrajY * newTrajY);
          trajectoryRef.current = { x: newTrajX / len, y: newTrajY / len };
        }

        trackerPosRef.current = newPos;
        trackingDataRef.current.push({ time: video.currentTime, x: newPos.x, y: newPos.y });
        setTrackerPos(newPos);
        setTrackingData([...trackingDataRef.current]);
      }
      drawFrame();

      if (!video.paused && !video.ended) {
        loopIdRef.current = (video as any).requestVideoFrameCallback(onFrame);
      } else if (video.ended) {
        setIsTracking(false);
      }
    };

    if (isTracking) {
      video.playbackRate = 0.25;
      video.play().catch(e => console.error(e));
      if ('requestVideoFrameCallback' in video) {
        loopIdRef.current = (video as any).requestVideoFrameCallback(onFrame);
      } else {
        const fallbackLoop = () => { onFrame(); if (isTrackingRef.current) requestRef.current = requestAnimationFrame(fallbackLoop); };
        requestRef.current = requestAnimationFrame(fallbackLoop);
      }
    } else {
      video.pause();
      if (loopIdRef.current && 'cancelVideoFrameCallback' in video) { (video as any).cancelVideoFrameCallback(loopIdRef.current); }
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }

    return () => {
      if (loopIdRef.current && video && 'cancelVideoFrameCallback' in video) { (video as any).cancelVideoFrameCallback(loopIdRef.current); }
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isTracking, pixelsPerMeter, fps]);

  const toggleTracking = () => {
    if (isTracking) { setIsTracking(false); }
    else {
      if (!trackerPos) { alert("Please click the barbell sleeve center to set the tracking target first."); return; }
      setIsTracking(true);
    }
  };

  const applyMedianFilter = (data: PhysicsData[], window: number): PhysicsData[] => {
    const result: PhysicsData[] = [];
    const half = Math.floor(window / 2);
    for (let i = 0; i < data.length; i++) {
      const chunkY: number[] = [];
      const chunkX: number[] = [];
      for (let j = -half; j <= half; j++) {
        if (i + j >= 0 && i + j < data.length) { chunkY.push(data[i + j].y); chunkX.push(data[i + j].x); }
      }
      chunkY.sort((a, b) => a - b);
      chunkX.sort((a, b) => a - b);
      const mid = Math.floor(chunkY.length / 2);
      result.push({ t: data[i].t, y: chunkY[mid], x: chunkX[mid] });
    }
    return result;
  };

  const analysisResults = useMemo((): AnalysisResults | null => {
    if (trackingData.length < 5 || !pixelsPerMeter) return null;

    const rawData: PhysicsData[] = trackingData.map(d => ({ t: d.time, y: (videoDimensions.height - d.y) / pixelsPerMeter, x: d.x / pixelsPerMeter }));
    const medianData = applyMedianFilter(rawData, 3);

    const smoothWindow = 7;
    const smoothedData: PhysicsData[] = [];
    for (let i = 0; i < medianData.length; i++) {
      let sumY = 0, sumX = 0, weightSum = 0;
      for (let j = -Math.floor(smoothWindow / 2); j <= Math.floor(smoothWindow / 2); j++) {
        const idx = i + j;
        if (idx >= 0 && idx < medianData.length) {
          const w = smoothWindow - Math.abs(j);
          sumY += medianData[idx].y * w;
          sumX += medianData[idx].x * w;
          weightSum += w;
        }
      }
      smoothedData.push({ t: medianData[i].t, y: sumY / weightSum, x: sumX / weightSum });
    }

    const velocityData: PhysicsData[] = [];
    for (let i = 1; i < smoothedData.length - 1; i++) {
      const dt = smoothedData[i + 1].t - smoothedData[i - 1].t;
      if (dt <= 0.001) continue;
      const vy = (smoothedData[i + 1].y - smoothedData[i - 1].y) / dt;
      const vx = (smoothedData[i + 1].x - smoothedData[i - 1].x) / dt;
      velocityData.push({ t: smoothedData[i].t, vy, vx, y: smoothedData[i].y, x: smoothedData[i].x });
    }

    const smoothVel: PhysicsData[] = [];
    const vWindow = 11;
    for (let i = 0; i < velocityData.length; i++) {
      let sumVy = 0, sumVx = 0, count = 0;
      for (let j = -Math.floor(vWindow / 2); j <= Math.floor(vWindow / 2); j++) {
        if (i + j >= 0 && i + j < velocityData.length) { sumVy += velocityData[i + j].vy!; sumVx += velocityData[i + j].vx!; count++; }
      }
      smoothVel.push({ ...velocityData[i], vy: sumVy / count, vx: sumVx / count });
    }

    const massKg = unit === 'lbs' ? weight * 0.453592 : weight;
    const finalPhysics: PhysicsData[] = [];

    for (let i = 1; i < smoothVel.length - 1; i++) {
      const dt = smoothVel[i + 1].t - smoothVel[i - 1].t;
      if (dt <= 0.001) { finalPhysics.push({ ...smoothVel[i], ay: 0, f: massKg * 9.81 * forceScale, v: smoothVel[i].vy }); continue; }
      let ay = (smoothVel[i + 1].vy! - smoothVel[i - 1].vy!) / dt;
      ay = Math.max(-5.0, Math.min(5.0, ay));
      const force = massKg * (9.81 + ay) * forceScale;
      const clampedForce = Math.max(0, force);
      finalPhysics.push({ ...smoothVel[i], ay, ax: 0, f: clampedForce, v: smoothVel[i].vy });
    }

    const forceSmoothWindow = 13;
    const smoothedPhysics: PhysicsData[] = [];
    for (let i = 0; i < finalPhysics.length; i++) {
      let sumF = 0, count = 0;
      for (let j = -Math.floor(forceSmoothWindow / 2); j <= Math.floor(forceSmoothWindow / 2); j++) {
        if (i + j >= 0 && i + j < finalPhysics.length) { sumF += finalPhysics[i + j].f!; count++; }
      }
      smoothedPhysics.push({ ...finalPhysics[i], f: sumF / count });
    }

    const forceMultiplier = unit === 'lbs' ? 0.224809 : 1.0;
    const forceUnitLabel = unit === 'lbs' ? 'lbf' : 'N';

    const threshold = 0.05;
    const minPeakVel = 0.15;
    const minDuration = 0.35;

    const reps: PhysicsData[][] = [];
    let currentRep: PhysicsData[] = [];
    let inConcentric = false;

    smoothedPhysics.forEach((d) => {
      if (d.v! > threshold) { inConcentric = true; currentRep.push(d); }
      else {
        if (inConcentric) {
          if (currentRep.length > 5) {
            const duration = currentRep[currentRep.length - 1].t - currentRep[0].t;
            const peakVel = Math.max(...currentRep.map(r => r.v!));
            if (duration > minDuration && peakVel > minPeakVel) reps.push([...currentRep]);
          }
          currentRep = [];
        }
        inConcentric = false;
      }
    });
    
    if (currentRep.length > 5) {
      const duration = currentRep[currentRep.length - 1].t - currentRep[0].t;
      const peakVel = Math.max(...currentRep.map(r => r.v!));
      if (duration > minDuration && peakVel > minPeakVel) reps.push(currentRep);
    }

    const repMetrics: RepMetric[] = reps.map((repData, index) => {
      const meanVelocity = repData.reduce((acc, cur) => acc + cur.v!, 0) / repData.length;
      const forces = repData.map(d => d.f!).sort((a, b) => b - a);
      const top20Count = Math.max(1, Math.ceil(forces.length * 0.20));
      const topForces = forces.slice(0, top20Count);
      const peakForceN = topForces.reduce((a, b) => a + b, 0) / topForces.length;
      const duration = repData[repData.length - 1].t - repData[0].t;
      return {
        id: index + 1,
        meanVelocity,
        peakForceN,
        peakForceLbs: peakForceN * 0.224809,
        duration
      };
    });

    const allMeanVel = repMetrics.length > 0 ? repMetrics.reduce((acc, r) => acc + r.meanVelocity, 0) / repMetrics.length : 0;
    const allPeakForceN = repMetrics.length > 0 ? Math.max(...repMetrics.map(r => r.peakForceN)) : 0;

    return {
      metrics: {
        meanVelocity: allMeanVel.toFixed(2),
        peakForceN: allPeakForceN.toFixed(0),
        peakForceLbs: (allPeakForceN * 0.224809).toFixed(0),
        forceUnit: 'N'
      },
      chartData: smoothedPhysics,
      repMetrics
    };
  }, [trackingData, pixelsPerMeter, videoDimensions.height, unit, weight, forceScale]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {onBack && (
            <BackButton onClick={onBack} />
          )}
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Bar Speed Analyzer</h1>
          </div>
          <div className="flex items-center gap-3 ml-auto flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">Weight</label>
              <input type="number" value={weight} onChange={e => setWeight(Number(e.target.value))} className="w-20 px-3 py-2 bg-secondary border border-border rounded-lg text-foreground font-mono text-sm outline-none focus:border-primary" />
              <select value={unit} onChange={e => setUnit(e.target.value as MassUnit)} className="px-2 py-2 bg-secondary border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary">
                <option value="kg">KG</option>
                <option value="lbs">LBS</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">FPS</label>
              <input type="number" value={fps} onChange={e => setFps(Number(e.target.value))} className="w-16 px-3 py-2 bg-secondary border border-border rounded-lg text-foreground font-mono text-sm outline-none focus:border-primary" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">Force Scale</label>
              <input type="number" step="0.01" value={forceScale} onChange={e => setForceScale(Number(e.target.value))} className="w-16 px-3 py-2 bg-secondary border border-border rounded-lg text-foreground font-mono text-sm outline-none focus:border-primary" />
            </div>
            {step !== 'upload' && (
              <button onClick={() => { setStep('upload'); setVideoSrc(null); setIsTracking(false); }} className="text-base text-destructive hover:text-destructive/80 font-bold transition-colors px-3 py-1">Reset</button>
            )}
          </div>
        </div>

        {/* Progress Steps */}
        {videoSrc && (
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
            {[{ id: 'setup', label: 'Calibration', num: 1 }, { id: 'tracking', label: 'Tracking', num: 2 }, { id: 'results', label: 'Results', num: 3 }].map((item, idx) => (
              <React.Fragment key={item.id}>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${step === item.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                  <span className="w-5 h-5 rounded-full bg-background/20 flex items-center justify-center text-xs">{item.num}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </div>
                {idx < 2 && <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
              </React.Fragment>
            ))}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content Area */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-xl p-6">
              {step === 'upload' && (
                <div className="space-y-6">
                  <label className="border-2 border-dashed border-border rounded-xl p-12 hover:border-primary hover:bg-primary/5 transition-all block cursor-pointer">
                    <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-6 rounded-full bg-primary/20">
                        <Upload className="w-12 h-12 text-primary" />
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-semibold text-foreground">Upload Barbell Video</p>
                        <p className="text-muted-foreground mt-1">Select a video file of your set</p>
                      </div>
                    </div>
                  </label>

                  <div className="bg-secondary/50 border border-border rounded-xl p-5">
                    <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                      <Target size={16} className="text-primary" />
                      Filming Tips for Best Results
                    </h3>
                    <div className="grid gap-3 text-sm">
                      {[
                        { num: 1, title: 'Side View Camera Position', desc: 'Position camera perpendicular to the bar path, 2-3m away. The bar should move vertically in frame.' },
                        { num: 2, title: 'Stable & Level', desc: "Use a tripod or stable surface. Keep camera level - don't tilt." },
                        { num: 3, title: 'Good Lighting', desc: 'Ensure the barbell sleeve is well-lit and visible. Avoid backlighting.' },
                        { num: 4, title: 'Frame the Full Movement', desc: 'Keep the entire bar path in frame throughout the set. Include some extra space above/below.' },
                        { num: 5, title: 'High Frame Rate', desc: 'Use 60fps if possible (30fps minimum). Higher = more accurate velocity data.' }
                      ].map(tip => (
                        <div key={tip.num} className="flex gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">{tip.num}</div>
                          <div>
                            <p className="font-medium text-foreground">{tip.title}</p>
                            <p className="text-muted-foreground text-xs">{tip.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {videoSrc && (
                <div ref={containerRef} className="relative bg-black rounded-lg overflow-hidden flex justify-center items-center" style={{ minHeight: '350px' }}>
                  {debugPreviews.template && (
                    <div className="absolute bottom-4 left-4 z-40 bg-card/95 p-3 rounded-xl shadow-xl border border-border flex items-center gap-3 backdrop-blur-sm">
                      <div className="text-center">
                        <div className="text-[10px] text-muted-foreground font-bold mb-1 uppercase">Target</div>
                        <img src={debugPreviews.template} alt="Target" className="w-[45px] h-[45px] border-2 border-primary rounded bg-secondary object-cover" />
                      </div>
                      <div className="h-10 w-px bg-border"></div>
                      <div className="text-center">
                        <div className="text-[10px] text-muted-foreground font-bold mb-1 uppercase">Match</div>
                        {debugPreviews.match ? (
                          <img src={debugPreviews.match} alt="Match" className="w-[45px] h-[45px] border-2 border-border rounded bg-secondary object-cover" />
                        ) : (
                          <div className="w-[45px] h-[45px] border-2 border-dashed border-border rounded bg-muted flex items-center justify-center text-[9px] text-muted-foreground">...</div>
                        )}
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-muted-foreground font-bold mb-1 uppercase">Diff</div>
                        <div className={`text-sm font-bold font-mono ${debugPreviews.diff < 20 ? 'text-green-500' : 'text-red-500'}`}>{debugPreviews.diff.toFixed(1)}</div>
                      </div>
                    </div>
                  )}

                  {!isVideoReady && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-foreground z-10 bg-background/80">
                      <RefreshCw className="animate-spin mb-2 text-primary" />
                      <span className="text-sm">Loading Video...</span>
                    </div>
                  )}
                  {isTracking && (
                    <>
                      <div className="absolute top-4 right-4 bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-xs font-bold animate-pulse z-30 flex items-center gap-2">
                        <div className="w-2 h-2 bg-primary-foreground rounded-full"></div> Tracking...
                      </div>
                      <div className="absolute top-4 left-4 z-40">
                        <VelocityGauge velocity={currentVelocity} maxVelocity={2.0} size={100} />
                      </div>
                    </>
                  )}

                  <video ref={videoRef} src={videoSrc} onLoadedData={handleVideoLoad} onEnded={() => setIsTracking(false)} className="hidden" playsInline muted preload="auto" />
                  {step !== 'results' && (
                    <canvas ref={canvasRef} onClick={handleClick} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} className="cursor-crosshair w-full h-auto z-20 relative block" style={{ touchAction: 'none' }} />
                  )}

                  {step === 'results' && analysisResults && (
                    <div className="w-full bg-card p-6 z-20 relative">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <div className="bg-secondary p-4 rounded-xl border border-border">
                          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Mean Velocity</p>
                          <div className="text-2xl font-bold text-primary mt-1 font-mono">
                            <AnimatedNumber value={parseFloat(analysisResults.metrics.meanVelocity)} decimals={2} />
                            <span className="text-sm text-muted-foreground font-normal ml-1">m/s</span>
                          </div>
                        </div>
                        <div className="bg-secondary p-4 rounded-xl border border-border">
                          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Peak Force</p>
                          <div className="text-2xl font-bold text-green-500 mt-1 font-mono">
                            <AnimatedNumber value={parseFloat(analysisResults.metrics.peakForceN)} decimals={0} />
                            <span className="text-sm text-muted-foreground font-normal ml-1">N</span>
                          </div>
                        </div>
                        <div className="bg-secondary p-4 rounded-xl border border-border">
                          <div className="flex justify-between items-center">
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Est. 1RM</p>
                            <TrendingUp size={12} className="text-primary" />
                          </div>
                          <div className="text-2xl font-bold text-primary mt-1 font-mono">
                            <AnimatedNumber value={estimate1RM(weight, parseFloat(analysisResults.metrics.meanVelocity), unit)} decimals={1} />
                            <span className="text-sm text-muted-foreground font-normal ml-1">{unit}</span>
                          </div>
                        </div>
                        <div className="bg-secondary p-4 rounded-xl border border-border">
                          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Reps</p>
                          <div className="text-2xl font-bold text-foreground mt-1 font-mono">
                            <AnimatedNumber value={analysisResults.repMetrics.length} decimals={0} />
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3 mb-6">
                        <button
                          onClick={() => {
                            setIsReplaying(true);
                            const video = videoRef.current;
                            const canvas = canvasRef.current;
                            if (video && canvas) {
                              canvas.style.display = 'block';
                              video.currentTime = 0;
                              video.playbackRate = 0.5;
                              video.play();
                              const drawReplay = () => {
                                if (video.paused || video.ended) { setIsReplaying(false); return; }
                                const ctx = canvas.getContext('2d');
                                if (ctx) {
                                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                                  ctx.strokeStyle = 'hsl(var(--primary))';
                                  ctx.lineWidth = 3;
                                  ctx.beginPath();
                                  const currentTime = video.currentTime;
                                  trackingData.filter(p => p.time <= currentTime).forEach((pt, i) => { if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); });
                                  ctx.stroke();
                                }
                                requestAnimationFrame(drawReplay);
                              };
                              requestAnimationFrame(drawReplay);
                            }
                          }}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-secondary border border-border rounded-xl text-sm font-bold text-foreground hover:bg-secondary/80 transition-all"
                          disabled={isReplaying}
                        >
                          <RotateCcw size={16} />
                          {isReplaying ? 'Playing...' : 'Replay with Path'}
                        </button>
                        <button
                          onClick={() => {
                            addSession({
                              weight,
                              unit,
                              reps: analysisResults.repMetrics.length,
                              meanVelocity: parseFloat(analysisResults.metrics.meanVelocity),
                              peakForceN: parseFloat(analysisResults.metrics.peakForceN),
                              estimated1RM: estimate1RM(weight, parseFloat(analysisResults.metrics.meanVelocity), unit),
                            });
                          }}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-all"
                        >
                          <Save size={16} />
                          Save Session
                        </button>
                      </div>

                      {isReplaying && <canvas ref={canvasRef} className="w-full h-auto rounded-lg mb-6" />}

                      {analysisResults.repMetrics.length > 0 && (
                        <div className="mb-8">
                          <h4 className="text-sm font-semibold text-foreground mb-3">Rep-by-Rep Breakdown</h4>
                          <div className="overflow-hidden border border-border rounded-xl">
                            <table className="min-w-full divide-y divide-border">
                              <thead className="bg-secondary">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Rep</th>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Mean Velocity</th>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Peak Force</th>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Duration</th>
                                </tr>
                              </thead>
                              <tbody className="bg-card divide-y divide-border">
                                {analysisResults.repMetrics.map((rep) => (
                                  <tr key={rep.id} className="hover:bg-secondary/50 transition-colors">
                                    <td className="px-4 py-3 text-sm font-medium text-foreground">{rep.id}</td>
                                    <td className="px-4 py-3 text-sm text-primary font-bold font-mono">{rep.meanVelocity.toFixed(2)} m/s</td>
                                    <td className="px-4 py-3 text-sm text-green-500 font-bold font-mono">{rep.peakForceN.toFixed(0)} N <span className="text-muted-foreground font-normal mx-1">/</span> {rep.peakForceLbs.toFixed(0)} lbf</td>
                                    <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{rep.duration.toFixed(2)}s</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      <EnhancedChart data={analysisResults.chartData} dataKey="v" color="hsl(var(--primary))" gradientId="velocityGradient" label="Velocity Over Time" unit="m/s" />
                      <EnhancedChart data={analysisResults.chartData} dataKey="f" color="#22c55e" gradientId="forceGradient" label={`Force Over Time (${analysisResults.metrics.forceUnit})`} unit={analysisResults.metrics.forceUnit} />
                    </div>
                  )}
                  {step === 'results' && !analysisResults && (
                    <div className="w-full h-64 flex items-center justify-center text-muted-foreground z-20 relative bg-card">Not enough data for analysis. Try tracking a longer portion of the lift.</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Controls */}
          <div className="space-y-6">
            {step === 'setup' && videoSrc && (
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-start gap-3 mb-4">
                  <Ruler className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Calibrate Scale</p>
                    <p className="text-sm text-muted-foreground mt-1">Click the <strong className="text-foreground">center</strong> of the barbell sleeve cap, drag to the <strong className="text-foreground">edge</strong> (50mm), and release.</p>
                  </div>
                </div>
                {pixelsPerMeter && (
                  <>
                    <p className="text-green-500 font-bold text-sm mb-3">✓ Calibrated: {pixelsPerMeter.toFixed(1)} px/m</p>
                    <button onClick={() => { setStep('tracking'); drawFrame(); }} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-all">Next: Start Tracking</button>
                  </>
                )}
              </div>
            )}

            {step === 'tracking' && (
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-start gap-3 mb-4">
                  <Target className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Track the Bar</p>
                    <p className="text-sm text-muted-foreground mt-1">1. Click the center of the barbell end.<br />2. Press <strong className="text-foreground">Start Tracking</strong>.<br />3. Watch the debug panel (bottom-left).</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <button onClick={toggleTracking} className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${isTracking ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
                    {isTracking ? <><Pause size={16} /> Stop Tracking</> : <><Play size={16} /> Start Tracking</>}
                  </button>
                  <button onClick={() => { if (trackingData.length > 5) { setIsTracking(false); setStep('results'); } else alert("Track at least a few frames first."); }} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-secondary border border-border rounded-xl text-sm font-bold text-foreground hover:bg-secondary/80 transition-all">Finish & Analyze</button>
                </div>
                <p className="mt-3 text-xs text-primary font-mono">Frames tracked: {trackingData.length}</p>
              </div>
            )}

            {step === 'results' && (
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-green-500" />
                  <p className="font-semibold text-foreground">Analysis Complete</p>
                </div>
              </div>
            )}

            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Physics</p>
                  <p className="text-xs text-muted-foreground mt-1">Force = Mass × (g + a)<br />Using 9.81 m/s² gravity and 50mm sleeve for calibration.</p>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  <p className="text-sm font-medium text-foreground">Session History</p>
                </div>
                <button onClick={() => setShowHistory(!showHistory)} className="text-xs text-primary hover:underline">{showHistory ? 'Hide' : `Show (${sessions.length})`}</button>
              </div>
              
              {showHistory && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {sessions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No saved sessions yet.</p>
                  ) : (
                    <>
                      {sessions.slice(0, 10).map((session) => (
                        <div key={session.id} className="bg-secondary p-3 rounded-lg border border-border text-xs">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-medium text-foreground">{session.weight} {session.unit} × {session.reps} reps</span>
                            <button onClick={() => deleteSession(session.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={12} /></button>
                          </div>
                          <div className="flex gap-3 text-muted-foreground">
                            <span>Vel: <span className="text-primary font-mono">{session.meanVelocity.toFixed(2)}</span> m/s</span>
                            <span>1RM: <span className="text-foreground font-mono">{session.estimated1RM?.toFixed(1)}</span> {session.unit}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1">{new Date(session.date).toLocaleDateString()}</div>
                        </div>
                      ))}
                      {sessions.length > 0 && <button onClick={clearHistory} className="text-xs text-destructive hover:underline w-full text-center mt-2">Clear All History</button>}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
