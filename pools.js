// Pools component: the daily list of live pools under the saturation point at
// k = 1000 (pools.json, same origin), in a modal like the votes. Opens from the
// Pools button, or directly on a link to /#pools.
(function () {
    'use strict';

    const btn = document.getElementById('poolsBtn');
    const modal = document.getElementById('poolsModal');
    const closeBtn = document.getElementById('poolsClose');
    const rowsEl = document.getElementById('poolsRows');
    const filterEl = document.getElementById('poolsFilter');
    const metaEl = document.getElementById('poolsMeta');
    if (!btn || !modal || !closeBtn || !rowsEl || !filterEl || !metaEl) return;

    const fmt = n => n.toLocaleString('en-US');
    let lastFocused = null;
    let loaded = false;
    let pools = [];
    let sortKey = 'stake_ada';
    let sortDesc = false;   // smallest first: the pools that need delegation the most

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
        if (location.hash === '#pools') {
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

    function render() {
        const q = filterEl.value.trim().toLowerCase();
        const shown = pools
            .filter(p => !q || p.ticker.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
            .sort((a, b) => {
                const x = a[sortKey], y = b[sortKey];
                const c = typeof x === 'number' ? x - y : String(x).localeCompare(String(y));
                return sortDesc ? -c : c;
            });
        const frag = document.createDocumentFragment();
        for (const p of shown) {
            const tr = document.createElement('tr');
            const scan = 'https://cardanoscan.io/pool/' + encodeURIComponent(p.pool_id);
            for (const [text, cls] of [[p.ticker, 'pools-ticker'], [p.name, 'pools-link']]) {
                const td = document.createElement('td');
                const a = document.createElement('a');
                a.href = scan;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.className = cls;
                a.textContent = text;
                a.title = 'Open ' + p.ticker + ' on Cardanoscan (new window)';
                td.appendChild(a);
                tr.appendChild(td);
            }
            for (const [v, cls] of [[fmt(p.stake_ada), 'num'], [fmt(p.blocks_2026), 'num'], [fmt(p.blocks_last_10_epochs), 'num']]) {
                const td = document.createElement('td');
                td.textContent = v;
                if (cls) td.className = cls;
                tr.appendChild(td);
            }
            const copyTd = document.createElement('td');
            const copy = document.createElement('button');
            copy.type = 'button';
            copy.className = 'pools-copy';
            copy.textContent = 'Copy ID';
            copy.title = p.pool_id;
            copy.addEventListener('click', () => {
                if (!navigator.clipboard) return;
                navigator.clipboard.writeText(p.pool_id).then(() => {
                    copy.textContent = 'Copied';
                    setTimeout(() => { copy.textContent = 'Copy ID'; }, 1200);
                });
            });
            copyTd.appendChild(copy);
            tr.appendChild(copyTd);
            frag.appendChild(tr);
        }
        rowsEl.replaceChildren(frag);
    }

    async function load() {
        try {
            const res = await fetch('pools.json', { cache: 'no-cache' });
            if (!res.ok) throw new Error('pools.json ' + res.status);
            const d = await res.json();
            pools = d.pools;
            document.getElementById('poolsSaturation').textContent = fmt(d.saturation_ada);
            metaEl.textContent =
                `${fmt(pools.length)} pools, updated ${d.generated.slice(0, 10)} (epoch ${d.epoch}). ` +
                `Of ${fmt(d.pools_with_stake)} pools with stake, ${fmt(d.alive_named)} are alive and named; ` +
                `${fmt(d.above_saturation)} of those are above the saturation point.` +
                (d.excluded ? ` Left out: ${fmt(d.excluded_exchanges)} pools of exchanges and ` +
                    `${fmt(d.excluded_founders)} of the founding entities` +
                    (d.excluded_takeover ? `, and ${fmt(d.excluded_takeover)} of ADA Labo.` : '.') : '');
            render();
        } catch (error) {
            metaEl.textContent = 'Could not load the list. Please try again later.';
        }
    }

    modal.querySelectorAll('.pools-table th').forEach(th => {
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
    if (location.hash === '#pools') openModal();
})();
