'use client';

import React, { useState, useEffect } from 'react';
import { ThemedCard, ThemedText, ThemedButton } from '@/components/ui/ThemeProvider';
import AppLayout from '@/components/AppLayout';
import { formatCurrency, formatPercentage } from '@/lib/theme';

interface BitcoinTransaction {
  id: number;
  type: 'BUY' | 'SELL';
  btc_amount: number;
  original_price_per_btc: number;
  original_currency: string;
  original_total_amount: number;
  main_currency_price_per_btc: number;
  main_currency_total_amount: number;
  main_currency: string;
  usd_price_per_btc: number;
  usd_total_amount: number;
  exchange_rate_used: number;
  fees: number;
  fees_currency: string;
  transaction_date: string;
  notes: string;
  created_at: string;
  updated_at: string;
  
  // Secondary currency display values (added by API)
  secondary_currency?: string;
  secondary_currency_price_per_btc?: number;
  secondary_currency_total_amount?: number;
  secondary_currency_current_value?: number;
  secondary_currency_pnl?: number;
  current_value_main?: number;
  pnl_main?: number;
}

interface TransactionFormData {
  type: 'BUY' | 'SELL';
  btc_amount: string;
  price_per_btc: string;
  currency: string;
  fees: string;
  transaction_date: string;
  notes: string;
}

const initialFormData: TransactionFormData = {
  type: 'BUY',
  btc_amount: '',
  price_per_btc: '',
  currency: 'USD',
  fees: '0',
  transaction_date: new Date().toISOString().split('T')[0],
  notes: ''
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<BitcoinTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<BitcoinTransaction | null>(null);
  const [formData, setFormData] = useState<TransactionFormData>(initialFormData);
  const [filterType, setFilterType] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'pnl'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentBtcPrice, setCurrentBtcPrice] = useState(105000); // Fallback price
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);
  const [formatDetecting, setFormatDetecting] = useState(false);

  useEffect(() => {
    loadTransactions();
    loadCurrentBitcoinPrice();
  }, []);

  const loadTransactions = async () => {
    try {
      const response = await fetch('/api/transactions');
      const result = await response.json();
      
      if (result.success) {
        setTransactions(Array.isArray(result.data) ? result.data : []);
      } else {
        console.error('Failed to load transactions:', result.error);
        setTransactions([]);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentBitcoinPrice = async () => {
    try {
      const response = await fetch('/api/bitcoin-price');
      const result = await response.json();
      
      if (result.success && result.data?.price) {
        setCurrentBtcPrice(result.data.price);
      }
    } catch (error) {
      console.error('Error loading current Bitcoin price:', error);
    }
  };

  const handleAddTransaction = () => {
    setEditingTransaction(null);
    setFormData(initialFormData);
    setShowAddForm(true);
  };

  const handleEditTransaction = (transaction: BitcoinTransaction) => {
    setEditingTransaction(transaction);
    setFormData({
      type: transaction.type,
      btc_amount: transaction.btc_amount.toString(),
      price_per_btc: transaction.original_price_per_btc.toString(),
      currency: transaction.original_currency,
      fees: transaction.fees.toString(),
      transaction_date: transaction.transaction_date,
      notes: transaction.notes
    });
    setShowAddForm(true);
  };

  const handleDeleteTransaction = async (id: number) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      try {
        const response = await fetch(`/api/transactions/${id}`, {
          method: 'DELETE',
        });

        const result = await response.json();
        
        if (result.success) {
          loadTransactions(); // Reload transactions
        } else {
          alert(`Error: ${result.error || result.message}`);
        }
      } catch (error) {
        console.error('Error deleting transaction:', error);
        alert('Failed to delete transaction. Please try again.');
      }
    }
  };

  const handleSubmitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const method = editingTransaction ? 'PUT' : 'POST';
      const url = editingTransaction 
        ? `/api/transactions/${editingTransaction.id}` 
        : '/api/transactions';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      
      if (result.success) {
        setShowAddForm(false);
        setFormData(initialFormData);
        setEditingTransaction(null);
        loadTransactions(); // Reload transactions
      } else {
        alert(`Error: ${result.error || result.message}`);
      }
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Failed to save transaction. Please try again.');
    }
  };

  const calculatePnL = (transaction: BitcoinTransaction) => {
    // Use API-provided P&L calculation if available (more accurate)
    if (transaction.pnl_main !== undefined) {
      return transaction.pnl_main;
    }
    
    // Fallback calculation using main currency values
    const currentValue = transaction.btc_amount * currentBtcPrice;
    const mainCurrencyTotal = transaction.main_currency_total_amount || transaction.usd_total_amount;
    const costBasis = mainCurrencyTotal + (transaction.fees || 0);
    
    if (transaction.type === 'BUY') {
      return currentValue - costBasis;
    } else {
      // For SELL transactions, P&L is the proceeds minus the cost basis
      return mainCurrencyTotal - costBasis;
    }
  };

  const calculatePnLPercent = (transaction: BitcoinTransaction) => {
    const pnl = calculatePnL(transaction);
    const mainCurrencyTotal = transaction.main_currency_total_amount || transaction.usd_total_amount;
    const costBasis = mainCurrencyTotal + (transaction.fees || 0);
    return costBasis > 0 ? (pnl / costBasis) * 100 : 0;
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/transactions/export');
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bitcoin-transactions-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting transactions:', error);
      alert('Failed to export transactions. Please try again.');
    }
  };

  const detectFileFormat = async (file: File) => {
    setFormatDetecting(true);
    setDetectedFormat(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('detect_only', 'true'); // Add flag for detection only
      
      const response = await fetch('/api/transactions/import', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (result.detected_format) {
        const formatMap: { [key: string]: string } = {
          'legacy': 'Legacy Format',
          'binance': 'Binance SPOT Export',
          'standard': 'Standard CSV Format',
          'kraken': 'Kraken Export',
          'coinbase': 'Coinbase Export',
          'strike': 'Strike Export'
        };
        setDetectedFormat(formatMap[result.detected_format] || result.detected_format);
      }
    } catch (error) {
      console.error('Error detecting file format:', error);
      setDetectedFormat('Unknown Format');
    } finally {
      setFormatDetecting(false);
    }
  };

  const handleImportSubmit = async () => {
    if (!importFile) {
      alert('Please select a file to import');
      return;
    }

    setImportLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('skip_duplicates', 'true');

      const response = await fetch('/api/transactions/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`Successfully imported ${result.imported} transactions. ${result.skipped} duplicates skipped.`);
        setShowImportModal(false);
        setImportFile(null);
        setDetectedFormat(null);
        loadTransactions(); // Reload transactions
      } else {
        alert(`Import failed: ${result.error || result.message}`);
      }
    } catch (error) {
      console.error('Error importing transactions:', error);
      alert('Failed to import transactions. Please try again.');
    } finally {
      setImportLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'text/csv' || file.type === 'application/json' || file.name.endsWith('.csv') || file.name.endsWith('.json')) {
        setImportFile(file);
        if (file.name.endsWith('.csv')) {
          detectFileFormat(file);
        }
      } else {
        alert('Please upload a CSV or JSON file');
      }
    }
  };

  const filteredAndSortedTransactions = transactions
    .filter(t => filterType === 'ALL' || t.type === filterType)
    .sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'date':
          aValue = new Date(a.transaction_date).getTime();
          bValue = new Date(b.transaction_date).getTime();
          break;
        case 'amount':
          aValue = a.btc_amount;
          bValue = b.btc_amount;
          break;
        case 'pnl':
          aValue = calculatePnL(a);
          bValue = calculatePnL(b);
          break;
        default:
          return 0;
      }
      
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <ThemedText variant="secondary">Loading transactions...</ThemedText>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-2xl font-bold text-btc-text-primary">
                Transaction History
              </h1>
              <div className="bg-btc-bg-tertiary px-2 py-1 rounded-md">
                <ThemedText variant="secondary" size="sm">
                  {filteredAndSortedTransactions.length} 
                  {filterType !== 'ALL' ? ` ${filterType.toLowerCase()}` : ''} 
                  {filteredAndSortedTransactions.length === 1 ? ' transaction' : ' transactions'}
                </ThemedText>
              </div>
            </div>
            <ThemedText variant="secondary">
              Manage your Bitcoin transactions and track performance
            </ThemedText>
          </div>
          <div className="flex space-x-3">
            <ThemedButton
              variant="secondary"
              onClick={() => setShowImportModal(true)}
              className="text-btc-text-secondary hover:text-btc-text-primary"
            >
              <span className="mr-2">⬆️</span> Import
            </ThemedButton>
            <ThemedButton
              variant="secondary"
              onClick={handleExport}
              disabled={transactions.length === 0}
              className="text-btc-text-secondary hover:text-btc-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="mr-2">⬇️</span> Export
            </ThemedButton>
            <ThemedButton
              variant="primary"
              onClick={handleAddTransaction}
              className="bg-bitcoin hover:bg-bitcoin-dark"
            >
              + Add Transaction
            </ThemedButton>
          </div>
        </div>

        {/* Filters and Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
          {/* Quick Stats */}
          <ThemedCard>
            <div className="text-center">
              <div className="text-2xl font-bold text-btc-text-primary">
                {transactions.length}
              </div>
              <ThemedText variant="secondary" size="sm">
                Total Transactions
              </ThemedText>
            </div>
          </ThemedCard>

          <ThemedCard>
            <div className="text-center">
              <div className="text-2xl font-bold text-profit">
                {transactions.filter(t => t.type === 'BUY').length}
              </div>
              <ThemedText variant="secondary" size="sm">
                Buy Transactions
              </ThemedText>
            </div>
          </ThemedCard>

          <ThemedCard>
            <div className="text-center">
              <div className="text-2xl font-bold text-loss">
                {transactions.filter(t => t.type === 'SELL').length}
              </div>
              <ThemedText variant="secondary" size="sm">
                Sell Transactions
              </ThemedText>
            </div>
          </ThemedCard>

          <ThemedCard>
            <div className="text-center">
              <div className="text-2xl font-bold text-btc-text-primary">
                {formatCurrency(transactions.reduce((sum, t) => sum + (t.main_currency_total_amount || t.usd_total_amount), 0), transactions[0]?.main_currency || 'USD')}
              </div>
              <ThemedText variant="secondary" size="sm">
                Total Volume
              </ThemedText>
            </div>
          </ThemedCard>
        </div>

        {/* Filters and Controls */}
        <ThemedCard className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Type Filter */}
            <div className="flex items-center space-x-2">
              <ThemedText variant="secondary" size="sm">Filter:</ThemedText>
              <div className="flex space-x-1">
                {(['ALL', 'BUY', 'SELL'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 relative ${
                      filterType === type
                        ? 'bg-bitcoin text-white shadow-md transform scale-105'
                        : 'bg-btc-bg-tertiary text-btc-text-secondary hover:text-btc-text-primary hover:bg-btc-border-primary'
                    }`}
                  >
                    {type}
                    {filterType === type && type !== 'ALL' && (
                      <span className="ml-1 text-xs opacity-75">
                        ({transactions.filter(t => t.type === type).length})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort Controls */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <ThemedText variant="secondary" size="sm">Sort by:</ThemedText>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-1 bg-btc-bg-tertiary border border-btc-border-primary rounded text-btc-text-primary text-xs focus:ring-2 focus:ring-bitcoin focus:border-bitcoin"
                >
                  <option value="date">Date</option>
                  <option value="amount">Amount</option>
                  <option value="pnl">P&L</option>
                </select>
              </div>

              <button
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className={`px-3 py-1 rounded text-xs transition-all duration-200 flex items-center space-x-1 ${
                  sortOrder === 'desc' 
                    ? 'bg-bitcoin text-white shadow-md' 
                    : 'bg-btc-bg-tertiary text-btc-text-secondary hover:text-btc-text-primary'
                }`}
              >
                <span>{sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}</span>
                {sortOrder === 'desc' && (
                  <div className="w-1 h-1 bg-white rounded-full opacity-75"></div>
                )}
              </button>
            </div>
          </div>
        </ThemedCard>

        {/* Transactions Table */}
        <ThemedCard padding={false}>
          <div className="overflow-x-auto">
            {/* Table Header */}
            <div className="bg-btc-bg-tertiary px-6 py-3 border-b border-btc-border-primary">
              <div className="grid grid-cols-10 gap-4 text-xs font-medium text-btc-text-secondary uppercase tracking-wider">
                <button 
                  onClick={() => {
                    if (sortBy === 'date') {
                      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('date');
                      setSortOrder('desc');
                    }
                  }}
                  className="text-left hover:text-btc-text-primary transition-colors flex items-center space-x-1"
                >
                  <span>Date</span>
                  {sortBy === 'date' && (
                    <span className="text-bitcoin">
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
                <div>Type</div>
                <button 
                  onClick={() => {
                    if (sortBy === 'amount') {
                      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('amount');
                      setSortOrder('desc');
                    }
                  }}
                  className="text-left hover:text-btc-text-primary transition-colors flex items-center space-x-1"
                >
                  <span>Amount (BTC)</span>
                  {sortBy === 'amount' && (
                    <span className="text-bitcoin">
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
                <div>Original Price</div>
                <div>Total (Main)</div>
                <div>Total (Display)</div>
                <div>Fees</div>
                <div>Current Value</div>
                <button 
                  onClick={() => {
                    if (sortBy === 'pnl') {
                      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('pnl');
                      setSortOrder('desc');
                    }
                  }}
                  className="text-left hover:text-btc-text-primary transition-colors flex items-center space-x-1"
                >
                  <span>P&L</span>
                  {sortBy === 'pnl' && (
                    <span className="text-bitcoin">
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
                <div>Actions</div>
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-btc-border-secondary">
              {filteredAndSortedTransactions.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <div className="text-4xl mb-4">₿</div>
                  <h3 className="text-lg font-medium text-btc-text-secondary mb-2">
                    No transactions found
                  </h3>
                  <ThemedText variant="muted">
                    {filterType !== 'ALL' 
                      ? `No ${filterType.toLowerCase()} transactions to display.`
                      : 'Start by adding your first Bitcoin transaction.'
                    }
                  </ThemedText>
                </div>
              ) : (
                filteredAndSortedTransactions.map((transaction) => {
                  const currentValue = transaction.btc_amount * currentBtcPrice;
                  const pnl = calculatePnL(transaction);
                  const pnlPercent = calculatePnLPercent(transaction);

                  return (
                    <div key={transaction.id} className="px-6 py-4 hover:bg-btc-bg-tertiary transition-colors">
                      <div className="grid grid-cols-10 gap-4 items-center">
                        {/* Date */}
                        <div className="text-sm">
                          <div className="text-btc-text-primary font-medium">
                            {new Date(transaction.transaction_date).toLocaleDateString()}
                          </div>
                          <div className="text-btc-text-muted text-xs">
                            {new Date(transaction.created_at).toLocaleTimeString()}
                          </div>
                        </div>

                        {/* Type */}
                        <div>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            transaction.type === 'BUY' 
                              ? 'bg-profit text-white' 
                              : 'bg-loss text-white'
                          }`}>
                            {transaction.type}
                          </span>
                        </div>

                        {/* BTC Amount */}
                        <div className="text-sm">
                          <div className="text-btc-text-primary font-medium">
                            {transaction.btc_amount.toFixed(8)} ₿
                          </div>
                          <div className="text-btc-text-muted text-xs">
                            {(transaction.btc_amount * 100000000).toLocaleString()} sats
                          </div>
                        </div>

                        {/* Original Price */}
                        <div className="text-sm">
                          <div className="text-btc-text-primary font-medium">
                            {formatCurrency(transaction.original_price_per_btc, transaction.original_currency)}
                          </div>
                          {transaction.original_currency !== (transaction.main_currency || 'USD') && (
                            <div className="text-btc-text-muted text-xs opacity-70">
                              {formatCurrency(transaction.main_currency_price_per_btc || transaction.usd_price_per_btc, transaction.main_currency || 'USD')}
                            </div>
                          )}
                        </div>

                        {/* Total (Main) */}
                        <div className="text-sm">
                          <div className="text-btc-text-primary font-semibold">
                            {formatCurrency(transaction.main_currency_total_amount || transaction.usd_total_amount, transaction.main_currency || 'USD')}
                          </div>
                          {transaction.original_currency !== (transaction.main_currency || 'USD') && (
                            <div className="text-btc-text-muted text-xs opacity-70 font-normal">
                              {formatCurrency(transaction.original_total_amount, transaction.original_currency)}
                            </div>
                          )}
                        </div>

                        {/* Total (Display) */}
                        <div className="text-sm">
                          {transaction.secondary_currency && (
                            <div className="text-btc-text-secondary text-sm opacity-80">
                              {formatCurrency(transaction.secondary_currency_total_amount || 0, transaction.secondary_currency)}
                            </div>
                          )}
                        </div>

                        {/* Fees */}
                        <div className="text-sm text-btc-text-primary font-medium">
                          {formatCurrency(transaction.fees, transaction.fees_currency)}
                        </div>

                        {/* Current Value */}
                        <div className="text-sm">
                          {transaction.type === 'BUY' ? (
                            <>
                              <div className="text-btc-text-primary font-semibold">
                                {formatCurrency(transaction.current_value_main || (transaction.btc_amount * currentBtcPrice), transaction.main_currency || 'USD')}
                              </div>
                              {transaction.secondary_currency && (
                                <div className="text-btc-text-muted text-xs opacity-70 font-normal">
                                  {formatCurrency(transaction.secondary_currency_current_value || 0, transaction.secondary_currency)}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-btc-text-muted">-</div>
                          )}
                        </div>

                        {/* P&L */}
                        <div className="text-sm">
                          {(() => {
                            const mainPnL = transaction.pnl_main || pnl;
                            const secondaryPnL = transaction.secondary_currency_pnl || 0;
                            const pnlColor = mainPnL >= 0 ? 'text-profit' : 'text-loss';
                            
                            return (
                              <>
                                <div className={`font-bold text-base ${pnlColor}`}>
                                  {mainPnL >= 0 ? '+' : ''}{formatCurrency(mainPnL, transaction.main_currency || 'USD')}
                                </div>
                                {transaction.secondary_currency && (
                                  <div className={`text-xs opacity-70 font-normal ${pnlColor}`}>
                                    {secondaryPnL >= 0 ? '+' : ''}{formatCurrency(secondaryPnL, transaction.secondary_currency)}
                                  </div>
                                )}
                                <div className={`text-xs font-semibold ${pnlColor}`}>
                                  {formatPercentage(pnlPercent)}
                                </div>
                              </>
                            );
                          })()}
                        </div>

                        {/* Actions */}
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditTransaction(transaction)}
                            className="px-3 py-1.5 bg-bitcoin/10 hover:bg-bitcoin/20 text-bitcoin hover:text-bitcoin-dark text-xs font-medium rounded-md border border-bitcoin/20 hover:border-bitcoin/40 transition-all duration-200"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTransaction(transaction.id)}
                            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-medium rounded-md border border-red-500/20 hover:border-red-500/40 transition-all duration-200"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Notes */}
                      {transaction.notes && (
                        <div className="mt-2 text-xs text-btc-text-muted">
                          Note: {transaction.notes}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </ThemedCard>

        {/* Add/Edit Transaction Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-btc-text-primary mb-4">
                {editingTransaction ? 'Edit Transaction' : 'Add New Transaction'}
              </h3>

              <form onSubmit={handleSubmitTransaction} className="space-y-4">
                {/* Transaction Type */}
                <div>
                  <label className="block text-sm font-medium text-btc-text-secondary mb-2">
                    Transaction Type
                  </label>
                  <div className="flex space-x-2">
                    {(['BUY', 'SELL'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, type }))}
                        className={`flex-1 py-2 px-4 rounded transition-colors ${
                          formData.type === type
                            ? type === 'BUY' ? 'bg-profit text-white' : 'bg-loss text-white'
                            : 'bg-gray-800 text-btc-text-secondary hover:text-btc-text-primary'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* BTC Amount */}
                <div>
                  <label className="block text-sm font-medium text-btc-text-secondary mb-2">
                    BTC Amount
                  </label>
                  <input
                    type="number"
                    step="0.00000001"
                    value={formData.btc_amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, btc_amount: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-btc-border-primary rounded text-btc-text-primary"
                    placeholder="0.00000000"
                    required
                  />
                </div>

                {/* Price per BTC */}
                <div>
                  <label className="block text-sm font-medium text-btc-text-secondary mb-2">
                    Price per BTC
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price_per_btc}
                    onChange={(e) => setFormData(prev => ({ ...prev, price_per_btc: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-btc-border-primary rounded text-btc-text-primary"
                    placeholder="105000.00"
                    required
                  />
                </div>

                {/* Currency */}
                <div>
                  <label className="block text-sm font-medium text-btc-text-secondary mb-2">
                    Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-btc-border-primary rounded text-btc-text-primary"
                  >
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="PLN">PLN - Polish Złoty</option>
                    <option value="GBP">GBP - British Pound</option>
                  </select>
                </div>

                {/* Fees */}
                <div>
                  <label className="block text-sm font-medium text-btc-text-secondary mb-2">
                    Fees
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.fees}
                    onChange={(e) => setFormData(prev => ({ ...prev, fees: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-btc-border-primary rounded text-btc-text-primary"
                    placeholder="0.00"
                  />
                </div>

                {/* Transaction Date */}
                <div>
                  <label className="block text-sm font-medium text-btc-text-secondary mb-2">
                    Transaction Date
                  </label>
                  <input
                    type="date"
                    value={formData.transaction_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, transaction_date: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-btc-border-primary rounded text-btc-text-primary"
                    required
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-btc-text-secondary mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-btc-border-primary rounded text-btc-text-primary"
                    placeholder="Add any notes about this transaction..."
                    rows={3}
                  />
                </div>

                {/* Form Actions */}
                <div className="flex space-x-3 pt-4">
                  <ThemedButton
                    type="submit"
                    variant="primary"
                    className="flex-1 bg-btc-orange hover:bg-btc-orange-dark"
                  >
                    {editingTransaction ? 'Update Transaction' : 'Add Transaction'}
                  </ThemedButton>
                  <ThemedButton
                    type="button"
                    variant="secondary"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1"
                  >
                    Cancel
                  </ThemedButton>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-btc-text-primary mb-4">
                Import Transactions
              </h3>

              <div className="space-y-4">
                {/* Drag and Drop Area */}
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive
                      ? 'border-bitcoin bg-bitcoin/10'
                      : 'border-btc-border-primary hover:border-bitcoin/50'
                  }`}
                >
                  {importFile ? (
                    <div className="space-y-2">
                      <div className="text-4xl">📄</div>
                      <div className="text-btc-text-primary font-medium">
                        {importFile.name}
                      </div>
                      <div className="text-btc-text-secondary text-sm">
                        {(importFile.size / 1024).toFixed(2)} KB
                      </div>
                      {/* Format Detection */}
                      {formatDetecting && (
                        <div className="text-btc-text-secondary text-sm flex items-center justify-center">
                          <span className="animate-spin mr-2">⏳</span>
                          Detecting format...
                        </div>
                      )}
                      {detectedFormat && !formatDetecting && (
                        <div className="text-profit text-sm font-medium">
                          ✓ Detected: {detectedFormat}
                        </div>
                      )}
                      <button
                        onClick={() => {
                          setImportFile(null);
                          setDetectedFormat(null);
                        }}
                        className="text-red-400 hover:text-red-300 text-sm underline"
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-4xl">📥</div>
                      <div className="text-btc-text-primary font-medium">
                        Drag and drop your file here
                      </div>
                      <div className="text-btc-text-secondary text-sm">
                        or
                      </div>
                      <label className="inline-block">
                        <input
                          type="file"
                          accept=".csv,.json"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setImportFile(file);
                              if (file.name.endsWith('.csv')) {
                                detectFileFormat(file);
                              }
                            }
                          }}
                          className="hidden"
                        />
                        <span className="text-bitcoin hover:text-bitcoin-dark cursor-pointer underline">
                          browse to upload
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Supported Formats Info */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
                  <h4 className="text-sm font-medium text-btc-text-primary">
                    Supported Formats:
                  </h4>
                  <ul className="text-xs text-btc-text-secondary space-y-1">
                    <li>• <strong>CSV:</strong> Standard format, Legacy format, Binance SPOT export</li>
                    <li>• <strong>JSON:</strong> Our export format or custom array</li>
                    <li>• Duplicate transactions will be automatically skipped</li>
                  </ul>
                </div>

                {/* Import Actions */}
                <div className="flex space-x-3 pt-4">
                  <ThemedButton
                    variant="primary"
                    onClick={handleImportSubmit}
                    disabled={!importFile || importLoading}
                    className="flex-1 bg-bitcoin hover:bg-bitcoin-dark disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {importLoading ? 'Importing...' : 'Import Transactions'}
                  </ThemedButton>
                  <ThemedButton
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowImportModal(false);
                      setImportFile(null);
                    }}
                    disabled={importLoading}
                    className="flex-1"
                  >
                    Cancel
                  </ThemedButton>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
} 