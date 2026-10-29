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

    const shortId = id => id.slice(0, 12) + '…' + id.slice(-6);

    // The governance roles that the pool declares in its registered metadata,
    // as the CIP "Disclosure of Governance Roles" reads them: a line under the
    // name. Only a declaration counts. Nothing is inferred from a name, a
    // website, a delegation or a vote. "No roles declared" is not the absence
    // of an overlap, and a reciprocal relation is not proof of who controls
    // both credentials: it proves that both documents name each other.
    function rolesLine(x) {
        if (!x.document) return null;
        const el = document.createElement('span');
        el.className = 'pools-roles';
        if (x.document !== 'valid') {
            el.textContent = 'Roles unknown: ' + (x.document === 'no anchor' ? 'no metadata registered' : 'metadata ' + x.document);
            return el;
        }
        if (!x.roles || !x.roles.length) {
            el.textContent = 'No roles declared';
            return el;
        }
        el.textContent = 'Roles: ' + x.roles.map(r => {
            if (r.kind === 'committee') return 'Constitutional Committee ' + shortId(r.cc_id) + ', ' + r.member + ' member';
            const who = r.kind === 'pool' ? 'pool ' + (r.ticker || shortId(r.pool_id)) : 'DRep ' + (r.name || shortId(r.drep_id));
            if (r.relation === 'unknown') {
                const other = r.document === 'no anchor' ? 'no metadata registered' : 'metadata ' + r.document;
                return who + ', declared by ' + r.declared_by + ', the other side has ' + other;
            }
            return who + ', ' + r.relation;
        }).join('. ');
        el.title = x.roles.map(r => r.kind === 'committee' ? r.cc_id : r.kind === 'pool' ? r.pool_id : r.drep_id).join('\n');
        return el;
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
                // A pool that announced its retirement stays listed until it
                // takes effect, with the epoch in which it retires.
                if (cls === 'pools-link' && p.retiring_epoch) {
                    const tag = document.createElement('span');
                    tag.className = 'pools-retiring';
                    tag.textContent = 'retiring in epoch ' + p.retiring_epoch;
                    tag.title = p.ticker + ' has announced its retirement; it stops at the start of epoch ' + p.retiring_epoch + '.';
                    td.appendChild(tag);
                }
                if (cls === 'pools-link') {
                    const roles = rolesLine(p);
                    if (roles) td.appendChild(roles);
                }
                tr.appendChild(td);
            }
            // The label shows on a phone, where each pool is a card (pools.css).
            for (const [v, label] of [[fmt(p.stake_ada), 'Stake (ADA)'], [fmt(p.blocks_2026), 'Blocks 2026'],
                [fmt(p.blocks_last_10_epochs), 'Blocks, last 10 epochs']]) {
                const td = document.createElement('td');
                td.textContent = v;
                td.className = 'num';
                td.dataset.label = label;
                tr.appendChild(td);
            }
            const actionTd = document.createElement('td');
            actionTd.className = 'pools-actions';
            const buttons = document.createElement('div');
            buttons.className = 'pools-buttons';
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'pools-delegate';
            del.textContent = 'Delegate';
            del.title = 'Delegate to ' + p.ticker + ' with your wallet';
            del.addEventListener('click', () => {
                if (window.sboDelegate) window.sboDelegate.open(p);
            });
            buttons.appendChild(del);
            actionTd.appendChild(buttons);
            tr.appendChild(actionTd);
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
                `Of ${fmt(d.pools_with_stake)} pools with stake, ${fmt(d.alive_named)} are alive and known to the public; ` +
                `${fmt(d.above_saturation)} of those are above the saturation point.` +
                (d.excluded ? ` Left out: ${fmt(d.excluded_exchanges)} pools of exchanges, ` +
                    `${fmt(d.excluded_founders)} of the founding entities and ` +
                    `${fmt(d.excluded_several || 0)} of owners with more than one pool.` : '');
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
