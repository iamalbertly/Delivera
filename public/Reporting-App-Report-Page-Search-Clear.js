export function initSearchClearButtons() {
  const targets = ['report-tab-search', 'boards-search-box', 'sprints-search-box', 'search-box', 'project-search'];
  targets.forEach((id) => {
    const input = document.getElementById(id);
    const btn = document.querySelector(`.search-clear-btn[data-target="${id}"]`);
    if (!input || !btn) return;
    const update = () => {
      btn.classList.add('is-visible');
      btn.disabled = !input.value;
    };
    input.addEventListener('input', update);
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      update();
      input.focus();
    });
    update();
  });
}
