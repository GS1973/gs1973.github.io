import { Lucid, Blockfrost } from 'https://cdn.jsdelivr.net/npm/lucid-cardano@0.10.7/web/mod.js';
import { bech32 } from 'https://cdn.jsdelivr.net/npm/@scure/base@1.1.5/+esm';

// Make Lucid available globally
window.LucidCardano = { Lucid, Blockfrost };

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        POOL_ID: 'pool1m83drqwlugdt9jn7jkz8hx3pne53acfkd539d9cj8yr92dr4k9y',
        POOL_BECH32: 'pool1m83drqwlugdt9jn7jkz8hx3pne53acfkd539d9cj8yr92dr4k9y',
        PROXY_URL: 'https://blockfrost-proxy.smitblockchainops.workers.dev',
        WALLETS: ['eternl', 'lace', 'yoroi', 'typhon']
    };

    // DOM Elements
    const delegateBtn = document.getElementById('delegateBtn');
    const walletContainer = document.getElementById('walletContainer');
    const messageBox = document.getElementById('messageBox');
    const walletButtons = document.querySelectorAll('.wallet-btn');
    const delegateActionContainer = document.getElementById('delegateActionContainer');
    const delegateToPoolBtn = document.getElementById('delegateToPoolBtn');

    // State
    let connectedWallet = null;
    let walletApi = null;
    let currentStakeAddress = null;
    let currentDelegationStatus = null;

    // Utility Functions
    function showMessage(text, type = 'info', loading = false) {
        messageBox.className = `message-box visible ${type}`;
        // Clear previous content safely
        messageBox.textContent = '';
        if (loading) {
            const spinner = document.createElement('span');
            spinner.className = 'loading';
            messageBox.appendChild(spinner);
            messageBox.appendChild(document.createTextNode(text));
        } else {
            messageBox.textContent = text;
        }
    }

    function hideMessage() {
        messageBox.className = 'message-box';
    }

    function showDelegateAction() {
        delegateActionContainer.classList.add('visible');
    }

    function hideDelegateAction() {
        delegateActionContainer.classList.remove('visible');
    }

    function isWalletInstalled(walletName) {
        return window.cardano && window.cardano[walletName];
    }

    function updateWalletButtons() {
        walletButtons.forEach(btn => {
            const walletName = btn.dataset.wallet;
            if (!isWalletInstalled(walletName)) {
                btn.classList.add('not-installed');
                btn.title = `${walletName} is not installed`;
            }
        });
    }

    // Hex encoding/decoding utilities
    function hexToBytes(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    }

    function bytesToHex(bytes) {
        return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    // Bech32 encoding/decoding using @scure/base library
    function bech32Decode(str) {
        try {
            const decoded = bech32.decode(str);
            return decoded.bytes;
        } catch (error) {
            console.error('Bech32 decode error:', error);
            return null;
        }
    }

    function bech32Encode(hrp, data) {
        try {
            return bech32.encode(hrp, data);
        } catch (error) {
            console.error('Bech32 encode error:', error);
            return null;
        }
    }

    // API Functions
    async function fetchFromProxy(endpoint) {
        const response = await fetch(`${CONFIG.PROXY_URL}${endpoint}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `API error: ${response.status}`);
        }

        return response.json();
    }

    async function submitTransaction(txCbor) {
        const txBytes = hexToBytes(txCbor);

        const response = await fetch(`${CONFIG.PROXY_URL}/tx/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/cbor'
            },
            body: txBytes
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Submit error: ${response.status}`);
        }

        return response.json();
    }

    async function checkDelegationStatus(stakeAddress) {
        try {
            const accountInfo = await fetchFromProxy(`/accounts/${stakeAddress}`);

            if (accountInfo.pool_id === CONFIG.POOL_ID) {
                return { delegated: true, toOurPool: true };
            } else if (accountInfo.pool_id) {
                return { delegated: true, toOurPool: false, currentPool: accountInfo.pool_id };
            }

            return { delegated: false, toOurPool: false };
        } catch (error) {
            // Account might not exist yet (no transactions)
            if (error.message.includes('404')) {
                return { delegated: false, toOurPool: false, newAccount: true };
            }
            throw error;
        }
    }

    // Wallet Connection
    async function connectWallet(walletName) {
        if (!isWalletInstalled(walletName)) {
            showMessage(`${walletName} wallet is not installed. Please install it first.`, 'error');
            return false;
        }

        try {
            showMessage(`Connecting to ${walletName}...`, 'info', true);

            walletApi = await window.cardano[walletName].enable();
            connectedWallet = walletName;

            showMessage(`Connected to ${walletName}. Checking delegation status...`, 'info', true);

            return true;
        } catch (error) {
            console.error('Wallet connection error:', error);
            if (error.code === -3 || error.message?.includes('declined')) {
                showMessage('Connection declined. Please approve the connection in your wallet.', 'warning');
            } else {
                showMessage('Failed to connect to wallet. Please try again.', 'error');
            }
            return false;
        }
    }

    async function getStakeAddress() {
        if (!walletApi) throw new Error('Wallet not connected');

        const rewardAddresses = await walletApi.getRewardAddresses();
        if (!rewardAddresses || rewardAddresses.length === 0) {
            throw new Error('No stake address found');
        }

        // The address is returned as hex, we need to convert to bech32
        const hexAddr = rewardAddresses[0];
        return hexToBech32StakeAddress(hexAddr);
    }

    function hexToBech32StakeAddress(hex) {
        // Convert hex to stake address (simplified - assumes mainnet stake address)
        // Stake address starts with 'stake1' for mainnet
        const bytes = hexToBytes(hex);
        return bech32Encode('stake', bytes);
    }

    // Wallet Connection and Status Check
    async function handleWalletConnect(walletName) {
        hideDelegateAction();
        const connected = await connectWallet(walletName);
        if (!connected) return;

        try {
            currentStakeAddress = await getStakeAddress();
            currentDelegationStatus = await checkDelegationStatus(currentStakeAddress);

            // Hide wallet buttons after successful connection
            walletContainer.classList.remove('visible');

            if (currentDelegationStatus.toOurPool) {
                showMessage('You are already delegating to BKIND. Thank you for your support!', 'success');
                return;
            }

            if (currentDelegationStatus.newAccount) {
                showMessage(
                    'Your wallet has no transaction history yet. Please make at least one transaction first, then return to delegate.',
                    'warning'
                );
                return;
            }

            // Wallet is connected but not delegated to BKIND - show delegate option
            if (currentDelegationStatus.currentPool) {
                showMessage(
                    `Connected! You are currently delegating to another pool. Click below to switch to BKIND.`,
                    'info'
                );
            } else {
                showMessage(
                    'Connected! Your wallet is not delegating to any pool. Click below to delegate to BKIND.',
                    'info'
                );
            }
            showDelegateAction();

        } catch (error) {
            console.error('Connection error:', error);
            showMessage('An error occurred while checking delegation status. Please try again.', 'error');
        }
    }

    // Delegation Process (triggered by Delegate to BKIND button)
    async function handleDelegation() {
        if (!walletApi || !currentStakeAddress) {
            showMessage('Please connect your wallet first.', 'warning');
            return;
        }

        try {
            showMessage('Preparing delegation transaction...', 'info', true);
            await buildAndSignDelegation(currentStakeAddress, currentDelegationStatus.delegated);
        } catch (error) {
            console.error('Delegation error:', error);
            showMessage('An error occurred during delegation. Please try again.', 'error');
        }
    }

    async function buildAndSignDelegation(stakeAddress, alreadyRegistered) {
        try {
            // Check if Lucid is loaded
            if (!window.LucidCardano) {
                showMessage('Transaction library not loaded. Please refresh and try again.', 'error');
                return;
            }

            showMessage('Fetching protocol parameters...', 'info', true);

            const { Lucid } = window.LucidCardano;

            // Fetch protocol parameters from our proxy
            const protocolParams = await fetchFromProxy('/epochs/latest/parameters');

            // Create a custom provider
            const customProvider = {
                getProtocolParameters: async () => ({
                    minFeeA: parseInt(protocolParams.min_fee_a),
                    minFeeB: parseInt(protocolParams.min_fee_b),
                    maxTxSize: parseInt(protocolParams.max_tx_size),
                    maxValSize: parseInt(protocolParams.max_val_size),
                    keyDeposit: BigInt(protocolParams.key_deposit),
                    poolDeposit: BigInt(protocolParams.pool_deposit),
                    priceMem: parseFloat(protocolParams.price_mem),
                    priceStep: parseFloat(protocolParams.price_step),
                    maxTxExMem: BigInt(protocolParams.max_tx_ex_mem),
                    maxTxExSteps: BigInt(protocolParams.max_tx_ex_steps),
                    coinsPerUtxoByte: BigInt(protocolParams.coins_per_utxo_size),
                    collateralPercentage: parseInt(protocolParams.collateral_percent),
                    maxCollateralInputs: parseInt(protocolParams.max_collateral_inputs),
                    costModels: protocolParams.cost_models,
                }),
                getUtxos: async () => [],
                getUtxosWithUnit: async () => [],
                getUtxoByUnit: async () => undefined,
                getUtxosByOutRef: async () => [],
                getDelegation: async () => ({ poolId: null, rewards: 0n }),
                getDatum: async () => undefined,
                awaitTx: async () => true,
                submitTx: async (tx) => {
                    const txBytes = hexToBytes(tx);
                    const response = await fetch(`${CONFIG.PROXY_URL}/tx/submit`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/cbor' },
                        body: txBytes
                    });
                    if (!response.ok) {
                        const error = await response.json().catch(() => ({}));
                        throw new Error(error.message || 'Transaction submission failed');
                    }
                    return await response.text();
                },
            };

            showMessage('Initializing...', 'info', true);

            // Initialize Lucid with custom provider
            const lucid = await Lucid.new(customProvider, 'Mainnet');

            // Connect wallet using CIP-30 API
            lucid.selectWallet({
                getNetworkId: async () => await walletApi.getNetworkId(),
                getUtxos: async () => await walletApi.getUtxos(),
                getCollateral: async () => [],
                getBalance: async () => await walletApi.getBalance(),
                getUsedAddresses: async () => await walletApi.getUsedAddresses(),
                getUnusedAddresses: async () => await walletApi.getUnusedAddresses(),
                getChangeAddress: async () => await walletApi.getChangeAddress(),
                getRewardAddresses: async () => await walletApi.getRewardAddresses(),
                signTx: async (tx) => await walletApi.signTx(tx, true),
                signData: async (addr, payload) => await walletApi.signData(addr, payload),
                submitTx: async (tx) => await walletApi.submitTx(tx),
            });

            showMessage('Building delegation transaction...', 'info', true);

            // Build the delegation transaction
            let tx;
            if (!alreadyRegistered) {
                tx = await lucid.newTx()
                    .registerStake(stakeAddress)
                    .delegateTo(stakeAddress, CONFIG.POOL_ID)
                    .complete();
            } else {
                tx = await lucid.newTx()
                    .delegateTo(stakeAddress, CONFIG.POOL_ID)
                    .complete();
            }

            showMessage('Please sign the transaction in your wallet...', 'info', true);

            const signedTx = await tx.sign().complete();

            showMessage('Submitting transaction...', 'info', true);

            const txHash = await signedTx.submit();

            showMessage(
                `Delegation successful! Transaction: ${txHash.slice(0, 16)}...`,
                'success'
            );
            hideDelegateAction();

        } catch (error) {
            console.error('Delegation error:', error);
            if (error.code === 2 || error.message?.includes('refused') || error.message?.includes('declined') || error.message?.includes('User')) {
                showMessage('Transaction signing was declined.', 'warning');
            } else {
                showMessage('Delegation failed. Please try again or contact support if the issue persists.', 'error');
            }
        }
    }

    // Event Handlers
    delegateBtn.addEventListener('click', function() {
        walletContainer.classList.toggle('visible');
        hideMessage();
        hideDelegateAction();
        updateWalletButtons();
    });

    walletButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const walletName = this.dataset.wallet;
            handleWalletConnect(walletName);
        });
    });

    delegateToPoolBtn.addEventListener('click', function() {
        handleDelegation();
    });

    // Initialize
    document.addEventListener('DOMContentLoaded', function() {
        // Check if any wallets are available
        if (!window.cardano) {
            console.log('No Cardano wallets detected');
        }
    });

})();
