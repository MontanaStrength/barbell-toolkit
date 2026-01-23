import { useState, useEffect, useCallback } from 'react';

declare global {
  interface Window {
    cv: any;
    Module: any;
  }
}

export function useOpenCV() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOpenCV = useCallback(() => {
    if (window.cv) {
      setIsLoaded(true);
      return;
    }

    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.x/opencv.js';
    script.async = true;

    script.onload = () => {
      // OpenCV.js uses Module.onRuntimeInitialized
      if (window.cv && window.cv.Mat) {
        setIsLoaded(true);
        setIsLoading(false);
      } else {
        // Wait for OpenCV to initialize
        const checkInterval = setInterval(() => {
          if (window.cv && window.cv.Mat) {
            setIsLoaded(true);
            setIsLoading(false);
            clearInterval(checkInterval);
          }
        }, 100);

        // Timeout after 30 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          if (!isLoaded) {
            setError('OpenCV initialization timed out');
            setIsLoading(false);
          }
        }, 30000);
      }
    };

    script.onerror = () => {
      setError('Failed to load OpenCV.js');
      setIsLoading(false);
    };

    document.head.appendChild(script);
  }, [isLoaded, isLoading]);

  useEffect(() => {
    loadOpenCV();
  }, [loadOpenCV]);

  return { isLoaded, isLoading, error, cv: window.cv };
}

export interface TrackingResult {
  x: number;
  y: number;
  found: boolean;
}

/**
 * Simple circle/blob tracker using color-based tracking
 * Tracks a region of interest based on initial selection
 */
export class SimpleTracker {
  private cv: any;
  private templateHist: any = null;
  private lastPosition: { x: number; y: number } | null = null;
  private searchRadius: number = 100;

  constructor(cv: any) {
    this.cv = cv;
  }

  /**
   * Initialize tracker with the first frame and ROI
   */
  initialize(
    frame: HTMLCanvasElement | HTMLVideoElement,
    centerX: number,
    centerY: number,
    radius: number
  ): void {
    const cv = this.cv;
    
    // Create Mat from frame
    const src = cv.imread(frame);
    const hsv = new cv.Mat();
    cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
    cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

    // Create mask for ROI (circular region)
    const mask = new cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
    const center = new cv.Point(centerX, centerY);
    cv.circle(mask, center, radius, new cv.Scalar(255), -1);

    // Calculate histogram of the ROI
    const hsvPlanes = new cv.MatVector();
    cv.split(hsv, hsvPlanes);
    
    const hue = hsvPlanes.get(0);
    this.templateHist = new cv.Mat();
    
    const histSize = [180];
    const ranges = [0, 180];
    
    cv.calcHist(
      new cv.MatVector().push_back(hue),
      [0],
      mask,
      this.templateHist,
      histSize,
      ranges
    );
    
    cv.normalize(this.templateHist, this.templateHist, 0, 255, cv.NORM_MINMAX);
    
    this.lastPosition = { x: centerX, y: centerY };
    this.searchRadius = radius * 3;

    // Cleanup
    src.delete();
    hsv.delete();
    mask.delete();
    hsvPlanes.delete();
    hue.delete();
  }

  /**
   * Track in the current frame using CAMShift
   */
  track(frame: HTMLCanvasElement | HTMLVideoElement): TrackingResult {
    if (!this.templateHist || !this.lastPosition) {
      return { x: 0, y: 0, found: false };
    }

    const cv = this.cv;
    
    try {
      const src = cv.imread(frame);
      const hsv = new cv.Mat();
      cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
      cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

      // Calculate back projection
      const hsvPlanes = new cv.MatVector();
      cv.split(hsv, hsvPlanes);
      const hue = hsvPlanes.get(0);
      
      const backProj = new cv.Mat();
      cv.calcBackProject(
        new cv.MatVector().push_back(hue),
        [0],
        this.templateHist,
        backProj,
        [0, 180],
        1
      );

      // Define search window around last position
      const trackWindow = new cv.Rect(
        Math.max(0, this.lastPosition.x - this.searchRadius),
        Math.max(0, this.lastPosition.y - this.searchRadius),
        this.searchRadius * 2,
        this.searchRadius * 2
      );

      // Apply meanShift
      const criteria = new cv.TermCriteria(
        cv.TermCriteria_EPS | cv.TermCriteria_COUNT,
        10,
        1
      );
      
      const [rotatedRect, window] = cv.CamShift(backProj, trackWindow, criteria);
      
      const newX = rotatedRect.center.x;
      const newY = rotatedRect.center.y;
      
      this.lastPosition = { x: newX, y: newY };

      // Cleanup
      src.delete();
      hsv.delete();
      hsvPlanes.delete();
      hue.delete();
      backProj.delete();

      return { x: newX, y: newY, found: true };
    } catch (e) {
      console.error('Tracking error:', e);
      return { x: this.lastPosition?.x || 0, y: this.lastPosition?.y || 0, found: false };
    }
  }

  /**
   * Release resources
   */
  destroy(): void {
    if (this.templateHist) {
      this.templateHist.delete();
      this.templateHist = null;
    }
    this.lastPosition = null;
  }
}
