(function () {
    'use strict';

    const delegateBtn = document.getElementById('delegateBtn');
    const modal = document.getElementById('delegateModal');
    const modalClose = document.getElementById('modalClose');
    const poolId = document.getElementById('poolId');
    const copyHint = document.getElementById('copyHint');

    let lastFocused = null;

    function openModal() {
        lastFocused = document.activeElement;
        modal.hidden = false;
        document.addEventListener('keydown', onKeydown);
        modalClose.focus();
    }

    function closeModal() {
        modal.hidden = true;
        document.removeEventListener('keydown', onKeydown);
        resetCopyHint();
        if (lastFocused && typeof lastFocused.focus === 'function') {
            lastFocused.focus();
        }
    }

    function onKeydown(event) {
        if (event.key === 'Escape') {
            closeModal();
        } else if (event.key === 'Tab') {
            trapFocus(event);
        }
    }

    // Keep keyboard focus inside the dialog while it is open.
    function trapFocus(event) {
        const focusable = [modalClose, poolId];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function resetCopyHint() {
        copyHint.textContent = 'click to copy';
        copyHint.classList.remove('copied');
    }

    async function copyPoolId() {
        const value = poolId.textContent.trim();
        try {
            await navigator.clipboard.writeText(value);
            copyHint.textContent = 'copied';
            copyHint.classList.add('copied');
        } catch (error) {
            // Clipboard API unavailable or denied: select the text so the user can copy it manually.
            const range = document.createRange();
            range.selectNodeContents(poolId);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            copyHint.textContent = 'press Ctrl+C to copy';
        }
    }

    delegateBtn.addEventListener('click', openModal);
    modalClose.addEventListener('click', closeModal);
    poolId.addEventListener('click', copyPoolId);

    // Close when the backdrop (not the dialog itself) is clicked.
    modal.addEventListener('click', function (event) {
        if (event.target === modal) {
            closeModal();
        }
    });
})();
