// Dashboard: who holds the power in Cardano (dashboard.json, same origin, made
// every day by the same job as the pool and DRep lists). Two views behind one
// switch: the DReps and the stake pools, each with four key figures, one chart
// with the largest beside it, one bar and where delegation moved. The overlap,
// the same hands with stake and with a vote, is shown from both sides.
// Opens from the Dashboard button, or on a link to /#dashboard (the DReps) or
// /#stake (the stake pools), in any case of letters.
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
    const low = t => t.charAt(0).toLowerCase() + t.slice(1);
    let lastFocused = null;
    let data = null;
    let index = null;
    let view = 'dreps';

    // The reason a DRep has its colour, as one or more sentences.
    function reason(x) {
        if (x.cls === 'drep') return 'DRep only: No other role found in what it declares.' + (x.why ? ' It ' + x.why + '.' : '');
        return CLS[x.cls] + ': ' + cap(x.why) + '.';
    }

    // ---------- the window and its two views ----------
    function openModal(which) {
        lastFocused = document.activeElement;
        modal.hidden = false;
        document.addEventListener('keydown', onKeydown);
        closeBtn.focus();
        show(which || view);
        if (!data) load();
    }

    function closeModal() {
        modal.hidden = true;
        document.removeEventListener('keydown', onKeydown);
        if (['#dashboard', '#stake'].includes(location.hash.toLowerCase())) history.replaceState(null, '', location.pathname + location.search);
        if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    }

    function onKeydown(event) {
        if (event.key === 'Escape') closeModal();
    }

    function show(which) {
        view = which;
        ['dreps', 'pools'].forEach(v => {
            const tab = $('dashTab-' + v), panel = $('dashView-' + v);
            const on = v === which;
            tab.setAttribute('aria-selected', on ? 'true' : 'false');
            tab.classList.toggle('dash-tab-on', on);
            tab.tabIndex = on ? 0 : -1;
            panel.hidden = !on;
        });
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
        if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 1 : 2) + ' billion';
        if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e8 ? 0 : 1) + ' million';
        return fmt(Math.round(n));
    }
    const pct = (a, b) => b ? (100 * a / b) : 0;
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
        drepView(d);
        poolView(d);
    }

    // ---------- the key figures ----------
    function card(big, line1, line2, was) {
        const c = el('div', 'dash-card');
        c.append(el('div', 'dash-big', String(big)), el('div', 'dash-line', line1 + ' ' + line2));   // one text, so it wraps by itself
        c.append(el('div', 'dash-was', was || ''));
        return c;
    }

    function wasText(now, before, epoch) {
        if (before === null || before === undefined) return '';
        return before === now ? 'The same a month ago' : before + ' a month ago (epoch ' + epoch + ')';
    }

    const share = x => (x === null || x === undefined) ? '' : Math.round(100 * x) + '%';

    // ---------- one chart, used by both views ----------
    // items: [{value, cls, lines: [title, line, reason], url}] largest first.
    // marks: [[count, text]]. A column has an invisible hit area over its full
    // height, so a small one is as easy to point at as a large one.
    function chart(box, items, marks, opts) {
        const W = 860, H = opts.height || 215, L = 68, R = 8, T = 8, B = 26;
        const n = items.length;
        const vmax = Math.max(...items.map(x => x.value));
        const step = opts.step || 100e6;
        const top = Math.ceil(vmax / step) * step;
        const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'dash-svg', role: 'img', 'aria-label': opts.label });
        const y = v => T + (H - T - B) * (1 - v / top);
        for (let v = 0; v <= top; v += step) {
            s.append(svg('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'dash-grid' }));
            const t = svg('text', { x: L - 6, y: y(v) + 4, class: 'dash-axis', 'text-anchor': 'end' });
            t.textContent = v === 0 ? '0' : (v >= 1e9 ? (v / 1e9) + 'bn ADA' : (v / 1e6) + 'M ADA');
            s.append(t);
        }
        const bw = (W - L - R) / n;
        opts.ticks.filter(r => r <= n).forEach(r => {
            const cx = L + (r - 0.5) * bw;
            s.append(svg('line', { x1: cx, x2: cx, y1: y(0), y2: y(0) + 4, class: 'dash-tick' }));
            const t = svg('text', { x: cx, y: y(0) + 14, class: 'dash-axis', 'text-anchor': 'middle' });
            t.textContent = String(r);
            s.append(t);
        });
        const xt = svg('text', { x: W - R, y: H - 2, class: 'dash-axis', 'text-anchor': 'end' });
        xt.textContent = opts.xTitle;
        s.append(xt);
        const bars = items.map((x, i) => {
            const h = Math.max((H - T - B) * x.value / top, 0.8);
            const r = svg('rect', { x: L + i * bw, y: y(0) - h, width: bw > 2 ? bw - 0.6 : bw, height: h, class: 'dash-c-' + x.cls, 'data-b': i });
            s.append(r);
            return r;
        });
        marks.forEach(([k, what], j) => {
            const lx = L + k * bw;
            s.append(svg('line', { x1: lx, x2: lx, y1: T + 18 + j * 22, y2: y(0), class: 'dash-mark' }));
            const t = svg('text', { x: lx + 6, y: T + 22 + j * 22, class: 'dash-marktext' });
            t.textContent = what;
            s.append(t);
        });
        const hits = items.map((x, i) => {
            const r = svg('rect', { x: L + i * bw, y: T, width: bw, height: y(0) - T, class: 'dash-hit', tabindex: i < 40 ? 0 : -1, 'data-i': i });
            s.append(r);
            return r;
        });
        const tip = el('div', 'dash-tip');
        tip.hidden = true;
        box.replaceChildren(s, tip);

        function showTip(target) {
            const i = Number(target.getAttribute('data-i'));
            const [first, ...rest] = items[i].lines;
            tip.replaceChildren(el('strong', '', first), ...rest.map((t, j) => el('div', j === rest.length - 1 && rest.length > 1 ? 'dash-tipwhy' : '', t)));
            tip.hidden = false;
            const br = box.getBoundingClientRect(), rr = target.getBoundingClientRect();
            const right = rr.left - br.left + 14 + 280 > br.width;
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
        s.addEventListener('mouseover', e => { if (e.target.hasAttribute('data-i')) showTip(e.target); });
        s.addEventListener('focusin', e => { if (e.target.hasAttribute('data-i')) showTip(e.target); });
        s.addEventListener('mouseleave', () => { tip.hidden = true; off(); });
        // On a touch screen the first tap shows the name, a second tap on the
        // same column opens it; with a mouse a click opens it at once.
        let tapped = null;
        s.addEventListener('click', e => {
            if (!e.target.hasAttribute('data-i')) return;
            const i = Number(e.target.getAttribute('data-i'));
            if (window.matchMedia('(hover: none)').matches && tapped !== i) { tapped = i; showTip(e.target); return; }
            if (items[i].url) window.open(items[i].url, '_blank', 'noopener');
        });
    }

    function largest(box, title, hint, rows) {
        const h = el('h3', '', title);
        h.title = hint;
        const list = el('ol', 'dash-largest');
        rows.forEach(r => {
            const li = el('li', 'dash-c-' + r.cls + '-text', r.name);
            if (r.extra) li.append(el('span', 'dash-pools', ' ' + r.extra));
            li.title = r.title || '';
            list.append(li);
        });
        box.replaceChildren(h, list);
    }

    // one more card in the row of figures: how many there are, how many are not
    // in the chart and how many are
    function counts(row, title, rows) {
        const c = el('div', 'dash-card dash-countcard');
        c.append(el('div', 'dash-countstitle', title));
        rows.forEach(([n, what]) => { c.append(el('span', 'dash-countn', fmt(n)), el('span', 'dash-countwhat', what)); });
        row.append(c);
        row.classList.add('dash-cards-5');
    }

    // ---------- the DReps ----------
    function drepView(d) {
        const k = d.key;
        $('dashCards-dreps').replaceChildren(
            card(k.block, 'DReps together can block', 'any treasury withdrawal', wasText(k.block, k.block_prev, k.prev_epoch)),
            card(k.carry, 'DReps together carry', 'a treasury withdrawal', wasText(k.carry, k.carry_prev, k.prev_epoch)),
            card(k.linked_dreps, 'DReps also run a stake pool,', 'with ' + share(k.linked_share) + ' of the active vote', ''),
            card(share(k.no_vote_share), 'of all ADA abstains', 'or has no DRep', ''));
        const total = d.dreps.reduce((a, b) => a + b.ada, 0);
        const items = d.dreps.map((x, i) => ({
            value: x.ada, cls: x.cls,
            lines: [(i + 1) + '. ' + (x.name || x.drep_id.slice(0, 14) + '…'), ada(x.ada) + ' ADA, ' + pctText(pct(x.ada, total)) + ' of the active vote', reason(x)],
            url: 'https://cardanoscan.io/dRep/' + encodeURIComponent(x.drep_id),
        }));
        chart($('dashChart-dreps'), items, [[d.block, d.block + ' DReps can block'], [d.carry, d.carry + ' DReps carry']],
            { label: 'Voting power of all ' + items.length + ' active DReps, largest first', ticks: [1, 10, 50, 100, 150, 200, 250], xTitle: 'Rank by voting power', step: 100e6, height: 300 });
        largest($('dashLargest-dreps'), 'The ' + d.carry + ' who carry', 'Together they carry a treasury withdrawal. The first ' + d.block + ' can block one.',
            d.dreps.slice(0, d.carry).map(x => ({ name: x.name || x.drep_id.slice(0, 14) + '…', cls: x.cls,
                extra: x.pools >= 2 ? x.pools + ' pools, ' + ada(x.pools_ada) : '', title: reason(x) })));
        if (k.dreps_registered) counts($('dashCards-dreps'), 'DReps', [[k.dreps_registered, 'registered'],
            [k.dreps_registered - items.length, 'not active'], [items.length, 'active']]);
    }

    // ---------- the stake pools ----------
    function poolView(d) {
        const k = d.key, o = d.owners;
        $('dashCards-pools').replaceChildren(
            card(k.owners_third, 'owners hold more than', 'a third of all stake', wasText(k.owners_third, k.owners_third_prev, k.prev_epoch)),
            card(k.owners_half, 'owners hold', 'half of all stake', wasText(k.owners_half, k.owners_half_prev, k.prev_epoch)),
            card(k.large_dreps, 'DReps belong to the ' + k.owners_half + ' largest', 'owners, with ' + share(k.large_share) + ' of the active vote', ''),
            card(fmt(k.producing || 0), 'pools made a block', 'in the past year', ''));
        if (!o) {
            $('dashChart-pools').replaceChildren(el('p', 'pools-meta', 'The owners could not be grouped today.'));
            $('dashLargest-pools').replaceChildren();
            $('dashRest').textContent = '';
            return;
        }
        const has = x => x.dreps && x.dreps.length;      // the DReps the monitor links to this owner
        const cls = x => has(x) ? 'spo' : (x.pools >= 2 ? 'multi' : 'drep');
        const brief = n => ada(n).replace(' million', 'M').replace(' billion', 'bn');
        const items = o.top.map((x, i) => ({
            value: x.ada, cls: cls(x), url: x.pool ? 'https://cardanoscan.io/pool/' + encodeURIComponent(x.pool) : '',
            lines: [(i + 1) + '. ' + x.name, ada(x.ada) + ' ADA, ' + pctText(pct(x.ada, o.total_ada)) + ' of all stake, in ' + x.pools + (x.pools === 1 ? ' pool' : ' pools'),
                (x.tickers && x.tickers.length ? 'Tickers ' + x.tickers.join(', ') + (x.pools > x.tickers.length ? ' and more' : '') + '. ' : '')
                + (has(x) ? 'Also has a DRep: ' + x.dreps.map(r => r.name + ' (number ' + r.rank + ', ' + ada(r.ada) + ' ADA of voting power)').join(', ') + '.'
                    : 'No DRep linked to ' + (x.pools === 1 ? 'this pool.' : 'these pools.'))],
        }));
        const n = items.length, vmax = n ? items[0].value : 0;
        const every = n > 600 ? 200 : n > 250 ? 100 : 50;
        const ticks = [1];
        for (let r = every; r <= n; r += every) ticks.push(r);
        chart($('dashChart-pools'), items, [[o.third, o.third + ' owners: a third'], [o.half, o.half + ' owners: half']],
            { label: 'Stake of the ' + fmt(n) + ' pool owners with an active pool, largest first', ticks, xTitle: 'Rank by stake',
              step: vmax > 2e9 ? 500e6 : 100e6, height: 390 });   // this chart is narrower: the same height on the page as the DReps chart
        $('dashRest').textContent = (o.producing ? 'One bar for each of the ' + fmt(n) + ' owners with a pool that made a block in the past year. '
            : 'One bar for each of the ' + fmt(n) + ' largest owners. ')
            + 'The other ' + fmt(o.count - n) + ' owners hold ' + pctText(pct(o.rest_ada, o.total_ada)) + ' of all stake together.'
            + ' Click a bar, or tap it again, to open the largest pool of that owner on Cardanoscan.';
        largest($('dashLargest-pools'), 'The ' + o.half + ' who hold half', 'Owners as in the Decentralization Monitor: Pools of one owner key, reward account or organization count together. The first ' + o.third + ' hold more than a third.',
            o.top.slice(0, o.half).map(x => ({ name: x.name, cls: cls(x),
                extra: (x.pools === 1 ? '' : x.pools + ' pools, ') + brief(x.ada),
                title: has(x) ? 'Also has a DRep: ' + x.dreps.map(r => r.name).join(', ') : '' })));
        if (o.producing) counts($('dashCards-pools'), 'Pool owners', [[o.count, 'with stake in their pools'],
            [o.count - n, 'no block in the past year'], [n, 'a block in the past year']]);
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
        document.querySelectorAll('#dashboardModal .dash-mine').forEach(e => e.classList.remove('dash-mine'));
        if (!row) { box.replaceChildren(el('p', '', LOOKUP_ERRORS.notfound)); return; }
        const [, pc, dc] = row;
        const out = [];
        if (pc === '-') out.push(line('Your stake:', 'Not delegated to a pool.'));
        else {
            const p = index.pool[pc];
            const nm = p ? (p[1] || p[0].slice(0, 14) + '…') + (p[2] ? ' (' + p[2] + ')' : '') : 'a pool';
            const stake = p ? p[4] : 0;
            let note = stake ? '' : 'This pool has no stake this epoch.';
            // the owner of the pool, when it is among the owners in the chart
            const oi = p && d.owners && Number.isInteger(p[5]) && d.owners.top[p[5]] ? p[5] : -1;
            if (oi >= 0) {
                const o = d.owners.top[oi];
                note = 'Its owner is number ' + (oi + 1) + ' of the ' + fmt(d.owners.top.length) + ' owners in the chart, with ' + o.pools + (o.pools === 1 ? ' pool' : ' pools') + ' and ' + ada(o.ada) + ' ADA.'
                    + (o.dreps && o.dreps.length ? ' This owner also has a DRep: ' + o.dreps.map(r => r.name).join(', ') + '.' : '');
                const r = document.querySelector('#dashChart-pools rect[data-b="' + oi + '"]');
                if (r) r.classList.add('dash-mine');
            }
            out.push(line('Your stake:', 'Pool ' + nm + (stake ? ', with ' + ada(stake) + ' ADA of stake.' : '.'), note));
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
            if (rank) {
                const r = document.querySelector('#dashChart-dreps rect[data-b="' + (rank - 1) + '"]');
                if (r) r.classList.add('dash-mine');
            }
        }
        const go = el('div', 'dash-go');
        const toPools = el('button', 'dash-btn', 'See the pool list');
        const toDreps = el('button', 'dash-btn', 'See the DRep list');
        toPools.type = toDreps.type = 'button';
        toPools.addEventListener('click', () => { closeModal(); $('poolsBtn') && $('poolsBtn').click(); });
        toDreps.addEventListener('click', () => { closeModal(); $('drepsBtn') && $('drepsBtn').click(); });
        go.append(toPools, toDreps);
        box.replaceChildren(...out, go);
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

    // What the wallet itself reported, as plain text. CIP-30 errors carry `info`
    // and a numeric `code`, other errors a `message`.
    function walletSaid(e) {
        const t = e && (e.info || e.message || (e.code !== undefined ? 'code ' + e.code : ''));
        return t ? ' The wallet said: ' + String(t).slice(0, 200) : '';
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
                // A wallet that asks for permission in a window of its own keeps
                // enable() pending until the visitor answers. Say so, because that
                // window can open behind the browser.
                const waiting = setTimeout(() => {
                    $('dashResult').replaceChildren(el('p', 'pools-meta', 'Waiting for ' + WALLETS[k] + '. Look for a wallet window that asks for permission. It can open behind this window.'));
                }, 6000);
                try { api = await window.cardano[k].enable(); }
                catch (e) { throw new Error('The wallet did not give access.' + walletSaid(e)); }
                finally { clearTimeout(waiting); }
                let net, rewards;
                try {
                    net = Number(await api.getNetworkId());
                    rewards = (await api.getRewardAddresses()) || [];
                } catch (e) { throw new Error('The wallet did not give its stake address.' + walletSaid(e)); }
                if (net !== 1) throw new Error('network');
                if (!rewards.length) throw new Error('This wallet has no stake address.');
                const b2 = rewards[0].match(/../g).map(h => parseInt(h, 16));
                return credOf(b2);
            }));
            return b;
        }));
    });


    // the switch between the two views, also with the arrow keys
    ['dreps', 'pools'].forEach(v => $('dashTab-' + v).addEventListener('click', () => show(v)));
    $('dashTabs').addEventListener('keydown', e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            const next = view === 'dreps' ? 'pools' : 'dreps';
            show(next);
            $('dashTab-' + next).focus();
        }
    });

    btn.addEventListener('click', () => openModal());
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    // /#dashboard opens the DReps, /#stake the stake pools, in any case of letters, also when the hash changes on the page
    function fromHash() {
        const h = location.hash.toLowerCase();
        if (h === '#dashboard') { modal.hidden ? openModal('dreps') : show('dreps'); }
        else if (h === '#stake') { modal.hidden ? openModal('pools') : show('pools'); }
    }
    fromHash();
    window.addEventListener('hashchange', fromHash);
})();
