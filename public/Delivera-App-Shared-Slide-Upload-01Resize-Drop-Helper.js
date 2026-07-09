/**
 * Shared slide upload: resize to base64 + drag/drop zone binding (ChatGPT-style).
 */

export async function resizeImageFileToBase64(file, { maxW = 1400, maxBytes = 900000 } = {}) {
  if (!file) throw new Error('No file selected');
  const mime = String(file.type || 'image/jpeg').split(';')[0].trim() || 'image/jpeg';

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, maxW / bitmap.width);
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
      bitmap.close?.();
      let quality = 0.85;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);
      while (dataUrl.length > maxBytes * 1.37 && quality > 0.35) {
        quality -= 0.1;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }
      return { base64: dataUrl.split(',')[1] || '', mimeType: 'image/jpeg' };
    } catch (_) { /* fall through */ }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        let quality = 0.85;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > maxBytes * 1.37 && quality > 0.35) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve({ base64: dataUrl.split(',')[1] || '', mimeType: 'image/jpeg' });
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

/**
 * @param {HTMLElement} zoneEl drop zone (label or container with file input)
 * @param {(file: File) => void|Promise<void>} onFile
 * @returns {() => void} cleanup
 */
export function bindSlideDropZone(zoneEl, onFile) {
  if (!zoneEl || typeof onFile !== 'function') return () => {};

  const input = zoneEl.querySelector?.('input[type="file"]')
    || (zoneEl.matches?.('input[type="file"]') ? zoneEl : null);
  if (input?.id && zoneEl.tagName === 'LABEL') {
    zoneEl.setAttribute('for', input.id);
  }

  const onPick = (file) => {
    if (!file || !String(file.type || '').startsWith('image/')) return;
    void onFile(file);
  };

  input?.addEventListener('change', () => {
    const f = input.files?.[0];
    if (f) onPick(f);
    if (input) input.value = '';
  });

  const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };
  const onEnter = (e) => { prevent(e); zoneEl.classList.add('is-dragover'); };
  const onLeave = (e) => { prevent(e); zoneEl.classList.remove('is-dragover'); };
  const onDrop = (e) => {
    prevent(e);
    zoneEl.classList.remove('is-dragover');
    const f = e.dataTransfer?.files?.[0];
    if (f) onPick(f);
  };

  zoneEl.addEventListener('dragenter', onEnter);
  zoneEl.addEventListener('dragover', onEnter);
  zoneEl.addEventListener('dragleave', onLeave);
  zoneEl.addEventListener('drop', onDrop);

  return () => {
    zoneEl.classList.remove('is-dragover');
    zoneEl.removeEventListener('dragenter', onEnter);
    zoneEl.removeEventListener('dragover', onEnter);
    zoneEl.removeEventListener('dragleave', onLeave);
    zoneEl.removeEventListener('drop', onDrop);
  };
}
