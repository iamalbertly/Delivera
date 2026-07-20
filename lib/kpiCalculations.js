/**
 * KPI calculation functions for agile maturity analysis
 */

/**
 * Calculates work days (business days) between two dates, excluding weekends
 * and optionally public holidays.
 * @param {string|Date} startDate - Start date (ISO string or Date object)
 * @param {string|Date} endDate - End date (ISO string or Date object)
 * @param {string[]} [holidays=[]] - Optional array of ISO date strings (YYYY-MM-DD) to exclude
 * @returns {number} Number of work days (excluding weekends + holidays)
 */
export function calculateWorkDays(startDate, endDate, holidays = []) {
  if (!startDate || !endDate) return '';
  
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return '';
    }
    
    // Swap if end is before start
    if (end < start) {
      return 0;
    }

    const holidaySet = Array.isArray(holidays) && holidays.length
      ? new Set(holidays.map((d) => String(d).slice(0, 10)))
      : null;
    
    let count = 0;
    const current = new Date(start);
    
    while (current <= end) {
      const dayOfWeek = current.getDay();
      // Count only weekdays (Monday=1 to Friday=5)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const isoDate = current.toISOString().slice(0, 10);
        if (!holidaySet || !holidaySet.has(isoDate)) {
          count++;
        }
      }
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  } catch (error) {
    return '';
  }
}

/**
 * Calculates cycle time (work days from created to resolved)
 * @param {string|Date} createdDate - Created date
 * @param {string|Date} resolvedDate - Resolution date
 * @returns {number} Cycle time in work days
 */
export function calculateCycleTime(createdDate, resolvedDate) {
  return calculateWorkDays(createdDate, resolvedDate);
}

/**
 * Calculates lead time (work days from epic start to last story done)
 * @param {string|Date} epicStartDate - Epic start date
 * @param {string|Date} lastStoryDate - Last story completion date
 * @returns {number} Lead time in work days
 */
export function calculateLeadTime(epicStartDate, lastStoryDate) {
  return calculateWorkDays(epicStartDate, lastStoryDate);
}

/**
 * Calculates velocity trend (SP per sprint compared to previous sprint)
 * @param {number} currentSP - Current sprint story points
 * @param {number} previousSP - Previous sprint story points
 * @returns {string} Trend indicator: "↑", "↓", "→", or empty if no previous data
 */
export function calculateVelocityTrend(currentSP, previousSP) {
  if (previousSP === undefined || previousSP === null || previousSP === 0) {
    return '';
  }
  
  if (currentSP > previousSP) {
    return '↑';
  } else if (currentSP < previousSP) {
    return '↓';
  } else {
    return '→';
  }
}

/**
 * Calculates predictability score (committed vs delivered percentage)
 * @param {number} committed - Committed stories/SP
 * @param {number} delivered - Delivered stories/SP
 * @returns {number} Predictability percentage (0-100)
 */
export function calculatePredictabilityScore(committed, delivered) {
  if (!committed || committed === 0) {
    return 0;
  }
  
  return Math.round((delivered / committed) * 100);
}

/**
 * Calculates rework ratio (bug SP / total SP percentage)
 * @param {number} bugSP - Bug story points
 * @param {number} totalSP - Total story points (bug + story)
 * @returns {number} Rework ratio percentage (0-100)
 */
export function calculateReworkRatio(bugSP, totalSP) {
  if (!totalSP || totalSP === 0) {
    return 0;
  }
  
  return parseFloat(((bugSP / totalSP) * 100).toFixed(2));
}

/**
 * Calculates raw maturity score (0-100) from predictability, consistency, rework
 * @param {number} predictability - Predictability score (0-100)
 * @param {number} velocityConsistency - Velocity consistency score (0-100)
 * @param {number} reworkRatio - Rework ratio (0-100)
 * @returns {number} Raw maturity score
 */
export function getMaturityScore(predictability, velocityConsistency, reworkRatio) {
  const pred = predictability || 0;
  const consistency = velocityConsistency || 0;
  const reworkScore = 100 - (reworkRatio || 0);
  return (pred * 0.4) + (consistency * 0.3) + (reworkScore * 0.3);
}

/**
 * Calculates agile maturity level (1-5 scale)
 * Based on predictability, velocity consistency, and rework ratio
 * @param {number} predictability - Predictability score (0-100)
 * @param {number} velocityConsistency - Velocity consistency score (0-100, calculated from variance)
 * @param {number} reworkRatio - Rework ratio (0-100)
 * @returns {number} Maturity level (1=immature, 5=mature)
 */
export function calculateMaturityLevel(predictability, velocityConsistency, reworkRatio) {
  const maturityScore = getMaturityScore(predictability, velocityConsistency, reworkRatio);
  if (maturityScore >= 80) return 5;
  if (maturityScore >= 65) return 4;
  if (maturityScore >= 50) return 3;
  if (maturityScore >= 35) return 2;
  return 1;
}

/**
 * Calculates velocity consistency score from array of sprint velocities
 * @param {number[]} velocities - Array of story points per sprint
 * @returns {number} Consistency score (0-100, higher = more consistent)
 */
export function calculateVelocityConsistency(velocities) {
  if (!velocities || velocities.length < 2) {
    return 0;
  }
  
  const mean = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;
  const variance = velocities.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / velocities.length;
  const stdDev = Math.sqrt(variance);
  
  // Lower coefficient of variation = higher consistency
  const coefficientOfVariation = mean > 0 ? stdDev / mean : 1;
  
  // Convert to 0-100 scale (inverse: lower CV = higher score)
  const consistencyScore = Math.max(0, 100 - (coefficientOfVariation * 100));
  
  return Math.round(consistencyScore);
}

/**
 * Adds KPI columns to a row based on all rows and metrics
 * @param {Object} row - Current row data
 * @param {Array} allRows - All rows for context
 * @param {Object} metrics - Calculated metrics
 * @returns {Object} Row with added KPI columns
 */
export function addKPIColumns(row, allRows, metrics) {
  const kpiRow = { ...row };
  
  // Work Days to Complete (created to resolved)
  kpiRow['Work Days to Complete'] = calculateWorkDays(row.created, row.resolutionDate);
  
  // Sprint Duration (Work Days)
  kpiRow['Sprint Duration (Work Days)'] = calculateWorkDays(row.sprintStartDate, row.sprintEndDate);
  
  // Cycle Time (Days)
  kpiRow['Cycle Time (Days)'] = calculateCycleTime(row.created, row.resolutionDate);
  
  // Days Since Created (to today)
  const today = new Date().toISOString().split('T')[0];
  kpiRow['Days Since Created'] = calculateWorkDays(row.created, today);
  
  // Velocity Trend (if metrics available)
  if (metrics && metrics.throughput && metrics.throughput.perSprint) {
    const sprintSP = metrics.throughput.perSprint[row.sprintId];
    // Would need previous sprint data for trend - simplified for now
    kpiRow['Velocity Trend'] = '';
  } else {
    kpiRow['Velocity Trend'] = '';
  }
  
  // Predictability Score (if metrics available)
  if (metrics && metrics.predictability && metrics.predictability.perSprint) {
    const sprintPredictability = metrics.predictability.perSprint[row.sprintId];
    if (sprintPredictability) {
      kpiRow['Predictability Score'] = sprintPredictability.predictabilitySP || 0;
    } else {
      kpiRow['Predictability Score'] = '';
    }
  } else {
    kpiRow['Predictability Score'] = '';
  }
  
  // Rework Ratio (from metrics)
  if (metrics && metrics.rework) {
    kpiRow['Rework Ratio'] = metrics.rework.reworkRatio || 0;
  } else {
    kpiRow['Rework Ratio'] = '';
  }
  
  // Agile Maturity Level (calculated from metrics)
  if (metrics) {
    const predictability = kpiRow['Predictability Score'] || 0;
    const velocities = metrics.throughput?.perSprint ? Object.values(metrics.throughput.perSprint).map(s => s.totalSP || 0) : [];
    const consistency = calculateVelocityConsistency(velocities);
    const reworkRatio = metrics.rework?.reworkRatio || 0;
    kpiRow['Agile Maturity Level'] = calculateMaturityLevel(predictability, consistency, reworkRatio);
  } else {
    kpiRow['Agile Maturity Level'] = '';
  }
  
  return kpiRow;
}
