/**
 * Web Worker for parsing large Spotify JSON collections in background
 * Frees up Main UI thread to maintain 60 FPS
 */

self.onmessage = async function(e) {
  const { files } = e.data; // array of { name, text }
  let combined = [];

  for (let i = 0; i < files.length; i++) {
    const item = files[i];
    try {
      const parsed = JSON.parse(item.text);
      if (Array.isArray(parsed)) {
        combined = combined.concat(parsed);
      } else if (parsed && typeof parsed === 'object') {
        combined.push(parsed);
      }
    } catch (err) {
      self.postMessage({ type: 'ERROR', fileName: item.name, message: err.message });
    }

    self.postMessage({
      type: 'PROGRESS',
      loadedCount: i + 1,
      totalCount: files.length,
      percentage: Math.round(((i + 1) / files.length) * 100)
    });
  }

  self.postMessage({
    type: 'COMPLETE',
    records: combined
  });
};
