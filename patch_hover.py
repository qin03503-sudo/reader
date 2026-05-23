import re

with open('src/lib/components/Reader.svelte', 'r') as f:
    content = f.read()

attach_events_old = """  function attachEventListeners() {
    setTimeout(() => {
        if (!originalContainer) return;

        const handleMouseUp = async () => {
            const selection = window.getSelection();
            if (!selection || selection.toString().trim() === '') return;
            console.log("Selected:", selection.toString());
        };

        originalContainer.addEventListener('mouseup', handleMouseUp);
        return () => {
            if (originalContainer) {
                originalContainer.removeEventListener('mouseup', handleMouseUp);
            }
        };
    }, 100);
  }"""

attach_events_new = """  function attachEventListeners() {
    setTimeout(() => {
        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('sync-hover')) {
                const syncId = target.getAttribute('data-sync-id');
                if (syncId) {
                    const elements = document.querySelectorAll(`[data-sync-id="${syncId}"]`);
                    elements.forEach(el => el.classList.add('active'));
                }
            }
        };

        const handleMouseOut = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('sync-hover')) {
                const syncId = target.getAttribute('data-sync-id');
                if (syncId) {
                    const elements = document.querySelectorAll(`[data-sync-id="${syncId}"]`);
                    elements.forEach(el => el.classList.remove('active'));
                }
            }
        };

        // Note: The dictionary click event will be added later

        if (originalContainer) {
            originalContainer.addEventListener('mouseover', handleMouseOver);
            originalContainer.addEventListener('mouseout', handleMouseOut);
        }
        if (translatedContainer) {
            translatedContainer.addEventListener('mouseover', handleMouseOver);
            translatedContainer.addEventListener('mouseout', handleMouseOut);
        }

        return () => {
            if (originalContainer) {
                originalContainer.removeEventListener('mouseover', handleMouseOver);
                originalContainer.removeEventListener('mouseout', handleMouseOut);
            }
            if (translatedContainer) {
                translatedContainer.removeEventListener('mouseover', handleMouseOver);
                translatedContainer.removeEventListener('mouseout', handleMouseOut);
            }
        };
    }, 100);
  }"""

content = content.replace(attach_events_old, attach_events_new)

with open('src/lib/components/Reader.svelte', 'w') as f:
    f.write(content)
