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
  // Velocity tracking for prediction
  const velocityRef = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 });
  const prevPositionRef = useRef<{ x: number; y: number } | null>(null);

  // Enhanced tracking with color matching, velocity prediction, and adaptive search
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

    // Calculate current velocity from previous positions
    let velocity = velocityRef.current;
    if (prevPositionRef.current && !isFirstFrame) {
      velocity = {
        vx: lastPos.x - prevPositionRef.current.x,
        vy: lastPos.y - prevPositionRef.current.y,
      };
      // Smooth velocity with exponential moving average
      velocityRef.current = {
        vx: velocity.vx * 0.7 + velocityRef.current.vx * 0.3,
        vy: velocity.vy * 0.7 + velocityRef.current.vy * 0.3,
      };
    }
    
    // Calculate speed for adaptive parameters
    const speed = Math.sqrt(velocity.vx * velocity.vx + velocity.vy * velocity.vy);
    const isMovingFast = speed > circleRadius * 0.3;

    // Predict next position based on velocity (helps with fast movements)
    // If we've been "lost" for a few frames, push further ahead so we can catch up.
    const lead = 0.8 + Math.min(2, consecutiveLossCountRef.current * 0.4);
    const predictedPos = {
      x: lastPos.x + velocityRef.current.vx * lead,
      y: lastPos.y + velocityRef.current.vy * lead,
    };

    // Adaptive search radius - larger when moving fast or tracking lost
    const baseSearchRadius = circleRadius * 2;
    const speedMultiplier = 1 + Math.min(2, speed / circleRadius);
    // Allow search to expand more than before for brief occlusions (e.g. bottom of a rep)
    const lossMultiplier = Math.min(6, 1 + consecutiveLossCountRef.current * 0.9);
    const searchRadius = baseSearchRadius * Math.max(speedMultiplier, lossMultiplier);
    
    // Search around predicted position (even when "lost" we should keep searching forward,
    // otherwise we can never catch up after a brief occlusion).
    const searchCenter = predictedPos;
    const searchX = Math.max(0, Math.floor(searchCenter.x - searchRadius));
    const searchY = Math.max(0, Math.floor(searchCenter.y - searchRadius));
    const searchW = Math.min(Math.floor(searchRadius * 2), canvas.width - searchX);
    const searchH = Math.min(Math.floor(searchRadius * 2), canvas.height - searchY);
    
    if (searchW <= 0 || searchH <= 0) return { ...lastPos, confidence: 0 };

    try {
      const imageData = ctx.getImageData(searchX, searchY, searchW, searchH);
      
      // On first frame, capture reference color from the center of selection
      if (isFirstFrame || !referenceColorRef.current) {
        const centerX = Math.floor(searchW / 2);
        const centerY = Math.floor(searchH / 2);
        const sampleRadius = Math.floor(circleRadius * 0.4);
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
        prevPositionRef.current = { ...lastPos };
      }

      const refColor = referenceColorRef.current;
      if (!refColor) return { ...lastPos, confidence: 0 };

      // Color-based weighted centroid calculation
      let sumX = 0, sumY = 0, totalWeight = 0;
      let bestMatchWeight = 0;
      
      // Loosen color tolerance when moving fast (motion blur changes appearance)
      const refBrightness = (refColor.r + refColor.g + refColor.b) / 3;
      const baseColorTolerance = Math.max(50, refBrightness * 0.5);
      const colorTolerance = isMovingFast ? baseColorTolerance * 1.5 : baseColorTolerance;
      
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
          
          // Distance from predicted position (not last position)
          const posX = searchX + x;
          const posY = searchY + y;
          const posDist = Math.sqrt(
            Math.pow(posX - predictedPos.x, 2) +
            Math.pow(posY - predictedPos.y, 2)
          );
          // Wider position tolerance when moving fast
          const posRadius = isMovingFast ? searchRadius : baseSearchRadius;
          const posWeight = Math.exp(-posDist * posDist / (2 * posRadius * posRadius));
          
          // Combined weight - prioritize color when moving fast
          const colorPriority = isMovingFast ? 0.85 : 0.7;
          const weight = colorWeight * (colorPriority + (1 - colorPriority) * posWeight);
          
          // Lower threshold when moving fast to catch motion-blurred object
          const matchThreshold = isMovingFast ? 0.2 : 0.3;
          if (colorWeight > matchThreshold) {
            sumX += x * weight;
            sumY += y * weight;
            totalWeight += weight;
            bestMatchWeight = Math.max(bestMatchWeight, colorWeight);
          }
        }
      }
      
      // Lower confidence threshold when moving fast
      const confidenceThreshold = isMovingFast ? 0.25 : 0.4;
      
      if (totalWeight > 0 && bestMatchWeight > confidenceThreshold) {
        const newX = searchX + sumX / totalWeight;
        const newY = searchY + sumY / totalWeight;
        
        // Allow much faster movement - no artificial clamping
        // Trust the color matching instead
        const maxMove = circleRadius * (3 + speed / circleRadius);
        const dx = Math.max(-maxMove, Math.min(maxMove, newX - lastPos.x));
        const dy = Math.max(-maxMove, Math.min(maxMove, newY - lastPos.y));
        
        // Less smoothing when moving fast (need to keep up with rapid changes)
        const smoothing = isMovingFast ? 0.85 : (0.6 + 0.3 * bestMatchWeight);
        
        consecutiveLossCountRef.current = 0; // Reset loss counter

        // Adapt reference color slowly to handle lighting/motion-blur changes.
        // Only update when we're reasonably confident.
        if (bestMatchWeight > 0.55) {
          const sampleRadius = Math.max(2, Math.floor(circleRadius * 0.25));
          const sx0 = Math.max(0, Math.floor(newX) - sampleRadius);
          const sy0 = Math.max(0, Math.floor(newY) - sampleRadius);
          const sx1 = Math.min(canvas.width - 1, Math.floor(newX) + sampleRadius);
          const sy1 = Math.min(canvas.height - 1, Math.floor(newY) + sampleRadius);
          const sw = Math.max(1, sx1 - sx0);
          const sh = Math.max(1, sy1 - sy0);
          const sampleData = ctx.getImageData(sx0, sy0, sw, sh);

          let rSum = 0, gSum = 0, bSum = 0, n = 0;
          for (let i = 0; i < sampleData.data.length; i += 4) {
            rSum += sampleData.data[i];
            gSum += sampleData.data[i + 1];
            bSum += sampleData.data[i + 2];
            n++;
          }

          if (n > 0 && referenceColorRef.current) {
            const next = { r: rSum / n, g: gSum / n, b: bSum / n };
            // 90/10 EMA
            referenceColorRef.current = {
              r: referenceColorRef.current.r * 0.9 + next.r * 0.1,
              g: referenceColorRef.current.g * 0.9 + next.g * 0.1,
              b: referenceColorRef.current.b * 0.9 + next.b * 0.1,
            };
          }
        }

        prevPositionRef.current = { ...lastPos };
        
        return {
          x: lastPos.x + dx * smoothing,
          y: lastPos.y + dy * smoothing,
          confidence: bestMatchWeight,
        };
      } else {
        // Tracking lost - increment counter for adaptive search
        consecutiveLossCountRef.current = Math.min(5, consecutiveLossCountRef.current + 1);

        // If we've been lost for a couple frames, do a coarse re-acquisition scan over
        // the full frame (downsampled). This helps when the sleeve exits the local window.
        if (consecutiveLossCountRef.current >= 2) {
          const full = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const ref = referenceColorRef.current;
          if (ref) {
            const step = Math.max(3, Math.floor(circleRadius * 0.2));
            let best = { w: 0, x: lastPos.x, y: lastPos.y };
            const refBrightness = (ref.r + ref.g + ref.b) / 3;
            const tol = Math.max(70, refBrightness * 0.7);

            for (let y = 0; y < canvas.height; y += step) {
              for (let x = 0; x < canvas.width; x += step) {
                const idx = (y * canvas.width + x) * 4;
                const r = full.data[idx];
                const g = full.data[idx + 1];
                const b = full.data[idx + 2];

                const d = Math.sqrt(
                  Math.pow(r - ref.r, 2) + Math.pow(g - ref.g, 2) + Math.pow(b - ref.b, 2)
                );
                const cw = Math.exp(-(d * d) / (2 * tol * tol));

                // Prefer candidates near the predicted position, but still allow global jumps.
                const pd = Math.sqrt(Math.pow(x - predictedPos.x, 2) + Math.pow(y - predictedPos.y, 2));
                const pw = Math.exp(-(pd * pd) / (2 * Math.pow(circleRadius * 10, 2)));
                const w = cw * (0.75 + 0.25 * pw);

                if (w > best.w) best = { w, x, y };
              }
            }

            const reacquireThreshold = isMovingFast ? 0.25 : 0.35;
            if (best.w > reacquireThreshold) {
              consecutiveLossCountRef.current = 0;
              prevPositionRef.current = { ...lastPos };
              return { x: best.x, y: best.y, confidence: best.w };
            }
          }
        }
      }
    } catch (e) {
      // Canvas security errors, etc.
      console.error('Tracking frame error:', e);
    }

    // When lost, don't freeze in place—advance using prediction so the local window can catch up.
    prevPositionRef.current = { ...lastPos };
    const fallbackX = Math.max(0, Math.min(canvas.width, predictedPos.x));
    const fallbackY = Math.max(0, Math.min(canvas.height, predictedPos.y));
    // Slightly decay velocity when we don't have a confident match.
    velocityRef.current = { vx: velocityRef.current.vx * 0.9, vy: velocityRef.current.vy * 0.9 };
    return { x: fallbackX, y: fallbackY, confidence: 0 };
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
