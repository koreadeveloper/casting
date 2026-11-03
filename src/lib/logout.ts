/** 로그아웃. 실수로 누르는 일을 막으려고 한 번 묻는다. 브라우저에서만 쓴다. */
export async function confirmLogout() {
  if (!window.confirm('로그아웃할까요?')) return;
  await fetch('/api/auth', { method: 'DELETE' });
  location.href = '/';
}
