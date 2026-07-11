export function waitForVideoElement(
  doc: Document,
  timeoutMs = 5000,
  intervalMs = 200
): Promise<HTMLVideoElement | null> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;

    function check(): void {
      const video = doc.querySelector('video');
      if (video) {
        resolve(video);
        return;
      }
      if (Date.now() >= deadline) {
        resolve(null);
        return;
      }
      setTimeout(check, intervalMs);
    }

    check();
  });
}
