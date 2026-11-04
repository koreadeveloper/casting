/**
 * 로그아웃. 실수로 누르는 일을 막으려고 한 번 묻는다. 브라우저에서만 쓴다.
 * 브라우저 기본 확인창(window.confirm)은 카카오톡 등 앱 안 브라우저나 일부 휴대폰에서 뜨지 않고
 * 바로 '취소'로 처리되어 로그아웃이 안 되는 일이 있어, 화면 안에 확인창을 직접 그린다.
 */
export async function confirmLogout() {
  if (!(await askInPage('로그아웃할까요?', '로그아웃'))) return;
  await fetch('/api/auth', { method: 'DELETE' }).catch(() => null);
  location.href = '/';
}

function askInPage(message: string, okLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'confirm-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    const card = document.createElement('div');
    card.className = 'confirm-card';
    const text = document.createElement('p');
    text.textContent = message;
    const actions = document.createElement('div');
    actions.className = 'confirm-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'button button-soft';
    cancel.textContent = '취소';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'button button-primary';
    ok.textContent = okLabel;
    actions.append(cancel, ok);
    card.append(text, actions);
    backdrop.append(card);

    const done = (answer: boolean) => {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      resolve(answer);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') done(false);
    };
    cancel.addEventListener('click', () => done(false));
    ok.addEventListener('click', () => done(true));
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) done(false);
    });
    document.addEventListener('keydown', onKey);
    document.body.append(backdrop);
    ok.focus();
  });
}
