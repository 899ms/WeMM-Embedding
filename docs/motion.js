'use strict';

(() => {
  const visual = document.querySelector('#embedding-visual');
  if (!visual) return;
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let inView = false;
  const update = () => {
    visual.dataset.motion = !preference.matches && inView && !document.hidden ? 'running' : 'paused';
  };
  preference.addEventListener('change', update);
  document.addEventListener('visibilitychange', update);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      update();
    }, {threshold: 0}).observe(visual);
  } else {
    inView = true;
  }
  update();
})();
