// Delegating from this site: builds one delegation transaction, asks the
// wallet to sign it over CIP-30, and hands it back to the wallet to submit.
// Stake goes to a pool, the vote to a DRep (or one of the two predefined
// options, Always Abstain and Always No Confidence).
// No library: the transaction is a handful of CBOR fields, written here so
// that anyone can read what is signed. blake2b comes from vendor/blake2b.js.
//
//   body   inputs from the wallet, one change output back to the wallet, fee,
//          time-to-live, and one certificate:
//            [2, stake credential, pool]                   delegation
//            [11, stake credential, pool, deposit]         registration and
//                                                          delegation in one
//            [9, stake credential, drep]                   vote delegation
//            [12, stake credential, drep, deposit]         registration and
//                                                          vote delegation
//          drep = [0, key hash] | [1, script hash] | [2] (Always Abstain)
//                 | [3] (Always No Confidence)
//
// The first try is a delegation only: most wallets have delegated before, so
// their stake address is registered. When the wallet cannot sign or send it,
// the dialog offers a second try that registers the stake address as well,
// with the deposit the protocol asks (key_deposit, returned on deregistration).
// If the address was registered after all, the chain refuses that second
// transaction and nothing happens.
//
// The fee, the deposit and the minimum output come from pools.json (the daily
// list, same origin). Before sending, the wallet's signatures and the real size
// against the fee are checked.
//
// Opens with window.sboDelegate.open({ ticker, name, pool_id }) for a pool,
// { kind: 'drep', name, drep_id, hash, script } for a DRep, or
// { kind: 'drep', option: 'abstain' | 'no_confidence' }.
(function () {
    'use strict';

    const SHELLEY_UNIX_MINUS_SLOT = 1591566291;   // mainnet: slot = unix time - this
    const TTL_SECONDS = 2 * 3600;
    const MAX_INPUTS = 30;
    const FEE_MARGIN_BYTES = 110;                 // about 0.005 ADA: one extra witness (101) fits
    // The fee rules come from pools.json. A wrong number there must not become a
    // transaction: the rules are held to a band, and no fee above MAX_FEE is
    // built (the largest transaction the chain allows costs 0.88 ADA today).
    const MAX_FEE = 1000000n;
    const PARAM_MAX = { min_fee_a: 1000, min_fee_b: 2000000, key_deposit: 10000000, coins_per_utxo_byte: 100000, max_tx_size: 65536 };

    // ---------- bytes ----------

    const hexToBytes = h => Uint8Array.from(h.match(/../g) || [], b => parseInt(b, 16));
    const bytesToHex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
    const concatBytes = parts => {
        const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
        let o = 0;
        for (const p of parts) { out.set(p, o); o += p.length; }
        return out;
    };
    const blake = (bytes, len) => window.blakejs.blake2b(bytes, null, len);

    // ---------- CBOR (RFC 8949), the part a transaction needs ----------

    class Tagged { constructor(tag, value) { this.tag = tag; this.value = value; } }

    function cborHead(major, n) {
        n = BigInt(n);
        const m = major << 5;
        if (n < 24n) return Uint8Array.of(m | Number(n));
        if (n < 0x100n) return Uint8Array.of(m | 24, Number(n));
        if (n < 0x10000n) return Uint8Array.of(m | 25, Number(n >> 8n), Number(n & 0xffn));
        if (n < 0x100000000n) return Uint8Array.of(m | 26, ...[24n, 16n, 8n, 0n].map(s => Number((n >> s) & 0xffn)));
        return Uint8Array.of(m | 27, ...[56n, 48n, 40n, 32n, 24n, 16n, 8n, 0n].map(s => Number((n >> s) & 0xffn)));
    }

    // Values: number/BigInt, Uint8Array (bytes), string, Array, Map (keys in
    // insertion order), Tagged, true/false.
    function cborEncode(v) {
        if (typeof v === 'number' || typeof v === 'bigint') {
            const n = BigInt(v);
            return n >= 0n ? cborHead(0, n) : cborHead(1, -1n - n);
        }
        if (v instanceof Uint8Array) return concatBytes([cborHead(2, v.length), v]);
        if (typeof v === 'string') { const b = new TextEncoder().encode(v); return concatBytes([cborHead(3, b.length), b]); }
        if (Array.isArray(v)) return concatBytes([cborHead(4, v.length), ...v.map(cborEncode)]);
        if (v instanceof Map) {
            const parts = [cborHead(5, v.size)];
            for (const [k, x] of v) parts.push(cborEncode(k), cborEncode(x));
            return concatBytes(parts);
        }
        if (v instanceof Tagged) return concatBytes([cborHead(6, v.tag), cborEncode(v.value)]);
        if (v === true) return Uint8Array.of(0xf5);
        if (v === false) return Uint8Array.of(0xf4);
        throw new Error('cannot encode ' + typeof v);
    }

    // Integers decode to BigInt, maps to Map, tags to Tagged.
    function cborDecode(b, i = 0) {
        const ib = b[i++], major = ib >> 5, info = ib & 31;
        const arg = () => {
            if (info < 24) return BigInt(info);
            const len = { 24: 1, 25: 2, 26: 4, 27: 8 }[info];
            if (!len) throw new Error('bad CBOR length');
            let n = 0n;
            for (let k = 0; k < len; k++) n = (n << 8n) | BigInt(b[i++]);
            return n;
        };
        const items = (fn) => {           // definite or indefinite count
            if (info === 31) { while (b[i] !== 0xff) fn(); i++; return; }
            const n = Number(arg());
            for (let k = 0; k < n; k++) fn();
        };
        const next = () => { const r = cborDecode(b, i); i = r.end; return r.value; };
        switch (major) {
            case 0: return { value: arg(), end: i };
            case 1: return { value: -1n - arg(), end: i };
            case 2: case 3: {
                let out;
                if (info === 31) {
                    const parts = [];
                    while (b[i] !== 0xff) { const r = cborDecode(b, i); parts.push(major === 2 ? r.value : new TextEncoder().encode(r.value)); i = r.end; }
                    i++; out = concatBytes(parts);
                } else { const n = Number(arg()); out = b.slice(i, i + n); i += n; }
                return { value: major === 2 ? out : new TextDecoder().decode(out), end: i };
            }
            case 4: { const a = []; items(() => a.push(next())); return { value: a, end: i }; }
            case 5: { const m = new Map(); items(() => { const k = next(); m.set(typeof k === 'bigint' ? Number(k) : k, next()); }); return { value: m, end: i }; }
            case 6: { const tag = Number(arg()); return { value: new Tagged(tag, next()), end: i }; }
            case 7:
                if (info === 20) return { value: false, end: i };
                if (info === 21) return { value: true, end: i };
                if (info === 22 || info === 23) return { value: null, end: i };
                throw new Error('unsupported CBOR simple value');
        }
    }
    const untag = v => (v instanceof Tagged ? v.value : v);

    // ---------- the pool ID and the DRep ID ----------

    // bech32 (BIP-173), checksum checked: the bytes of an ID with this prefix.
    const BECH32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    function polymod(values) {
        const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
        let chk = 1;
        for (const v of values) {
            const top = chk >>> 25;
            chk = ((chk & 0x1ffffff) << 5) ^ v;
            for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= GEN[i];
        }
        return chk;
    }
    function bech32Bytes(id, wantHrp) {
        const s = String(id).toLowerCase();
        const sep = s.lastIndexOf('1');
        const hrp = s.slice(0, sep);
        const data = Array.from(s.slice(sep + 1), c => BECH32.indexOf(c));
        if (hrp !== wantHrp || data.length < 7 || data.some(d => d < 0)) throw new Error('not a ' + wantHrp + ' ID');
        const expanded = [...Array.from(hrp, c => c.charCodeAt(0) >> 5), 0, ...Array.from(hrp, c => c.charCodeAt(0) & 31)];
        if (polymod(expanded.concat(data)) !== 1) throw new Error(wantHrp + ' ID checksum');
        let acc = 0, bits = 0;
        const out = [];
        for (const d of data.slice(0, -6)) {
            acc = ((acc << 5) | d) & 0xffff; bits += 5;
            if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 0xff); }
        }
        return Uint8Array.from(out);
    }

    function poolKeyHash(poolId) {
        const out = bech32Bytes(poolId, 'pool');
        if (out.length !== 28) throw new Error('pool ID length');
        return out;
    }

    // The DRep in a certificate. A DRep's hash is taken from its CIP-129 ID
    // (header 0x22 key, 0x23 script, then the 28-byte hash) and must equal the
    // hash in the list, so what is signed is the DRep that is shown.
    function drepField(target) {
        if (target.option === 'abstain') return [2];
        if (target.option === 'no_confidence') return [3];
        const b = bech32Bytes(target.drep_id, 'drep');
        if (b.length !== 29 || (b[0] !== 0x22 && b[0] !== 0x23)) throw new Error('DRep ID form');
        const script = b[0] === 0x23, hash = b.slice(1);
        if (bytesToHex(hash) !== String(target.hash).toLowerCase() || script !== Boolean(target.script)) {
            throw new Error('DRep ID and hash differ');
        }
        return [script ? 1 : 0, hash];
    }

    // ---------- addresses and values ----------

    // Payment key hash of a Shelley address whose payment part is a key; null for
    // script addresses, Byron addresses and anything else this cannot sign for.
    function paymentKeyHash(addr) {
        const type = addr[0] >> 4;
        return [0, 2, 4, 6].includes(type) && addr.length >= 29 ? addr.slice(1, 29) : null;
    }

    // { coin: BigInt, assets: Map('policyhex.namehex' -> BigInt) }
    function outputValue(out) {
        const amount = out instanceof Map ? out.get(1) : out[1];
        const v = { coin: 0n, assets: new Map() };
        if (typeof amount === 'bigint') { v.coin = amount; return v; }
        v.coin = amount[0];
        for (const [policy, names] of untag(amount[1])) {
            for (const [name, q] of names) v.assets.set(bytesToHex(policy) + '.' + bytesToHex(name), q);
        }
        return v;
    }
    function addValue(a, b) {
        const assets = new Map(a.assets);
        for (const [k, q] of b.assets) assets.set(k, (assets.get(k) || 0n) + q);
        return { coin: a.coin + b.coin, assets };
    }
    // Canonical order (RFC 8949 §4.2.3): shorter keys first, then bytewise.
    const canonical = (x, y) => x.length - y.length || (x < y ? -1 : x > y ? 1 : 0);
    function encodeValue(v) {
        if (!v.assets.size) return v.coin;
        const policies = new Map();
        for (const k of [...v.assets.keys()].sort()) {
            const [p, n] = k.split('.');
            if (!policies.has(p)) policies.set(p, []);
            policies.get(p).push(n);
        }
        const ma = new Map();
        for (const p of [...policies.keys()].sort(canonical)) {
            const names = new Map();
            for (const n of policies.get(p).sort(canonical)) names.set(hexToBytes(n), v.assets.get(p + '.' + n));
            ma.set(hexToBytes(p), names);
        }
        return [v.coin, ma];
    }

    // ---------- the transaction ----------

    function txBody({ inputs, changeAddr, change, fee, ttl, cert }) {
        return cborEncode(new Map([
            [0, inputs.map(u => [u.txHash, u.index])],
            [1, [new Map([[0, changeAddr], [1, encodeValue(change)]])]],
            [2, fee],
            [3, ttl],
            [4, [cert]],
        ]));
    }

    // Chooses inputs and computes fee and change. Plain-ADA outputs are used
    // first, so that tokens stay where they are unless the ADA alone does not
    // suffice; any token in a chosen input goes back in the change output. The
    // deposit, when registering, leaves the change too.
    function buildTx({ utxos, changeAddr, cert, deposit, ttl, params }) {
        const usable = utxos.filter(u => u.keyHash)
            .sort((a, b) => (a.value.assets.size - b.value.assets.size) || (b.value.coin > a.value.coin ? 1 : -1));
        const chosen = [];
        let total = { coin: 0n, assets: new Map() };
        for (const u of usable.slice(0, MAX_INPUTS)) {
            chosen.push(u);
            total = addValue(total, u.value);
            // The input keys and the stake key sign. A vkey witness is
            // [32-byte key, 64-byte signature]: 101 bytes in CBOR. Wallets wrap
            // them differently (a set tag adds 3 bytes; a wallet may add a
            // witness of its own, 101 more), so the estimate carries a margin
            // of FEE_MARGIN_BYTES; after signing the real size is checked
            // against the fee before anything is sent. The fee field is taken
            // at its widest.
            const signers = new Set(chosen.map(c => bytesToHex(c.keyHash))).size + 1;
            const size = body => 1 + body.length + (8 + 101 * signers) + 1 + 1 + FEE_MARGIN_BYTES;
            let fee = 0n, change, body;
            for (let round = 0; round < 3; round++) {
                change = { coin: total.coin - fee - deposit, assets: total.assets };
                body = txBody({ inputs: chosen, changeAddr, change, fee: fee || 0xffffffffn, ttl, cert });
                fee = BigInt(params.min_fee_a) * BigInt(size(body)) + BigInt(params.min_fee_b);
            }
            change = { coin: total.coin - fee - deposit, assets: total.assets };
            const outBytes = cborEncode(new Map([[0, changeAddr], [1, encodeValue(change)]]));
            const minAda = BigInt(params.coins_per_utxo_byte) * BigInt(160 + outBytes.length);
            if (change.coin < minAda) continue;
            body = txBody({ inputs: chosen, changeAddr, change, fee, ttl, cert });
            if (size(body) > params.max_tx_size) break;
            return { body, fee, inputs: chosen };
        }
        return null;
    }

    // ---------- the wallet ----------

    class DelegateError extends Error { constructor(key, detail) { super(key); this.key = key; this.detail = detail; } }

    // Only the wallets tested with a real transaction are offered, the same as
    // on The Voice of ADA Holders (decided 27-09-2026), by the key each
    // registers under window.cardano. Any other wallet is not. The icon is the
    // wallet's own, only when it is an image data URI.
    const SUPPORTED = { eternl: 'Eternl', gerowallet: 'Gero', lace: 'Lace', typhoncip30: 'Typhon', vespr: 'VESPR' };

    function wallets() {
        const c = window.cardano || {};
        return Object.keys(SUPPORTED).filter(k => c[k] && typeof c[k].enable === 'function').map(k => ({
            key: k, name: SUPPORTED[k],
            icon: typeof c[k].icon === 'string' && /^data:image\/(png|svg\+xml|jpeg|webp)[;,]/.test(c[k].icon) ? c[k].icon : '',
        }));
    }

    async function enableWallet(walletKey) {
        if (!SUPPORTED[walletKey]) throw new DelegateError('failed');
        let api;
        try { api = await window.cardano[walletKey].enable(); } catch (e) { throw new DelegateError('declined', e); }
        if (Number(await api.getNetworkId()) !== 1) throw new DelegateError('wrongNet');
        const rewards = (await api.getRewardAddresses()) || [];
        if (!rewards.length) throw new DelegateError('noStake');
        const reward = hexToBytes(rewards[0]);
        if (reward[0] >> 4 === 15) throw new DelegateError('script');
        if (reward[0] >> 4 !== 14 || reward.length !== 29) throw new DelegateError('noStake');
        return { api, stakeKeyHash: reward.slice(1) };
    }

    // Some wallets answer getUtxos() without arguments with nothing at all. Then
    // ask again: page by page (CIP-30 paginate), for an amount, and last the
    // collateral, which wallets leave out of getUtxos.
    async function walletUtxos(api) {
        const tries = [
            () => api.getUtxos(),
            async () => {
                let all = [];
                for (let page = 0; page < 20; page++) {
                    const part = (await api.getUtxos(undefined, { page, limit: 50 })) || [];
                    all = all.concat(part);
                    if (part.length < 50) break;
                }
                return all;
            },
            () => api.getUtxos(bytesToHex(cborEncode(5000000n))),
            () => (api.getCollateral ? api.getCollateral({ amount: bytesToHex(cborEncode(5000000n)) })
                : api.experimental && api.experimental.getCollateral ? api.experimental.getCollateral() : null),
        ];
        for (const get of tries) {
            let raw;
            try { raw = (await get()) || []; } catch (e) { raw = []; }
            if (raw.length) {
                return raw.map(h => {
                    const [input, output] = cborDecode(hexToBytes(h)).value;
                    const addr = output instanceof Map ? output.get(0) : output[0];
                    return { txHash: input[0], index: Number(input[1]), keyHash: paymentKeyHash(addr), value: outputValue(output) };
                });
            }
        }
        return [];
    }

    // CIP-30 TxSignError code 2: the user declined.
    const userDeclined = e => e && (e.code === 2 || /declin|reject|cancel/i.test(String(e.info || e.message || '')));

    async function delegate(walletKey, target, params, register, step) {
        step('connect');
        const { api, stakeKeyHash } = await enableWallet(walletKey);

        step('build');
        const deposit = register ? BigInt(params.key_deposit) : 0n;
        const cred = [0, stakeKeyHash];
        let cert;
        if (target.kind === 'drep') {
            const drep = drepField(target);
            cert = register ? [12, cred, drep, deposit] : [9, cred, drep];
        } else {
            const poolHash = poolKeyHash(target.pool_id);
            cert = register ? [11, cred, poolHash, deposit] : [2, cred, poolHash];
        }
        const changeAddr = hexToBytes(await api.getChangeAddress());
        const utxos = await walletUtxos(api);
        const ttl = Math.floor(Date.now() / 1000) - SHELLEY_UNIX_MINUS_SLOT + TTL_SECONDS;
        const built = buildTx({ utxos, changeAddr, cert, deposit, ttl, params });
        if (!built) throw new DelegateError('noFunds');
        if (built.fee > MAX_FEE) throw new DelegateError('feeHigh');
        const { body } = built;
        const unsigned = concatBytes([Uint8Array.of(0x84), body, Uint8Array.of(0xa0, 0xf5, 0xf6)]);

        step('sign');
        let witHex;
        try { witHex = await api.signTx(bytesToHex(unsigned), true); } catch (e) {
            throw new DelegateError(userDeclined(e) ? 'declined' : 'signFailed', e);
        }
        const witBytes = hexToBytes(witHex);
        const wit = cborDecode(witBytes).value;
        const signed = new Set(((wit instanceof Map && untag(wit.get(0))) || []).map(w => bytesToHex(blake(w[0], 28))));
        if (!signed.has(bytesToHex(stakeKeyHash))) throw new DelegateError('noStakeSig');
        if (built.inputs.some(u => !signed.has(bytesToHex(u.keyHash)))) throw new DelegateError('missingSig');

        const tx = concatBytes([Uint8Array.of(0x84), body, witBytes, Uint8Array.of(0xf5, 0xf6)]);
        const minFee = BigInt(params.min_fee_a) * BigInt(tx.length) + BigInt(params.min_fee_b);
        if (built.fee < minFee) {
            console.error('signed transaction, not sent (fee', String(built.fee), 'below', String(minFee), '):', bytesToHex(tx));
            throw new DelegateError('feeShort');
        }

        step('submit');
        try { await api.submitTx(bytesToHex(tx)); } catch (e) {
            console.error('signed transaction the wallet could not send:', bytesToHex(tx));
            const err = new DelegateError('submitFailed', e);
            err.txId = bytesToHex(blake(body, 32));
            throw err;
        }
        return { txId: bytesToHex(blake(body, 32)), fee: built.fee, deposit };
    }

    // ---------- the dialog ----------

    const ada = lovelace => (Number(lovelace) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 6 });

    const STEP = {
        connect: 'Connecting to your wallet…',
        build: 'Building the transaction…',
        sign: 'Waiting for your signature in the wallet…',
        submit: 'Sending the transaction…',
    };
    const ERR = {
        declined: 'Nothing was signed: the wallet declined or the request was canceled.',
        wrongNet: 'Your wallet is not on the Cardano main network.',
        noStake: 'This wallet has no stake address to delegate with.',
        script: 'This wallet\'s stake address is a script; this site can only delegate with a key.',
        noFunds: 'Not enough ADA in this wallet for the fee (and the deposit, when registering).',
        noStakeSig: 'The wallet did not sign with its stake key, so the chain would refuse the delegation. Nothing was sent.',
        missingSig: 'The wallet did not sign for all the funds used. Nothing was sent.',
        feeShort: 'The signed transaction came out larger than its fee allows. Nothing was sent.',
        feeHigh: 'The fee for this transaction came out above 1 ADA, which cannot be right. Nothing was built or sent.',
        params: 'The fee rules could not be loaded. Please try again later.',
        failed: 'Something went wrong. Nothing was sent.',
    };

    let open = null;

    function el(tag, props, children) {
        const e = document.createElement(tag);
        Object.assign(e, props || {});
        for (const c of children || []) e.append(c);
        return e;
    }

    async function loadParams() {
        const res = await fetch('pools.json', { cache: 'no-cache' });
        if (!res.ok) throw new Error('pools.json ' + res.status);
        const d = await res.json();
        const p = d.params;
        if (!p) throw new Error('no params');
        for (const k of Object.keys(PARAM_MAX)) {
            if (!Number.isInteger(p[k]) || p[k] <= 0 || p[k] > PARAM_MAX[k]) throw new Error('params out of range: ' + k);
        }
        return p;
    }

    function openDialog(pool) {
        if (open || window.top !== window.self) return;   // never inside another site's frame
        const isDrep = pool.kind === 'drep';
        const OPTION = { abstain: 'Always Abstain', no_confidence: 'Always No Confidence' };
        const label = isDrep ? (OPTION[pool.option] || pool.name || String(pool.drep_id).slice(0, 12) + '…' + String(pool.drep_id).slice(-6))
            : pool.ticker;
        const lastFocused = document.activeElement;
        const closeBtn = el('button', { type: 'button', className: 'modal-close', textContent: '×' });
        closeBtn.setAttribute('aria-label', 'Close');
        const title = el('h2', { className: 'modal-title', id: 'delegateTxTitle',
            textContent: isDrep ? 'Give your vote to ' + label : 'Delegate to ' + pool.ticker });
        const body = el('div', { className: 'modal-body delegate-body' });
        const box = el('div', { className: 'modal modal-delegate' }, [closeBtn, title, body]);
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.setAttribute('aria-labelledby', 'delegateTxTitle');
        const overlay = el('div', { className: 'modal-overlay delegate-overlay' }, [box]);

        let busy = false;
        const close = () => {
            if (busy) return;
            overlay.remove();
            document.removeEventListener('keydown', onKey, true);
            open = null;
            if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
        };
        const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
        closeBtn.addEventListener('click', close);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        document.addEventListener('keydown', onKey, true);
        document.body.appendChild(overlay);
        open = overlay;

        const say = (...nodes) => body.replaceChildren(...nodes);
        const p = (text, cls) => el('p', { textContent: text, className: cls || '' });
        const poolLine = () => isDrep
            ? el('p', { className: 'delegate-pool' }, [el('strong', { textContent: label })].concat(pool.drep_id
                ? [el('br'), el('span', { className: 'delegate-id', textContent: pool.drep_id })] : []))
            : el('p', { className: 'delegate-pool' }, [
                el('strong', { textContent: pool.ticker }), ' — ' + pool.name,
                el('br'), el('span', { className: 'delegate-id', textContent: pool.pool_id }),
            ]);
        const disclaimer = () => el('p', { className: 'delegate-fine' }, [
            'You sign in your own wallet. Delegating does not move your ADA: you pay only the transaction fee, and a refundable deposit the first time your wallet delegates. By continuing you accept the ',
            el('a', { href: '/terms', target: '_blank', rel: 'noopener noreferrer', textContent: 'disclaimer' }), '.',
        ]);

        function run(walletKey, walletName, params, register) {
            busy = true;
            closeBtn.disabled = true;
            (async () => {
                try {
                    const r = await delegate(walletKey, pool, params, register, s => say(poolLine(), p(STEP[s])));
                    const link = el('a', {
                        href: 'https://cardanoscan.io/transaction/' + r.txId, target: '_blank', rel: 'noopener noreferrer',
                        textContent: r.txId.slice(0, 16) + '…',
                    });
                    say(poolLine(),
                        el('p', {}, ['Sent. Transaction ', link, ' (fee ' + ada(r.fee) + ' ADA' +
                            (r.deposit ? ', deposit ' + ada(r.deposit) + ' ADA' : '') + ').']),
                        isDrep
                            ? p('Once it is in a block, your vote goes to ' + label + '. It counts from the next epoch.')
                            : p('Once it is in a block, the delegation to ' + pool.ticker + ' takes effect at the end of this epoch. ' +
                                'The first rewards arrive about 15 to 20 days from now.'));
                } catch (e) {
                    console.error(e, e.detail);
                    const full = e.detail && (e.detail.info || e.detail.message) ? String(e.detail.info || e.detail.message) : '';
                    const detail = full.length > 160 ? full.slice(0, 160) + '\u2026' : full;   // the whole text is in the console
                    // Inputs already spent: the node has this transaction already, or the
                    // wallet has not caught up with an earlier one. Registering would not help.
                    const spent = e.key === 'submitFailed' && /inputs are spent|already been included|BadInputsUTxO/i.test(full);
                    const retry = !register && !spent && (e.key === 'submitFailed' || e.key === 'signFailed');
                    if (spent) {
                        const link = el('a', {
                            href: 'https://cardanoscan.io/transaction/' + e.txId, target: '_blank', rel: 'noopener noreferrer',
                            textContent: e.txId.slice(0, 16) + '\u2026',
                        });
                        say(poolLine(),
                            p(walletName + ' says the funds this transaction uses are already spent. Either the delegation has gone ' +
                                'through already, or the wallet has not yet caught up with an earlier transaction.'),
                            el('p', {}, ['Check transaction ', link, ' on Cardanoscan in a minute. If it is not there, wait a minute and delegate again.']));
                    } else if (retry) {
                        const again = el('button', { type: 'button', className: 'delegate-go', textContent: 'Register and delegate' });
                        again.addEventListener('click', () => run(walletKey, walletName, params, true));
                        say(poolLine(),
                            p(walletName + ' could not ' + (e.key === 'signFailed' ? 'sign' : 'send') + ' the delegation.' + (detail ? ' (' + detail + ')' : '')),
                            p('A wallet that has never delegated must first register its stake address. That takes a deposit of ' +
                                ada(params.key_deposit) + ' ADA, which you get back when you deregister. ' +
                                'Registering and delegating can go in one transaction. If your stake address is registered already, ' +
                                'the chain refuses it and nothing happens.'),
                            again);
                        again.focus();
                    } else {
                        const msg = e.key === 'submitFailed' || e.key === 'signFailed'
                            ? walletName + ' could not ' + (e.key === 'signFailed' ? 'sign' : 'send') + ' the transaction. Nothing was sent.'
                            : (ERR[e.key] || ERR.failed);
                        say(poolLine(), p(msg + (detail ? ' (' + detail + ')' : '')));
                    }
                }
                busy = false;
                closeBtn.disabled = false;
            })();
        }

        const list = wallets();
        if (!list.length) {
            say(poolLine(),
                p('No supported Cardano wallet was found in this browser. This site works with Eternl, Gero, Lace, Typhon and VESPR. ' +
                    (!isDrep ? 'You can also copy the pool ID above and select the pool in your wallet itself.'
                        : pool.drep_id ? 'You can also copy the DRep ID above and choose the DRep in your wallet itself.'
                            : 'You can also choose ' + label + ' in your wallet itself.')),
                disclaimer());
            closeBtn.focus();
            return;
        }
        const buttons = list.map(w => {
            const b = el('button', { type: 'button', className: 'delegate-wallet' }, [el('span', { textContent: w.name })]);
            if (w.icon) b.prepend(el('img', { src: w.icon, alt: '', width: 24, height: 24 }));
            b.addEventListener('click', async () => {
                let params;
                try { params = await loadParams(); } catch (err) { say(poolLine(), p(ERR.params)); return; }
                run(w.key, w.name, params, false);
            });
            return b;
        });
        say(poolLine(),
            isDrep
                ? p('Choose your wallet. It will show a vote delegation to ' + (pool.option ? label : 'this DRep') +
                    ' and a fee of about 0.18 ADA for you to sign. If your wallet already gives its vote to ' +
                    (pool.option ? label : 'this DRep') + ', there is nothing to do: signing again only costs the fee.')
                : p('Choose your wallet. It will show a delegation to this pool and a fee of about 0.18 ADA for you to sign. ' +
                    'If your wallet already delegates to this pool, there is nothing to do: signing again only costs the fee.'),
            el('div', { className: 'delegate-wallets' }, buttons),
            disclaimer());
        buttons[0].focus();
    }

    window.sboDelegate = { open: openDialog };
})();
