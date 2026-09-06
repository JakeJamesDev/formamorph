(() => {
  const key = 'vite-ui-theme';
  const media = matchMedia('(prefers-color-scheme: dark)');
  const resolve = () => {
    const stored = localStorage.getItem(key);
    return stored === 'light' || stored === 'dark' ? stored : media.matches ? 'dark' : 'light';
  };
  const apply = () => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(resolve());
  };

  apply();
  media.addEventListener('change', apply);
  addEventListener('storage', (event) => {
    if (event.key === key || event.key === null) apply();
  });
})();
