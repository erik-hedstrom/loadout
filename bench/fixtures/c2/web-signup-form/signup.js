const form = document.getElementById('signup');
const status = document.getElementById('status');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = {
    email: form.email.value,
    password: form.password.value,
  };

  // Do not change this call: the server contract is fixed.
  const res = await fetch('/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  status.textContent = res.ok ? 'Account created. Check your email.' : 'Something went wrong. Try again.';
});
