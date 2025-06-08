/**
 * Reusable Transaction Modal Component
 * Used across index.html, admin.html, and transactions.html
 */

class TransactionModal {
    constructor() {
        this.modal = null;
        this.isEditMode = false;
        this.transactionId = null;
        this.onSuccess = null;
        this.apiEndpoint = '/api/transactions'; // Default endpoint
    }

    /**
     * Show the modal for adding a new transaction
     */
    showAddModal(options = {}) {
        this.isEditMode = false;
        this.transactionId = null;
        this.apiEndpoint = options.apiEndpoint || '/api/transactions';
        this.onSuccess = options.onSuccess || null;
        
        this.createModal('Add Transaction', 'Add Transaction');
        this.populateDefaults();
        this.showModal();
    }

    /**
     * Show the modal for editing an existing transaction
     */
    showEditModal(transaction, options = {}) {
        this.isEditMode = true;
        this.transactionId = transaction.id;
        this.apiEndpoint = options.apiEndpoint || '/api/admin/transactions';
        this.onSuccess = options.onSuccess || null;
        
        this.createModal('Edit Transaction', 'Update Transaction');
        this.populateTransaction(transaction);
        this.showModal();
    }

    /**
     * Create the modal HTML structure
     */
    createModal(title, submitText) {
        // Remove any existing modal
        this.destroyModal();

        // Create modal element
        this.modal = document.createElement('div');
        this.modal.className = 'transaction-modal';
        this.modal.innerHTML = this.getModalHTML(title, submitText);
        
        document.body.appendChild(this.modal);
        
        // Setup event listeners
        this.setupEventListeners();
    }

    /**
     * Get the modal HTML template
     */
    getModalHTML(title, submitText) {
        return `
            <div class="transaction-sidebar">
                <div class="sidebar-header">
                    <h3><i class="fas fa-${this.isEditMode ? 'edit' : 'plus'}"></i> ${title}</h3>
                    <button type="button" class="sidebar-close" id="modalCancelBtn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="sidebar-content">
                    <form id="transactionModalForm" class="sidebar-form">
                        <div class="sidebar-section">
                            <h4><i class="fas fa-info-circle"></i> Transaction Details</h4>
                            
                            <div class="form-group">
                                <label for="modalTransactionType"><i class="fas fa-exchange-alt"></i> Transaction Type</label>
                                <select id="modalTransactionType" name="type" required>
                                    <option value="buy">🔵 Buy BTC</option>
                                    <option value="sell">🔴 Sell BTC</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="modalTransactionDate"><i class="fas fa-calendar"></i> Date & Time</label>
                                <input type="datetime-local" id="modalTransactionDate" name="date" required>
                            </div>
                        </div>
                        
                        <div class="sidebar-section">
                            <h4><i class="fab fa-bitcoin"></i> Amount & Price</h4>
                            
                            <div class="form-group">
                                <label for="modalTransactionAmount" id="modalAmountLabel"><i class="fab fa-bitcoin"></i> BTC Amount</label>
                                <input type="number" id="modalTransactionAmount" name="amount" step="0.00000001" min="0" required>
                                <p class="sidebar-desc" id="modalAmountHelp">Amount of Bitcoin for this transaction</p>
                            </div>
                            
                            <div class="form-group">
                                <label for="modalTransactionPrice"><i class="fas fa-tag"></i> Price per BTC</label>
                                <input type="number" id="modalTransactionPrice" name="price" step="0.01" min="0" required>
                                <p class="sidebar-desc">Price in the selected currency</p>
                            </div>
                        </div>
                        
                        <div class="sidebar-section">
                            <h4><i class="fas fa-money-bill"></i> Currency & Fees</h4>
                            
                            <div class="form-group">
                                <label for="modalTransactionCurrency"><i class="fas fa-money-bill"></i> Currency</label>
                                <select id="modalTransactionCurrency" name="currency" required>
                                    <option value="EUR">EUR (€)</option>
                                    <option value="USD">USD ($)</option>
                                    <option value="PLN">PLN (zł)</option>
                                    <option value="GBP">GBP (£)</option>
                                    <option value="JPY">JPY (¥)</option>
                                    <option value="CHF">CHF (Fr)</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="modalTransactionFee"><i class="fas fa-percentage"></i> Fee (optional)</label>
                                <input type="number" id="modalTransactionFee" name="fee" step="0.01" min="0">
                                <p class="sidebar-desc">Transaction fee in the selected currency</p>
                            </div>
                        </div>
                        
                        <div class="sidebar-section">
                            <h4><i class="fas fa-calculator"></i> Total Cost</h4>
                            <div class="cost-display" id="modalCalculatedCost">0.00 EUR</div>
                            <p class="sidebar-desc">Calculated: (Amount × Price) + Fee</p>
                        </div>
                        
                        <div class="sidebar-buttons">
                            <button type="submit" class="btn btn-primary btn-full" id="modalSubmitBtn">${submitText}</button>
                            <button type="button" class="btn btn-secondary btn-full" id="modalCancelBtnSecondary">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
            <div class="sidebar-overlay" id="transactionSidebarOverlay"></div>
        `;
    }

    /**
     * Setup all event listeners for the modal
     */
    setupEventListeners() {
        const form = this.modal.querySelector('#transactionModalForm');
        const cancelBtn = this.modal.querySelector('#modalCancelBtn');
        const cancelBtnSecondary = this.modal.querySelector('#modalCancelBtnSecondary');
        const overlay = this.modal.querySelector('#transactionSidebarOverlay');
        
        // Form submission
        form.addEventListener('submit', this.handleSubmit.bind(this));
        
        // Cancel buttons
        cancelBtn.addEventListener('click', this.closeModal.bind(this));
        cancelBtnSecondary.addEventListener('click', this.closeModal.bind(this));
        
        // Close on overlay click
        overlay.addEventListener('click', this.closeModal.bind(this));
        
        // Close on escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        
        // Real-time cost calculation
        const amountInput = this.modal.querySelector('#modalTransactionAmount');
        const priceInput = this.modal.querySelector('#modalTransactionPrice');
        const feeInput = this.modal.querySelector('#modalTransactionFee');
        const currencySelect = this.modal.querySelector('#modalTransactionCurrency');
        
        [amountInput, priceInput, feeInput].forEach(input => {
            input.addEventListener('input', this.calculateCost.bind(this));
        });
        currencySelect.addEventListener('change', this.calculateCost.bind(this));
        
        // Update form labels based on BTC unit
        this.updateFormLabels();
        
        // Listen for BTC unit changes
        window.addEventListener('btcUnitChanged', this.updateFormLabels.bind(this));
    }

    /**
     * Update form labels based on current BTC unit setting
     */
    updateFormLabels() {
        const amountLabel = this.modal?.querySelector('#modalAmountLabel');
        const amountHelp = this.modal?.querySelector('#modalAmountHelp');
        const amountInput = this.modal?.querySelector('#modalTransactionAmount');
        
        if (!amountLabel || !amountHelp || !amountInput) return;
        
        if (window.currentBtcUnit === 'satoshi') {
            amountLabel.innerHTML = '<i class="fak fa-satoshisymbol-solid"></i> Satoshi Amount:';
            amountHelp.textContent = 'Amount of Satoshis for this transaction';
            amountInput.step = '1';
            amountInput.placeholder = '100000';
        } else {
            amountLabel.innerHTML = '<i class="fab fa-bitcoin"></i> BTC Amount:';
            amountHelp.textContent = 'Amount of Bitcoin for this transaction';
            amountInput.step = '0.00000001';
            amountInput.placeholder = '0.001';
        }
    }

    /**
     * Calculate and display the total cost
     */
    calculateCost() {
        if (!this.modal) return;
        
        const amount = parseFloat(this.modal.querySelector('#modalTransactionAmount').value) || 0;
        const price = parseFloat(this.modal.querySelector('#modalTransactionPrice').value) || 0;
        const fee = parseFloat(this.modal.querySelector('#modalTransactionFee').value) || 0;
        const currency = this.modal.querySelector('#modalTransactionCurrency').value;
        
        // Convert amount to BTC if in satoshi mode
        const btcAmount = window.currentBtcUnit === 'satoshi' ? amount / 100000000 : amount;
        
        const cost = (btcAmount * price) + fee;
        const symbol = this.getCurrencySymbol(currency);
        
        this.modal.querySelector('#modalCalculatedCost').textContent = `${cost.toFixed(2)} ${symbol}`;
    }

    /**
     * Get currency symbol helper
     */
    getCurrencySymbol(currency) {
        const symbols = {
            'EUR': '€',
            'USD': '$',
            'PLN': 'zł',
            'GBP': '£',
            'JPY': '¥',
            'CHF': 'Fr'
        };
        return symbols[currency] || currency;
    }

    /**
     * Populate form with default values for new transaction
     */
    populateDefaults() {
        if (!this.modal) return;
        
        // Set default date to now
        const now = new Date();
        const dateString = now.getFullYear() + '-' + 
                          String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                          String(now.getDate()).padStart(2, '0') + 'T' + 
                          String(now.getHours()).padStart(2, '0') + ':' + 
                          String(now.getMinutes()).padStart(2, '0');
        
        this.modal.querySelector('#modalTransactionDate').value = dateString;
        
        // Set default currency to main currency if available
        if (window.mainCurrency) {
            this.modal.querySelector('#modalTransactionCurrency').value = window.mainCurrency;
        }
        
        this.calculateCost();
    }

    /**
     * Populate form with existing transaction data for editing
     */
    populateTransaction(transaction) {
        if (!this.modal) return;
        
        // Format date for datetime-local input
        const date = new Date(transaction.date);
        const dateString = date.getFullYear() + '-' + 
                          String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                          String(date.getDate()).padStart(2, '0') + 'T' + 
                          String(date.getHours()).padStart(2, '0') + ':' + 
                          String(date.getMinutes()).padStart(2, '0');
        
        this.modal.querySelector('#modalTransactionType').value = transaction.type;
        this.modal.querySelector('#modalTransactionDate').value = dateString;
        
        // Handle amount based on current BTC unit
        const displayAmount = window.currentBtcUnit === 'satoshi' 
            ? Math.round(transaction.amount * 100000000)
            : transaction.amount;
        this.modal.querySelector('#modalTransactionAmount').value = displayAmount;
        
        // Use original values for editing
        this.modal.querySelector('#modalTransactionPrice').value = transaction.original?.price || transaction.price || 0;
        this.modal.querySelector('#modalTransactionCurrency').value = transaction.original?.currency || 'EUR';
        this.modal.querySelector('#modalTransactionFee').value = transaction.original?.fee || 0;
        
        this.calculateCost();
    }

    /**
     * Handle form submission
     */
    async handleSubmit(e) {
        e.preventDefault();
        
        const submitBtn = this.modal.querySelector('#modalSubmitBtn');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = this.isEditMode ? 'Updating...' : 'Adding...';
        submitBtn.disabled = true;
        
        try {
            const formData = new FormData(e.target);
            let amount = parseFloat(formData.get('amount'));
            
            // Convert from satoshi to BTC if needed
            if (window.currentBtcUnit === 'satoshi') {
                amount = amount / 100000000;
            }
            
            // Round to satoshi precision
            amount = Math.round(amount * 100000000) / 100000000;
            
            const transactionData = {
                type: formData.get('type'),
                date: new Date(formData.get('date')).toISOString(),
                amount: amount,
                price: parseFloat(formData.get('price')),
                currency: formData.get('currency'),
                fee: parseFloat(formData.get('fee')) || 0
            };
            
            // For edit mode, use different field names that admin expects
            if (this.isEditMode) {
                transactionData.originalPrice = transactionData.price;
                transactionData.originalCurrency = transactionData.currency;
                transactionData.originalFee = transactionData.fee;
                delete transactionData.price;
                delete transactionData.currency;
                delete transactionData.fee;
            }
            
            const url = this.isEditMode 
                ? `${this.apiEndpoint}/${this.transactionId}`
                : this.apiEndpoint;
            
            const method = this.isEditMode ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(transactionData)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || errorData.error || 'Failed to save transaction');
            }
            
            // Success
            this.closeModal();
            
            // Call success callback if provided
            if (this.onSuccess) {
                this.onSuccess();
            }
            
            // Show success message
            this.showSuccessMessage(
                this.isEditMode ? 'Transaction updated successfully!' : 'Transaction added successfully!'
            );
            
        } catch (error) {
            console.error('Error saving transaction:', error);
            alert(`Error ${this.isEditMode ? 'updating' : 'adding'} transaction: ${error.message}`);
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    /**
     * Show success toast notification
     */
    showSuccessMessage(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #00b894;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10001;
            font-family: 'JetBrains Mono', monospace;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    /**
     * Show the modal
     */
    showModal() {
        if (this.modal) {
            const sidebar = this.modal.querySelector('.transaction-sidebar');
            const overlay = this.modal.querySelector('#transactionSidebarOverlay');
            
            this.modal.style.display = 'block';
            
            // Add open classes for animation
            setTimeout(() => {
                sidebar.classList.add('open');
                overlay.classList.add('active');
                document.body.style.overflow = 'hidden';
            }, 10);
            
            // Focus first input
            setTimeout(() => {
                const firstInput = this.modal.querySelector('input, select');
                if (firstInput) firstInput.focus();
            }, 300);
        }
    }

    /**
     * Close the modal
     */
    closeModal() {
        if (this.modal) {
            const sidebar = this.modal.querySelector('.transaction-sidebar');
            const overlay = this.modal.querySelector('#transactionSidebarOverlay');
            
            // Remove open classes for animation
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
            
            // Hide after animation
            setTimeout(() => {
                if (this.modal) {
                    this.modal.style.display = 'none';
                    this.destroyModal();
                }
            }, 300);
        }
    }

    /**
     * Destroy the modal and clean up
     */
    destroyModal() {
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
    }
}

// Global instance
window.transactionModal = new TransactionModal();

// Add required CSS styles if not already present
if (!document.querySelector('#transaction-modal-styles')) {
    const styles = document.createElement('style');
    styles.id = 'transaction-modal-styles';
    styles.textContent = `
        .transaction-modal {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            z-index: 1000 !important;
            pointer-events: none !important;
        }

        .transaction-modal .transaction-sidebar {
            position: fixed !important;
            top: 0 !important;
            right: -450px !important;
            width: 450px !important;
            height: 100vh !important;
            background: var(--bg-color, #0f0f0f) !important;
            border-left: 1px solid rgba(255, 255, 255, 0.1) !important;
            z-index: 1001 !important;
            transition: right 0.3s ease !important;
            overflow-y: auto !important;
            pointer-events: all !important;
        }

        .transaction-modal .transaction-sidebar.open {
            right: 0 !important;
        }

        .transaction-modal .sidebar-overlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0, 0, 0, 0.5) !important;
            z-index: 1000 !important;
            opacity: 0 !important;
            visibility: hidden !important;
            transition: opacity 0.3s ease, visibility 0.3s ease !important;
            pointer-events: none !important;
        }

        .transaction-modal .sidebar-overlay.active {
            opacity: 1 !important;
            visibility: visible !important;
            pointer-events: all !important;
        }

        .transaction-modal .sidebar-header {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            padding: 15px 18px !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
            background: rgba(247, 147, 26, 0.05) !important;
        }

        .transaction-modal .sidebar-header h3 {
            margin: 0 !important;
            color: var(--accent-color, #f7931a) !important;
            font-size: 1.2rem !important;
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
        }

        .transaction-modal .sidebar-close {
            background: none !important;
            border: none !important;
            color: var(--text-color, #ffffff) !important;
            font-size: 1.1rem !important;
            cursor: pointer !important;
            padding: 6px !important;
            border-radius: 4px !important;
            transition: background 0.2s ease !important;
        }

        .transaction-modal .sidebar-close:hover {
            background: rgba(255, 255, 255, 0.1) !important;
        }

        .transaction-modal .sidebar-content {
            padding: 16px !important;
        }

        .transaction-modal .sidebar-section {
            margin-bottom: 18px !important;
            padding-bottom: 15px !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
        }

        .transaction-modal .sidebar-section:last-child {
            border-bottom: none !important;
            margin-bottom: 0 !important;
        }

        .transaction-modal .sidebar-section h4 {
            margin: 0 0 12px 0 !important;
            color: var(--accent-color, #f7931a) !important;
            font-size: 0.95rem !important;
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
        }

        .transaction-modal .sidebar-form {
            display: flex !important;
            flex-direction: column !important;
        }

        .transaction-modal .form-group {
            margin-bottom: 12px !important;
        }

        .transaction-modal .form-group label {
            display: block !important;
            margin-bottom: 6px !important;
            font-weight: 600 !important;
            color: var(--text-color, #ffffff) !important;
            font-size: 0.85rem !important;
            display: flex !important;
            align-items: center !important;
            gap: 5px !important;
        }

        .transaction-modal .form-group input, 
        .transaction-modal .form-group select {
            width: 100% !important;
            padding: 10px !important;
            border: 1px solid var(--border-color, #333) !important;
            border-radius: 6px !important;
            background-color: var(--input-background, #222) !important;
            color: var(--text-color, #eee) !important;
            font-family: 'JetBrains Mono', monospace !important;
            box-sizing: border-box !important;
            font-size: 0.8rem !important;
            line-height: 1.3 !important;
            appearance: none !important;
            -webkit-appearance: none !important;
            -moz-appearance: none !important;
        }

        .transaction-modal .form-group input:focus,
        .transaction-modal .form-group select:focus {
            border-color: #f7931a !important;
            outline: none !important;
            box-shadow: 0 0 0 2px rgba(247, 147, 26, 0.2) !important;
        }

        .transaction-modal .form-group select {
            background-image: linear-gradient(45deg, transparent 50%, var(--text-color, #eee) 50%), 
                             linear-gradient(135deg, var(--text-color, #eee) 50%, transparent 50%) !important;
            background-position: calc(100% - 20px) calc(1em + 2px), 
                                calc(100% - 15px) calc(1em + 2px) !important;
            background-size: 5px 5px, 5px 5px !important;
            background-repeat: no-repeat !important;
            padding-right: 40px !important;
        }

        .transaction-modal .sidebar-desc {
            font-size: 0.75rem !important;
            color: var(--text-secondary-color, #cccccc) !important;
            margin-top: 4px !important;
            margin-bottom: 0 !important;
            line-height: 1.2 !important;
        }

        .transaction-modal .cost-display {
            padding: 12px !important;
            background-color: rgba(247, 147, 26, 0.1) !important;
            border-radius: 6px !important;
            text-align: center !important;
            font-family: 'JetBrains Mono', monospace !important;
            font-weight: 600 !important;
            color: var(--accent-color, #f7931a) !important;
            border: 1px solid rgba(247, 147, 26, 0.3) !important;
            font-size: 1rem !important;
        }

        .transaction-modal .sidebar-buttons {
            display: flex !important;
            flex-direction: column !important;
            gap: 8px !important;
            margin-top: 16px !important;
        }

        .transaction-modal .btn {
            padding: 10px 16px !important;
            border: none !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            font-weight: 600 !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 6px !important;
            transition: all 0.2s ease !important;
            font-family: inherit !important;
            font-size: 0.85rem !important;
            text-decoration: none !important;
            line-height: 1.3 !important;
        }

        .transaction-modal .btn-full {
            width: 100% !important;
        }

        .transaction-modal .btn-primary {
            background-color: #f7931a !important;
            color: #fff !important;
        }

        .transaction-modal .btn-primary:hover {
            background-color: #e67e00 !important;
            transform: translateY(-1px) !important;
        }

        .transaction-modal .btn-secondary {
            background-color: var(--button-secondary-bg, #333) !important;
            color: var(--button-secondary-color, #eee) !important;
        }

        .transaction-modal .btn-secondary:hover {
            background-color: var(--button-secondary-hover, #444) !important;
        }

        /* Mobile Responsive */
        @media (max-width: 768px) {
            .transaction-modal .transaction-sidebar {
                width: 100% !important;
                right: -100% !important;
            }
        }
    `;
    document.head.appendChild(styles);
} 