// Physics calculations for barbell velocity and force analysis

// ============================================
// CONFIGURABLE CONSTANTS
// ============================================

/**
 * Peak Force Window Size (in milliseconds)
 * Used for rolling average when calculating peak force to avoid noise spikes.
 * Recommended values: 50ms - 150ms
 */
export const PEAK_FORCE_WINDOW_MS = 100;

/**
 * Position Smoothing Window (in milliseconds)
 * Applied to raw position data before deriving velocity.
 * Larger values = smoother but less responsive.
 */
export const POSITION_SMOOTHING_MS = 100;

/**
 * Velocity Smoothing Window (in milliseconds)
 * Applied to velocity before deriving acceleration.
 */
export const VELOCITY_SMOOTHING_MS = 100;

/**
 * Acceleration Smoothing Window (in milliseconds)
 * Applied to acceleration before calculating force.
 * Critical for avoiding force spikes from tracking noise.
 */
export const ACCELERATION_SMOOTHING_MS = 100;

// ============================================
// TYPE DEFINITIONS
// ============================================

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
  smoothedForce?: number; // Newtons (time-windowed average)
}

export interface AnalysisResult {
  meanVelocity: number;
  peakForce: number;
  velocityDataArray: ProcessedFrame[];
}

/**
 * Apply time-based moving average filter to smooth noisy data
 * Uses time window (ms) instead of frame count for consistency across frame rates
 */
export function timeBasedMovingAverage(
  data: { time: number; value: number }[],
  windowMs: number
): number[] {
  const windowSeconds = windowMs / 1000;
  const halfWindow = windowSeconds / 2;
  
  return data.map((point) => {
    const windowStart = point.time - halfWindow;
    const windowEnd = point.time + halfWindow;
    
    let sum = 0;
    let count = 0;
    
    for (const p of data) {
      if (p.time >= windowStart && p.time <= windowEnd) {
        sum += p.value;
        count++;
      }
    }
    
    return count > 0 ? sum / count : point.value;
  });
}

/**
 * Apply frame-based moving average filter (legacy, used as fallback)
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
 * Apply time-based rolling average to force data
 * This helps avoid noise spikes when calculating peak force
 * @param forceData - Array of processed frames with force values
 * @param windowMs - Window size in milliseconds (default: PEAK_FORCE_WINDOW_MS)
 */
export function applyForceRollingAverage(
  forceData: ProcessedFrame[],
  windowMs: number = PEAK_FORCE_WINDOW_MS
): ProcessedFrame[] {
  const windowSeconds = windowMs / 1000;
  const halfWindow = windowSeconds / 2;
  
  return forceData.map((point, i) => {
    // Find all points within the time window centered on current point
    const windowStart = point.time - halfWindow;
    const windowEnd = point.time + halfWindow;
    
    let sum = 0;
    let count = 0;
    
    for (let j = 0; j < forceData.length; j++) {
      if (forceData[j].time >= windowStart && forceData[j].time <= windowEnd) {
        sum += forceData[j].force;
        count++;
      }
    }
    
    return {
      ...point,
      smoothedForce: count > 0 ? sum / count : point.force,
    };
  });
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
 * Full processing pipeline with time-based smoothing
 * Applies smoothing at each derivative stage to minimize noise amplification
 */
export function processTrackingData(
  trackingPoints: TrackingPoint[],
  pixelsPerMeter: number,
  mass: number,
  _smoothingWindow: number = 5 // Deprecated, using time-based constants instead
): ProcessedFrame[] {
  if (trackingPoints.length < 3) {
    return [];
  }
  
  // Convert to meters
  const metersData = pixelsToMeters(trackingPoints, pixelsPerMeter);
  
  // Step 1: Smooth Y coordinates (position) using time-based window
  const positionForSmoothing = metersData.map(p => ({ time: p.time, value: p.y }));
  const smoothedY = timeBasedMovingAverage(positionForSmoothing, POSITION_SMOOTHING_MS);
  
  const smoothedPositionData = metersData.map((p, i) => ({
    ...p,
    y: smoothedY[i],
  }));
  
  // Step 2: Calculate velocity from smoothed position
  const velocityData = calculateVelocity(smoothedPositionData);
  
  // Step 3: Smooth velocity using time-based window
  const velocityForSmoothing = velocityData.map(p => ({ time: p.time, value: p.velocity }));
  const smoothedVelocity = timeBasedMovingAverage(velocityForSmoothing, VELOCITY_SMOOTHING_MS);
  
  const smoothedVelocityData = velocityData.map((p, i) => ({
    ...p,
    velocity: smoothedVelocity[i],
  }));
  
  // Step 4: Calculate acceleration from smoothed velocity
  const accelerationData = calculateAcceleration(smoothedVelocityData);
  
  // Step 5: Smooth acceleration using time-based window (CRITICAL for force accuracy)
  const accelerationForSmoothing = accelerationData.map(p => ({ time: p.time, value: p.acceleration }));
  const smoothedAcceleration = timeBasedMovingAverage(accelerationForSmoothing, ACCELERATION_SMOOTHING_MS);
  
  const smoothedAccelerationData = accelerationData.map((p, i) => ({
    ...p,
    acceleration: smoothedAcceleration[i],
  }));
  
  // Step 6: Calculate force from smoothed acceleration
  const forceData = calculateForce(smoothedAccelerationData, mass);
  
  // Step 7: Apply additional rolling average to force for peak calculation
  const forceDataWithSmoothing = applyForceRollingAverage(forceData);
  
  return forceDataWithSmoothing;
}

/**
 * Calculate analysis metrics from processed data within a time range
 * Peak force uses the smoothedForce (time-windowed rolling average) to avoid noise spikes
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
  
  // Use smoothedForce (rolling average) for peak force to avoid noise spikes
  // Falls back to raw force if smoothedForce not available
  const peakForce = Math.max(
    ...filteredData.map(p => p.smoothedForce ?? p.force)
  );
  
  return { meanVelocity, peakForce };
}
