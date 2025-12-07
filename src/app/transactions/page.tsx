'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import AddTransactionModal from '@/components/AddTransactionModal';
import { formatCurrency, formatPercentage } from '@/lib/theme';
import { cn } from '@/lib/utils';

// shadcn/ui components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Icons
import {
  PlusIcon,
  UploadIcon,
  DownloadIcon,
  SearchIcon,
  XIcon,
  TrashIcon,
  PencilIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  FileIcon,
  InboxIcon,
  CheckIcon,
  MoreVerticalIcon,
  FilterIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  WalletIcon,
  CoinsIcon,
  BarChart3Icon,
  CalendarIcon,
  ListChecksIcon,
} from 'lucide-react';

interface BitcoinTransaction {
  id: number;
  type: 'BUY' | 'SELL' | 'TRANSFER';
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
  tags?: string;
  created_at: string;
  updated_at: string;
  transfer_type?: string;
  destination_address?: string;
  secondary_currency?: string;
  secondary_currency_price_per_btc?: number;
  secondary_currency_total_amount?: number;
  secondary_currency_current_value?: number;
  secondary_currency_pnl?: number;
  current_value_main?: number;
  pnl_main?: number;
}

type DuplicateCheckMode = 'strict' | 'standard' | 'loose' | 'off';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<BitcoinTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<BitcoinTransaction | null>(null);
  const [filterType, setFilterType] = useState<'ALL' | 'BUY' | 'SELL' | 'TRANSFER'>('ALL');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'pnl' | 'price' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentBtcPrice, setCurrentBtcPrice] = useState(105000);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);
  const [formatDetecting, setFormatDetecting] = useState(false);
  const [duplicateCheckMode, setDuplicateCheckMode] = useState<DuplicateCheckMode>('standard');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [summaryStats, setSummaryStats] = useState({
    totalBtcBought: 0,
    totalBtcSold: 0,
    buyTransactionCount: 0,
    sellTransactionCount: 0,
    totalInvested: 0,
    totalPnL: 0,
    mainCurrency: 'USD'
  });
  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d' | '3m' | '1y' | 'custom'>('all');
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [customDateTo, setCustomDateTo] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set());
  const [bulkActionMode, setBulkActionMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadTransactions();
    loadCurrentBitcoinPrice();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadTransactions(currentPage, itemsPerPage);
    }
  }, [currentPage, itemsPerPage]);

  useEffect(() => {
    if (currentPage === 1) {
      loadTransactions(1, itemsPerPage);
    } else {
      setCurrentPage(1);
    }
  }, [filterType, dateRange, customDateFrom, customDateTo]);
  
  const getDateRangeBoundaries = useCallback(() => {
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
  }, [dateRange, customDateFrom, customDateTo]);

  const getAllTags = (): string[] => {
    const tagSet = new Set<string>();
    transactions.forEach(t => {
      if (t.tags) {
        t.tags.split(',').forEach(tag => tagSet.add(tag.trim()));
      }
    });
    return Array.from(tagSet).sort();
  };

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

  const toggleTransactionSelection = (id: number) => {
    const newSelection = new Set(selectedTransactions);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedTransactions(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedTransactions.size === filteredAndSortedTransactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(filteredAndSortedTransactions.map(t => t.id)));
    }
  };

  const loadSummaryStats = async () => {
    try {
      // Use portfolio-metrics API for consistent P&L calculation with sidebar
      const response = await fetch('/api/portfolio-metrics');
      const result = await response.json();
      
      if (result.success && result.data) {
        const metrics = result.data;
        
        setSummaryStats({
          totalBtcBought: metrics.totalBtc + (metrics.totalBtcSold || 0), // Approximate from holdings
          totalBtcSold: 0, // Will be calculated from transactions if needed
          buyTransactionCount: metrics.totalBuys || 0,
          sellTransactionCount: metrics.totalSells || 0,
          totalInvested: metrics.totalInvested || 0,
          totalPnL: metrics.unrealizedPnL || 0,
          mainCurrency: metrics.mainCurrency || 'USD'
        });
      }
    } catch (error) {
      console.error('Error loading summary stats:', error);
    }
  };

  const loadTransactions = async (page: number = currentPage, limit: number = itemsPerPage) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (filterType !== 'ALL') params.append('type', filterType);
      const dateRangeBoundaries = getDateRangeBoundaries();
      if (dateRangeBoundaries) {
        params.append('date_from', dateRangeBoundaries.from.toISOString());
        params.append('date_to', dateRangeBoundaries.to.toISOString());
      }

      const response = await fetch(`/api/transactions?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setTransactions(Array.isArray(result.data) ? result.data : []);
        if (result.pagination) {
          setTotalItems(result.pagination.total);
          setTotalPages(result.pagination.totalPages);
          setCurrentPage(result.pagination.page);
        }
      } else {
        setTransactions([]);
      }
      
      await loadSummaryStats();
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

  const handleEditTransaction = (transaction: BitcoinTransaction) => {
    setEditingTransaction(transaction);
    setShowAddModal(true);
  };

  const handleDeleteTransaction = async (id: number) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      try {
        const response = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (result.success) {
          loadTransactions();
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
    if (transaction.type === 'TRANSFER') return 0;
    if (transaction.pnl_main !== undefined) return transaction.pnl_main;
    
    const currentValue = transaction.btc_amount * currentBtcPrice;
    const mainCurrencyTotal = transaction.main_currency_total_amount || transaction.usd_total_amount;
    const costBasis = mainCurrencyTotal + (transaction.fees || 0);
    
    if (transaction.type === 'BUY') {
      return currentValue - costBasis;
    } else {
      return mainCurrencyTotal - costBasis;
    }
  };

  const calculatePnLPercent = (transaction: BitcoinTransaction) => {
    if (transaction.type === 'TRANSFER') return 0;
    const pnl = calculatePnL(transaction);
    const mainCurrencyTotal = transaction.main_currency_total_amount || transaction.usd_total_amount;
    const costBasis = mainCurrencyTotal + (transaction.fees || 0);
    return costBasis > 0 ? (pnl / costBasis) * 100 : 0;
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/transactions/export');
      const blob = await response.blob();
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
      formData.append('detect_only', 'true');
      const response = await fetch('/api/transactions/import', { method: 'POST', body: formData });
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
      formData.append('duplicate_check_mode', duplicateCheckMode);

      const response = await fetch('/api/transactions/import', { method: 'POST', body: formData });
      const result = await response.json();
      
      if (result.success) {
        const message = duplicateCheckMode === 'off' 
          ? `Successfully imported ${result.imported} transactions.`
          : `Successfully imported ${result.imported} transactions. ${result.skipped} duplicates skipped.`;
        alert(message);
        setShowImportModal(false);
        setImportFile(null);
        setDetectedFormat(null);
        setDuplicateCheckMode('standard');
        loadTransactions();
      } else {
        alert(`Import failed: ${result.error || result.message}`);
      }
    } catch (error) {
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

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const filteredAndSortedTransactions = transactions
    .filter(t => {
      if (selectedTags.length > 0) {
        const txTags = t.tags ? t.tags.split(',').map(tag => tag.trim()) : [];
        if (!selectedTags.some(selectedTag => txTags.includes(selectedTag))) return false;
      }
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
      let aValue: number | string, bValue: number | string;
      
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
        case 'price':
          aValue = a.main_currency_price_per_btc || a.original_price_per_btc;
          bValue = b.main_currency_price_per_btc || b.original_price_per_btc;
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        default:
          return 0;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      return sortOrder === 'asc' ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number);
    });

  const netPosition = summaryStats.totalBtcBought - summaryStats.totalBtcSold;
  const avgBuyPrice = summaryStats.totalBtcBought > 0 ? summaryStats.totalInvested / summaryStats.totalBtcBought : 0;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-3">
            <div className="size-8 border-2 border-btc-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">Loading transactions...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {totalItems.toLocaleString()} total transactions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)}>
              <UploadIcon className="size-4 mr-2" />
              Import
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={transactions.length === 0}>
              <DownloadIcon className="size-4 mr-2" />
              Export
            </Button>
            <Button size="sm" onClick={() => { setEditingTransaction(null); setShowAddModal(true); }}>
              <PlusIcon className="size-4 mr-2" />
              New Transaction
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Holdings Card */}
          <Card className="col-span-2 bg-gradient-to-br from-btc-500/10 to-btc-600/5 border-btc-500/20">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Net Holdings</p>
                  <p className="text-3xl font-bold text-btc-500 mt-1">{netPosition.toFixed(8)} BTC</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    ≈ {formatCurrency(netPosition * currentBtcPrice, summaryStats.mainCurrency)}
                  </p>
                </div>
                <div className="p-3 bg-btc-500/10 rounded-xl">
                  <WalletIcon className="size-6 text-btc-500" />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-btc-500/10 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Bought</p>
                  <p className="text-sm font-semibold text-profit">{summaryStats.totalBtcBought.toFixed(6)} BTC</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sold</p>
                  <p className="text-sm font-semibold text-loss">{summaryStats.totalBtcSold.toFixed(6)} BTC</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Investment Card */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Invested</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(summaryStats.totalInvested, summaryStats.mainCurrency)}</p>
                </div>
                <div className="p-2.5 bg-muted rounded-lg">
                  <CoinsIcon className="size-5 text-muted-foreground" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-xs text-muted-foreground">Avg. Buy Price</p>
                <p className="text-sm font-medium">{avgBuyPrice > 0 ? formatCurrency(avgBuyPrice, summaryStats.mainCurrency) : '—'}</p>
              </div>
            </CardContent>
          </Card>

          {/* P&L Card */}
          <Card className={summaryStats.totalPnL >= 0 ? 'bg-profit/5 border-profit/20' : 'bg-loss/5 border-loss/20'}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Unrealized P&L</p>
                  <p className={cn("text-2xl font-bold mt-1", summaryStats.totalPnL >= 0 ? 'text-profit' : 'text-loss')}>
                    {summaryStats.totalPnL >= 0 ? '+' : ''}{formatCurrency(summaryStats.totalPnL, summaryStats.mainCurrency)}
                  </p>
                </div>
                <div className={cn("p-2.5 rounded-lg", summaryStats.totalPnL >= 0 ? 'bg-profit/10' : 'bg-loss/10')}>
                  {summaryStats.totalPnL >= 0 
                    ? <TrendingUpIcon className="size-5 text-profit" />
                    : <TrendingDownIcon className="size-5 text-loss" />
                  }
                </div>
              </div>
              <div className="mt-3">
                <p className="text-xs text-muted-foreground">Return</p>
                <p className={cn("text-sm font-medium", summaryStats.totalPnL >= 0 ? 'text-profit' : 'text-loss')}>
                  {summaryStats.totalInvested > 0 
                    ? formatPercentage((summaryStats.totalPnL / summaryStats.totalInvested) * 100)
                    : '—'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Search */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search by amount, notes, date..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-muted/50"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 size-7"
                    onClick={() => setSearchQuery('')}
                  >
                    <XIcon className="size-3" />
                  </Button>
                )}
              </div>

              {/* Quick Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center rounded-lg border bg-muted/30 p-1">
                  {(['ALL', 'BUY', 'SELL', 'TRANSFER'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFilterType(type)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                        filterType === type 
                          ? "bg-background shadow-sm text-foreground" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {type === 'ALL' ? 'All' : type.charAt(0) + type.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>

                <Select value={dateRange} onValueChange={(v) => setDateRange(v as typeof dateRange)}>
                  <SelectTrigger className="w-[130px] bg-muted/30">
                    <CalendarIcon className="size-4 mr-2 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                    <SelectItem value="3m">Last 3 Months</SelectItem>
                    <SelectItem value="1y">Last Year</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(showFilters && "bg-muted")}
                >
                  <FilterIcon className="size-4 mr-2" />
                  Filters
                  {(selectedTags.length > 0 || dateRange === 'custom') && (
                    <Badge variant="secondary" className="ml-2 size-5 p-0 justify-center">
                      {selectedTags.length + (dateRange === 'custom' ? 1 : 0)}
                    </Badge>
                  )}
                </Button>

                <Button
                  variant={bulkActionMode ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setBulkActionMode(!bulkActionMode);
                    setSelectedTransactions(new Set());
                  }}
                >
                  <ListChecksIcon className="size-4 mr-2" />
                  {bulkActionMode ? 'Done' : 'Select'}
                </Button>
              </div>
            </div>

            {/* Extended Filters */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t space-y-4">
                {/* Custom Date Range */}
                {dateRange === 'custom' && (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground">From</Label>
                      <Input
                        type="date"
                        value={customDateFrom}
                        onChange={(e) => setCustomDateFrom(e.target.value)}
                        className="w-40"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground">To</Label>
                      <Input
                        type="date"
                        value={customDateTo}
                        onChange={(e) => setCustomDateTo(e.target.value)}
                        className="w-40"
                      />
                    </div>
                  </div>
                )}

                {/* Tags */}
                {getAllTags().length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">Tags:</span>
                    {getAllTags().map(tag => (
                      <Badge
                        key={tag}
                        variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => {
                          if (selectedTags.includes(tag)) {
                            setSelectedTags(selectedTags.filter(t => t !== tag));
                          } else {
                            setSelectedTags([...selectedTags, tag]);
                          }
                        }}
                      >
                        {tag}
                        {selectedTags.includes(tag) && <CheckIcon className="size-3 ml-1" />}
                      </Badge>
                    ))}
                    {selectedTags.length > 0 && (
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setSelectedTags([])}>
                        Clear all
                      </Button>
                    )}
                  </div>
                )}

                {/* Sort */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-muted-foreground">Sort by</Label>
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="type">Type</SelectItem>
                        <SelectItem value="amount">Amount</SelectItem>
                        <SelectItem value="price">Price</SelectItem>
                        <SelectItem value="pnl">P&L</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  >
                    {sortOrder === 'asc' ? <ArrowUpIcon className="size-4 mr-1" /> : <ArrowDownIcon className="size-4 mr-1" />}
                    {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bulk Actions Bar */}
        {bulkActionMode && selectedTransactions.size > 0 && (
          <div className="flex items-center justify-between bg-muted/50 border rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
                {selectedTransactions.size === filteredAndSortedTransactions.length ? 'Deselect all' : 'Select all'}
              </Button>
              <span className="text-sm text-muted-foreground">
                {selectedTransactions.size} of {filteredAndSortedTransactions.length} selected
              </span>
            </div>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <TrashIcon className="size-4 mr-2" />
              Delete selected
            </Button>
          </div>
        )}

        {/* Transactions List */}
        <Card>
          <CardContent className="p-0">
            {/* Table Header */}
            <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3 bg-muted/30 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {bulkActionMode && <div className="col-span-1" />}
              <div className={cn("cursor-pointer hover:text-foreground transition-colors flex items-center gap-1", bulkActionMode ? "col-span-2" : "col-span-2")} onClick={() => handleSort('date')}>
                Date {sortBy === 'date' && (sortOrder === 'asc' ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />)}
              </div>
              <div className="col-span-1 cursor-pointer hover:text-foreground transition-colors flex items-center gap-1" onClick={() => handleSort('type')}>
                Type {sortBy === 'type' && (sortOrder === 'asc' ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />)}
              </div>
              <div className={cn("cursor-pointer hover:text-foreground transition-colors flex items-center gap-1", bulkActionMode ? "col-span-2" : "col-span-2")} onClick={() => handleSort('amount')}>
                Amount {sortBy === 'amount' && (sortOrder === 'asc' ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />)}
              </div>
              <div className="col-span-2 cursor-pointer hover:text-foreground transition-colors flex items-center gap-1" onClick={() => handleSort('price')}>
                Price {sortBy === 'price' && (sortOrder === 'asc' ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />)}
              </div>
              <div className="col-span-2">Value</div>
              <div className="col-span-2 cursor-pointer hover:text-foreground transition-colors flex items-center gap-1" onClick={() => handleSort('pnl')}>
                P&L {sortBy === 'pnl' && (sortOrder === 'asc' ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />)}
              </div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            {/* Empty State */}
            {filteredAndSortedTransactions.length === 0 ? (
              <div className="py-16 text-center">
                <div className="inline-flex items-center justify-center size-16 rounded-full bg-muted mb-4">
                  <BarChart3Icon className="size-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1">No transactions found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {filterType !== 'ALL' || searchQuery 
                    ? 'Try adjusting your filters or search query'
                    : 'Get started by adding your first Bitcoin transaction'
                  }
                </p>
                {filterType === 'ALL' && !searchQuery && (
                  <Button onClick={() => { setEditingTransaction(null); setShowAddModal(true); }}>
                    <PlusIcon className="size-4 mr-2" />
                    Add Transaction
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {filteredAndSortedTransactions.map((transaction) => {
                  const pnl = calculatePnL(transaction);
                  const pnlPercent = calculatePnLPercent(transaction);
                  const isSelected = selectedTransactions.has(transaction.id);
                  const currentValue = transaction.current_value_main || (transaction.btc_amount * currentBtcPrice);

                  return (
                    <div 
                      key={transaction.id} 
                      className={cn(
                        "group px-6 py-4 transition-colors hover:bg-muted/30",
                        isSelected && "bg-primary/5"
                      )}
                    >
                      {/* Desktop View */}
                      <div className="hidden lg:grid grid-cols-12 gap-4 items-center">
                        {bulkActionMode && (
                          <div className="col-span-1">
                            <button
                              onClick={() => toggleTransactionSelection(transaction.id)}
                              className={cn(
                                "size-5 rounded border-2 flex items-center justify-center transition-colors",
                                isSelected 
                                  ? "bg-primary border-primary text-primary-foreground" 
                                  : "border-muted-foreground/30 hover:border-primary"
                              )}
                            >
                              {isSelected && <CheckIcon className="size-3" />}
                            </button>
                          </div>
                        )}
                        <div className={cn(bulkActionMode ? "col-span-2" : "col-span-2")}>
                          <p className="font-medium">{new Date(transaction.transaction_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                          <p className="text-xs text-muted-foreground">{new Date(transaction.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <div className="col-span-1">
                          <Badge 
                            variant="outline"
                            className={cn(
                              "font-semibold",
                              transaction.type === 'BUY' && "border-profit/50 text-profit bg-profit/10",
                              transaction.type === 'SELL' && "border-loss/50 text-loss bg-loss/10",
                              transaction.type === 'TRANSFER' && transaction.transfer_type === 'TRANSFER_IN' && "border-green-500/50 text-green-500 bg-green-500/10",
                              transaction.type === 'TRANSFER' && transaction.transfer_type === 'TRANSFER_OUT' && "border-red-500/50 text-red-500 bg-red-500/10",
                              transaction.type === 'TRANSFER' && transaction.transfer_type !== 'TRANSFER_IN' && transaction.transfer_type !== 'TRANSFER_OUT' && "border-blue-500/50 text-blue-500 bg-blue-500/10"
                            )}
                          >
                            {transaction.type === 'TRANSFER' 
                              ? transaction.transfer_type === 'TRANSFER_IN' 
                                ? 'TRANSFER IN' 
                                : transaction.transfer_type === 'TRANSFER_OUT' 
                                  ? 'TRANSFER OUT' 
                                  : 'TRANSFER'
                              : transaction.type}
                          </Badge>
                        </div>
                        <div className={cn(bulkActionMode ? "col-span-2" : "col-span-2")}>
                          <p className="font-mono font-medium">{transaction.btc_amount.toFixed(8)}</p>
                          <p className="text-xs text-muted-foreground font-mono">{(transaction.btc_amount * 100000000).toLocaleString()} sats</p>
                        </div>
                        <div className="col-span-2">
                          {transaction.type === 'TRANSFER' && (transaction.transfer_type === 'TRANSFER_IN' || transaction.transfer_type === 'TRANSFER_OUT') ? (
                            // External transfers show reference price
                            transaction.original_price_per_btc > 0 ? (
                              <>
                                <p className="font-medium text-muted-foreground">{formatCurrency(transaction.original_price_per_btc, transaction.original_currency)}</p>
                                <p className="text-xs text-muted-foreground/70">ref. price</p>
                              </>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )
                          ) : transaction.type === 'TRANSFER' ? (
                            // Internal transfers have no price
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            // BUY/SELL show actual price
                            <>
                              <p className="font-medium">{formatCurrency(transaction.original_price_per_btc, transaction.original_currency)}</p>
                              {transaction.original_currency !== transaction.main_currency && (
                                <p className="text-xs text-muted-foreground">{formatCurrency(transaction.main_currency_price_per_btc, transaction.main_currency)}</p>
                              )}
                            </>
                          )}
                        </div>
                        <div className="col-span-2">
                          {transaction.type === 'TRANSFER' && (transaction.transfer_type === 'TRANSFER_IN' || transaction.transfer_type === 'TRANSFER_OUT') ? (
                            // External transfers: show value at transfer time + current value
                            <>
                              <p className="font-semibold">
                                {transaction.original_price_per_btc > 0 
                                  ? formatCurrency(transaction.btc_amount * transaction.original_price_per_btc, transaction.original_currency)
                                  : formatCurrency(currentValue, transaction.main_currency)
                                }
                              </p>
                              {transaction.original_price_per_btc > 0 && (
                                <p className="text-xs text-muted-foreground">Now: {formatCurrency(currentValue, transaction.main_currency)}</p>
                              )}
                            </>
                          ) : transaction.type === 'TRANSFER' ? (
                            // Internal transfers: no value to show
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            // BUY/SELL: show original transaction value
                            <>
                              <p className="font-semibold">{formatCurrency(transaction.main_currency_total_amount, transaction.main_currency)}</p>
                              {transaction.type === 'BUY' && (
                                <p className="text-xs text-muted-foreground">Now: {formatCurrency(currentValue, transaction.main_currency)}</p>
                              )}
                            </>
                          )}
                        </div>
                        <div className="col-span-2">
                          {transaction.type === 'TRANSFER' ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <div>
                              <p className={cn("font-bold", pnl >= 0 ? 'text-profit' : 'text-loss')}>
                                {pnl >= 0 ? '+' : ''}{formatCurrency(pnl, transaction.main_currency)}
                              </p>
                              <p className={cn("text-xs font-medium", pnl >= 0 ? 'text-profit' : 'text-loss')}>
                                {formatPercentage(pnlPercent)}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="col-span-1 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVerticalIcon className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditTransaction(transaction)}>
                                <PencilIcon className="size-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteTransaction(transaction.id)}>
                                <TrashIcon className="size-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Mobile View */}
                      <div className="lg:hidden space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            {bulkActionMode && (
                              <button
                                onClick={() => toggleTransactionSelection(transaction.id)}
                                className={cn(
                                  "size-5 rounded border-2 flex items-center justify-center transition-colors",
                                  isSelected 
                                    ? "bg-primary border-primary text-primary-foreground" 
                                    : "border-muted-foreground/30 hover:border-primary"
                                )}
                              >
                                {isSelected && <CheckIcon className="size-3" />}
                              </button>
                            )}
                            <div>
                              <Badge 
                                variant="outline"
                                className={cn(
                                  "font-semibold mb-1",
                                  transaction.type === 'BUY' && "border-profit/50 text-profit bg-profit/10",
                                  transaction.type === 'SELL' && "border-loss/50 text-loss bg-loss/10",
                                  transaction.type === 'TRANSFER' && transaction.transfer_type === 'TRANSFER_IN' && "border-green-500/50 text-green-500 bg-green-500/10",
                                  transaction.type === 'TRANSFER' && transaction.transfer_type === 'TRANSFER_OUT' && "border-red-500/50 text-red-500 bg-red-500/10",
                                  transaction.type === 'TRANSFER' && transaction.transfer_type !== 'TRANSFER_IN' && transaction.transfer_type !== 'TRANSFER_OUT' && "border-blue-500/50 text-blue-500 bg-blue-500/10"
                                )}
                              >
                                {transaction.type === 'TRANSFER' 
                                  ? transaction.transfer_type === 'TRANSFER_IN' 
                                    ? 'TRANSFER IN' 
                                    : transaction.transfer_type === 'TRANSFER_OUT' 
                                      ? 'TRANSFER OUT' 
                                      : 'TRANSFER'
                                  : transaction.type}
                              </Badge>
                              <p className="text-sm text-muted-foreground">{new Date(transaction.transaction_date).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-semibold">{transaction.btc_amount.toFixed(6)} BTC</p>
                            <p className="text-sm text-muted-foreground">{formatCurrency(transaction.main_currency_total_amount, transaction.main_currency)}</p>
                          </div>
                        </div>
                        {(transaction.type === 'BUY' || transaction.type === 'SELL') && (
                          <div className="flex items-center justify-between pt-2 border-t">
                            <p className="text-sm text-muted-foreground">P&L</p>
                            <div className="text-right">
                              <p className={cn("font-bold", pnl >= 0 ? 'text-profit' : 'text-loss')}>
                                {pnl >= 0 ? '+' : ''}{formatCurrency(pnl, transaction.main_currency)}
                              </p>
                              <p className={cn("text-xs", pnl >= 0 ? 'text-profit' : 'text-loss')}>
                                {formatPercentage(pnlPercent)}
                              </p>
                            </div>
                          </div>
                        )}
                        <div className="flex justify-end gap-2 pt-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEditTransaction(transaction)}>
                            <PencilIcon className="size-4 mr-1" />
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteTransaction(transaction.id)}>
                            <TrashIcon className="size-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/20">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Rows per page</span>
                  <Select value={itemsPerPage.toString()} onValueChange={(v) => { setItemsPerPage(parseInt(v)); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[70px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground mr-2">
                    {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
                  </span>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                    <ChevronsLeftIcon className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                    <ChevronLeftIcon className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                    <ChevronRightIcon className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
                    <ChevronsRightIcon className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Transaction Modal */}
        <AddTransactionModal
          isOpen={showAddModal}
          onClose={() => { setShowAddModal(false); setEditingTransaction(null); }}
          onSuccess={() => { setShowAddModal(false); setEditingTransaction(null); loadTransactions(); }}
          editingTransaction={editingTransaction}
        />

        {/* Import Modal */}
        <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Import Transactions</DialogTitle>
              <DialogDescription>
                Upload a CSV or JSON file with your Bitcoin transactions
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Drag and Drop Area */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 text-center transition-all",
                  dragActive ? 'border-btc-500 bg-btc-500/5' : 'border-muted hover:border-muted-foreground/50'
                )}
              >
                {importFile ? (
                  <div className="space-y-3">
                    <div className="inline-flex items-center justify-center size-12 rounded-full bg-btc-500/10">
                      <FileIcon className="size-6 text-btc-500" />
                    </div>
                    <div>
                      <p className="font-medium">{importFile.name}</p>
                      <p className="text-sm text-muted-foreground">{(importFile.size / 1024).toFixed(2)} KB</p>
                    </div>
                    {formatDetecting && (
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <div className="size-4 border-2 border-btc-500 border-t-transparent rounded-full animate-spin" />
                        Detecting format...
                      </div>
                    )}
                    {detectedFormat && !formatDetecting && (
                      <Badge className="bg-profit/10 text-profit border-profit/30">
                        <CheckIcon className="size-3 mr-1" />
                        {detectedFormat}
                      </Badge>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => { setImportFile(null); setDetectedFormat(null); }}>
                      Remove file
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="inline-flex items-center justify-center size-12 rounded-full bg-muted">
                      <InboxIcon className="size-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">Drop your file here</p>
                      <p className="text-sm text-muted-foreground">or click to browse</p>
                    </div>
                    <Label className="cursor-pointer">
                      <Input
                        type="file"
                        accept=".csv,.json"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setImportFile(file);
                            if (file.name.endsWith('.csv')) detectFileFormat(file);
                          }
                        }}
                      />
                      <Button variant="outline" size="sm" asChild>
                        <span>Choose file</span>
                      </Button>
                    </Label>
                  </div>
                )}
              </div>

              {/* Duplicate Detection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Duplicate handling</Label>
                <Select value={duplicateCheckMode} onValueChange={(v) => setDuplicateCheckMode(v as DuplicateCheckMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strict">Strict — All fields must match</SelectItem>
                    <SelectItem value="standard">Standard — Core fields must match (recommended)</SelectItem>
                    <SelectItem value="loose">Loose — Only date and amount</SelectItem>
                    <SelectItem value="off">Off — Import all</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Supported Formats */}
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium mb-1">Supported formats</p>
                <p className="text-xs text-muted-foreground">CSV: Standard, Binance, Kraken, Coinbase, Strike • JSON: Our export format</p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowImportModal(false); setImportFile(null); }} disabled={importLoading}>
                Cancel
              </Button>
              <Button onClick={handleImportSubmit} disabled={!importFile || importLoading}>
                {importLoading ? (
                  <>
                    <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Importing...
                  </>
                ) : (
                  <>
                    <UploadIcon className="size-4 mr-2" />
                    Import
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}


