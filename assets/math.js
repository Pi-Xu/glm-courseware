(() => {
  const render = (root = document.body) => {
    if (!root || typeof renderMathInElement !== 'function') return;
    renderMathInElement(root, {
      delimiters: [
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false,
      output: 'htmlAndMathml',
      trust: false
    });
  };
  window.TeachingMath = { render };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => render(), { once: true });
  } else {
    render();
  }
})();
