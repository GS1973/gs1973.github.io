// Not inside another site's frame: GitHub Pages cannot send a header that
// forbids it, so a page framed elsewhere hides itself and takes the whole
// window instead (a click meant for the framing site must not land on Delegate).
if (window.top !== window.self) {
    document.documentElement.hidden = true;
    try { window.top.location = window.location.href; } catch (e) { /* the frame stays hidden */ }
}

// Delegate: a window with two ways on, delegating to BKIND through the wallet
// dialog of delegate.js, or choosing another pool from the Pools window.
(function () {
    'use strict';

    const BKIND = { ticker: 'BKIND', name: 'Smit Blockchain Operations', pool_id: 'pool1m83drqwlugdt9jn7jkz8hx3pne53acfkd539d9cj8yr92dr4k9y' };

    const delegateBtn = document.getElementById('delegateBtn');
    const modal = document.getElementById('delegateModal');
    const modalClose = document.getElementById('modalClose');
    const walletBtn = document.getElementById('delegateWalletBtn');
    const toPools = document.getElementById('delegateToPools');
    const toDreps = document.getElementById('delegateToDreps');

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
        const focusable = [modalClose, walletBtn, toPools, toDreps];
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

    delegateBtn.addEventListener('click', openModal);
    modalClose.addEventListener('click', closeModal);

    walletBtn.addEventListener('click', function () {
        closeModal();
        if (window.sboDelegate) {
            window.sboDelegate.open(BKIND);
        }
    });

    toPools.addEventListener('click', function () {
        closeModal();
        const poolsBtn = document.getElementById('poolsBtn');
        if (poolsBtn) poolsBtn.click();
    });

    toDreps.addEventListener('click', function () {
        closeModal();
        const drepsBtn = document.getElementById('drepsBtn');
        if (drepsBtn) drepsBtn.click();
    });

    // Close when the backdrop (not the dialog itself) is clicked.
    modal.addEventListener('click', function (event) {
        if (event.target === modal) {
            closeModal();
        }
    });
})();

// Mobile navigation: the hamburger toggles the header actions into a dropdown.
(function () {
    'use strict';

    const toggle = document.getElementById('menuToggle');
    const menu = document.getElementById('headerActions');
    if (!toggle || !menu) return;

    function openMenu() {
        menu.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
        toggle.setAttribute('aria-label', 'Close menu');
        document.addEventListener('keydown', onKeydown);
        document.addEventListener('click', onDocumentClick, true);
    }

    function closeMenu() {
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open menu');
        document.removeEventListener('keydown', onKeydown);
        document.removeEventListener('click', onDocumentClick, true);
    }

    function onKeydown(event) {
        if (event.key === 'Escape') {
            closeMenu();
            toggle.focus();
        }
    }

    // Close when a click lands outside both the menu and the toggle.
    function onDocumentClick(event) {
        if (!menu.contains(event.target) && !toggle.contains(event.target)) {
            closeMenu();
        }
    }

    toggle.addEventListener('click', function (event) {
        event.stopPropagation();
        if (menu.classList.contains('open')) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    // Selecting an item closes the menu; the item's own handler still fires.
    menu.addEventListener('click', function (event) {
        if (event.target.closest('a, button')) {
            closeMenu();
        }
    });
})();

// About: modal describing what Smit Blockchain Operations does.
(function () {
    'use strict';

    const btn = document.getElementById('aboutBtn');
    const modal = document.getElementById('aboutModal');
    const closeBtn = document.getElementById('aboutClose');
    if (!btn || !modal || !closeBtn) return;

    let lastFocused = null;

    function openModal() {
        lastFocused = document.activeElement;
        modal.hidden = false;
        document.addEventListener('keydown', onKeydown);
        closeBtn.focus();
    }

    function closeModal() {
        modal.hidden = true;
        document.removeEventListener('keydown', onKeydown);
        if (lastFocused && typeof lastFocused.focus === 'function') {
            lastFocused.focus();
        }
    }

    function onKeydown(event) {
        if (event.key === 'Escape') {
            closeModal();
        } else if (event.key === 'Tab') {
            // Only the close button is focusable; keep focus on it.
            event.preventDefault();
            closeBtn.focus();
        }
    }

    btn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function (event) {
        if (event.target === modal) {
            closeModal();
        }
    });
})();

// Contact: modal with the address to reach Smit Blockchain Operations.
(function () {
    'use strict';

    const btn = document.getElementById('contactBtn');
    const modal = document.getElementById('contactModal');
    const closeBtn = document.getElementById('contactClose');
    const email = document.getElementById('contactEmail');
    if (!btn || !modal || !closeBtn) return;

    let lastFocused = null;

    function openModal() {
        lastFocused = document.activeElement;
        modal.hidden = false;
        document.addEventListener('keydown', onKeydown);
        closeBtn.focus();
    }

    function closeModal() {
        modal.hidden = true;
        document.removeEventListener('keydown', onKeydown);
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

    // Keep keyboard focus within the dialog (close button and email link).
    function trapFocus(event) {
        const focusable = email ? [closeBtn, email] : [closeBtn];
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

    btn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function (event) {
        if (event.target === modal) {
            closeModal();
        }
    });
})();
