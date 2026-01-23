import { useState, useCallback } from 'react';
import { UploadState } from './UploadState';
import { CalibrationState } from './CalibrationState';
import { TrackingState } from './TrackingState';
import { ReviewState } from './ReviewState';
import {
  processTrackingData,
  type TrackingPoint,
  type ProcessedFrame,
  type AnalysisResult,
} from '@/lib/barbell-physics';

type TrackerState = 'upload' | 'calibration' | 'tracking' | 'review';

interface BarbellTrackerProps {
  mass: number;
  onAnalysisComplete?: (result: AnalysisResult) => void;
}

export function BarbellTracker({ mass, onAnalysisComplete }: BarbellTrackerProps) {
  const [state, setState] = useState<TrackerState>('upload');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [calibration, setCalibration] = useState<{
    pixelsPerMeter: number;
    circleCenter: { x: number; y: number };
    circleRadius: number;
  } | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedFrame[]>([]);

  // Handle video upload
  const handleVideoSelected = useCallback((file: File) => {
    setVideoFile(file);
    setState('calibration');
  }, []);

  // Handle calibration complete
  const handleCalibrationComplete = useCallback((
    pixelsPerMeter: number,
    circleCenter: { x: number; y: number },
    circleRadius: number,
    video: HTMLVideoElement
  ) => {
    setCalibration({ pixelsPerMeter, circleCenter, circleRadius });
    setVideoElement(video);
    setState('tracking');
  }, []);

  // Handle tracking complete
  const handleTrackingComplete = useCallback((trackingPoints: TrackingPoint[]) => {
    if (!calibration) return;

    // Process the tracking data
    const processed = processTrackingData(
      trackingPoints,
      calibration.pixelsPerMeter,
      mass,
      5 // Smoothing window
    );

    setProcessedData(processed);
    setState('review');
  }, [calibration, mass]);

  // Handle save
  const handleSave = useCallback((result: AnalysisResult) => {
    onAnalysisComplete?.(result);
  }, [onAnalysisComplete]);

  // Handle reset
  const handleReset = useCallback(() => {
    setVideoFile(null);
    setVideoElement(null);
    setCalibration(null);
    setProcessedData([]);
    setState('upload');
  }, []);

  // Handle back navigation
  const handleBack = useCallback((targetState: TrackerState) => {
    setState(targetState);
  }, []);

  return (
    <div className="w-full">
      {state === 'upload' && (
        <UploadState onVideoSelected={handleVideoSelected} />
      )}

      {state === 'calibration' && videoFile && (
        <CalibrationState
          videoFile={videoFile}
          onCalibrationComplete={handleCalibrationComplete}
          onBack={() => handleBack('upload')}
        />
      )}

      {state === 'tracking' && videoElement && calibration && (
        <TrackingState
          videoElement={videoElement}
          circleCenter={calibration.circleCenter}
          circleRadius={calibration.circleRadius}
          onTrackingComplete={handleTrackingComplete}
          onBack={() => handleBack('calibration')}
        />
      )}

      {state === 'review' && (
        <ReviewState
          processedData={processedData}
          mass={mass}
          onSave={handleSave}
          onReset={handleReset}
        />
      )}
    </div>
  );
}
