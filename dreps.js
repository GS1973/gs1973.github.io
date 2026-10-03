// DReps component: the daily list of active DReps and the figures about who
// holds the vote (dreps.json, same origin), in a modal like the pools. Opens
// from the DReps button, or directly on a link to /#dreps.
(function () {
    'use strict';

    const btn = document.getElementById('drepsBtn');
    const modal = document.getElementById('drepsModal');
    const closeBtn = document.getElementById('drepsClose');
    const rowsEl = document.getElementById('drepsRows');
    const filterEl = document.getElementById('drepsFilter');
    const metaEl = document.getElementById('drepsMeta');
    if (!btn || !modal || !closeBtn || !rowsEl || !filterEl || !metaEl) return;

    const fmt = n => n.toLocaleString('en-US');
    // 37536044256 -> "37.5 billion", 182792281 -> "183 million"
    const big = ada => ada >= 1e9 ? (ada / 1e9).toFixed(1) + ' billion'
        : ada >= 1e6 ? Math.round(ada / 1e6) + ' million' : fmt(ada);
    const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '–';
    const shortId = id => id.slice(0, 12) + '…' + id.slice(-6);

    let lastFocused = null;
    let loaded = false;
    let dreps = [];
    let sameName = new Map();
    let sortKey = 'voting_power_ada';
    let sortDesc = false;   // smallest first: a smaller DRep helps spread the vote

    function openModal() {
        lastFocused = document.activeElement;
        modal.hidden = false;
        document.addEventListener('keydown', onKeydown);
        closeBtn.focus();
        if (!loaded) {
            loaded = true;
            load();
        }
    }

    function closeModal() {
        modal.hidden = true;
        document.removeEventListener('keydown', onKeydown);
        if (location.hash === '#dreps') {
            history.replaceState(null, '', location.pathname + location.search);
        }
        if (lastFocused && typeof lastFocused.focus === 'function') {
            lastFocused.focus();
        }
    }

    function onKeydown(event) {
        if (event.key === 'Escape') {
            closeModal();
        }
    }

    function delegateTo(target) {
        if (window.sboDelegate) window.sboDelegate.open(target);
    }

    function render() {
        const q = filterEl.value.trim().toLowerCase();
        const shown = dreps
            .filter(d => !q || d.label.toLowerCase().includes(q) || d.drep_id.includes(q))
            .sort((a, b) => {
                const x = a[sortKey], y = b[sortKey];
                const c = typeof x === 'number' ? x - y : String(x).localeCompare(String(y));
                return sortDesc ? -c : c;
            });
        const frag = document.createDocumentFragment();
        for (const d of shown) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.className = 'dreps-name';
            const a = document.createElement('a');
            a.href = 'https://cardanoscan.io/drep/' + encodeURIComponent(d.drep_id);
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.className = 'pools-ticker';
            a.textContent = d.name || shortId(d.drep_id);
            a.title = 'Open ' + (d.name || 'this DRep') + ' on Cardanoscan (new window)';
            td.appendChild(a);
            // A name is the DRep's own choice and two DReps can carry the same
            // one: then the short ID tells them apart.
            if (d.name && sameName.get(d.name.toLowerCase()) > 1) td.append(' ' + shortId(d.drep_id));
            tr.appendChild(td);
            // The label shows on a phone, where each DRep is a card (pools.css).
            for (const [v, label] of [
                [fmt(d.voting_power_ada), 'Voting power (ADA)'],
                [d.share.toFixed(2) + '%', 'Share'],
                [fmt(d.delegators), 'Delegators'],
                [d.eligible ? d.voted + ' of ' + d.eligible : '–', 'Voted'],
                [d.voted ? pct(d.rationale, d.voted) : '–', 'Rationale'],
                [d.last_vote || '–', 'Last vote']]) {
                const cell = document.createElement('td');
                cell.textContent = v;
                cell.className = 'num';
                cell.dataset.label = label;
                tr.appendChild(cell);
            }
            const actionTd = document.createElement('td');
            actionTd.className = 'pools-actions';
            const buttons = document.createElement('div');
            buttons.className = 'pools-buttons';
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'pools-delegate';
            del.textContent = 'Delegate';
            del.title = 'Give your vote to ' + (d.name || 'this DRep') + ' with your wallet';
            del.addEventListener('click', () => delegateTo({
                kind: 'drep', name: d.name, drep_id: d.drep_id, hash: d.hash, script: d.script,
            }));
            buttons.appendChild(del);
            actionTd.appendChild(buttons);
            tr.appendChild(actionTd);
            frag.appendChild(tr);
        }
        rowsEl.replaceChildren(frag);
    }

    function fill(f) {
        const set = (key, text) => modal.querySelectorAll('[data-fig="' + key + '"]').forEach(e => { e.textContent = text; });
        set('circulating', big(f.circulating_ada));
        set('voting', big(f.voting_ada));
        set('voting_pct', pct(f.voting_ada, f.circulating_ada));
        set('no_drep', big(f.no_drep_ada));
        set('no_drep_pct', pct(f.no_drep_ada, f.circulating_ada));
        set('abstain', big(f.abstain_ada));
        set('abstain_pct', pct(f.abstain_ada, f.circulating_ada));
        set('inactive_dreps', fmt(f.inactive_dreps));
        set('inactive_days', fmt(f.drep_activity_epochs * 5));
        set('inactive_ada', big(f.inactive_ada));
        set('block_treasury_params', fmt(f.block_treasury_params));
        set('block_constitution', fmt(f.block_constitution));
        set('carry_treasury', fmt(f.carry_treasury));
        set('rationale_pct', pct(f.votes_with_rationale, f.votes));
        set('never_rationale', fmt(f.dreps_never_rationale));
        set('never_rationale_pct', pct(f.dreps_never_rationale_ada, f.active_ada));
    }

    async function load() {
        try {
            const res = await fetch('dreps.json', { cache: 'no-cache' });
            if (!res.ok) throw new Error('dreps.json ' + res.status);
            const doc = await res.json();
            dreps = doc.dreps.map(d => Object.assign({}, d, {
                label: d.name || d.drep_id,
                voted_ratio: d.eligible ? d.voted / d.eligible : -1,
                rationale_ratio: d.voted ? d.rationale / d.voted : -1,
                last_vote: d.last_vote || '',
            }));
            sameName = new Map();
            for (const d of dreps) if (d.name) sameName.set(d.name.toLowerCase(), (sameName.get(d.name.toLowerCase()) || 0) + 1);
            fill(doc.figures);
            metaEl.textContent =
                `${fmt(dreps.length)} active DReps, updated ${doc.generated.slice(0, 10)} (epoch ${doc.epoch}).` +
                (doc.excluded && doc.excluded.length ? ` Left out: ${fmt(doc.excluded.length)} DReps of the founding entities.` : '');
            render();
        } catch (error) {
            metaEl.textContent = 'Could not load the list. Please try again later.';
        }
    }

    modal.querySelectorAll('.dreps-table th').forEach(th => {
        th.addEventListener('click', () => {
            const k = th.dataset.key;
            if (!k) return;
            sortDesc = sortKey === k ? !sortDesc : false;
            sortKey = k;
            render();
        });
    });
    filterEl.addEventListener('input', render);
    btn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function (event) {
        if (event.target === modal) closeModal();
    });
    if (location.hash === '#dreps') openModal();
})();
