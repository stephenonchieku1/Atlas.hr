fetch('/api/health')
  .then((res) => res.json())
  .then((data) => {
    document.getElementById('status').textContent = `Server status: ${data.status}`;
  })
  .catch(() => {
    document.getElementById('status').textContent = 'Unable to reach server';
  });
