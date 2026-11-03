export function createAccountTransition({ body, content, reducedMotion }) {
  let target = null;
  let locked = false;
  let animation = null;

  function begin(accountId) {
    animation?.cancel();
    target = accountId;
    locked = true;
    body.classList.add('account-size-locked', 'account-switching');
    body.setAttribute('aria-busy', 'true');
  }

  function complete(accountId) {
    if (!target || target !== accountId) return;
    target = null;
    body.classList.remove('account-switching');
    body.setAttribute('aria-busy', 'false');
    const view = content();
    if (view.style.display !== 'none' && !reducedMotion()) {
      animation = view.animate([
        { opacity: 0.45, transform: 'translateY(3px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 180, easing: 'ease-out' });
    }
  }

  function reset() {
    animation?.cancel();
    animation = null;
    target = null;
    locked = false;
    body.classList.remove('account-size-locked', 'account-switching');
    body.setAttribute('aria-busy', 'false');
  }

  function unlock() {
    locked = false;
    body.classList.remove('account-size-locked');
  }

  return {
    begin, complete, reset, unlock,
    isLocked: () => locked,
    isPending: () => target !== null,
    isFor: (id) => target === id,
    accepts: (id) => target === null || target === id,
  };
}
