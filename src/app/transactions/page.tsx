'use client';

import React, { useState, useEffect } from 'react';
import { ThemedCard, ThemedText, ThemedButton } from '@/components/ui/ThemeProvider';
import AppLayout from '@/components/AppLayout';
import AddTransactionModal from '@/components/AddTransactionModal';
import TransactionTags from '@/components/TransactionTags';
import { formatCurrency, formatPercentage } from '@/lib/theme';
import { DocumentIcon, InboxIcon } from '@heroicons/react/24/outline';

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
  tags?: string; // Comma-separated tags
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

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<BitcoinTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<BitcoinTransaction | null>(null);
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
  
  // New: Date range filter
  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d' | '3m' | '1y' | 'custom'>('all');
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [customDateTo, setCustomDateTo] = useState<string>('');
  
  // New: Search filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // New: Tag management
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState('');
  
  // New: Bulk actions
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set());
  const [bulkActionMode, setBulkActionMode] = useState(false);
  

  useEffect(() => {
    loadTransactions();
    loadCurrentBitcoinPrice();
  }, []);
  
  // Helper: Get date range boundaries
  const getDateRangeBoundaries = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (dateRange) {
      case '7d':
        return { from: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), to: now };
      case '30d':
        return { from: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), to: now };
      case '3m':
        return { from: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000), to: now };
      case '1y':
        return { from: new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000), to: now };
      case 'custom':
        return {
          from: customDateFrom ? new Date(customDateFrom) : new Date(0),
          to: customDateTo ? new Date(customDateTo) : now,
        };
      case 'all':
      default:
        return null;
    }
  };
  
  // Helper: Get all unique tags from transactions
  const getAllTags = (): string[] => {
    const tagSet = new Set<string>();
    transactions.forEach(t => {
      if (t.tags) {
        t.tags.split(',').forEach(tag => tagSet.add(tag.trim()));
      }
    });
    return Array.from(tagSet).sort();
  };
  
  // Helper: Add tag to transaction
  const addTagToTransaction = async (transactionId: number, tag: string) => {
    try {
      const transaction = transactions.find(t => t.id === transactionId);
      if (!transaction) return;
      
      const existingTags = transaction.tags ? transaction.tags.split(',').map(t => t.trim()) : [];
      if (existingTags.includes(tag)) return; // Already has this tag
      
      const newTags = [...existingTags, tag].join(',');
      
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...transaction, tags: newTags }),
      });
      
      if (response.ok) {
        await loadTransactions();
      }
    } catch (error) {
      console.error('Error adding tag:', error);
    }
  };
  
  // Helper: Remove tag from transaction
  const removeTagFromTransaction = async (transactionId: number, tagToRemove: string) => {
    try {
      const transaction = transactions.find(t => t.id === transactionId);
      if (!transaction) return;
      
      const existingTags = transaction.tags ? transaction.tags.split(',').map(t => t.trim()) : [];
      const newTags = existingTags.filter(t => t !== tagToRemove).join(',');
      
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...transaction, tags: newTags || null }),
      });
      
      if (response.ok) {
        await loadTransactions();
      }
    } catch (error) {
      console.error('Error removing tag:', error);
    }
  };
  
  // Helper: Bulk delete transactions
  const handleBulkDelete = async () => {
    if (selectedTransactions.size === 0) return;
    
    const confirmed = confirm(`Delete ${selectedTransactions.size} transaction(s)?`);
    if (!confirmed) return;
    
    try {
      await Promise.all(
        Array.from(selectedTransactions).map(id =>
          fetch(`/api/transactions/${id}`, { method: 'DELETE' })
        )
      );
      
      setSelectedTransactions(new Set());
      setBulkActionMode(false);
      await loadTransactions();
    } catch (error) {
      console.error('Error bulk deleting:', error);
      alert('Failed to delete transactions');
    }
  };
  
  // Helper: Bulk add tag
  const handleBulkAddTag = async (tag: string) => {
    if (selectedTransactions.size === 0) return;
    
    try {
      await Promise.all(
        Array.from(selectedTransactions).map(id => addTagToTransaction(id, tag))
      );
      
      setSelectedTransactions(new Set());
      setBulkActionMode(false);
    } catch (error) {
      console.error('Error bulk adding tag:', error);
    }
  };
  
  // Helper: Toggle transaction selection
  const toggleTransactionSelection = (id: number) => {
    const newSelection = new Set(selectedTransactions);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedTransactions(newSelection);
  };
  
  // Helper: Select all/none
  const toggleSelectAll = () => {
    if (selectedTransactions.size === filteredAndSortedTransactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(filteredAndSortedTransactions.map(t => t.id)));
    }
  };

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
    setShowAddModal(true);
  };

  const handleEditTransaction = (transaction: BitcoinTransaction) => {
    setEditingTransaction(transaction);
    setShowAddModal(true);
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
    .filter(t => {
      // Type filter
      if (filterType !== 'ALL' && t.type !== filterType) return false;
      
      // Date range filter
      const dateRangeBoundaries = getDateRangeBoundaries();
      if (dateRangeBoundaries) {
        const txDate = new Date(t.transaction_date);
        if (txDate < dateRangeBoundaries.from || txDate > dateRangeBoundaries.to) {
          return false;
        }
      }
      
      // Tag filter
      if (selectedTags.length > 0) {
        const txTags = t.tags ? t.tags.split(',').map(tag => tag.trim()) : [];
        const hasSelectedTag = selectedTags.some(selectedTag => txTags.includes(selectedTag));
        if (!hasSelectedTag) return false;
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesNotes = t.notes?.toLowerCase().includes(query);
        const matchesAmount = t.btc_amount.toString().includes(query);
        const matchesCurrency = t.original_currency?.toLowerCase().includes(query);
        const matchesDate = t.transaction_date.includes(query);
        const matchesPrice = t.original_price_per_btc.toString().includes(query);
        const matchesTags = t.tags?.toLowerCase().includes(query);
        
        if (!matchesNotes && !matchesAmount && !matchesCurrency && !matchesDate && !matchesPrice && !matchesTags) {
          return false;
        }
      }
      
      return true;
    })
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
      <div className="p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 space-y-4 lg:space-y-0">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 mb-2">
              <h1 className="text-xl md:text-2xl font-bold text-btc-text-primary">
                Transaction History
              </h1>
              <div className="bg-btc-bg-tertiary px-2 py-1 rounded-md inline-block">
                <ThemedText variant="secondary" size="sm">
                  {filteredAndSortedTransactions.length} 
                  {filterType !== 'ALL' ? ` ${filterType.toLowerCase()}` : ''} 
                  {filteredAndSortedTransactions.length === 1 ? ' transaction' : ' transactions'}
                </ThemedText>
              </div>
            </div>
            <ThemedText variant="secondary" className="text-sm md:text-base">
              Manage your Bitcoin transactions and track performance
            </ThemedText>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:space-x-3">
            <ThemedButton
              variant={bulkActionMode ? 'primary' : 'secondary'}
              onClick={() => {
                setBulkActionMode(!bulkActionMode);
                setSelectedTransactions(new Set());
              }}
              className="text-xs sm:text-sm"
            >
              {bulkActionMode ? '✓ Bulk Mode' : '☑ Select'}
            </ThemedButton>
            <ThemedButton
              variant="secondary"
              onClick={() => setShowImportModal(true)}
              className="text-btc-text-secondary hover:text-btc-text-primary text-xs sm:text-sm"
            >
              <span className="mr-1 sm:mr-2">⬆️</span> Import
            </ThemedButton>
            <ThemedButton
              variant="secondary"
              onClick={handleExport}
              disabled={transactions.length === 0}
              className="text-btc-text-secondary hover:text-btc-text-primary disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
            >
              <span className="mr-1 sm:mr-2">⬇️</span> Export
            </ThemedButton>
            <ThemedButton
              variant="primary"
              onClick={handleAddTransaction}
              className="bg-bitcoin hover:bg-bitcoin-dark text-xs sm:text-sm"
            >
              + Add
            </ThemedButton>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {bulkActionMode && (
          <ThemedCard className="mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center space-x-3">
                <button
                  onClick={toggleSelectAll}
                  className="text-xs text-bitcoin hover:text-bitcoin-dark font-medium"
                >
                  {selectedTransactions.size === filteredAndSortedTransactions.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-xs text-btc-text-muted">
                  {selectedTransactions.size} selected
                </span>
              </div>
              
              {selectedTransactions.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="px-4 py-2 bg-loss hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors shadow-md"
                >
                  🗑️ Delete {selectedTransactions.size} Transaction{selectedTransactions.size > 1 ? 's' : ''}
                </button>
              )}
            </div>
          </ThemedCard>
        )}

        {/* Enhanced Quick Stats Summary */}
        <ThemedCard className="mb-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Total BTC Bought */}
            <div className="text-center">
              <div className="text-xs text-btc-text-muted mb-1">BTC Bought</div>
              <div className="text-lg font-bold text-profit">
                {filteredAndSortedTransactions.filter(t => t.type === 'BUY').reduce((sum, t) => sum + t.btc_amount, 0).toFixed(6)} ₿
              </div>
              <div className="text-xs text-btc-text-secondary mt-1">
                {filteredAndSortedTransactions.filter(t => t.type === 'BUY').length} txs
            </div>
            </div>

            {/* Total BTC Sold */}
            <div className="text-center">
              <div className="text-xs text-btc-text-muted mb-1">BTC Sold</div>
              <div className="text-lg font-bold text-loss">
                {filteredAndSortedTransactions.filter(t => t.type === 'SELL').reduce((sum, t) => sum + t.btc_amount, 0).toFixed(6)} ₿
              </div>
              <div className="text-xs text-btc-text-secondary mt-1">
                {filteredAndSortedTransactions.filter(t => t.type === 'SELL').length} txs
            </div>
            </div>

            {/* Net Position */}
            <div className="text-center">
              <div className="text-xs text-btc-text-muted mb-1">Net Position</div>
              <div className="text-lg font-bold text-bitcoin">
                {(
                  filteredAndSortedTransactions.filter(t => t.type === 'BUY').reduce((sum, t) => sum + t.btc_amount, 0) -
                  filteredAndSortedTransactions.filter(t => t.type === 'SELL').reduce((sum, t) => sum + t.btc_amount, 0)
                ).toFixed(6)} ₿
              </div>
              <div className="text-xs text-btc-text-secondary mt-1">
                Current holdings
              </div>
            </div>

            {/* Total Invested */}
            <div className="text-center">
              <div className="text-xs text-btc-text-muted mb-1">Total Invested</div>
              <div className="text-lg font-bold text-btc-text-primary">
                {formatCurrency(
                  filteredAndSortedTransactions.filter(t => t.type === 'BUY').reduce((sum, t) => sum + (t.main_currency_total_amount || 0), 0),
                  filteredAndSortedTransactions[0]?.main_currency || 'USD'
                )}
              </div>
              <div className="text-xs text-btc-text-secondary mt-1">
                Buy volume
              </div>
            </div>

            {/* Average Buy Price */}
            <div className="text-center">
              <div className="text-xs text-btc-text-muted mb-1">Avg Buy Price</div>
              <div className="text-lg font-bold text-btc-text-primary">
                {(() => {
                  const buyTxs = filteredAndSortedTransactions.filter(t => t.type === 'BUY');
                  const totalBTC = buyTxs.reduce((sum, t) => sum + t.btc_amount, 0);
                  const totalSpent = buyTxs.reduce((sum, t) => sum + (t.main_currency_total_amount || 0), 0);
                  return totalBTC > 0 ? formatCurrency(totalSpent / totalBTC, filteredAndSortedTransactions[0]?.main_currency || 'USD') : '--';
                })()}
              </div>
              <div className="text-xs text-btc-text-secondary mt-1">
                Per BTC
              </div>
            </div>

            {/* Total P&L */}
            <div className="text-center">
              <div className="text-xs text-btc-text-muted mb-1">Total P&L</div>
              <div className={`text-lg font-bold ${
                filteredAndSortedTransactions.reduce((sum, t) => sum + (t.pnl_main || 0), 0) >= 0 ? 'text-profit' : 'text-loss'
              }`}>
                {(() => {
                  const totalPnL = filteredAndSortedTransactions.reduce((sum, t) => sum + (t.pnl_main || 0), 0);
                  return (totalPnL >= 0 ? '+' : '') + formatCurrency(totalPnL, filteredAndSortedTransactions[0]?.main_currency || 'USD');
                })()}
              </div>
              <div className="text-xs text-btc-text-secondary mt-1">
                Unrealized
              </div>
            </div>
            </div>
          </ThemedCard>

        {/* Tag Filter */}
        {getAllTags().length > 0 && (
          <div className="mb-4">
            <div className="flex items-center flex-wrap gap-2">
              <span className="text-xs text-btc-text-muted">Filter by tags:</span>
              {getAllTags().map(tag => (
                <button
                  key={tag}
                  onClick={() => {
                    if (selectedTags.includes(tag)) {
                      setSelectedTags(selectedTags.filter(t => t !== tag));
                    } else {
                      setSelectedTags([...selectedTags, tag]);
                    }
                  }}
                  className={`px-2 py-1 rounded-full text-xs font-medium transition-all ${
                    selectedTags.includes(tag)
                      ? 'bg-bitcoin text-white shadow-md'
                      : 'bg-btc-bg-tertiary text-btc-text-secondary hover:bg-btc-border-primary'
                  }`}
                >
                  {tag} {selectedTags.includes(tag) && '✓'}
                </button>
              ))}
              {selectedTags.length > 0 && (
                <button
                  onClick={() => setSelectedTags([])}
                  className="px-2 py-1 text-xs text-loss hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search transactions (notes, amount, currency, date, tags...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 bg-btc-bg-secondary border border-btc-border-primary rounded-lg text-btc-text-primary placeholder-btc-text-muted focus:ring-2 focus:ring-bitcoin focus:border-bitcoin transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-btc-text-secondary hover:text-btc-text-primary"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filters and Controls */}
        <ThemedCard className="mb-6">
          <div className="space-y-4">
            {/* Row 1: Type Filter & Date Range */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Type Filter */}
            <div className="flex items-center space-x-2">
                <ThemedText variant="secondary" size="sm">Type:</ThemedText>
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

              {/* Date Range Filter */}
              <div className="flex items-center space-x-2 flex-wrap">
                <ThemedText variant="secondary" size="sm">Period:</ThemedText>
                <div className="flex space-x-1">
                  {[
                    { value: 'all', label: 'All' },
                    { value: '7d', label: '7D' },
                    { value: '30d', label: '30D' },
                    { value: '3m', label: '3M' },
                    { value: '1y', label: '1Y' },
                    { value: 'custom', label: 'Custom' },
                  ].map((range) => (
                    <button
                      key={range.value}
                      onClick={() => setDateRange(range.value as any)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                        dateRange === range.value
                          ? 'bg-bitcoin text-white shadow-md'
                          : 'bg-btc-bg-tertiary text-btc-text-secondary hover:text-btc-text-primary hover:bg-btc-border-primary'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 2: Custom Date Range (if selected) */}
            {dateRange === 'custom' && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 pt-2 border-t border-btc-border-primary">
                <ThemedText variant="secondary" size="sm">From:</ThemedText>
                <input
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="px-3 py-1 bg-btc-bg-tertiary border border-btc-border-primary rounded text-btc-text-primary text-xs focus:ring-2 focus:ring-bitcoin"
                />
                <ThemedText variant="secondary" size="sm">To:</ThemedText>
                <input
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  className="px-3 py-1 bg-btc-bg-tertiary border border-btc-border-primary rounded text-btc-text-primary text-xs focus:ring-2 focus:ring-bitcoin"
                />
              </div>
            )}

            {/* Row 3: Sort Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2 border-t border-btc-border-primary">
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
              </button>
              </div>

            </div>
          </div>
        </ThemedCard>

        {/* Transactions Table */}
        <ThemedCard padding={false}>
          <div className="overflow-x-auto">
            {/* Table Header - Desktop Only */}
            <div className="hidden lg:block bg-btc-bg-tertiary px-6 py-3 border-b border-btc-border-primary">
              <div className={`grid gap-4 text-xs font-medium text-btc-text-secondary uppercase tracking-wider ${bulkActionMode ? 'grid-cols-11' : 'grid-cols-10'}`}>
                {/* Bulk Select Checkbox */}
                {bulkActionMode && (
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedTransactions.size === filteredAndSortedTransactions.length && filteredAndSortedTransactions.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-btc-border-primary text-bitcoin focus:ring-bitcoin cursor-pointer"
                    />
                  </div>
                )}
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
                    <div key={transaction.id}>
                      {/* Desktop View */}
                      <div className="hidden lg:block px-6 py-4 hover:bg-btc-bg-tertiary transition-colors">
                        <div className={`grid gap-4 items-center ${bulkActionMode ? 'grid-cols-11' : 'grid-cols-10'}`}>
                        {/* Bulk Select Checkbox */}
                        {bulkActionMode && (
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={selectedTransactions.has(transaction.id)}
                              onChange={() => toggleTransactionSelection(transaction.id)}
                              className="rounded border-btc-border-primary text-bitcoin focus:ring-bitcoin cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        )}
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
                      
                      {/* Mobile View - Card Layout */}
                      <div className="lg:hidden px-4 py-4 border-b border-btc-border-secondary hover:bg-btc-bg-tertiary transition-colors">
                        <div className="space-y-3">
                          {/* Header Row */}
                          <div className="flex justify-between items-start">
                            {/* Checkbox for bulk mode */}
                            {bulkActionMode && (
                              <input
                                type="checkbox"
                                checked={selectedTransactions.has(transaction.id)}
                                onChange={() => toggleTransactionSelection(transaction.id)}
                                className="mt-1 mr-2 rounded border-btc-border-primary text-bitcoin focus:ring-bitcoin cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                            <div>
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                transaction.type === 'BUY' 
                                  ? 'bg-profit text-white' 
                                  : 'bg-loss text-white'
                              }`}>
                                {transaction.type}
                              </span>
                              <div className="text-xs text-btc-text-muted mt-1">
                                {new Date(transaction.transaction_date).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono text-sm font-medium text-btc-text-primary">
                                {transaction.btc_amount.toFixed(6)} ₿
                              </div>
                              <div className="text-xs text-btc-text-muted">
                                @ {formatCurrency(transaction.original_price_per_btc, transaction.original_currency)}
                              </div>
                            </div>
                          </div>
                          
                          {/* Values Row */}
                          <div className="flex justify-between items-center pt-2 border-t border-btc-border-secondary">
                            <div>
                              <div className="text-xs text-btc-text-muted">Total</div>
                              <div className="text-sm font-medium text-btc-text-primary">
                                {formatCurrency(transaction.main_currency_total_amount || transaction.original_total_amount, transaction.main_currency || transaction.original_currency)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-btc-text-muted">P&L</div>
                              <div className={`text-sm font-bold ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                                {pnl >= 0 ? '+' : ''}{formatCurrency(pnl, transaction.main_currency || 'USD')}
                              </div>
                              <div className={`text-xs ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                                {formatPercentage(pnlPercent)}
                              </div>
                            </div>
                          </div>
                          
                          {/* Actions Row */}
                          <div className="flex justify-end space-x-2 pt-2">
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
                          
                          {/* Notes */}
                          {transaction.notes && (
                            <div className="text-xs text-btc-text-muted pt-2 border-t border-btc-border-secondary">
                              Note: {transaction.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </ThemedCard>

        {/* Add/Edit Transaction Modal */}
        <AddTransactionModal
          isOpen={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            setEditingTransaction(null);
          }}
          onSuccess={() => {
            setShowAddModal(false);
            setEditingTransaction(null);
            loadTransactions();
          }}
          editingTransaction={editingTransaction}
        />

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
                    <div className="space-y-3 text-center">
                      <DocumentIcon className="h-12 w-12 text-btc-500 mx-auto" />
                      <div className="text-btc-text-primary font-medium">
                        {importFile.name}
                      </div>
                      <div className="text-btc-text-secondary text-sm">
                        {(importFile.size / 1024).toFixed(2)} KB
                      </div>
                      {/* Format Detection */}
                      {formatDetecting && (
                        <div className="text-btc-text-secondary text-sm flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-btc-500 mr-2"></div>
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
                    <div className="space-y-3 text-center">
                      <InboxIcon className="h-12 w-12 text-btc-text-muted mx-auto" />
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