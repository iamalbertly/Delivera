/**
 * Countdown Timer Component
 * Color-coded circular progress indicator for days remaining
 * Green: 5+ days, Yellow: 2-5 days, Red: 0-2 days (with pulsing animation)
 * Switches to hour countdown at < 48h
 * Rationale: Customer - Color triggers urgency response faster than text. Simplicity - Visual > numeric. Trust - Consistent color coding.
 */

export function renderCountdownTimer(data, options = {}) {
  const days = data.daysMeta || {};
  const sprint = data.sprint || {};
  const compact = options.compact !== false;

  const remainingDays = days.daysRemainingWorking != null ? days.daysRemainingWorking : days.daysRemainingCalendar;
  const sprintEndDate = sprint.endDate;

  // Determine color and label
  let color = 'green'; // 5+ days
  let label = '';
  let ariaLabel = '';
  let isUrgent = false;

  if (remainingDays == null) {
    label = '?';
    ariaLabel = 'Sprint end date unknown';
  } else if (remainingDays <= 0) {
    color = 'gray';
    label = '✓';
    ariaLabel = 'Sprint has ended';
  } else if (remainingDays < 0.5) {
    // Less than 12 hours
    color = 'red';
    label = '<1h';
    isUrgent = true;
    ariaLabel = 'Sprint ends in less than 1 hour';
  } else if (remainingDays < 1) {
    // Less than 24 hours
    color = 'red';
    const hours = Math.ceil(remainingDays * 24);
    label = hours + 'h';
    isUrgent = true;
    ariaLabel = 'Sprint ends in ' + hours + ' hours';
  } else if (remainingDays < 2) {
    // 1-2 days
    color = 'red';
    label = '1d';
    isUrgent = true;
    ariaLabel = 'Sprint ends in 1 day';
  } else if (remainingDays < 5) {
    // 2-5 days
    color = 'yellow';
    label = Math.floor(remainingDays) + 'd';
    ariaLabel = 'Sprint ends in ' + Math.floor(remainingDays) + ' days';
  } else {
    // 5+ days
    color = 'green';
    label = Math.floor(remainingDays) + 'd';
    ariaLabel = 'Sprint ends in ' + Math.floor(remainingDays) + ' days';
  }

  // Calculate percentage for progress ring - derive max from actual sprint dates
  let maxDays = 14;
  if (sprint.startDate && sprint.endDate) {
    const sprintMs = new Date(sprint.endDate).getTime() - new Date(sprint.startDate).getTime();
    if (sprintMs > 0) maxDays = Math.ceil(sprintMs / (1000 * 60 * 60 * 24));
  }
  const progressPercent = Math.min(100, Math.max(0, (remainingDays / maxDays) * 100));

  // SVG for circular progress
  const radius = compact ? 24 : 45;
  const size = compact ? 64 : 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  let html = '<div class="countdown-timer-widget' + (compact ? ' countdown-timer-widget-compact' : '') + '" aria-live="polite" aria-label="' + ariaLabel + '">';
  html += '<span class="countdown-title">Remaining</span>';
  html += '<svg class="countdown-ring ' + color + (isUrgent ? ' urgent' : '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">';
  
  // Background ring
  html += '<circle cx="' + (size / 2) + '" cy="' + (size / 2) + '" r="' + radius + '" class="countdown-ring-background"></circle>';
  
  // Progress ring
  html += '<circle cx="' + (size / 2) + '" cy="' + (size / 2) + '" r="' + radius + '" class="countdown-ring-progress" style="stroke-dasharray: ' + circumference + '; stroke-dashoffset: ' + strokeDashoffset + 'px;"></circle>';
  
  // Center text
  html += '</svg>';
  html += '<div class="countdown-label' + (isUrgent ? ' blinking' : '') + '">' + label + '</div>';
  
  // Additional detail on hover
  if (sprintEndDate) {
    const endDateStr = new Date(sprintEndDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    html += '<div class="countdown-detail" title="Sprint end time">' + endDateStr + '</div>';
  }

  html += '</div>';

  return html;
}

/**
 * Wire countdown timer handlers (for future enhancements like notifications)
 */
export function wireCountdownTimerHandlers() {
  const timer = document.querySelector('.countdown-timer-widget');
  if (!timer) return;

  // Add tooltip on hover
  timer.addEventListener('mouseenter', () => {
    const detail = timer.querySelector('.countdown-detail');
    if (detail) {
      detail.style.opacity = '1';
    }
  });

  timer.addEventListener('mouseleave', () => {
    const detail = timer.querySelector('.countdown-detail');
    if (detail) {
      detail.style.opacity = '0.6';
    }
  });
}

/**
 * Update countdown timer in real-time (call every minute).
 * Uses innerHTML on parent to avoid outerHTML orphan-node memory leak.
 */
export function updateCountdownTimer(data) {
  const oldTimer = document.querySelector('.countdown-timer-widget');
  if (oldTimer && oldTimer.parentNode) {
    const wrapper = oldTimer.parentNode;
    const newHtml = renderCountdownTimer(data);
    // Replace the specific child rather than outerHTML to preserve parent event listeners
    const temp = document.createElement('div');
    temp.innerHTML = newHtml;
    const newEl = temp.firstElementChild;
    if (newEl) {
      wrapper.replaceChild(newEl, oldTimer);
      wireCountdownTimerHandlers();
    }
  }
}
