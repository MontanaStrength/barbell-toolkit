import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

interface CalibrationStateProps {
  videoFile: File;
  onCalibrationComplete: (
    pixelsPerMeter: number,
    circleCenter: { x: number; y: number },
    circleRadius: number,
    videoElement: HTMLVideoElement
  ) => void;
  onBack: () => void;
}

// Sleeve cap diameter: 50mm = 0.05 meters
const SLEEVE_DIAMETER_METERS = 0.05;

export function CalibrationState({
  videoFile,
  onCalibrationComplete,
  onBack,
}: CalibrationStateProps) {
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [circlePosition, setCirclePosition] = useState({ x: 150, y: 150 });
  const [circleRadius, setCircleRadius] = useState(30); // Smaller default for sleeve
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load video and capture first frame
  useEffect(() => {
    if (!videoFile || !videoRef.current) return;

    const video = videoRef.current;
    const url = URL.createObjectURL(videoFile);
    video.src = url;

    video.onloadedmetadata = () => {
      video.currentTime = 0;
    };

    video.onseeked = () => {
      setIsVideoReady(true);
      drawFrame();
    };

    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  const drawFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame
    ctx.drawImage(video, 0, 0);
  }, []);

  // Get scale factor between displayed size and actual video size
  const getScaleFactor = useCallback(() => {
    if (!canvasRef.current || !containerRef.current) return 1;
    const displayWidth = containerRef.current.clientWidth;
    const videoWidth = canvasRef.current.width;
    return videoWidth / displayWidth;
  }, []);

  // Handle mouse/touch events for dragging circle
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const distFromCenter = Math.sqrt(
      Math.pow(x - circlePosition.x, 2) + Math.pow(y - circlePosition.y, 2)
    );

    // Check if clicking on the resize handle (outer edge)
    if (Math.abs(distFromCenter - circleRadius) < 15) {
      setIsResizing(true);
    } else if (distFromCenter < circleRadius) {
      // Clicking inside circle - drag
      setIsDragging(true);
      setDragOffset({ x: x - circlePosition.x, y: y - circlePosition.y });
    }
  }, [circlePosition, circleRadius]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging) {
      setCirclePosition({
        x: x - dragOffset.x,
        y: y - dragOffset.y,
      });
    } else if (isResizing) {
      const newRadius = Math.sqrt(
        Math.pow(x - circlePosition.x, 2) + Math.pow(y - circlePosition.y, 2)
      );
      setCircleRadius(Math.max(10, Math.min(150, newRadius)));
    }
  }, [isDragging, isResizing, dragOffset, circlePosition]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  // Calculate pixels per meter and complete calibration
  const handleComplete = () => {
    if (!videoRef.current) return;

    const scale = getScaleFactor();
    const actualRadius = circleRadius * scale;
    const actualDiameter = actualRadius * 2;
    
    const pixelsPerMeter = actualDiameter / SLEEVE_DIAMETER_METERS;

    onCalibrationComplete(
      pixelsPerMeter,
      {
        x: circlePosition.x * scale,
        y: circlePosition.y * scale,
      },
      actualRadius,
      videoRef.current
    );
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h2 className="text-lg font-medium text-foreground mb-1">Calibrate Reference</h2>
        <p className="text-muted-foreground text-sm">
          Match the circle to the barbell sleeve cap (50mm)
        </p>
      </div>

      {/* Video Frame with Circle Overlay */}
      <div 
        ref={containerRef}
        className="relative bg-black rounded-lg overflow-hidden cursor-crosshair touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <video ref={videoRef} className="hidden" playsInline muted />
        <canvas 
          ref={canvasRef} 
          className="w-full h-auto"
          style={{ display: isVideoReady ? 'block' : 'none' }}
        />
        
        {!isVideoReady && (
          <div className="aspect-video flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-border border-t-tool-red rounded-full animate-spin" />
          </div>
        )}

        {isVideoReady && (
          <>
            {/* Draggable Circle */}
            <div
              className={`absolute border-2 rounded-full pointer-events-none transition-colors ${
                isDragging || isResizing ? 'border-tool-red' : 'border-tool-red/70'
              }`}
              style={{
                left: circlePosition.x - circleRadius,
                top: circlePosition.y - circleRadius,
                width: circleRadius * 2,
                height: circleRadius * 2,
                boxShadow: '0 0 0 1px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(0,0,0,0.5)',
              }}
            >
              {/* Center point */}
              <div 
                className="absolute w-2 h-2 bg-tool-red rounded-full"
                style={{
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              />
              
              {/* Resize handles */}
              <div className="absolute -right-1.5 top-1/2 w-3 h-3 bg-tool-red rounded-full -translate-y-1/2" />
              <div className="absolute -left-1.5 top-1/2 w-3 h-3 bg-tool-red rounded-full -translate-y-1/2" />
              <div className="absolute left-1/2 -top-1.5 w-3 h-3 bg-tool-red rounded-full -translate-x-1/2" />
              <div className="absolute left-1/2 -bottom-1.5 w-3 h-3 bg-tool-red rounded-full -translate-x-1/2" />
            </div>
          </>
        )}
      </div>

      <p className="text-muted-foreground text-xs text-center">
        Drag to move • Drag edges to resize
      </p>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          onClick={onBack}
          className="flex-1 border-border"
        >
          Back
        </Button>
        <Button
          onClick={handleComplete}
          disabled={!isVideoReady}
          className="flex-1 bg-tool-red hover:bg-tool-red/90 text-white"
        >
          <Check className="w-4 h-4 mr-2" />
          Confirm
        </Button>
      </div>
    </div>
  );
}
