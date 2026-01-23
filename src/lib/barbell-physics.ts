// Physics calculations for barbell velocity and force analysis
// Using Rolling Window smoothing algorithm for LDT-matching accuracy

// ============================================
// PHYSICS ENGINE CONSTANTS
// ============================================
const GRAVITY = 9.81; // m/s²
const SMOOTHING_WINDOW = 5; // Frames to smooth position (removes camera jitter)
const FORCE_WINDOW_MS = 100; // ms window to find "Peak Force" (prevents spikes)

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface TrackingPoint {
  x: number;
  y: number;
  time: number; // in seconds (will be converted from ms if needed)
}

export interface ProcessedFrame {
  time: number;
  y: number; // in meters (position)
  velocity: number; // m/s
  acceleration: number; // m/s²
  force: number; // Newtons
  smoothedForce?: number; // Newtons (for compatibility)
}

export interface RepMetrics {
  repNumber: number;
  startTime: number;
  endTime: number;
  meanVelocity: number;
  peakVelocity: number;
  peakForce: number; // in Newtons
}

export interface AnalysisResult {
  meanVelocity: number;
  peakForce: number;
  velocityDataArray: ProcessedFrame[];
  reps: RepMetrics[];
}

// ============================================
// CORE ANALYSIS FUNCTION (Rolling Window Algorithm)
// ============================================

/**
 * Core analysis function to convert raw pixels to physics data
 * Uses Rolling Window smoothing for LDT-matching accuracy
 */
export function processTrackingData(
  trackingPoints: TrackingPoint[],
  pixelsPerMeter: number,
  mass: number,
  _smoothingWindow: number = 5 // Kept for API compatibility
): ProcessedFrame[] {
  if (trackingPoints.length < 10) return [];

  // Convert TrackingPoints to the format expected by the algorithm
  // Note: TrackingPoint.time is in seconds, we work in seconds throughout
  const rawTrace = trackingPoints.map(p => ({
    x: p.x,
    y: p.y,
    timestamp: p.time * 1000 // Convert to ms for algorithm
  }));

  // 1. Convert Pixels to Meters (Invert Y because screen Y goes down)
  const maxY = Math.max(...rawTrace.map(t => t.y));
  const metersTrace = rawTrace.map(p => ({
    time: p.timestamp / 1000, // seconds
    pos: (maxY - p.y) / pixelsPerMeter
  }));

  // 2. SMOOTHING (Moving Average)
  // Essential for "Speed Reps" where 30fps video is noisy
  const smoothed = metersTrace.map((p, i, arr) => {
    const start = Math.max(0, i - Math.floor(SMOOTHING_WINDOW / 2));
    const end = Math.min(arr.length, i + Math.floor(SMOOTHING_WINDOW / 2) + 1);
    const window = arr.slice(start, end);
    const avgPos = window.reduce((sum, item) => sum + item.pos, 0) / window.length;
    return { ...p, pos: avgPos };
  });

  // 3. DERIVATIVES (Velocity & Acceleration)
  // Track previous velocity for acceleration calculation
  let prevVel = 0;
  
  const physicsData: ProcessedFrame[] = smoothed.map((p, i, arr) => {
    if (i === 0) {
      return { 
        time: p.time, 
        y: p.pos, 
        velocity: 0, 
        acceleration: 0, 
        force: mass * GRAVITY,
        smoothedForce: mass * GRAVITY
      };
    }
    
    const dt = p.time - arr[i - 1].time || 0.033; // Prevent div by zero
    const vel = (p.pos - arr[i - 1].pos) / dt;
    const acc = (vel - prevVel) / dt;
    
    // F = ma + mg
    const force = mass * (acc + GRAVITY);
    
    prevVel = vel;
    
    return { 
      time: p.time, 
      y: p.pos, 
      velocity: vel, 
      acceleration: acc, 
      force,
      smoothedForce: force // Will be updated below
    };
  });

  // Apply rolling average to force for smoothedForce
  const framesInWindow = Math.max(1, Math.floor(FORCE_WINDOW_MS / 33)); // approx 3 frames at 30fps
  
  for (let i = 0; i < physicsData.length; i++) {
    const start = Math.max(0, i - framesInWindow + 1);
    const window = physicsData.slice(start, i + 1);
    const avgForce = window.reduce((sum, f) => sum + f.force, 0) / window.length;
    physicsData[i].smoothedForce = avgForce;
  }

  return physicsData;
}

// ============================================
// REP DETECTION (Velocity-based)
// ============================================

/**
 * Detect individual repetitions based on velocity patterns
 * Detects concentric phase (velocity > 0.1 m/s)
 */
export function detectRepetitions(
  processedData: ProcessedFrame[],
  velocityThreshold: number = 0.1, // m/s - threshold for detecting rep start
  _minRepDurationMs: number = 150 // Kept for API compatibility
): { startIndex: number; endIndex: number }[] {
  if (processedData.length < 2) return [];

  const reps: { startIndex: number; endIndex: number }[] = [];
  let inRep = false;
  let repStartIndex = 0;

  processedData.forEach((d, i) => {
    // Threshold: 0.1 m/s to filter out "unracking" noise
    if (d.velocity > velocityThreshold) {
      if (!inRep) {
        inRep = true;
        repStartIndex = i;
      }
    } else if (inRep && d.velocity < 0.05) {
      // Rep Finished
      inRep = false;
      
      // Only count reps with significant samples (> 5 frames)
      if (i - repStartIndex > 5) {
        reps.push({ startIndex: repStartIndex, endIndex: i - 1 });
      }
    }
  });

  // Handle case where last rep extends to end
  if (inRep && processedData.length - repStartIndex > 5) {
    reps.push({ startIndex: repStartIndex, endIndex: processedData.length - 1 });
  }

  return reps;
}

/**
 * Calculate metrics for each detected repetition
 * Uses rolling peak force calculation (LDT simulation)
 */
export function calculateRepMetrics(
  processedData: ProcessedFrame[],
  reps: { startIndex: number; endIndex: number }[]
): RepMetrics[] {
  const framesInWindow = Math.max(1, Math.floor(FORCE_WINDOW_MS / 33)); // approx 3 frames at 30fps
  
  return reps.map((rep, index) => {
    const repData = processedData.slice(rep.startIndex, rep.endIndex + 1);
    
    if (repData.length === 0) {
      return {
        repNumber: index + 1,
        startTime: 0,
        endTime: 0,
        meanVelocity: 0,
        peakVelocity: 0,
        peakForce: 0,
      };
    }
    
    const startTime = repData[0].time;
    const endTime = repData[repData.length - 1].time;
    
    // Calculate mean velocity from all samples
    const velSamples = repData.map(p => p.velocity);
    const meanVelocity = velSamples.reduce((a, b) => a + b, 0) / velSamples.length;
    const peakVelocity = Math.max(...velSamples);
    
    // CALCULATE ROLLING PEAK FORCE (The LDT Simulation)
    // Look at the last N frames to find a sustained peak, not a spike
    let maxForce = 0;
    const forceSamples: number[] = [];
    
    for (const frame of repData) {
      forceSamples.push(frame.force);
      
      if (forceSamples.length >= framesInWindow) {
        const recentForce = forceSamples.slice(-framesInWindow);
        const avgRecentForce = recentForce.reduce((a, b) => a + b, 0) / recentForce.length;
        if (avgRecentForce > maxForce) {
          maxForce = avgRecentForce;
        }
      }
    }
    
    // Fallback if we didn't have enough frames for the rolling window
    if (maxForce === 0 && forceSamples.length > 0) {
      maxForce = forceSamples.reduce((a, b) => a + b, 0) / forceSamples.length;
    }
    
    return {
      repNumber: index + 1,
      startTime,
      endTime,
      meanVelocity,
      peakVelocity,
      peakForce: maxForce,
    };
  });
}

// ============================================
// HELPER FUNCTIONS (for compatibility)
// ============================================

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
  
  // Use smoothedForce for peak force
  const peakForce = Math.max(
    ...filteredData.map(p => p.smoothedForce ?? p.force)
  );
  
  return { meanVelocity, peakForce };
}

/**
 * Detect concentric phase (upward movement with positive velocity)
 * Returns indices of frames that are part of the concentric phase
 */
export function detectConcentricPhase(
  processedData: ProcessedFrame[],
  velocityThreshold: number = 0.05
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
  
  if (inPhase) {
    phases.push({ startIndex, endIndex: processedData.length - 1 });
  }
  
  return phases;
}
