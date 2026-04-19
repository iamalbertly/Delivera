function setFeedbackStatus(statusEl, message, tone = 'info') {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = tone === 'error' ? '#c33' : '#1b4f9c';
}

function toggleFeedbackPanel(panelEl, statusEl, show) {
  if (!panelEl) return;
  const shouldShow = typeof show === 'boolean' ? show : !panelEl.classList.contains('feedback-panel-open');
  if (shouldShow) {
    panelEl.style.display = 'block';
    setFeedbackStatus(statusEl, '');
    requestAnimationFrame(() => panelEl.classList.add('feedback-panel-open'));
  } else {
    panelEl.classList.remove('feedback-panel-open');
    setTimeout(() => { panelEl.style.display = 'none'; }, 250);
  }
}

export function initFeedbackPanel() {
  if (document.body && document.body.dataset.feedbackPanelInit === 'true') {
    return;
  }
  const feedbackToggle = document.getElementById('feedback-toggle');
  const feedbackPanel = document.getElementById('feedback-panel');
  const feedbackEmail = document.getElementById('feedback-email');
  const feedbackMessage = document.getElementById('feedback-message');
  const feedbackSubmit = document.getElementById('feedback-submit');
  const feedbackCancel = document.getElementById('feedback-cancel');
  const feedbackStatus = document.getElementById('feedback-status');

  if (feedbackToggle) {
    feedbackToggle.addEventListener('click', () => toggleFeedbackPanel(feedbackPanel, feedbackStatus));
  }

  // Keyboard shortcut: press 'f' to open feedback unless typing in an input/textarea
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'f' && (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) === false)) {
      ev.preventDefault();
      toggleFeedbackPanel(feedbackPanel, feedbackStatus, true);
    }
  });

  if (feedbackCancel) {
    feedbackCancel.addEventListener('click', () => toggleFeedbackPanel(feedbackPanel, feedbackStatus, false));
  }

  if (feedbackSubmit) {
    feedbackSubmit.addEventListener('click', async () => {
      const email = (feedbackEmail?.value || '').trim();
      const message = (feedbackMessage?.value || '').trim();
      // Email is optional; message is required (allow anonymous feedback)
      if (!message) {
        setFeedbackStatus(feedbackStatus, 'Please enter your feedback message.', 'error');
        return;
      }

      feedbackSubmit.disabled = true;
      setFeedbackStatus(feedbackStatus, 'Sending feedback...');
      try {
        const response = await fetch('/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, message }),
        });
        if (!response.ok) {
          const text = await response.text().catch(() => 'Unable to submit feedback.');
          throw new Error(text);
        }
        setFeedbackStatus(feedbackStatus, 'Thanks! Your feedback was received.');
        // record local timestamp of last sent feedback for UX hinting (e.g., clear badge)
        try { localStorage.setItem('feedback-last-sent', String(Date.now())); } catch (e) {}
        if (feedbackEmail) feedbackEmail.value = '';
        if (feedbackMessage) feedbackMessage.value = '';
      } catch (error) {
        setFeedbackStatus(feedbackStatus, `Failed to send feedback: ${error.message}`, 'error');
      } finally {
        feedbackSubmit.disabled = false;
      }
    });
  }

  if (document.body) {
    document.body.dataset.feedbackPanelInit = 'true';
  }
}
