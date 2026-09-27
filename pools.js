// The daily list of live pools under the saturation point (pools.json).
(function () {
    'use strict';
    const fmt = n => n.toLocaleString('en-US');
    const rowsEl = document.getElementById('rows');
    const filterEl = document.getElementById('filter');
    let pools = [];
    let sortKey = 'stake_ada';
    let sortDesc = false;   // smallest first: the small pools first in view

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
            const tick = document.createElement('td');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pools-ticker';
            btn.textContent = p.ticker;
            btn.title = p.pool_id;
            btn.addEventListener('click', () => {
                navigator.clipboard && navigator.clipboard.writeText(p.pool_id).then(() => {
                    btn.textContent = 'copied';
                    setTimeout(() => { btn.textContent = p.ticker; }, 1200);
                });
            });
            tick.appendChild(btn);
            tr.appendChild(tick);
            for (const [v, cls] of [[p.name, ''], [fmt(p.stake_ada), 'num'], [fmt(p.blocks_2026), 'num'], [fmt(p.blocks_last_10_epochs), 'num']]) {
                const td = document.createElement('td');
                td.textContent = v;
                if (cls) td.className = cls;
                tr.appendChild(td);
            }
            frag.appendChild(tr);
        }
        rowsEl.replaceChildren(frag);
    }

    document.querySelectorAll('.pools-table th').forEach(th => {
        th.addEventListener('click', () => {
            const k = th.dataset.key;
            sortDesc = sortKey === k ? !sortDesc : typeof pools[0]?.[k] === 'number';
            sortKey = k;
            render();
        });
    });
    filterEl.addEventListener('input', render);

    fetch('pools.json', { cache: 'no-cache' })
        .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(d => {
            pools = d.pools;
            document.getElementById('saturation').textContent = fmt(d.saturation_ada);
            const day = d.generated.slice(0, 10);
            document.getElementById('meta').textContent =
                `${fmt(pools.length)} pools, updated ${day} (epoch ${d.epoch}). ` +
                `Of ${fmt(d.pools_with_stake)} pools with stake, ${fmt(d.alive_named)} are alive and named; ` +
                `${fmt(d.above_saturation)} of those are above the saturation point.`;
            render();
        })
        .catch(() => { document.getElementById('meta').textContent = 'The list could not be loaded. Please try again later.'; });
})();
