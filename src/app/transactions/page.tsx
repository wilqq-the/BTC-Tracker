'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import AddTransactionModal from '@/components/AddTransactionModal';
import { formatCurrency } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { confirm } from '@/components/ui/confirm-dialog';
import { emitTransactionsChanged, onTransactionsChanged } from '@/lib/app-events';

// shadcn/ui components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { WalletTypeIcon } from '@/components/ui/wallet-type-icon';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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
  MoreHorizontalIcon,
  FilterIcon,
  CalendarIcon,
  ListChecksIcon,
  ColumnsIcon,
} from 'lucide-react';

interface WalletRef {
  id: number;
  name: string;
  emoji: string | null;
  type: string;
}

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
  from_wallet?: WalletRef | null;
  to_wallet?: WalletRef | null;
  secondary_currency?: string;
  secondary_currency_price_per_btc?: number;
  secondary_currency_total_amount?: number;
  secondary_currency_current_value?: number;
  secondary_currency_pnl?: number;
  current_value_main?: number;
  pnl_main?: number;
}

type DuplicateCheckMode = 'strict' | 'standard' | 'loose' | 'off' | 'dca';
type TypeFilter = 'ALL' | 'BUY' | 'SELL' | 'TRANSFER';
type DateRange = 'all' | '7d' | '30d' | '3m' | '1y' | 'custom';
type SortKey = 'date' | 'amount' | 'pnl' | 'price' | 'type';

// Column configuration
type ColumnId = 'date' | 'type' | 'amount' | 'price' | 'value' | 'pnl' | 'wallet' | 'notes';

interface ColumnConfig {
  id: ColumnId;
  label: string;
  defaultVisible: boolean;
  sortKey?: SortKey;
  align: 'left' | 'right';
}

const COLUMNS: ColumnConfig[] = [
  { id: 'date', label: 'Date', defaultVisible: true, sortKey: 'date', align: 'left' },
  { id: 'type', label: 'Type', defaultVisible: true, sortKey: 'type', align: 'left' },
  { id: 'amount', label: 'Amount', defaultVisible: true, sortKey: 'amount', align: 'right' },
  { id: 'price', label: 'Price', defaultVisible: true, sortKey: 'price', align: 'right' },
  { id: 'value', label: 'Value', defaultVisible: true, align: 'right' },
  { id: 'pnl', label: 'P&L', defaultVisible: true, sortKey: 'pnl', align: 'right' },
  { id: 'wallet', label: 'Wallet', defaultVisible: false, align: 'left' },
  { id: 'notes', label: 'Notes', defaultVisible: false, align: 'left' },
];

const TYPE_OPTIONS: { label: string; value: TypeFilter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Buy', value: 'BUY' },
  { label: 'Sell', value: 'SELL' },
  { label: 'Transfer', value: 'TRANSFER' },
];

const STORAGE_KEY = 'btc-tracker-tx-columns';

const getDefaultVisibility = (): Record<ColumnId, boolean> => {
  return COLUMNS.reduce((acc, col) => {
    acc[col.id] = col.defaultVisible;
    return acc;
  }, {} as Record<ColumnId, boolean>);
};

// Anything below half a cent reads as zero: muted, no sign
const isZero = (n: number) => Math.abs(n) < 0.005;
const tone = (n: number) =>
  isZero(n) ? 'text-muted-foreground' : n > 0 ? 'text-tint-green-fg' : 'text-tint-red-fg';
const sign = (n: number) => (isZero(n) ? '' : n > 0 ? '+' : '-');
const signedMoney = (n: number, currency: string) => `${sign(n)}${formatCurrency(Math.abs(n), currency)}`;
const signedPercent = (n: number) => `${sign(n)}${Math.abs(n).toFixed(2)}%`;
const btc = (n: number) => parseFloat(n.toFixed(8)).toLocaleString('en-US', { maximumFractionDigits: 8 });
const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const isExternalTransfer = (t: BitcoinTransaction) =>
  t.type === 'TRANSFER' && (t.transfer_type === 'TRANSFER_IN' || t.transfer_type === 'TRANSFER_OUT');

function typeChip(t: BitcoinTransaction) {
  if (t.type === 'BUY') return { label: 'Buy', tone: 'bg-tint-green text-tint-green-fg' };
  if (t.type === 'SELL') return { label: 'Sell', tone: 'bg-tint-red text-tint-red-fg' };
  const label = t.transfer_type === 'TRANSFER_IN' ? 'Transfer in' : t.transfer_type === 'TRANSFER_OUT' ? 'Transfer out' : 'Transfer';
  return { label, tone: 'bg-tint-blue text-tint-blue-fg' };
}

function TypeChip({ transaction }: { transaction: BitcoinTransaction }) {
  const chip = typeChip(transaction);
  return (
    <span className={cn('inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-bold', chip.tone)}>
      {chip.label}
    </span>
  );
}

function WalletLine({ prefix, wallet }: { prefix: string; wallet: WalletRef }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5" title={wallet.name}>
      <span className="text-muted-foreground">{prefix}</span>
      <WalletTypeIcon type={wallet.type} className="size-3.5" />
      <span className="truncate font-medium">{wallet.name}</span>
    </span>
  );
}

const Muted = ({ children = '—' }: { children?: React.ReactNode }) => (
  <span className="text-muted-foreground">{children}</span>
);

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<BitcoinTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<BitcoinTransaction | null>(null);
  const [filterType, setFilterType] = useState<TypeFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentBtcPrice, setCurrentBtcPrice] = useState(0);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importWalletId, setImportWalletId] = useState<string>('');
  const [importWallets, setImportWallets] = useState<{ id: number; name: string; type: string; emoji?: string | null }[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);
  const [formatDetecting, setFormatDetecting] = useState(false);
  const [duplicateCheckMode, setDuplicateCheckMode] = useState<DuplicateCheckMode>('standard');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  // Display (secondary) currency and the main -> display rate, from portfolio-metrics
  const [displayCurrency, setDisplayCurrency] = useState('USD');
  const [mainToDisplayRate, setMainToDisplayRate] = useState(1);
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [customDateTo, setCustomDateTo] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set());
  const [bulkActionMode, setBulkActionMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnId, boolean>>(getDefaultVisibility);

  // Dashboard "Import CSV" quick action links here with ?import=1
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('import') === '1') {
      handleOpenImportModal();
      window.history.replaceState(null, '', '/transactions');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load column visibility from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setColumnVisibility(prev => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.error('Failed to load column preferences:', e);
    }
  }, []);

  // Save column visibility to localStorage
  const updateColumnVisibility = (columnId: ColumnId, visible: boolean) => {
    const newVisibility = { ...columnVisibility, [columnId]: visible };
    setColumnVisibility(newVisibility);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newVisibility));
    } catch (e) {
      console.error('Failed to save column preferences:', e);
    }
  };

  const visibleColumns = COLUMNS.filter(col => columnVisibility[col.id]);

  useEffect(() => {
    loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading) {
      loadTransactions(currentPage, itemsPerPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, itemsPerPage]);

  useEffect(() => {
    if (currentPage === 1) {
      loadTransactions(1, itemsPerPage);
    } else {
      setCurrentPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, dateRange, customDateFrom, customDateTo]);

  // Reload when sort changes - reset to page 1
  useEffect(() => {
    if (!loading) {
      if (currentPage === 1) {
        loadTransactions(1, itemsPerPage);
      } else {
        setCurrentPage(1); // Will trigger loadTransactions via the currentPage useEffect
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortOrder]);

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

    const confirmed = await confirm({
      title: 'Delete transactions?',
      description: `Delete ${plural(selectedTransactions.size, 'transaction')}? This cannot be undone.`,
      confirmText: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await Promise.all(
        Array.from(selectedTransactions).map(id =>
          fetch(`/api/transactions/${id}`, { method: 'DELETE' })
        )
      );

      setSelectedTransactions(new Set());
      setBulkActionMode(false);
      emitTransactionsChanged();
    } catch (error) {
      console.error('Error bulk deleting:', error);
      toast({ title: 'Failed to delete transactions', variant: 'destructive' });
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

  const loadDisplayCurrency = async () => {
    try {
      const response = await fetch('/api/portfolio-metrics');
      const result = await response.json();
      if (result.success && result.data) {
        const metrics = result.data;
        const mainCurrency = metrics.mainCurrency || 'USD';
        setDisplayCurrency(metrics.secondaryCurrency || mainCurrency);
        setMainToDisplayRate(metrics.secondaryCurrency ? metrics.mainToSecondaryRate || 1 : 1);
        if (metrics.currentBtcPrice) setCurrentBtcPrice(metrics.currentBtcPrice);
      }
    } catch (error) {
      console.error('Error loading display currency:', error);
    }
  };

  const loadTransactions = async (page: number = currentPage, limit: number = itemsPerPage) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy: sortBy,
        sortOrder: sortOrder,
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

      await loadDisplayCurrency();
    } catch (error) {
      console.error('Error loading transactions:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  };

  // Refetch whenever transactions change anywhere (header "Add transaction", edits, imports)
  const loadRef = useRef(loadTransactions);
  loadRef.current = loadTransactions;
  useEffect(() => onTransactionsChanged(() => loadRef.current()), []);

  const handleEditTransaction = (transaction: BitcoinTransaction) => {
    setEditingTransaction(transaction);
    setShowAddModal(true);
  };

  const handleDeleteTransaction = async (id: number) => {
    if (await confirm({ title: 'Delete transaction?', description: 'This transaction will be removed for good.', confirmText: 'Delete', destructive: true })) {
      try {
        const response = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (result.success) {
          emitTransactionsChanged();
        } else {
          toast({ title: 'Error', description: result.error || result.message, variant: 'destructive' });
        }
      } catch (error) {
        console.error('Error deleting transaction:', error);
        toast({ title: 'Failed to delete transaction. Please try again.', variant: 'destructive' });
      }
    }
  };

  /**
   * Every money figure in the display currency. The API already converts each
   * transaction from its original currency (original -> secondary); the
   * main-currency fields times the main -> display rate are the fallback.
   */
  const displayValues = (t: BitcoinTransaction) => {
    const rate = mainToDisplayRate;
    const price = t.secondary_currency_price_per_btc ?? (t.main_currency_price_per_btc || 0) * rate;
    const total = t.secondary_currency_total_amount ?? (t.main_currency_total_amount || 0) * rate;
    const value = t.secondary_currency_current_value
      ?? (t.current_value_main ?? t.btc_amount * currentBtcPrice) * rate;
    let pnl = 0;
    if (t.type !== 'TRANSFER') {
      pnl = t.secondary_currency_pnl
        ?? (t.pnl_main ?? (t.type === 'BUY' ? value / rate - (t.main_currency_total_amount || 0) : (t.main_currency_total_amount || 0) - value / rate)) * rate;
    }
    const pnlPercent = total > 0 ? (pnl / total) * 100 : 0;
    return { currency: t.secondary_currency || displayCurrency, price, total, value, pnl, pnlPercent };
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
      toast({ title: 'Failed to export transactions. Please try again.', variant: 'destructive' });
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
          'legacy': 'Legacy format',
          'binance': 'Binance spot export',
          'standard': 'Standard CSV format',
          'kraken': 'Kraken export',
          'coinbase': 'Coinbase export',
          'strike': 'Strike export',
          'river': 'River export',
          '21bitcoin': '21bitcoin export',
          'cashapp': 'Cash App export',
          'revolutx': 'Revolut X export'
        };
        setDetectedFormat(formatMap[result.detected_format] || result.detected_format);
      }
    } catch (error) {
      setDetectedFormat('Unknown format');
    } finally {
      setFormatDetecting(false);
    }
  };

  async function handleOpenImportModal() {
    setShowImportModal(true);
    try {
      const res = await fetch('/api/wallets');
      const data = await res.json();
      if (data.success && data.data) setImportWallets(data.data);
    } catch {
      // wallets optional, ignore error
    }
  }

  const handleImportSubmit = async () => {
    if (!importFile) {
      toast({ title: 'Please select a file to import' });
      return;
    }

    setImportLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('duplicate_check_mode', duplicateCheckMode);
      if (importWalletId) formData.append('wallet_id', importWalletId);

      const response = await fetch('/api/transactions/import', { method: 'POST', body: formData });
      const result = await response.json();

      if (result.success) {
        let message: string;
        if (duplicateCheckMode === 'off') {
          message = `Imported ${plural(result.imported, 'transaction')}.`;
        } else if (duplicateCheckMode === 'dca') {
          const parts = [`Imported ${plural(result.imported, 'transaction')}.`];
          if (result.updated > 0) parts.push(`Updated ${result.updated} Auto-DCA ${result.updated === 1 ? 'entry' : 'entries'}.`);
          if (result.skipped > 0) parts.push(`Skipped ${plural(result.skipped, 'duplicate')}.`);
          message = parts.join(' ');
        } else {
          message = `Imported ${plural(result.imported, 'transaction')}, skipped ${plural(result.skipped, 'duplicate')}.`;
        }
        toast({ title: 'Import complete', description: message, variant: 'success' });
        setShowImportModal(false);
        setImportFile(null);
        setDetectedFormat(null);
        setDuplicateCheckMode('standard');
        setImportWalletId('');
        emitTransactionsChanged();
      } else {
        toast({ title: 'Import failed', description: result.error || result.message, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Failed to import transactions. Please try again.', variant: 'destructive' });
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
        toast({ title: 'Please upload a CSV or JSON file' });
      }
    }
  };

  const handleSort = (column: SortKey) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
    // Reset to page 1 when sorting changes
    setCurrentPage(1);
  };

  // Only filter client-side (tags and search), sorting is done server-side
  const filteredTransactions = transactions.filter(t => {
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
      const matchesWallet = t.from_wallet?.name.toLowerCase().includes(query) || t.to_wallet?.name.toLowerCase().includes(query);
      if (!matchesNotes && !matchesAmount && !matchesCurrency && !matchesDate && !matchesPrice && !matchesTags && !matchesWallet) {
        return false;
      }
    }
    return true;
  });

  const toggleSelectAll = () => {
    if (selectedTransactions.size === filteredTransactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(filteredTransactions.map(t => t.id)));
    }
  };

  const hasActiveFilters = filterType !== 'ALL' || dateRange !== 'all' || searchQuery !== '' || selectedTags.length > 0;
  const clearFilters = () => {
    setFilterType('ALL');
    setDateRange('all');
    setCustomDateFrom('');
    setCustomDateTo('');
    setSearchQuery('');
    setSelectedTags([]);
  };

  // Plain-language summary of what's on screen right now
  const summary = filteredTransactions.reduce(
    (acc, t) => {
      const v = displayValues(t);
      if (t.type === 'BUY') { acc.bought += t.btc_amount; acc.boughtFor += v.total; }
      else if (t.type === 'SELL') { acc.sold += t.btc_amount; acc.soldFor += v.total; }
      else acc.transfers += 1;
      return acc;
    },
    { bought: 0, boughtFor: 0, sold: 0, soldFor: 0, transfers: 0 }
  );
  const isClientFiltered = searchQuery !== '' || selectedTags.length > 0;
  const allSelected = filteredTransactions.length > 0 && selectedTransactions.size === filteredTransactions.length;

  if (!hasLoaded) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading transactions" />
      </div>
    );
  }

  const renderHeader = (column: ColumnConfig) => {
    const active = column.sortKey && sortBy === column.sortKey;
    return (
      <th
        key={column.id}
        scope="col"
        aria-sort={active ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
        className={cn(
          'whitespace-nowrap px-3 py-2.5 text-[13px] font-semibold text-muted-foreground first:pl-5 last:pr-5',
          column.align === 'right' ? 'text-right' : 'text-left'
        )}
      >
        {column.sortKey ? (
          <button
            type="button"
            onClick={() => handleSort(column.sortKey!)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full transition-colors hover:text-foreground',
              column.align === 'right' && 'flex-row-reverse',
              active && 'text-foreground'
            )}
          >
            {column.label}
            {active && (sortOrder === 'asc' ? <ArrowUpIcon className="size-3.5" /> : <ArrowDownIcon className="size-3.5" />)}
          </button>
        ) : (
          column.label
        )}
      </th>
    );
  };

  const renderActions = (transaction: BitcoinTransaction) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${typeChip(transaction).label.toLowerCase()} on ${formatDate(transaction.transaction_date)}`}
          className="size-9 rounded-full text-muted-foreground hover:text-foreground"
        >
          <MoreHorizontalIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleEditTransaction(transaction)}>
          <PencilIcon className="mr-2 size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteTransaction(transaction.id)}>
          <TrashIcon className="mr-2 size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderCell = (column: ColumnId, t: BitcoinTransaction) => {
    const v = displayValues(t);
    switch (column) {
      case 'date':
        return <span className="whitespace-nowrap font-semibold">{formatDate(t.transaction_date)}</span>;
      case 'type':
        return <TypeChip transaction={t} />;
      case 'amount':
        return (
          <>
            <div className="whitespace-nowrap font-bold">{t.btc_amount.toFixed(8)} BTC</div>
            <div className="whitespace-nowrap text-[13px] text-muted-foreground">{Math.round(t.btc_amount * 1e8).toLocaleString()} sats</div>
          </>
        );
      case 'price':
        if (t.type === 'TRANSFER') {
          return isExternalTransfer(t) && t.original_price_per_btc > 0 ? (
            <>
              <div className="whitespace-nowrap text-muted-foreground">{formatCurrency(v.price, v.currency)}</div>
              <div className="text-[13px] text-muted-foreground">Reference price</div>
            </>
          ) : <Muted />;
        }
        return <span className="whitespace-nowrap font-semibold">{formatCurrency(v.price, v.currency)}</span>;
      case 'value':
        if (t.type === 'TRANSFER') {
          return isExternalTransfer(t) ? (
            <>
              <div className="whitespace-nowrap font-semibold">{formatCurrency(v.value, v.currency)}</div>
              <div className="text-[13px] text-muted-foreground">Value today</div>
            </>
          ) : <Muted />;
        }
        return (
          <>
            <div className="whitespace-nowrap font-semibold">{formatCurrency(v.total, v.currency)}</div>
            {t.type === 'BUY' && (
              <div className="whitespace-nowrap text-[13px] text-muted-foreground">Now {formatCurrency(v.value, v.currency)}</div>
            )}
          </>
        );
      case 'pnl':
        if (t.type === 'TRANSFER') return <Muted />;
        return (
          <>
            <div className={cn('whitespace-nowrap font-bold', tone(v.pnl))}>{signedMoney(v.pnl, v.currency)}</div>
            <div className={cn('whitespace-nowrap text-[13px]', tone(v.pnl))}>{signedPercent(v.pnlPercent)}</div>
          </>
        );
      case 'wallet':
        return t.from_wallet || t.to_wallet ? (
          <div className="max-w-[220px] space-y-0.5 text-[13px]">
            {t.from_wallet && <WalletLine prefix="From" wallet={t.from_wallet} />}
            {t.to_wallet && <WalletLine prefix="To" wallet={t.to_wallet} />}
          </div>
        ) : <Muted />;
      case 'notes':
        return t.notes ? (
          <p className="max-w-[240px] truncate text-[13px] text-muted-foreground" title={t.notes}>{t.notes}</p>
        ) : <Muted />;
    }
  };

  return (
    <div className="space-y-4 pb-6">
      <Card className="gap-0 overflow-hidden py-0">
        {/* Toolbar */}
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1 xl:max-w-sm">
              <SearchIcon className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search notes, amounts, dates, wallets"
                aria-label="Search transactions"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 rounded-full border-0 bg-secondary pl-10 pr-10 shadow-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground"
                  onClick={() => setSearchQuery('')}
                >
                  <XIcon className="size-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
              <SegmentedControl<TypeFilter>
                aria-label="Transaction type"
                options={TYPE_OPTIONS}
                value={filterType}
                onChange={setFilterType}
              />

              <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                <SelectTrigger className="h-9 w-[150px] rounded-full bg-card font-semibold" aria-label="Date range">
                  <CalendarIcon className="size-4 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="3m">Last 3 months</SelectItem>
                  <SelectItem value="1y">Last year</SelectItem>
                  <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                aria-expanded={showFilters}
                onClick={() => setShowFilters(!showFilters)}
                className={cn('rounded-full bg-card font-semibold', showFilters && 'bg-secondary')}
              >
                <FilterIcon className="mr-1.5 size-4" />
                Filters
                {selectedTags.length > 0 && (
                  <span className="ml-1.5 inline-flex size-5 items-center justify-center rounded-full bg-tint-orange text-xs font-bold text-primary-strong">
                    {selectedTags.length}
                  </span>
                )}
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-full bg-card font-semibold">
                    <ColumnsIcon className="mr-1.5 size-4" />
                    Columns
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-52 rounded-2xl p-2">
                  <p className="px-2 py-1 text-[13px] font-semibold text-muted-foreground">Show columns</p>
                  {COLUMNS.map((column) => (
                    <label
                      key={column.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 text-sm hover:bg-secondary"
                    >
                      <Checkbox
                        checked={columnVisibility[column.id]}
                        onCheckedChange={(checked) => updateColumnVisibility(column.id, !!checked)}
                      />
                      {column.label}
                    </label>
                  ))}
                </PopoverContent>
              </Popover>

              <Button
                variant="outline"
                size="sm"
                aria-pressed={bulkActionMode}
                className={cn('rounded-full bg-card font-semibold', bulkActionMode && 'bg-secondary')}
                onClick={() => {
                  setBulkActionMode(!bulkActionMode);
                  setSelectedTransactions(new Set());
                }}
              >
                <ListChecksIcon className="mr-1.5 size-4" />
                {bulkActionMode ? 'Done' : 'Select'}
              </Button>
            </div>
          </div>

          {/* Custom date range */}
          {dateRange === 'custom' && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="tx-date-from" className="text-[13px] text-muted-foreground">From</Label>
                <Input id="tx-date-from" type="date" value={customDateFrom} onChange={(e) => setCustomDateFrom(e.target.value)} className="h-9 w-40 rounded-full" />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="tx-date-to" className="text-[13px] text-muted-foreground">To</Label>
                <Input id="tx-date-to" type="date" value={customDateTo} onChange={(e) => setCustomDateTo(e.target.value)} className="h-9 w-40 rounded-full" />
              </div>
            </div>
          )}

          {/* Extended filters */}
          {showFilters && (
            <div className="space-y-3 rounded-2xl bg-secondary p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold text-muted-foreground">Tags</span>
                {getAllTags().length === 0 ? (
                  <span className="text-[13px] text-muted-foreground">No tags on these transactions yet.</span>
                ) : (
                  <>
                    {getAllTags().map(tag => {
                      const on = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          aria-pressed={on}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-semibold transition-colors',
                            on ? 'bg-tint-orange text-primary-strong' : 'bg-card text-muted-foreground hover:text-foreground'
                          )}
                          onClick={() => setSelectedTags(on ? selectedTags.filter(t => t !== tag) : [...selectedTags, tag])}
                        >
                          {tag}
                          {on && <CheckIcon className="size-3.5" />}
                        </button>
                      );
                    })}
                    {selectedTags.length > 0 && (
                      <Button variant="ghost" size="sm" className="h-7 rounded-full px-2.5 text-[13px]" onClick={() => setSelectedTags([])}>
                        Clear tags
                      </Button>
                    )}
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-[13px] font-semibold text-muted-foreground">Sort by</Label>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                  <SelectTrigger className="h-9 w-[130px] rounded-full bg-card">
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
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full bg-card"
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                >
                  {sortOrder === 'asc' ? <ArrowUpIcon className="mr-1 size-4" /> : <ArrowDownIcon className="mr-1 size-4" />}
                  {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                </Button>
              </div>
            </div>
          )}

          {/* Bulk actions */}
          {bulkActionMode && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-secondary px-4 py-2.5">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" className="rounded-full" onClick={toggleSelectAll} disabled={filteredTransactions.length === 0}>
                  {allSelected ? 'Deselect all' : 'Select all'}
                </Button>
                <span className="text-[13px] text-muted-foreground tabular-nums">
                  {selectedTransactions.size} of {filteredTransactions.length} selected
                </span>
              </div>
              <Button variant="destructive" size="sm" className="rounded-full" onClick={handleBulkDelete} disabled={selectedTransactions.size === 0}>
                <TrashIcon className="mr-1.5 size-4" />
                Delete selected
              </Button>
            </div>
          )}

          {/* Summary of the filtered set, with import/export on the right */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1">
          {filteredTransactions.length > 0 ? (
            <p className="min-w-0 flex-1 text-[13px] text-muted-foreground">
              {totalPages > 1 && !isClientFiltered
                ? <>{plural(filteredTransactions.length, 'transaction')} on this page, {totalItems.toLocaleString()} in total.</>
                : <>{plural(filteredTransactions.length, 'transaction')}.</>}
              {' '}Bought{' '}
              <span className={cn('font-semibold', summary.bought > 0 && 'text-foreground')}>{btc(summary.bought)} BTC</span>
              {summary.bought > 0 && <> for <span className="font-semibold text-foreground">{formatCurrency(summary.boughtFor, displayCurrency)}</span></>}
              , sold{' '}
              <span className={cn('font-semibold', summary.sold > 0 && 'text-foreground')}>{btc(summary.sold)} BTC</span>
              {summary.sold > 0 && <> for <span className="font-semibold text-foreground">{formatCurrency(summary.soldFor, displayCurrency)}</span></>}
              .
              {summary.transfers > 0 && <> {plural(summary.transfers, 'transfer')} between wallets or exchanges.</>}
            </p>
          ) : <span />}
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-full bg-card font-semibold" onClick={handleOpenImportModal}>
                <UploadIcon className="mr-1.5 size-4" />
                Import
              </Button>
              <Button variant="outline" size="sm" className="rounded-full bg-card font-semibold" onClick={handleExport} disabled={transactions.length === 0}>
                <DownloadIcon className="mr-1.5 size-4" />
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Empty state */}
        {filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 border-t px-6 py-16 text-center">
            {hasActiveFilters ? (
              <>
                <p className="font-semibold">No transactions match these filters.</p>
                <p className="text-sm text-muted-foreground">Try a wider date range or a different search.</p>
                <Button variant="outline" size="sm" className="mt-2 rounded-full" onClick={clearFilters}>
                  Clear filters
                </Button>
              </>
            ) : (
              <>
                <p className="font-semibold">Your transactions will show here.</p>
                <p className="text-sm text-muted-foreground">Add a buy by hand, or import a CSV export from your exchange.</p>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  <Button size="sm" className="rounded-full font-semibold" onClick={() => { setEditingTransaction(null); setShowAddModal(true); }}>
                    <PlusIcon className="mr-1.5 size-4" />
                    Add transaction
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-full font-semibold" onClick={handleOpenImportModal}>
                    <UploadIcon className="mr-1.5 size-4" />
                    Import CSV
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className={cn('transition-opacity', loading && 'opacity-60')}>
            {/* Table, md and up: scrolls sideways inside the card */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] border-collapse text-sm tabular-nums">
                <thead>
                  <tr className="border-y bg-secondary/50">
                    {bulkActionMode && (
                      <th scope="col" className="w-10 py-2.5 pl-5 pr-1">
                        <Checkbox
                          aria-label={allSelected ? 'Deselect all' : 'Select all'}
                          checked={allSelected ? true : selectedTransactions.size > 0 ? 'indeterminate' : false}
                          onCheckedChange={toggleSelectAll}
                        />
                      </th>
                    )}
                    {visibleColumns.map(renderHeader)}
                    <th scope="col" className="w-14 py-2.5 pr-5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredTransactions.map((transaction) => {
                    const isSelected = selectedTransactions.has(transaction.id);
                    return (
                      <tr
                        key={transaction.id}
                        className={cn('transition-colors hover:bg-secondary/50', isSelected && 'bg-tint-orange/50 hover:bg-tint-orange/60')}
                      >
                        {bulkActionMode && (
                          <td className="py-3 pl-5 pr-1">
                            <Checkbox
                              aria-label={`Select transaction from ${formatDate(transaction.transaction_date)}`}
                              checked={isSelected}
                              onCheckedChange={() => toggleTransactionSelection(transaction.id)}
                            />
                          </td>
                        )}
                        {visibleColumns.map(column => (
                          <td
                            key={column.id}
                            className={cn(
                              'px-3 py-3 align-middle first:pl-5',
                              column.align === 'right' ? 'text-right' : 'text-left'
                            )}
                          >
                            {renderCell(column.id, transaction)}
                          </td>
                        ))}
                        <td className="py-3 pr-4 text-right">
                          {renderActions(transaction)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Compact list, below md */}
            <ul className="divide-y border-t md:hidden">
              {filteredTransactions.map((transaction) => {
                const v = displayValues(transaction);
                const isSelected = selectedTransactions.has(transaction.id);
                const showPnl = transaction.type !== 'TRANSFER';
                return (
                  <li
                    key={transaction.id}
                    className={cn('flex items-center gap-3 px-4 py-3', isSelected && 'bg-tint-orange/50')}
                  >
                    {bulkActionMode && (
                      <Checkbox
                        aria-label={`Select transaction from ${formatDate(transaction.transaction_date)}`}
                        checked={isSelected}
                        onCheckedChange={() => toggleTransactionSelection(transaction.id)}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <TypeChip transaction={transaction} />
                        <span className="truncate text-[15px] font-bold tabular-nums">{btc(transaction.btc_amount)} BTC</span>
                      </div>
                      <div className="mt-1 truncate text-[13px] text-muted-foreground tabular-nums">
                        {formatDate(transaction.transaction_date)}
                        {transaction.type !== 'TRANSFER' && <>, at {formatCurrency(v.price, v.currency)}</>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
                      {showPnl ? (
                        <>
                          <div className={cn('text-[15px] font-bold', tone(v.pnl))}>{signedMoney(v.pnl, v.currency)}</div>
                          <div className={cn('text-[13px]', tone(v.pnl))}>{signedPercent(v.pnlPercent)}</div>
                        </>
                      ) : (
                        <div className="text-[13px] text-muted-foreground">
                          {isExternalTransfer(transaction) ? formatCurrency(v.value, v.currency) : 'Internal'}
                        </div>
                      )}
                    </div>
                    {renderActions(transaction)}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-muted-foreground">Rows per page</span>
              <Select value={itemsPerPage.toString()} onValueChange={(v) => { setItemsPerPage(parseInt(v)); setCurrentPage(1); }}>
                <SelectTrigger className="h-8 w-[72px] rounded-full" aria-label="Rows per page">
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
              <span className="mr-2 text-[13px] text-muted-foreground tabular-nums">
                {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
              </span>
              <Button variant="ghost" size="icon" className="size-9 rounded-full" aria-label="First page" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                <ChevronsLeftIcon className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="size-9 rounded-full" aria-label="Previous page" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <ChevronLeftIcon className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="size-9 rounded-full" aria-label="Next page" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                <ChevronRightIcon className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="size-9 rounded-full" aria-label="Last page" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
                <ChevronsRightIcon className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Add/Edit Transaction Modal */}
      <AddTransactionModal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setEditingTransaction(null); }}
        onSuccess={() => { setShowAddModal(false); setEditingTransaction(null); emitTransactionsChanged(); }}
        editingTransaction={editingTransaction}
      />

      {/* Import Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Import transactions</DialogTitle>
            <DialogDescription>
              Upload a CSV export from your exchange, or a JSON file exported from BTC Tracker.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Drag and drop area */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={cn(
                'rounded-2xl border-2 border-dashed p-8 text-center transition-colors',
                dragActive ? 'border-primary bg-tint-orange/50' : 'border-border hover:border-muted-foreground/50'
              )}
            >
              {importFile ? (
                <div className="space-y-3">
                  <div className="inline-flex size-12 items-center justify-center rounded-full bg-tint-orange">
                    <FileIcon className="size-6 text-primary-strong" />
                  </div>
                  <div>
                    <p className="font-semibold">{importFile.name}</p>
                    <p className="text-sm text-muted-foreground tabular-nums">{(importFile.size / 1024).toFixed(2)} KB</p>
                  </div>
                  {formatDetecting && (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Detecting format...
                    </div>
                  )}
                  {detectedFormat && !formatDetecting && (
                    <Badge className="rounded-full border-0 bg-tint-green text-tint-green-fg">
                      <CheckIcon className="mr-1 size-3" />
                      {detectedFormat}
                    </Badge>
                  )}
                  <div>
                    <Button variant="ghost" size="sm" className="rounded-full" onClick={() => { setImportFile(null); setDetectedFormat(null); }}>
                      Remove file
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="inline-flex size-12 items-center justify-center rounded-full bg-secondary">
                    <InboxIcon className="size-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold">Drop your file here</p>
                    <p className="text-sm text-muted-foreground">or choose one from your computer</p>
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
                    <Button variant="outline" size="sm" className="rounded-full" asChild>
                      <span>Choose file</span>
                    </Button>
                  </Label>
                </div>
              )}
            </div>

            {/* Wallet selection */}
            {importWallets.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Assign to wallet <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Select value={importWalletId} onValueChange={setImportWalletId}>
                  <SelectTrigger>
                    <SelectValue placeholder="No wallet, assign later" />
                  </SelectTrigger>
                  <SelectContent>
                    {importWallets.map(w => (
                      <SelectItem key={w.id} value={w.id.toString()}>
                        <WalletTypeIcon type={w.type} />
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[13px] text-muted-foreground">Buys go into this wallet and sells come out of it. Transfers are skipped.</p>
              </div>
            )}

            {/* Duplicate detection */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Duplicate handling</Label>
              <Select value={duplicateCheckMode} onValueChange={(v) => setDuplicateCheckMode(v as DuplicateCheckMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strict">Strict: all fields must match</SelectItem>
                  <SelectItem value="standard">Standard: core fields must match (recommended)</SelectItem>
                  <SelectItem value="loose">Loose: only date and amount</SelectItem>
                  <SelectItem value="dca">DCA: date and fiat amount (updates Auto-DCA entries)</SelectItem>
                  <SelectItem value="off">Off: import everything</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Supported formats */}
            <div className="rounded-2xl bg-secondary p-3">
              <p className="text-[13px] font-semibold">Supported formats</p>
              <p className="text-[13px] text-muted-foreground">CSV from Binance, Kraken, Coinbase, Strike, River, 21bitcoin, Cash App or Revolut X, or the standard CSV template. JSON from a BTC Tracker export.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => { setShowImportModal(false); setImportFile(null); setImportWalletId(''); }} disabled={importLoading}>
              Cancel
            </Button>
            <Button className="rounded-full font-semibold" onClick={handleImportSubmit} disabled={!importFile || importLoading}>
              {importLoading ? (
                <>
                  <div className="mr-2 size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Importing...
                </>
              ) : (
                <>
                  <UploadIcon className="mr-2 size-4" />
                  Import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
