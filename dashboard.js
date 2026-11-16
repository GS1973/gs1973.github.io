// Dashboard: who holds the power in Cardano, in one view (dashboard.json,
// same origin, made every day by the same job as the pool and DRep lists).
// Opens from the Dashboard button, or directly on a link to /#dashboard.
//
// The lookup at the bottom reads only from this site: the address a visitor
// enters, or the stake address a wallet gives (CIP-30 getRewardAddresses, read
// only, nothing is signed), stays in the browser. Only the file of 1 in 256
// (lookup/<first two hex>.txt) is fetched, which says nothing about who asks.
(function () {
    'use strict';

    const btn = document.getElementById('dashboardBtn');
    const modal = document.getElementById('dashboardModal');
    const closeBtn = document.getElementById('dashboardClose');
    const $ = id => document.getElementById(id);
    if (!btn || !modal || !closeBtn) return;

    const SVG = 'http://www.w3.org/2000/svg';
    const WALLETS = { eternl: 'Eternl', gerowallet: 'Gero', lace: 'Lace', typhoncip30: 'Typhon', vespr: 'VESPR' };   // as delegate.js
    const CLS = { spo: 'Also runs a stake pool', cc: 'Also on the Constitutional Committee', drep: 'DRep only' };
    const cap = t => t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
    // The reason a DRep has its colour, as one or more sentences.
    function reason(x) {
        if (x.cls === 'drep') return 'DRep only: No other role found in what it declares.' + (x.why ? ' It ' + x.why + '.' : '');
        return CLS[x.cls] + ': ' + cap(x.why) + '.';
    }
    let lastFocused = null;
    let data = null;
    let index = null;

    // ---------- the window ----------
    function openModal() {
        lastFocused = document.activeElement;
        modal.hidden = false;
        document.addEventListener('keydown', onKeydown);
        closeBtn.focus();
        if (!data) load();
    }

    function closeModal() {
        modal.hidden = true;
        document.removeEventListener('keydown', onKeydown);
        if (location.hash.toLowerCase() === '#dashboard') history.replaceState(null, '', location.pathname + location.search);
        if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    }

    function onKeydown(event) {
        if (event.key === 'Escape') closeModal();
    }

    // ---------- helpers ----------
    function el(tag, cls, text) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined) e.textContent = text;
        return e;
    }

    function svg(tag, attrs) {
        const e = document.createElementNS(SVG, tag);
        for (const k in attrs) e.setAttribute(k, attrs[k]);
        return e;
    }

    const fmt = n => n.toLocaleString('en-US');
    function ada(n) {            // n in ADA
        if (n >= 1e9) return (n / 1e9).toFixed(1) + ' billion';
        if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e8 ? 0 : 1) + ' million';
        return fmt(Math.round(n));
    }
    const pct = (a, b) => b ? (100 * a / b) : 0;
    const BAND = ['Above saturation at k = 1000', '10M ADA to saturation', '1 to 10M ADA', 'Under 1M ADA'];   // short labels; the full ones in the tooltip
    const VOTE = ['Active DReps', 'No Confidence', 'Inactive DReps', 'Always Abstain', 'No DRep'];
    const low = t => t.charAt(0).toLowerCase() + t.slice(1);
    const pctText = x => (x < 1 && x > 0) ? 'under 1%' : x.toFixed(x < 10 ? 1 : 0) + '%';

    // ---------- loading ----------
    async function load() {
        try {
            const r = await fetch('dashboard.json', { cache: 'no-cache' });
            if (!r.ok) throw new Error(r.status);
            data = await r.json();
            render();
        } catch (e) {
            $('dashMeta').textContent = 'The dashboard could not be loaded. Please try again later.';
        }
    }

    function render() {
        const d = data;
        $('dashMeta').textContent = 'Epoch ' + d.epoch + ', measured on ' + d.generated.slice(0, 10) + ' from the Cardano chain.';
        $('dashMeta').title = 'The figures are the same as in the DRep window and the Decentralization Monitor.';
        cards(d);
        stakeBar(d);
        voteBar(d);
        chart(d);
        largest(d);
        flows(d);
    }

    // ---------- the key figures ----------
    function card(big, line1, line2, was) {
        const c = el('div', 'dash-card');
        c.append(el('div', 'dash-big', String(big)), el('div', 'dash-line', line1), el('div', 'dash-line', line2));
        if (was) c.append(el('div', 'dash-was', was));
        return c;
    }

    function wasText(now, before, epoch) {
        if (before === null || before === undefined) return '';
        return before === now ? 'The same a month ago' : before + ' a month ago (epoch ' + epoch + ')';
    }

    function cards(d) {
        const k = d.key;
        const box = $('dashCards');
        box.replaceChildren(
            card(k.owners_third, 'owners hold more than', 'a third of all stake', wasText(k.owners_third, k.owners_third_prev, k.prev_epoch)),
            card(k.block, 'DReps together can block', 'any treasury withdrawal', wasText(k.block, k.block_prev, k.prev_epoch)),
            card(k.carry, 'DReps together carry', 'a treasury withdrawal', wasText(k.carry, k.carry_prev, k.prev_epoch)));
    }

    // ---------- the two bars ----------
    function bar(target, parts, total, colors, short) {
        const wrap = el('div', 'dash-bar');
        const legend = el('div', 'dash-legend');
        parts.forEach((p, i) => {
            const share = pct(p.ada, total);
            const seg = el('div', 'dash-seg ' + colors[i]);
            const item = el('span', 'dash-key');
            seg.style.flexGrow = String(Math.max(p.ada, 0));
            seg.title = cap(p.label) + ': ' + ada(p.ada) + ' ADA (' + pctText(share) + ')';
            item.title = seg.title;
            wrap.append(seg);
            item.append(el('span', 'dash-swatch ' + colors[i]), document.createTextNode((short ? short[i] : p.label) + ' ' + pctText(share)));
            legend.append(item);
        });
        target.replaceChildren(wrap, legend);
    }

    function stakeBar(d) {
        const parts = d.stake_bands.map(b => ({ label: b.label + ' (' + fmt(b.pools) + ' pools)', ada: b.ada }));
        bar($('dashStake'), parts, d.stake_total_ada, ['dash-g4', 'dash-g3', 'dash-g2', 'dash-g1'], BAND);
    }

    function voteBar(d) {
        bar($('dashVote'), d.vote_bar, d.circulating_ada, ['dash-v-active', 'dash-v-nc', 'dash-v-inactive', 'dash-v-abstain', 'dash-v-none'], VOTE);
    }

    // ---------- every active DRep ----------
    function chart(d) {
        const W = 860, H = 215, L = 50, R = 8, T = 8, B = 12;
        const n = d.dreps.length;
        const vmax = Math.max(...d.dreps.map(x => x.ada));
        const step = vmax > 400e6 ? 250e6 : 100e6;
        const top = Math.ceil(vmax / step) * step;
        const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'dash-svg', role: 'img',
            'aria-label': 'Voting power of all ' + n + ' active DReps, largest first' });
        const y = v => T + (H - T - B) * (1 - v / top);
        for (let v = 0; v <= top; v += step) {
            s.append(svg('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'dash-grid' }));
            const t = svg('text', { x: L - 6, y: y(v) + 4, class: 'dash-axis', 'text-anchor': 'end' });
            t.textContent = v === 0 ? '0' : (v / 1e6) + 'M';
            s.append(t);
        }
        const bw = (W - L - R) / n;
        const bars = d.dreps.map((x, i) => {
            const h = Math.max((H - T - B) * x.ada / top, 0.8);
            const r = svg('rect', { x: L + i * bw, y: y(0) - h, width: Math.max(bw - 0.6, 0.8), height: h,
                class: 'dash-c-' + x.cls, 'data-b': i });
            s.append(r);
            return r;
        });
        [[d.block, 'can block'], [d.carry, 'carry']].forEach(([k, what], j) => {
            const lx = L + k * bw;
            s.append(svg('line', { x1: lx, x2: lx, y1: T + 18 + j * 22, y2: y(0), class: 'dash-mark' }));
            const t = svg('text', { x: lx + 6, y: T + 22 + j * 22, class: 'dash-marktext' });
            t.textContent = k + ' DReps ' + what;
            s.append(t);
        });
        // An invisible area over the full height of each column, on top of the
        // bars and the marks: a small DRep is as easy to point at as a large one.
        const hits = d.dreps.map((x, i) => {
            const r = svg('rect', { x: L + i * bw, y: T, width: bw, height: y(0) - T,
                class: 'dash-hit', tabindex: i < 40 ? 0 : -1, 'data-i': i });
            s.append(r);
            return r;
        });
        const box = $('dashChart');
        const tip = el('div', 'dash-tip');
        tip.hidden = true;
        box.replaceChildren(s, tip);

        const total = d.dreps.reduce((a, b) => a + b.ada, 0);
        function show(target) {
            const i = Number(target.getAttribute('data-i'));
            const x = d.dreps[i];
            tip.replaceChildren(el('strong', '', (i + 1) + '. ' + (x.name || x.drep_id.slice(0, 14) + '…')),
                el('div', '', ada(x.ada) + ' ADA, ' + pctText(pct(x.ada, total)) + ' of the active vote'),
                el('div', 'dash-tipwhy', reason(x)));
            tip.hidden = false;
            const br = box.getBoundingClientRect(), rr = target.getBoundingClientRect();
            const right = rr.left - br.left + 14 + 280 > br.width;              // near the right edge: show it on the left
            const left = (right ? rr.left - br.left - 284 : rr.left - br.left + 14) + box.scrollLeft;   // the box scrolls on a phone
            tip.style.left = Math.max(left, 0) + 'px';
            tip.style.top = '4px';
            off();
            bars[i].classList.add('dash-on');
            hits[i].classList.add('dash-col');
        }
        function off() {
            box.querySelectorAll('.dash-on').forEach(e => e.classList.remove('dash-on'));
            box.querySelectorAll('.dash-col').forEach(e => e.classList.remove('dash-col'));
        }
        s.addEventListener('mouseover', e => { if (e.target.hasAttribute('data-i')) show(e.target); });
        s.addEventListener('focusin', e => { if (e.target.hasAttribute('data-i')) show(e.target); });
        s.addEventListener('mouseleave', () => { tip.hidden = true; off(); });
        // On a touch screen the first tap shows the name, a second tap on the
        // same column opens it; with a mouse a click opens it at once.
        let tapped = null;
        s.addEventListener('click', e => {
            if (!e.target.hasAttribute('data-i')) return;
            const i = Number(e.target.getAttribute('data-i'));
            if (window.matchMedia('(hover: none)').matches && tapped !== i) {
                tapped = i;
                show(e.target);
                return;
            }
            window.open('https://cardanoscan.io/dRep/' + encodeURIComponent(d.dreps[i].drep_id), '_blank', 'noopener');
        });
    }

    function largest(d) {
        const box = $('dashLargest');
        const list = el('ol', 'dash-largest');
        d.dreps.slice(0, d.carry).forEach(x => {
            const li = el('li', 'dash-c-' + x.cls + '-text', x.name || x.drep_id.slice(0, 14) + '…');
            if (x.pools >= 2) li.append(el('span', 'dash-pools', ' ' + x.pools + ' pools, ' + ada(x.pools_ada)));
            li.title = reason(x);
            list.append(li);
        });
        const h = el('h3', '', 'The ' + d.carry + ' largest');
        h.title = 'Together they carry a treasury withdrawal. The first ' + d.block + ' can block one.';
        box.replaceChildren(h, list);
    }

    // ---------- where it moved ----------
    function flows(d) {
        const box = $('dashFlows');
        const f = d.flows;
        if (!f) { box.replaceChildren(el('p', 'pools-meta', 'Not measured yet for this epoch.')); return; }
        const sign = n => (n > 0 ? '+ ' : n < 0 ? '- ' : '') + ada(Math.abs(n)) + ' ADA';
        const tiles = el('div', 'dash-flows');
        f.pool_bands_net_ada.forEach((n, i) => {
            const t = el('div', 'dash-flow');
            t.title = 'Pools ' + d.stake_bands[i].label;
            t.append(el('div', 'dash-flowlabel', ['Pools above saturation', 'Pools 10M to saturation', 'Pools 1 to 10M', 'Pools under 1M'][i] + ', stake'), el('div', 'dash-flownum ' + (n < 0 ? 'dash-neg' : 'dash-pos'), sign(n)));
            tiles.append(t);
        });
        const t = el('div', 'dash-flow');
        t.append(el('div', 'dash-flowlabel', 'The ' + f.carry_group + ' largest DReps, votes'),
            el('div', 'dash-flownum ' + (f.carry_group_net_ada < 0 ? 'dash-neg' : 'dash-pos'), sign(f.carry_group_net_ada)));
        t.title = f.carry_group_share_of_moved === null ? '' : Math.round(100 * f.carry_group_share_of_moved) + '% of all vote delegation that moved went to them';
        tiles.append(t);
        box.replaceChildren(tiles, el('p', 'dash-hint', 'From epoch ' + f.from_epoch + ' to epoch ' + f.to_epoch +
            ': Stake that moved to another pool, and vote delegation that moved to another DRep, in minus out.'));
    }

    // ---------- the lookup ----------
    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    function bech32Bytes(s) {
        s = s.trim().toLowerCase();
        const pos = s.lastIndexOf('1');
        if (pos < 1 || s.length - pos < 8) throw new Error('format');
        const hrp = s.slice(0, pos);
        const data = [];
        for (const c of s.slice(pos + 1)) {
            const v = CHARSET.indexOf(c);
            if (v < 0) throw new Error('format');
            data.push(v);
        }
        const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
        let chk = 1;
        const values = [...[...hrp].map(c => c.charCodeAt(0) >> 5), 0, ...[...hrp].map(c => c.charCodeAt(0) & 31), ...data];
        for (const v of values) {
            const b = chk >>> 25;
            chk = ((chk & 0x1ffffff) << 5) ^ v;
            for (let i = 0; i < 5; i++) if ((b >>> i) & 1) chk ^= GEN[i];
        }
        if (chk !== 1) throw new Error('checksum');
        let acc = 0, bits = 0;
        const out = [];
        for (const v of data.slice(0, -6)) {
            acc = (acc << 5) | v; bits += 5;
            while (bits >= 8) { bits -= 8; out.push((acc >> bits) & 255); }
        }
        return { hrp, bytes: out };
    }

    const hex = b => b.map(x => x.toString(16).padStart(2, '0')).join('');

    // The stake credential of an address, as 56 hex characters.
    function credOf(bytes) {
        const head = bytes[0] >> 4, net = bytes[0] & 15;
        if (net !== 1) throw new Error('network');
        if ((head === 14 || head === 15) && bytes.length === 29) return hex(bytes.slice(1));
        if (head <= 3 && bytes.length === 57) return hex(bytes.slice(29));
        if (head === 6 || head === 7) throw new Error('enterprise');
        if (head === 4 || head === 5) throw new Error('pointer');
        throw new Error('format');
    }

    const LOOKUP_ERRORS = {
        format: 'This is not a Cardano address. Enter an address that starts with stake1 or addr1.',
        checksum: 'This address has a typing error: Its checksum does not match.',
        network: 'This is not a mainnet address.',
        enterprise: 'This address has no stake part, so it cannot delegate. Enter the stake address or a receive address of the wallet.',
        pointer: 'This is a pointer address. Enter the stake address of the wallet.',
        notfound: 'This address delegates to no pool and no DRep.',
        load: 'The lookup could not be loaded. Please try again later.',
    };

    async function lookUp(cred) {
        if (!index) {
            const r = await fetch('lookup/index.json', { cache: 'no-cache' });
            if (!r.ok) throw new Error('load');
            index = await r.json();
        }
        const r = await fetch('lookup/' + cred.slice(0, 2) + '.txt', { cache: 'no-cache' });
        if (!r.ok) throw new Error('load');
        const lines = (await r.text()).split('\n');
        const key = cred.slice(2, 12);
        let lo = 0, hi = lines.length - 1;
        while (lo <= hi) {                                // the lines are sorted
            const mid = (lo + hi) >> 1;
            const k = lines[mid].slice(0, 10);
            if (k === key) return lines[mid].split(' ');
            if (k < key) lo = mid + 1; else hi = mid - 1;
        }
        return null;
    }

    function line(label, value, note) {
        const p = el('p', 'dash-resline');
        p.append(el('strong', '', label + ' '), document.createTextNode(value));
        if (note) p.append(el('span', 'dash-resnote', ' ' + note));
        return p;
    }

    function showResult(row) {
        const box = $('dashResult');
        const d = data;
        box.hidden = false;
        if (!row) { box.replaceChildren(el('p', '', LOOKUP_ERRORS.notfound)); return; }
        const [, pc, dc] = row;
        const out = [];
        if (pc === '-') out.push(line('Your stake:', 'Not delegated to a pool.'));
        else {
            const p = index.pool[pc];
            const nm = p ? (p[1] || p[0].slice(0, 14) + '…') + (p[2] ? ' (' + p[2] + ')' : '') : 'a pool';
            const stake = p ? p[4] : 0;
            out.push(line('Your stake:', 'Pool ' + nm + (stake ? ', with ' + ada(stake) + ' ADA of stake.' : '.'),
                stake ? '' : 'This pool has no stake this epoch.'));
        }
        let rank = null;
        if (dc === '-') out.push(line('Your vote:', 'No DRep. Your ADA does not take part in the vote.'));
        else if (dc === 'A') out.push(line('Your vote:', 'Always Abstain. Your ADA never votes.'));
        else if (dc === 'N') out.push(line('Your vote:', 'Always No Confidence.'));
        else {
            const x = index.drep[dc];
            const nm = x ? (x[1] || x[0].slice(0, 14) + '…') : 'a DRep';
            rank = x ? x[4] : null;
            let note = '';
            if (x && x[2] !== 'active') note = 'This DRep is not active: The ADA delegated to it counts for nothing.';
            else if (rank && rank <= d.block) note = 'Number ' + rank + ' of ' + d.dreps.length + ': One of the ' + d.block + ' DReps who together can block a treasury withdrawal.';
            else if (rank && rank <= d.carry) note = 'Number ' + rank + ' of ' + d.dreps.length + ': One of the ' + d.carry + ' DReps who together carry a treasury withdrawal.';
            else if (rank) note = 'Number ' + rank + ' of ' + d.dreps.length + ' active DReps.';
            if (x && x[3] && x[3] !== 'drep') note += ' This DRep ' + low(CLS[x[3]]) + '.';
            const power = x ? x[5] : null;
            out.push(line('Your vote:', 'DRep ' + nm + (power ? ', with ' + ada(power) + ' ADA of voting power.' : '.'), note));
        }
        const go = el('div', 'dash-go');
        const toPools = el('button', 'dash-btn', 'See the pool list');
        const toDreps = el('button', 'dash-btn', 'See the DRep list');
        toPools.type = toDreps.type = 'button';
        toPools.addEventListener('click', () => { closeModal(); $('poolsBtn') && $('poolsBtn').click(); });
        toDreps.addEventListener('click', () => { closeModal(); $('drepsBtn') && $('drepsBtn').click(); });
        go.append(toPools, toDreps);
        box.replaceChildren(...out, go);
        document.querySelectorAll('#dashChart .dash-mine').forEach(e => e.classList.remove('dash-mine'));
        if (rank) {
            const r = document.querySelector('#dashChart rect[data-b="' + (rank - 1) + '"]');
            if (r) r.classList.add('dash-mine');
        }
    }

    async function run(getCred) {
        const box = $('dashResult');
        box.hidden = false;
        box.replaceChildren(el('p', 'pools-meta', 'Looking up…'));
        try {
            const cred = await getCred();
            showResult(await lookUp(cred));
        } catch (e) {
            box.replaceChildren(el('p', '', LOOKUP_ERRORS[e.message] || e.message || LOOKUP_ERRORS.load));
        }
    }

    function walletList() {
        const c = window.cardano || {};
        return Object.keys(WALLETS).filter(k => c[k] && typeof c[k].enable === 'function');
    }

    $('dashLook').addEventListener('click', () => run(async () => credOf(bech32Bytes($('dashAddr').value).bytes)));
    $('dashAddr').addEventListener('keydown', e => { if (e.key === 'Enter') $('dashLook').click(); });
    $('dashConnect').addEventListener('click', () => {
        const box = $('dashWallets');
        const keys = walletList();
        box.hidden = false;
        if (!keys.length) {
            box.replaceChildren(el('p', '', 'No supported wallet was found in this browser (Eternl, Gero, Lace, Typhon or VESPR). You can enter an address instead.'));
            return;
        }
        box.replaceChildren(...keys.map(k => {
            const b = el('button', 'dash-btn', WALLETS[k]);
            b.type = 'button';
            b.addEventListener('click', () => run(async () => {
                let api;
                try { api = await window.cardano[k].enable(); } catch (e) { throw new Error('The wallet did not give access.'); }
                if (Number(await api.getNetworkId()) !== 1) throw new Error('network');
                const rewards = (await api.getRewardAddresses()) || [];
                if (!rewards.length) throw new Error('This wallet has no stake address.');
                const b2 = rewards[0].match(/../g).map(h => parseInt(h, 16));
                return credOf(b2);
            }));
            return b;
        }));
    });

    btn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    // /#dashboard opens the window, in any case of letters (#Dashboard), also when the hash changes on the page
    const wanted = () => location.hash.toLowerCase() === '#dashboard';
    if (wanted()) openModal();
    window.addEventListener('hashchange', () => { if (wanted() && modal.hidden) openModal(); });
})();
