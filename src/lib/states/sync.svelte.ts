export function createSyncState() {
  let originalContainer = $state<HTMLDivElement | null>(null);
  let translatedContainer = $state<HTMLDivElement | null>(null);

  // Analysis / Dictionary state
  let showAnalysis = $state(false);
  let analysisLoading = $state(false);
  let analysisData = $state<any>(null);
  let analysisError = $state('');

  const getSyncPair = (syncId: string): HTMLElement[] => {
    if (!syncId) return [];
    const selector = `[data-sync-id="${syncId}"]`;
    return [
      ...(originalContainer?.querySelectorAll<HTMLElement>(selector) || []),
      ...(translatedContainer?.querySelectorAll<HTMLElement>(selector) || [])
    ];
  };

  const getTargetElement = (e: Event): HTMLElement | null => {
    const el = (e.target as HTMLElement | null)?.closest('.sync-hover') as HTMLElement | null;
    if (!el || (!originalContainer?.contains(el) && !translatedContainer?.contains(el))) return null;
    return el;
  };

  const handleMouseOver = (e: Event) => {
    const el = getTargetElement(e);
    if (!el) return;
    const syncId = el.getAttribute('data-sync-id');
    if (syncId) getSyncPair(syncId).forEach(el => el.classList.add('active'));
  };

  const handleMouseOut = (e: Event) => {
    const el = getTargetElement(e);
    if (!el) return;
    const syncId = el.getAttribute('data-sync-id');
    if (syncId) getSyncPair(syncId).forEach(el => el.classList.remove('active'));
  };

  const handleClick = async (e: Event, context: { targetLanguage: string, selectedModel: string, bookTitle?: string, chapterTitle?: string }) => {
    const el = getTargetElement(e);
    if (!el) return;

    const syncId = el.getAttribute('data-sync-id');
    if (!syncId) return;

    const counterpart = getSyncPair(syncId).find(element => element !== el);
    if (counterpart) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      counterpart.scrollIntoView({
        block: 'nearest',
        behavior: prefersReducedMotion ? 'instant' : 'smooth'
      });
    }

    const sentence = el.textContent || '';
    if (!sentence.trim()) return;

    showAnalysis = true;
    analysisLoading = true;
    analysisData = null;
    analysisError = '';

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentence,
          targetLanguage: context.targetLanguage,
          model: context.selectedModel,
          context: (context.bookTitle || '') + " - " + (context.chapterTitle || '')
        })
      });
      const data = await res.json();
      if (res.ok) {
        analysisData = data;
      } else {
        analysisError = data.error || 'Analysis failed';
      }
    } catch (err) {
      analysisError = 'Failed to connect';
    } finally {
      analysisLoading = false;
    }
  };

  return {
    get originalContainer() { return originalContainer; },
    set originalContainer(val) { originalContainer = val; },
    get translatedContainer() { return translatedContainer; },
    set translatedContainer(val) { translatedContainer = val; },
    get showAnalysis() { return showAnalysis; },
    set showAnalysis(val) { showAnalysis = val; },
    get analysisLoading() { return analysisLoading; },
    get analysisData() { return analysisData; },
    get analysisError() { return analysisError; },
    handleMouseOver,
    handleMouseOut,
    handleClick
  };
}
