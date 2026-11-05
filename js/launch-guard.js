(() => {
  if (['127.0.0.1', 'localhost'].includes(window.location.hostname)) return;

  const fallbackLaunchAt = Date.parse('2026-09-04T05:15:00+05:30');
  document.documentElement.style.visibility = 'hidden';

  fetch('/index.php?launch_status=1', { cache: 'no-store', credentials: 'same-origin' })
    .then((response) => {
      if (!response.ok) throw new Error('Launch status unavailable');
      return response.json();
    })
    .then(({ live }) => {
      if (live) document.documentElement.style.visibility = '';
      else window.location.replace('/');
    })
    .catch(() => {
      if (Date.now() >= fallbackLaunchAt) document.documentElement.style.visibility = '';
      else window.location.replace('/');
    });
})();
