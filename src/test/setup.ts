import '@testing-library/jest-dom/vitest';

// jsdom has no media playback; the sound store creates Audio elements on import.
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};

// recharts' ResponsiveContainer needs ResizeObserver.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
