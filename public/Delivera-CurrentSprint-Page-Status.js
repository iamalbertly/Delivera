import { getProjectsParam } from './Reporting-App-CurrentSprint-Page-Storage.js';
import { PAGE_STATE, setPageState, getCurrentState } from './Reporting-App-CurrentSprint-Page-State.js';

export { getCurrentState };

export function showWelcome(message) {
  setPageState(PAGE_STATE.WELCOME, message != null ? { message } : {});
}

export function showLoading(msg) {
  const text = msg || ('Loading sprint data for project ' + getProjectsParam() + '...');
  setPageState(PAGE_STATE.LOADING, {
    message: text,
    context: '',
    preserveContent: true,
  });
}

export function showError(msg) {
  const opts = typeof msg === 'object' && msg !== null ? msg : { message: String(msg || 'An error occurred.') };
  setPageState(PAGE_STATE.ERROR, opts);
}

export function clearError() {
  setPageState(PAGE_STATE.WELCOME, {});
}

export function showContent(html) {
  setPageState(PAGE_STATE.CONTENT, { html });
}
