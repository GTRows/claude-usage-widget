export function createAccountSetup({ onBusy = () => {} } = {}) {
  let generation = 0;
  let committing = false;
  const current = (token) => token === generation;
  function invalidate() { generation++; committing = false; onBusy(false); }
  function cancel() { if (committing) return false; invalidate(); return true; }
  async function run({ prepare, commit, apply }) {
    const token = ++generation;
    try {
      const prepared = await prepare();
      if (!current(token)) return false;
      committing = true;
      onBusy(true);
      const saved = await commit(prepared);
      if (!current(token)) return false;
      await apply(saved, token);
      return true;
    } catch (error) {
      if (current(token)) throw error;
      return false;
    } finally {
      if (current(token)) { committing = false; onBusy(false); }
    }
  }
  return { run, cancel, invalidate, current };
}
