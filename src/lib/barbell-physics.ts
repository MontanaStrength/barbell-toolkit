// Physics calculations for barbell velocity and force analysis

export interface TrackingPoint {
  x: number;
  y: number;
  time: number; // in seconds
}

export interface ProcessedFrame {
  time: number;
  y: number; // in meters
  velocity: number; // m/s
  acceleration: number; // m/s²
  force: number; // Newtons
}

export interface AnalysisResult {
  meanVelocity: number;
  peakForce: number;
  velocityDataArray: ProcessedFrame[];
}

/**
 * Apply moving average filter to smooth noisy data
 */
export function movingAverageFilter(data: number[], windowSize: number = 5): number[] {
  const result: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let i = 0; i < data.length; i++) {
    let sum = 0;
    let count = 0;
    
    for (let j = Math.max(0, i - halfWindow); j <= Math.min(data.length - 1, i + halfWindow); j++) {
      sum += data[j];
      count++;
    }
    
    result.push(sum / count);
  }
  
  return result;
}

/**
 * Convert pixel coordinates to meters using calibration data
 */
export function pixelsToMeters(
  trackingPoints: TrackingPoint[],
  pixelsPerMeter: number
): { time: number; y: number }[] {
  return trackingPoints.map(point => ({
    time: point.time,
    y: point.y / pixelsPerMeter,
  }));
}

/**
 * Calculate velocity from position data using central difference
 */
export function calculateVelocity(
  positions: { time: number; y: number }[]
): { time: number; y: number; velocity: number }[] {
  const result: { time: number; y: number; velocity: number }[] = [];
  
  for (let i = 0; i < positions.length; i++) {
    let velocity = 0;
    
    if (i === 0) {
      // Forward difference for first point
      const dt = positions[i + 1].time - positions[i].time;
      velocity = dt > 0 ? (positions[i].y - positions[i + 1].y) / dt : 0;
    } else if (i === positions.length - 1) {
      // Backward difference for last point
      const dt = positions[i].time - positions[i - 1].time;
      velocity = dt > 0 ? (positions[i - 1].y - positions[i].y) / dt : 0;
    } else {
      // Central difference for middle points
      const dt = positions[i + 1].time - positions[i - 1].time;
      velocity = dt > 0 ? (positions[i - 1].y - positions[i + 1].y) / dt : 0;
    }
    
    result.push({
      time: positions[i].time,
      y: positions[i].y,
      velocity,
    });
  }
  
  return result;
}

/**
 * Calculate acceleration from velocity data
 */
export function calculateAcceleration(
  velocityData: { time: number; y: number; velocity: number }[]
): { time: number; y: number; velocity: number; acceleration: number }[] {
  const result: { time: number; y: number; velocity: number; acceleration: number }[] = [];
  
  for (let i = 0; i < velocityData.length; i++) {
    let acceleration = 0;
    
    if (i === 0 && velocityData.length > 1) {
      const dt = velocityData[i + 1].time - velocityData[i].time;
      acceleration = dt > 0 ? (velocityData[i + 1].velocity - velocityData[i].velocity) / dt : 0;
    } else if (i === velocityData.length - 1) {
      const dt = velocityData[i].time - velocityData[i - 1].time;
      acceleration = dt > 0 ? (velocityData[i].velocity - velocityData[i - 1].velocity) / dt : 0;
    } else {
      const dt = velocityData[i + 1].time - velocityData[i - 1].time;
      acceleration = dt > 0 ? (velocityData[i + 1].velocity - velocityData[i - 1].velocity) / dt : 0;
    }
    
    result.push({
      ...velocityData[i],
      acceleration,
    });
  }
  
  return result;
}

/**
 * Calculate force from acceleration data
 * Force = mass * (acceleration + gravity)
 */
export function calculateForce(
  accelerationData: { time: number; y: number; velocity: number; acceleration: number }[],
  mass: number
): ProcessedFrame[] {
  const GRAVITY = 9.81; // m/s²
  
  return accelerationData.map(point => ({
    ...point,
    force: mass * (point.acceleration + GRAVITY),
  }));
}

/**
 * Detect concentric phase (upward movement with positive velocity)
 * Returns indices of frames that are part of the concentric phase
 */
export function detectConcentricPhase(
  processedData: ProcessedFrame[],
  velocityThreshold: number = 0.05 // m/s
): { startIndex: number; endIndex: number }[] {
  const phases: { startIndex: number; endIndex: number }[] = [];
  let inPhase = false;
  let startIndex = 0;
  
  for (let i = 0; i < processedData.length; i++) {
    const isPositiveVelocity = processedData[i].velocity > velocityThreshold;
    
    if (isPositiveVelocity && !inPhase) {
      inPhase = true;
      startIndex = i;
    } else if (!isPositiveVelocity && inPhase) {
      inPhase = false;
      phases.push({ startIndex, endIndex: i - 1 });
    }
  }
  
  // Handle case where phase extends to end
  if (inPhase) {
    phases.push({ startIndex, endIndex: processedData.length - 1 });
  }
  
  return phases;
}

/**
 * Full processing pipeline
 */
export function processTrackingData(
  trackingPoints: TrackingPoint[],
  pixelsPerMeter: number,
  mass: number,
  smoothingWindow: number = 5
): ProcessedFrame[] {
  if (trackingPoints.length < 3) {
    return [];
  }
  
  // Convert to meters
  const metersData = pixelsToMeters(trackingPoints, pixelsPerMeter);
  
  // Smooth Y coordinates
  const smoothedY = movingAverageFilter(
    metersData.map(p => p.y),
    smoothingWindow
  );
  
  const smoothedData = metersData.map((p, i) => ({
    ...p,
    y: smoothedY[i],
  }));
  
  // Calculate derivatives
  const velocityData = calculateVelocity(smoothedData);
  
  // Smooth velocity
  const smoothedVelocity = movingAverageFilter(
    velocityData.map(p => p.velocity),
    smoothingWindow
  );
  
  const smoothedVelocityData = velocityData.map((p, i) => ({
    ...p,
    velocity: smoothedVelocity[i],
  }));
  
  const accelerationData = calculateAcceleration(smoothedVelocityData);
  const forceData = calculateForce(accelerationData, mass);
  
  return forceData;
}

/**
 * Calculate analysis metrics from processed data within a time range
 */
export function calculateMetrics(
  processedData: ProcessedFrame[],
  startTime: number,
  endTime: number
): { meanVelocity: number; peakForce: number } {
  const filteredData = processedData.filter(
    p => p.time >= startTime && p.time <= endTime && p.velocity > 0
  );
  
  if (filteredData.length === 0) {
    return { meanVelocity: 0, peakForce: 0 };
  }
  
  const meanVelocity = filteredData.reduce((sum, p) => sum + p.velocity, 0) / filteredData.length;
  const peakForce = Math.max(...filteredData.map(p => p.force));
  
  return { meanVelocity, peakForce };
}
