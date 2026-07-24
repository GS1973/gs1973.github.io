// Votes component: lists BKIND's on-chain governance votes (SPO + DRep) and
// shows each CIP-136 rationale inline. Data is static and same-origin:
// votes.json (the index) + the rationale JSON-LD files in governance/.
(function () {
    'use strict';

    const btn = document.getElementById('votesBtn');
    const modal = document.getElementById('votesModal');
    const closeBtn = document.getElementById('votesClose');
    const listEl = document.getElementById('votesList');
    if (!btn || !modal || !closeBtn || !listEl) return;

    let lastFocused = null;
    let loaded = false;
    const rationaleCache = new Map();

    function openModal() {
        lastFocused = document.activeElement;
        modal.hidden = false;
        document.addEventListener('keydown', onKeydown);
        closeBtn.focus();
        if (!loaded) {
            loaded = true;
            loadVotes();
        }
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
        }
    }

    async function loadVotes() {
        try {
            const res = await fetch('votes.json', { cache: 'no-cache' });
            if (!res.ok) throw new Error('votes.json ' + res.status);
            const votes = await res.json();
            listEl.textContent = '';
            if (!Array.isArray(votes) || votes.length === 0) {
                listEl.appendChild(emptyMessage('No votes recorded yet.'));
                return;
            }
            votes.forEach(function (v, i) {
                listEl.appendChild(renderRow(v, i));
            });
        } catch (error) {
            listEl.textContent = '';
            listEl.appendChild(emptyMessage('Could not load votes.'));
        }
    }

    function emptyMessage(text) {
        const p = document.createElement('p');
        p.className = 'votes-empty';
        p.textContent = text;
        return p;
    }

    function renderRow(v, index) {
        const item = document.createElement('div');
        item.className = 'vote-item';

        const head = document.createElement('button');
        head.type = 'button';
        head.className = 'vote-head';
        head.setAttribute('aria-expanded', 'false');
        head.setAttribute('aria-controls', 'vote-panel-' + index);

        const role = String(v.role || '').toLowerCase();
        const badge = document.createElement('span');
        badge.className = 'vote-badge role-' + role;
        badge.textContent = v.role || '';

        const title = document.createElement('span');
        title.className = 'vote-title';
        title.textContent = v.title || v.action || '';

        const result = document.createElement('span');
        result.className = 'vote-result vote-' + String(v.vote || '').toLowerCase();
        result.textContent = v.vote || '';

        const epoch = document.createElement('span');
        epoch.className = 'vote-epoch';
        if (v.epoch != null) epoch.textContent = 'epoch ' + v.epoch;

        const chevron = document.createElement('span');
        chevron.className = 'vote-chevron';
        chevron.setAttribute('aria-hidden', 'true');

        head.append(badge, title, result, epoch, chevron);

        const panel = document.createElement('div');
        panel.className = 'vote-panel';
        panel.id = 'vote-panel-' + index;
        panel.hidden = true;

        head.addEventListener('click', function () {
            togglePanel(head, panel, v);
        });

        item.append(head, panel);
        return item;
    }

    async function togglePanel(head, panel, v) {
        const expanded = head.getAttribute('aria-expanded') === 'true';
        head.setAttribute('aria-expanded', String(!expanded));
        panel.hidden = expanded;
        if (!expanded && !panel.dataset.filled) {
            panel.dataset.filled = '1';
            panel.appendChild(await renderRationale(v));
        }
    }

    async function renderRationale(v) {
        const wrap = document.createElement('div');
        let doc;
        try {
            if (rationaleCache.has(v.rationale)) {
                doc = rationaleCache.get(v.rationale);
            } else {
                const res = await fetch(v.rationale, { cache: 'no-cache' });
                if (!res.ok) throw new Error(res.status);
                doc = await res.json();
                rationaleCache.set(v.rationale, doc);
            }
        } catch (error) {
            wrap.appendChild(emptyMessage('Could not load the rationale.'));
            return wrap;
        }

        const body = doc.body || {};
        const author = (Array.isArray(doc.authors) && doc.authors[0]) || {};

        if (body.summary) {
            const summary = document.createElement('p');
            summary.className = 'rationale-summary';
            summary.textContent = body.summary;
            wrap.appendChild(summary);
        }

        if (body.rationaleStatement) {
            String(body.rationaleStatement).split('\n').forEach(function (paragraph) {
                const text = paragraph.trim();
                if (!text) return;
                const p = document.createElement('p');
                p.className = 'rationale-text';
                p.textContent = text;
                wrap.appendChild(p);
            });
        }

        const meta = document.createElement('div');
        meta.className = 'rationale-meta';
        if (author.witness && author.witness.signature) {
            const signed = document.createElement('span');
            signed.className = 'signed-badge';
            signed.textContent = 'signed ✓';
            signed.title = 'Rationale signed with the ' +
                (author.witness.witnessAlgorithm || 'ed25519') + ' key';
            meta.appendChild(signed);
        }
        if (v.govActionId) {
            const gid = document.createElement('span');
            gid.className = 'gov-id';
            gid.textContent = v.govActionId;
            meta.appendChild(gid);
        }
        if (meta.childElementCount > 0) wrap.appendChild(meta);

        if (Array.isArray(body.references) && body.references.length > 0) {
            const refs = document.createElement('div');
            refs.className = 'rationale-refs';
            body.references.forEach(function (ref) {
                if (!ref || !ref.uri) return;
                const a = document.createElement('a');
                a.href = ref.uri;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.textContent = ref.label || ref.uri;
                refs.appendChild(a);
            });
            if (refs.childElementCount > 0) wrap.appendChild(refs);
        }

        return wrap;
    }

    btn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function (event) {
        if (event.target === modal) {
            closeModal();
        }
    });
})();
