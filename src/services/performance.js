const { updateTurn, updateCall } = require('./db');

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
  }

  // Start tracking metrics for a turn
  startTurn(turnId, callId) {
    this.metrics.set(turnId, {
      callId,
      turnId,
      startTime: Date.now(),
      phases: {},
      completed: false
    });
  }

  // Record phase timing
  recordPhase(turnId, phase, startTime, endTime = Date.now()) {
    const metrics = this.metrics.get(turnId);
    if (!metrics) return;

    metrics.phases[phase] = {
      duration: endTime - startTime,
      timestamp: endTime
    };
  }

  // Complete turn and log to database
  async completeTurn(turnId) {
    const metrics = this.metrics.get(turnId);
    if (!metrics || metrics.completed) return;

    metrics.completed = true;
    metrics.totalDuration = Date.now() - metrics.startTime;

    // Log performance metrics
    console.log(`Turn ${turnId} performance:`, {
      total: metrics.totalDuration,
      phases: Object.fromEntries(
        Object.entries(metrics.phases).map(([phase, data]) => [phase, data.duration])
      )
    });

    // Update database with timing data
    try {
      const updateData = {};
      
      if (metrics.phases.stt) updateData.asrMs = metrics.phases.stt.duration;
      if (metrics.phases.llm) updateData.llmMs = metrics.phases.llm.duration;  
      if (metrics.phases.tts) updateData.ttsMs = metrics.phases.tts.duration;

      if (Object.keys(updateData).length > 0) {
        await updateTurn(turnId, updateData);
      }

      // Update call with latest performance data
      if (metrics.callId) {
        await updateCall(metrics.callId, {
          metadata: {
            lastTurnMetrics: {
              total: metrics.totalDuration,
              phases: metrics.phases
            },
            performanceTarget: metrics.totalDuration < 1500 ? 'met' : 'exceeded'
          }
        });
      }

    } catch (error) {
      console.error('Failed to log performance metrics:', error);
    }

    // Clean up
    this.metrics.delete(turnId);
  }

  // Get current metrics for a turn
  getTurnMetrics(turnId) {
    return this.metrics.get(turnId);
  }

  // Get aggregated performance stats
  getPerformanceStats() {
    const activeMetrics = Array.from(this.metrics.values());
    
    return {
      activeTurns: activeMetrics.length,
      averageProcessingTime: activeMetrics.length > 0 
        ? activeMetrics.reduce((sum, m) => sum + (Date.now() - m.startTime), 0) / activeMetrics.length
        : 0,
      phaseBreakdown: this.calculatePhaseBreakdown(activeMetrics)
    };
  }

  calculatePhaseBreakdown(metrics) {
    const phaseStats = {};
    
    metrics.forEach(metric => {
      Object.entries(metric.phases).forEach(([phase, data]) => {
        if (!phaseStats[phase]) {
          phaseStats[phase] = { total: 0, count: 0, avg: 0 };
        }
        phaseStats[phase].total += data.duration;
        phaseStats[phase].count += 1;
        phaseStats[phase].avg = phaseStats[phase].total / phaseStats[phase].count;
      });
    });

    return phaseStats;
  }

  // Helper method to check if response time target is met
  isTargetMet(totalDuration) {
    return totalDuration < 1500; // Target: <1.5s end-to-end
  }

  // Export metrics for external monitoring
  exportMetrics() {
    return {
      timestamp: Date.now(),
      performanceStats: this.getPerformanceStats(),
      targetLatency: 1500,
      activeMetrics: this.metrics.size
    };
  }
}

// Singleton instance
const performanceMonitor = new PerformanceMonitor();

module.exports = {
  PerformanceMonitor,
  performanceMonitor
};