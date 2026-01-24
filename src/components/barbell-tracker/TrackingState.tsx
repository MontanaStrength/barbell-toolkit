import { useState, useEffect, useRef, useCallback } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import type { TrackingPoint } from '@/lib/barbell-physics';

interface TrackingStateProps {
  videoFile: File;
  circleCenter: { x: number; y: number };
  circleRadius: number;
  onTrackingComplete: (trackingPoints: TrackingPoint[]) => void;
  onBack: () => void;
}

export function TrackingState({
  videoFile,
  circleCenter,
  circleRadius,
  onTrackingComplete,
  onBack,
}: TrackingStateProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'initializing' | 'tracking' | 'complete' | 'error'>('initializing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentPosition, setCurrentPosition] = useState(circleCenter);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackingPointsRef = useRef<TrackingPoint[]>([]);
  const videoUrlRef = useRef<string | null>(null);

  // Reference color from initial calibration (set on first frame)
  const referenceColorRef = useRef<{ r: number; g: number; b: number } | null>(null);
  const consecutiveLossCountRef = useRef(0);

  // Enhanced tracking with color matching and adaptive search
  const trackFrame = useCallback((
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    lastPos: { x: number; y: number },
    _frameTime: number,
    isFirstFrame: boolean = false
  ): { x: number; y: number; confidence: number } => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ...lastPos, confidence: 0 };

    // Draw current frame
    ctx.drawImage(video, 0, 0);

    // Adaptive search radius - expands when tracking is lost
    const baseSearchRadius = circleRadius * 1.5;
    const lossMultiplier = Math.min(3, 1 + consecutiveLossCountRef.current * 0.5);
    const searchRadius = baseSearchRadius * lossMultiplier;
    
    // Get image data around last position
    const searchX = Math.max(0, Math.floor(lastPos.x - searchRadius));
    const searchY = Math.max(0, Math.floor(lastPos.y - searchRadius));
    const searchW = Math.min(Math.floor(searchRadius * 2), canvas.width - searchX);
    const searchH = Math.min(Math.floor(searchRadius * 2), canvas.height - searchY);
    
    if (searchW <= 0 || searchH <= 0) return { ...lastPos, confidence: 0 };

    try {
      const imageData = ctx.getImageData(searchX, searchY, searchW, searchH);
      
      // On first frame, capture reference color from the center of selection
      if (isFirstFrame || !referenceColorRef.current) {
        const centerX = Math.floor(searchW / 2);
        const centerY = Math.floor(searchH / 2);
        const sampleRadius = Math.floor(circleRadius * 0.3);
        let rSum = 0, gSum = 0, bSum = 0, samples = 0;
        
        for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
          for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
            const sx = centerX + dx;
            const sy = centerY + dy;
            if (sx >= 0 && sx < searchW && sy >= 0 && sy < searchH) {
              const i = (sy * searchW + sx) * 4;
              rSum += imageData.data[i];
              gSum += imageData.data[i + 1];
              bSum += imageData.data[i + 2];
              samples++;
            }
          }
        }
        
        if (samples > 0) {
          referenceColorRef.current = {
            r: rSum / samples,
            g: gSum / samples,
            b: bSum / samples,
          };
        }
      }

      const refColor = referenceColorRef.current;
      if (!refColor) return { ...lastPos, confidence: 0 };

      // Color-based weighted centroid calculation
      let sumX = 0, sumY = 0, totalWeight = 0;
      let bestMatchWeight = 0;
      
      // Calculate color similarity threshold based on reference brightness
      const refBrightness = (refColor.r + refColor.g + refColor.b) / 3;
      const colorTolerance = Math.max(40, refBrightness * 0.4);
      
      for (let y = 0; y < searchH; y++) {
        for (let x = 0; x < searchW; x++) {
          const i = (y * searchW + x) * 4;
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];
          
          // Color distance from reference
          const colorDist = Math.sqrt(
            Math.pow(r - refColor.r, 2) +
            Math.pow(g - refColor.g, 2) +
            Math.pow(b - refColor.b, 2)
          );
          
          // Weight based on color similarity (Gaussian falloff)
          const colorWeight = Math.exp(-colorDist * colorDist / (2 * colorTolerance * colorTolerance));
          
          // Distance from last position (prefer nearby matches)
          const posX = searchX + x;
          const posY = searchY + y;
          const posDist = Math.sqrt(
            Math.pow(posX - lastPos.x, 2) +
            Math.pow(posY - lastPos.y, 2)
          );
          const posWeight = Math.exp(-posDist * posDist / (2 * baseSearchRadius * baseSearchRadius));
          
          // Combined weight
          const weight = colorWeight * (0.7 + 0.3 * posWeight);
          
          if (colorWeight > 0.3) { // Only consider good color matches
            sumX += x * weight;
            sumY += y * weight;
            totalWeight += weight;
            bestMatchWeight = Math.max(bestMatchWeight, colorWeight);
          }
        }
      }
      
      if (totalWeight > 0 && bestMatchWeight > 0.4) {
        const newX = searchX + sumX / totalWeight;
        const newY = searchY + totalWeight > 0 ? searchY + sumY / totalWeight : lastPos.y;
        
        // Allow faster movement when tracking is confident
        const maxMove = circleRadius * (0.8 + consecutiveLossCountRef.current * 0.3);
        const dx = Math.max(-maxMove, Math.min(maxMove, newX - lastPos.x));
        const dy = Math.max(-maxMove, Math.min(maxMove, newY - lastPos.y));
        
        // Smoothing factor based on confidence
        const smoothing = 0.6 + 0.3 * bestMatchWeight;
        
        consecutiveLossCountRef.current = 0; // Reset loss counter
        
        return {
          x: lastPos.x + dx * smoothing,
          y: lastPos.y + dy * smoothing,
          confidence: bestMatchWeight,
        };
      } else {
        // Tracking lost - increment counter for adaptive search
        consecutiveLossCountRef.current = Math.min(5, consecutiveLossCountRef.current + 1);
      }
    } catch (e) {
      // Canvas security errors, etc.
      console.error('Tracking frame error:', e);
    }
    
    return { ...lastPos, confidence: 0 };
  }, [circleRadius]);

  // Initialize video element
  useEffect(() => {
    if (!videoFile) return;

    const url = URL.createObjectURL(videoFile);
    videoUrlRef.current = url;

    return () => {
      if (videoUrlRef.current) {
        URL.revokeObjectURL(videoUrlRef.current);
        videoUrlRef.current = null;
      }
    };
  }, [videoFile]);

  // Run tracking
  useEffect(() => {
    if (!videoFile || !canvasRef.current || !videoUrlRef.current) return;

    const video = document.createElement('video');
    video.playsInline = true;
    video.muted = true;
    video.src = videoUrlRef.current;
    videoRef.current = video;

    const canvas = canvasRef.current;
    let lastPosition = { ...circleCenter };
    trackingPointsRef.current = [];

    let isCancelled = false;

    const handleComplete = () => {
      if (isCancelled) return;
      setStatus('complete');
      onTrackingComplete(trackingPointsRef.current);
    };

    const seekTo = (t: number) =>
      new Promise<void>((resolve, reject) => {
        const onSeeked = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error('Video seek error'));
        };
        const cleanup = () => {
          video.removeEventListener('seeked', onSeeked);
          video.removeEventListener('error', onError);
        };
        video.addEventListener('seeked', onSeeked);
        video.addEventListener('error', onError);
        video.currentTime = t;
      });

    let frameCount = 0;
    
    const sampleFrameAt = (t: number, duration: number) => {
      setProgress(duration > 0 ? (t / duration) * 100 : 0);
      setStatus('tracking');

      const isFirstFrame = frameCount === 0;
      const result = trackFrame(video, canvas, lastPosition, t, isFirstFrame);
      lastPosition = { x: result.x, y: result.y };
      setCurrentPosition(lastPosition);

      trackingPointsRef.current.push({
        x: result.x,
        y: result.y,
        time: t,
      });
      
      frameCount++;
    };

    const startTracking = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Deterministic, stall-proof processing: step through the video by seeking.
      // This avoids playback stalling (where currentTime stops advancing), which can
      // truncate data around ~5-6s in some environments.
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        setStatus('error');
        setErrorMessage('Could not read video duration. Please try a different file.');
        return;
      }

      setStatus('tracking');
      setProgress(0);
      video.pause();
      video.playbackRate = 1;

      const run = async () => {
        try {
          // Default to ~30fps sampling (matches FORCE_WINDOW_MS/33 assumption)
          const step = 1 / 30;
          const endTime = Math.max(0, duration);

          for (let t = 0; t <= endTime; t += step) {
            if (isCancelled) return;
            const clampedT = Math.min(endTime, t);
            await seekTo(clampedT);
            if (isCancelled) return;
            sampleFrameAt(clampedT, endTime);
          }

          handleComplete();
        } catch (err) {
          if (isCancelled) return;
          setStatus('error');
          setErrorMessage('Tracking failed while reading the video. Please try again.');
          console.error('Tracking seek error:', err);
        }
      };

      void run();
    };

    video.onloadedmetadata = startTracking;
    
    video.onerror = () => {
      setStatus('error');
      setErrorMessage('Failed to load video. Please try uploading again.');
    };

    // Trigger load
    video.load();

    return () => {
      isCancelled = true;
      video.pause();
      video.playbackRate = 1;
      video.src = '';
    };
  }, [videoFile, circleCenter, onTrackingComplete, trackFrame]);

  // Draw tracking overlay
  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Draw tracking point
    ctx.beginPath();
    ctx.arc(currentPosition.x, currentPosition.y, circleRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'hsl(0, 30%, 55%)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw center point
    ctx.beginPath();
    ctx.arc(currentPosition.x, currentPosition.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'hsl(0, 30%, 55%)';
    ctx.fill();

    // Draw trail
    const points = trackingPointsRef.current.slice(-30);
    if (points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.strokeStyle = 'hsla(0, 30%, 55%, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [currentPosition, circleRadius]);

  if (status === 'error') {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
        <p className="text-foreground font-medium mb-2">Tracking Failed</p>
        <p className="text-muted-foreground text-sm mb-4">{errorMessage}</p>
        <Button variant="outline" onClick={onBack}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h2 className="text-lg font-medium text-foreground mb-1">
          {status === 'complete' ? 'Tracking Complete' : 'Tracking Bar Path'}
        </h2>
        <p className="text-muted-foreground text-sm">
          {status === 'tracking' && 'Following the bar through the lift...'}
          {status === 'initializing' && 'Initializing tracker...'}
          {status === 'complete' && `Captured ${trackingPointsRef.current.length} data points`}
        </p>
      </div>

      {/* Video with tracking overlay */}
      <div className="relative bg-black rounded-lg overflow-hidden">
        <canvas 
          ref={canvasRef} 
          className="w-full h-auto"
        />
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <Progress 
          value={Math.min(progress, 100)} 
          className="h-2 bg-secondary [&>div]:bg-tool-red" 
        />
        <p className="text-muted-foreground text-sm text-center">
          {Math.round(progress)}% processed
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          onClick={onBack}
          className="flex-1 border-border"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
