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

  // Simple tracking using template matching simulation
  const trackFrame = useCallback((
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    lastPos: { x: number; y: number },
    _frameTime: number
  ): { x: number; y: number } => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return lastPos;

    // Draw current frame
    ctx.drawImage(video, 0, 0);

    // Simulate tracking with slight movement detection
    const searchRadius = circleRadius * 0.5;
    
    // Get image data around last position
    const searchX = Math.max(0, lastPos.x - searchRadius);
    const searchY = Math.max(0, lastPos.y - searchRadius);
    const searchW = Math.min(searchRadius * 2, canvas.width - searchX);
    const searchH = Math.min(searchRadius * 2, canvas.height - searchY);
    
    try {
      const imageData = ctx.getImageData(searchX, searchY, searchW, searchH);
      
      // Simple centroid calculation based on brightness
      let sumX = 0, sumY = 0, count = 0;
      
      for (let y = 0; y < searchH; y++) {
        for (let x = 0; x < searchW; x++) {
          const i = (y * searchW + x) * 4;
          const brightness = (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
          
          if (brightness > 100) {
            sumX += x * brightness;
            sumY += y * brightness;
            count += brightness;
          }
        }
      }
      
      if (count > 0) {
        const newX = searchX + sumX / count;
        const newY = searchY + sumY / count;
        
        const maxMove = circleRadius * 0.3;
        const dx = Math.max(-maxMove, Math.min(maxMove, newX - lastPos.x));
        const dy = Math.max(-maxMove, Math.min(maxMove, newY - lastPos.y));
        
        return {
          x: lastPos.x + dx * 0.3,
          y: lastPos.y + dy * 0.3,
        };
      }
    } catch (e) {
      // Canvas security errors, etc.
    }
    
    return lastPos;
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

    const sampleFrameAt = (t: number, duration: number) => {
      setProgress(duration > 0 ? (t / duration) * 100 : 0);
      setStatus('tracking');

      const newPosition = trackFrame(video, canvas, lastPosition, t);
      lastPosition = newPosition;
      setCurrentPosition(newPosition);

      trackingPointsRef.current.push({
        x: newPosition.x,
        y: newPosition.y,
        time: t,
      });
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
