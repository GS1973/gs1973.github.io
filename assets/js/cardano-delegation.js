import { Lucid, Blockfrost } from "https://unpkg.com/lucid-cardano@0.10.7/web/mod.js";

// ============================================
// CARDANO DELEGATION MODULE (Self-executing to avoid global pollution)
// ============================================
(function() {
	'use strict';

	// ============================================
	// SECURITY CONFIGURATION
	// ============================================
	const POOL_ID = 'pool1m83drqwlugdt9jn7jkz8hx3pne53acfkd539d9cj8yr92dr4k9y';
	const LOVELACE_PER_ADA = 1_000_000;

	// Secure Worker URL - API key is hidden in the Worker
	const WORKER_URL = 'https://blockfrost-proxy.smitblockchainops.workers.dev';

	// SECURITY NOTE: API key secured in Cloudflare Worker
	// All Blockfrost API calls are routed through the Worker proxy

	// ============================================
	// CUSTOM SECURE BLOCKFROST PROVIDER
	// ============================================
	/**
	 * Custom Blockfrost provider that routes all API calls through Worker proxy
	 * This keeps the API key secure on the server side
	 */
	class SecureBlockfrostProvider extends Blockfrost {
		constructor(workerUrl) {
			// Initialize parent with Worker URL and dummy project ID
			super(`${workerUrl}/api`, "secure");
			this.workerUrl = workerUrl;
			this.url = `${workerUrl}/api`;
		}

		async request(endpoint, headers = {}, body) {
			const url = `${this.url}/${endpoint}`;

			try {
				const options = {
					headers: {
						'Content-Type': 'application/json',
						...headers
					}
				};

				if (body !== undefined) {
					options.method = 'POST';
					options.body = typeof body === 'string' ? body : JSON.stringify(body);
				}

				const response = await fetch(url, options);

				if (!response.ok) {
					const errorText = await response.text();
					throw new Error(`Blockfrost API error (${response.status}): ${errorText}`);
				}

				return await response.json();
			} catch (error) {
				console.error('SecureBlockfrostProvider error:', error);
				throw error;
			}
		}
	}

	// Module-scoped variables (not global)
	let connectedWallet = null;
	let walletApi = null;
	let lucid = null;
	let isDelegating = false; // Prevent multiple simultaneous delegations

	function showMessage(text, isError = false) {
		const msgDiv = document.getElementById('message');
		msgDiv.textContent = text;
		msgDiv.style.display = 'block';
		msgDiv.style.background = isError ? 'rgba(255, 100, 100, 0.2)' : 'rgba(100, 255, 100, 0.2)';
		msgDiv.style.border = isError ? '1px solid #ff6b6b' : '1px solid #6bcf7f';
		msgDiv.style.color = 'white';
		setTimeout(() => {
			msgDiv.style.display = 'none';
		}, 5000);
	}

	/**
	 * Safely updates the delegation status box without using innerHTML
	 * @param {string} icon - The icon/emoji to display
	 * @param {string} title - The main title text
	 * @param {string|null} subtitle - Optional subtitle text
	 * @param {string} type - 'success', 'warning', 'info', 'pending', or 'error'
	 * @param {string|null} poolId - Optional pool ID to display (will be sanitized)
	 */
	function setDelegationStatusBox(icon, title, subtitle, type, poolId = null) {
		const statusBox = document.getElementById('delegation-status-box');
		// Clear existing content safely
		while (statusBox.firstChild) {
			statusBox.removeChild(statusBox.firstChild);
		}

		const container = document.createElement('div');
		container.style.cssText = 'text-align: center; padding: 1em;';

		// Icon
		const iconDiv = document.createElement('div');
		iconDiv.style.cssText = type === 'pending' ? 'font-size: 1em; margin-bottom: 0.3em;' : 'font-size: 2.5em; margin-bottom: 0.3em;';
		iconDiv.textContent = icon;
		container.appendChild(iconDiv);

		// Title
		const titleDiv = document.createElement('div');
		const titleColor = type === 'success' ? '#6bcf7f' : 'inherit';
		titleDiv.style.cssText = `font-size: 1.1em; font-weight: bold; color: ${titleColor}; margin-bottom: 0.3em;`;
		titleDiv.textContent = title;
		container.appendChild(titleDiv);

		// Pool ID (sanitized)
		if (poolId) {
			const poolDiv = document.createElement('div');
			poolDiv.style.cssText = 'font-size: 0.85em; opacity: 0.8; word-break: break-all;';
			// Sanitize pool ID - only allow alphanumeric characters
			const sanitizedPoolId = poolId.replace(/[^a-zA-Z0-9]/g, '');
			poolDiv.textContent = `Pool ID: ${sanitizedPoolId.substring(0, 30)}...`;
			container.appendChild(poolDiv);
		}

		// Subtitle
		if (subtitle) {
			const subtitleDiv = document.createElement('div');
			subtitleDiv.style.cssText = 'font-size: 0.9em; margin-top: 0.5em; opacity: 0.9;';
			subtitleDiv.textContent = subtitle;
			container.appendChild(subtitleDiv);
		}

		statusBox.appendChild(container);
	}


	// ============================================
	// SECURE API HELPER
	// ============================================
	/**
	 * Makes a secure API call to Blockfrost via Worker proxy
	 * @param {string} endpoint - The Blockfrost API endpoint (e.g., 'accounts/stake1...')
	 * @returns {Promise<Object>} - The API response
	 */
	async function secureBlockfrostFetch(endpoint) {
	// Input validation
	if (!endpoint || typeof endpoint !== 'string') {
		throw new Error('Invalid endpoint');
	}

	// Sanitize endpoint - prevent injection
	const sanitizedEndpoint = endpoint.replace(/[^a-zA-Z0-9/_-]/g, '');

	// Use Worker proxy - API key is secured on the Worker
	const response = await fetch(`${WORKER_URL}/api/${sanitizedEndpoint}`);

	if (!response.ok) {
		throw new Error(`Worker API error: ${response.status}. Ensure Worker is properly configured.`);
	}

	return response.json();
}


	async function connectWallet(walletName) {
	try {
		// Check if wallet extension is installed
		if (!window.cardano || !window.cardano[walletName]) {
			showMessage(`${walletName.charAt(0).toUpperCase() + walletName.slice(1)} wallet not found. Please install the extension.`, true);
			return;
		}

		// Enable wallet
		walletApi = await window.cardano[walletName].enable();
		connectedWallet = walletName;

		// Initialize Lucid with Secure Blockfrost Provider (routes through Worker)
		lucid = await Lucid.new(
			new SecureBlockfrostProvider(WORKER_URL),
			"Mainnet"
		);

		// Select wallet
		lucid.selectWallet(walletApi);

		// Get wallet info
		const utxos = await lucid.wallet.getUtxos();
		let totalLovelace = 0n;
		utxos.forEach(utxo => {
			totalLovelace += utxo.assets.lovelace;
		});
		const balanceAda = Number(totalLovelace) / LOVELACE_PER_ADA;

	// Update UI elements - show delegation section immediately
	document.getElementById('connection-status').textContent = `✓ Connected: ${walletName.charAt(0).toUpperCase() + walletName.slice(1)}`;
	document.getElementById('wallet-buttons').style.display = 'none';
	document.getElementById('delegation-section').style.display = 'block';
	setDelegationStatusBox('⏳', 'Checking delegation status...', null, 'pending');

		// Check current delegation status
		const rewardAddress = await lucid.wallet.rewardAddress();
		let delegationInfo = '';
		let isAlreadyDelegatedToBKIND = false;

	try {
		// Query Blockfrost for delegation info via secure Worker proxy
		const accountInfo = await secureBlockfrostFetch(`accounts/${rewardAddress}`);

		if (accountInfo && accountInfo.pool_id) {
			const currentPool = accountInfo.pool_id;
			isAlreadyDelegatedToBKIND = (currentPool === POOL_ID);

					if (isAlreadyDelegatedToBKIND) {
						delegationInfo = `✓ Already delegating to BKIND pool!`;
			// Update status box with prominent success message
			setDelegationStatusBox('✓', 'Already Delegating to BKIND!', 'Thank you for your support! 🙏', 'success');
						document.getElementById('delegate-btn').textContent = '✓ Delegating to BKIND!';
						document.getElementById('delegate-btn').disabled = true;
						document.getElementById('delegate-btn').style.opacity = '0.5';
						document.getElementById('delegate-btn').style.cursor = 'not-allowed';
					} else {
						delegationInfo = `Currently delegating to: ${currentPool.substring(0, 20)}...`;
						// Update status box for other pool
						setDelegationStatusBox('🔄', 'Currently Delegating to Another Pool', 'You can switch to BKIND below', 'info', currentPool);
						document.getElementById('delegate-btn').textContent = '🔄 Switch to BKIND Pool';
					}
				} else {
					delegationInfo = 'Not currently delegating';
					// Update status box for no delegation
					setDelegationStatusBox('⚠️', 'Not Currently Delegating', 'Your ADA is not earning rewards yet', 'warning');
				}
		} catch (delegationError) {
			console.log('Could not fetch delegation info:', delegationError);
			delegationInfo = '';
		// Update status box for error
		setDelegationStatusBox('', 'Unable to check delegation status', null, 'error');
		}


	// Update wallet balance info
	document.getElementById('wallet-info').textContent = `Balance: ${balanceAda.toFixed(2)} ADA`;

		if (isAlreadyDelegatedToBKIND) {
			showMessage('✓ You are already delegating to BKIND pool! Thank you for your support!');
		} else {
			showMessage('Wallet connected successfully!');
		}
	} catch (error) {
		console.error('Error connecting wallet:', error);
		showMessage('Failed to connect wallet: ' + error.message, true);
	}
}

	async function delegateToPool() {
	if (!lucid || !walletApi) {
		showMessage('Please connect your wallet first', true);
		return;
	}

	// Prevent multiple simultaneous delegations
	if (isDelegating) {
		showMessage('Delegation already in progress. Please wait...', true);
		return;
	}

	isDelegating = true;

	try {
		showMessage('Preparing delegation transaction...');

		// Re-initialize Lucid with fresh connection to ensure latest UTxOs
		lucid = await Lucid.new(
			new SecureBlockfrostProvider(WORKER_URL),
			"Mainnet"
		);
		lucid.selectWallet(walletApi);

		// Get reward address
		const rewardAddress = await lucid.wallet.rewardAddress();

		if (!rewardAddress) {
			showMessage('No reward address found. Please ensure your wallet is properly set up.', true);
			isDelegating = false;
			return;
		}

		showMessage('Building transaction... This may take a moment.');

		// Try delegation only first (most common case)
		try {
			const tx = await lucid
				.newTx()
				.delegateTo(rewardAddress, POOL_ID)
				.complete();

			showMessage('Please sign the transaction in your wallet...');

			const signedTx = await tx.sign().complete();
			const txHash = await signedTx.submit();

			showMessage(`✓ Success! Delegation transaction submitted!\n\nTransaction Hash: ${txHash}\n\nYou are now delegating to BKIND pool!`);

			document.getElementById('delegate-btn').textContent = '✓ Delegated to BKIND!';

			isDelegating = false;
			return;

		} catch (firstError) {
			console.log('First attempt (delegation only) failed, trying with registration:', firstError);

			// If delegation-only failed, try with stake key registration
			if (firstError.message && (firstError.message.includes('not registered') || firstError.message.includes('StakeKeyNotRegistered'))) {
				showMessage('Registering stake key and delegating...');

				const tx = await lucid
					.newTx()
					.registerStake(rewardAddress)
					.delegateTo(rewardAddress, POOL_ID)
					.complete();

				showMessage('Please sign the transaction in your wallet...');

				const signedTx = await tx.sign().complete();
				const txHash = await signedTx.submit();

				showMessage(`✓ Success! Stake key registered and delegated!\n\nTransaction Hash: ${txHash}\n\nYou are now delegating to BKIND pool!`);

				document.getElementById('delegate-btn').textContent = '✓ Delegated to BKIND!';

				isDelegating = false;
				return;
			}

			// Re-throw if it's not a registration issue
			throw firstError;
		}

	} catch (error) {
		console.error('Delegation error:', error);
		isDelegating = false;

		// Provide helpful error messages
		let errorMsg = error.message || error.toString();

		if (errorMsg.includes('already spent') || errorMsg.includes('BadInputsUTxO')) {
			showMessage('Transaction error: Your wallet has a pending transaction. Please wait a few moments for it to complete, then try again.', true);
		} else if (errorMsg.includes('insufficient')) {
			showMessage('Insufficient funds. You need at least 2-3 ADA to cover transaction fee and deposit.', true);
		} else if (errorMsg.includes('UTxO Balance Insufficient')) {
			showMessage('Insufficient balance for transaction. Please ensure you have enough ADA.', true);
		} else if (errorMsg.includes('User declined')) {
			showMessage('Transaction cancelled by user.', true);
		} else {
			showMessage('Delegation failed: ' + errorMsg + '\n\nPlease try again in a few moments.', true);
		}
	}
}


	// Function to show wallet selection
	function showWalletSelection() {
		document.getElementById('wallet-section').style.display = 'block';
		document.getElementById('top-delegate-btn').style.display = 'none';
		// Scroll to wallet section
		document.getElementById('wallet-section').scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	// Make functions globally available for onclick handlers
	window.connectWallet = connectWallet;
	window.delegateToPool = delegateToPool;
	window.showWalletSelection = showWalletSelection;

})(); // End of IIFE module
