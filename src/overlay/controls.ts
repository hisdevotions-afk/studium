const SPEEDS = [1, 1.25, 1.5, 0.75];
const BTN_STYLE =
  'cursor: pointer; pointer-events: auto; margin: 0 6px; padding: 6px 16px; ' +
  'font-size: 1.2vw; line-height: 1; ' +
  'background: rgba(0,0,0,0.75); color: #fff; border: 1px solid #666; border-radius: 6px;';

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
  let desiredRate = 1;
  speedButton.textContent = `${SPEEDS[speedIdx]}x`;
  speedButton.addEventListener('click', (e) => {
    e.stopPropagation(); // don't let Netflix's click-to-pause also fire
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    desiredRate = SPEEDS[speedIdx]!;
    video.playbackRate = desiredRate;
    speedButton.textContent = `${desiredRate}x`;
  });
  // Netflix's player resets playbackRate to 1 on its own; reassert ours — but
  // only when the user actually picked a non-default speed, so we never fight
  // Netflix's own rate handling at 1x.
  video.addEventListener('ratechange', () => {
    if (desiredRate !== 1 && video.playbackRate !== desiredRate) video.playbackRate = desiredRate;
  });

  const repeatButton = document.createElement('button');
  repeatButton.className = 'sla-copilot-repeat';
  repeatButton.style.cssText = BTN_STYLE;
  repeatButton.textContent = 'repetir';
  let loop: { start: number; end: number } | null = null;
  repeatButton.addEventListener('click', (e) => {
    e.stopPropagation();
    loop = loop ? null : getCurrentCue();
    repeatButton.style.borderColor = loop ? '#e50914' : '#666';
  });
  video.addEventListener('timeupdate', () => {
    if (loop && video.currentTime >= loop.end) video.currentTime = loop.start;
  });

  container.append(speedButton, repeatButton);
}
