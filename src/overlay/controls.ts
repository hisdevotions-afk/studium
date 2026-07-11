const SPEEDS = [1, 1.25, 1.5, 0.75];
const BTN_STYLE =
  'cursor: pointer; pointer-events: auto; margin: 0 4px; padding: 2px 10px; ' +
  'background: rgba(0,0,0,0.75); color: #fff; border: 1px solid #666; border-radius: 4px;';

export function renderControls(
  container: HTMLElement,
  video: HTMLVideoElement,
  getCurrentCue: () => { start: number; end: number } | null
): void {
  container.innerHTML = '';

  const speedButton = document.createElement('button');
  speedButton.className = 'sla-copilot-speed';
  speedButton.style.cssText = BTN_STYLE;
  let speedIdx = 0;
  speedButton.textContent = `${SPEEDS[speedIdx]}x`;
  speedButton.addEventListener('click', () => {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    video.playbackRate = SPEEDS[speedIdx]!;
    speedButton.textContent = `${SPEEDS[speedIdx]}x`;
  });

  const repeatButton = document.createElement('button');
  repeatButton.className = 'sla-copilot-repeat';
  repeatButton.style.cssText = BTN_STYLE;
  repeatButton.textContent = 'repetir';
  let loop: { start: number; end: number } | null = null;
  repeatButton.addEventListener('click', () => {
    loop = loop ? null : getCurrentCue();
    repeatButton.style.borderColor = loop ? '#e50914' : '#666';
  });
  video.addEventListener('timeupdate', () => {
    if (loop && video.currentTime >= loop.end) video.currentTime = loop.start;
  });

  container.append(speedButton, repeatButton);
}
