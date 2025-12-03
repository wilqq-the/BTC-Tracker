'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { formatCurrency } from '@/lib/theme';
import DCABacktestSimulator from '@/components/DCABacktestSimulator';
import TabNavigation from '@/components/TabNavigation';
import AutoDCATab from '@/components/AutoDCATab';
import { cn } from '@/lib/utils';

// shadcn/ui components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Icons
import {
  TargetIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  CalendarIcon,
  WalletIcon,
  RefreshCwIcon,
  TrashIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  CalculatorIcon,
  PlusIcon,
  ChevronRightIcon,
  ClockIcon,
  BarChart3Icon,
  ZapIcon,
  CoinsIcon,
  PiggyBankIcon,
  CircleDollarSignIcon,
  ArrowRightIcon,
} from 'lucide-react';

interface PriceScenario {
  id: string;
  name: string;
  icon: string;
  description: string;
  annualGrowthRate: number;
  color: string;
  basis: string;
}

interface ScenarioCalculation {
  scenario: PriceScenario;
  totalFiatNeeded: number;
  averageMonthlyFiat: number;
  finalProjectedPrice: number;
  totalBtcNeeded: number;
}

interface DCACalculation {
  monthlyBtcNeeded: number;
  monthlyFiatNeeded: number;
  totalMonths: number;
  projectedCompletionDate: string;
  isFeasible: boolean;
  message: string;
  selectedScenario?: PriceScenario;
  allScenarios?: ScenarioCalculation[];
  totalFiatNeeded?: number;
  finalBtcPrice?: number;
  currentBtcPriceInCurrency?: number;
}

interface Goal {
  id: number;
  name: string;
  target_btc_amount: number;
  target_date: string;
  current_holdings: number;
  monthly_budget: number | null;
  currency: string;
  price_scenario: string;
  scenario_growth_rate: number;
  monthly_btc_needed: number;
  monthly_fiat_needed: number;
  total_fiat_needed: number;
  total_months: number;
  initial_btc_price: number;
  final_btc_price: number;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface GoalRecalculation {
  goalId: number;
  original: any;
  current: any;
  projection: any;
  recommendations: any;
}

interface DCAAnalysisResult {
  score: {
    overall: number;
    timing: number;
    consistency: number;
    performance: number;
  };
  timing: {
    btcBoughtBelowCurrent: number;
    btcBoughtAboveCurrent: number;
    bestPurchasePrice: number;
    worstPurchasePrice: number;
    bestPurchaseDate: string;
    worstPurchaseDate: string;
    avgPurchasePrice: number;
    currentPrice: number;
    priceImprovement: number;
  };
  consistency: {
    avgDaysBetweenPurchases: number;
    consistency: number;
    longestGap: number;
    longestGapStart: string | null;
    longestGapEnd: string | null;
    recentActivity: number;
    totalPurchases: number;
    missedMonths: number;
  };
  priceDistribution: Array<{
    range: string;
    btcAmount: number;
    percentage: number;
    transactions: number;
  }>;
  whatIfScenarios: Array<{
    name: string;
    description: string;
    totalInvested: number;
    btcHoldings: number;
    currentValue: number;
    pnl: number;
    pnlPercentage: number;
    difference: number;
  }>;
  monthlyBreakdown: Array<{
    month: string;
    totalInvested: number;
    btcPurchased: number;
    avgPrice: number;
    transactions: number;
    missed: boolean;
  }>;
  recommendations: Array<{
    type: string;
    icon: string;
    message: string;
  }>;
  summary: {
    totalInvested: number;
    totalBtc: number;
    avgBuyPrice: number;
    currentPrice: number;
    currentValue: number;
    totalPnL: number;
    totalPnLPercent: number;
  };
  currency?: string;
}

export default function GoalsPage() {
  const [loading, setLoading] = useState(true);
  const [currentBtcPrice, setCurrentBtcPrice] = useState<number>(0);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [savingGoal, setSavingGoal] = useState(false);
  const [portfolioBtc, setPortfolioBtc] = useState<number>(0);
  
  const [dcaAnalysis, setDcaAnalysis] = useState<DCAAnalysisResult | null>(null);
  const [dcaLoading, setDcaLoading] = useState(false);
  const [dcaError, setDcaError] = useState<string>('');
  
  const [targetBtc, setTargetBtc] = useState<number>(1.0);
  const [timeframeYears, setTimeframeYears] = useState<number>(5);
  const [targetDate, setTargetDate] = useState<string>('');
  const [currentHoldings, setCurrentHoldings] = useState<string>('');
  const [monthlyBudget, setMonthlyBudget] = useState<number>(500);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('EUR');
  const [goalName, setGoalName] = useState<string>('Bitcoin Savings Goal');
  
  const [availableScenarios, setAvailableScenarios] = useState<PriceScenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('stable');
  const [customGrowthRate, setCustomGrowthRate] = useState<string>('20');
  
  type DCAFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';
  const [dcaFrequency, setDcaFrequency] = useState<DCAFrequency>('monthly');
  
  const [calculation, setCalculation] = useState<DCACalculation | null>(null);
  const [calculating, setCalculating] = useState(false);
  
  const [goalRecalculations, setGoalRecalculations] = useState<Map<number, GoalRecalculation>>(new Map());
  const [recalculatingGoalId, setRecalculatingGoalId] = useState<number | null>(null);

  useEffect(() => {
    loadCurrentBitcoinPrice();
    loadGoals();
    loadPortfolioHoldings();
    loadScenarios();
    loadDCAAnalysis();
    setLoading(false);
  }, []);
  
  const loadCurrentBitcoinPrice = async () => {
    try {
      const response = await fetch('/api/portfolio-metrics');
      const result = await response.json();
      
      if (result.success && result.data) {
        const btcPrice = result.data.currentBtcPrice;
        const mainCurrency = result.data.mainCurrency || 'USD';
        setCurrentBtcPrice(btcPrice);
        setSelectedCurrency(mainCurrency);
      }
    } catch (error) {
      console.error('Error loading Bitcoin price:', error);
    }
  };
  
  const loadGoals = async () => {
    try {
      const response = await fetch('/api/goals');
      const result = await response.json();
      
      if (result.success && result.data) {
        setGoals(result.data);
        const activeGoals = result.data.filter((g: Goal) => !g.is_completed);
        activeGoals.forEach((goal: Goal) => {
          recalculateGoalSilently(goal.id);
        });
      }
    } catch (error) {
      console.error('Error loading goals:', error);
    }
  };
  
  const loadPortfolioHoldings = async () => {
    try {
      const response = await fetch('/api/portfolio-metrics');
      const result = await response.json();
      
      if (result.success && result.data?.totalBtc !== undefined) {
        const holdings = result.data.totalBtc;
        setPortfolioBtc(holdings);
        if (holdings > 0) {
          setCurrentHoldings(holdings.toFixed(8));
        }
      }
    } catch (error) {
      console.error('Error loading portfolio holdings:', error);
    }
  };
  
  const loadScenarios = async () => {
    try {
      const response = await fetch('/api/goals/scenarios');
      const result = await response.json();
      if (result.success && result.data) {
        setAvailableScenarios(result.data);
      }
    } catch (error) {
      console.error('Error loading scenarios:', error);
    }
  };
  
  const loadDCAAnalysis = async () => {
    setDcaLoading(true);
    setDcaError('');
    
    try {
      const response = await fetch('/api/goals/dca-analysis');
      const result = await response.json();
      
      if (result.success && result.data) {
        setDcaAnalysis(result.data);
      } else {
        setDcaError(result.error || 'Failed to load DCA analysis');
      }
    } catch (error) {
      console.error('Error loading DCA analysis:', error);
      setDcaError('Failed to load DCA analysis');
    } finally {
      setDcaLoading(false);
    }
  };
  
  const saveGoalToDatabase = async () => {
    if (!calculation || !calculation.isFeasible) {
      alert('Please calculate a valid DCA strategy first');
      return;
    }
    
    setSavingGoal(true);
    
    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: goalName,
          target_btc_amount: targetBtc.toString(),
          target_date: targetDate,
          current_holdings: currentHoldings || '0',
          monthly_budget: monthlyBudget > 0 ? monthlyBudget.toString() : null,
          currency: selectedCurrency,
          price_scenario: selectedScenarioId,
          scenario_growth_rate: selectedScenarioId === 'custom' 
            ? (parseFloat(customGrowthRate) / 100) 
            : (calculation.selectedScenario?.annualGrowthRate || 0),
          monthly_btc_needed: calculation.monthlyBtcNeeded.toString(),
          monthly_fiat_needed: calculation.monthlyFiatNeeded.toString(),
          total_fiat_needed: (calculation.totalFiatNeeded || 0).toString(),
          total_months: calculation.totalMonths.toString(),
          initial_btc_price: (calculation.currentBtcPriceInCurrency || currentBtcPrice).toString(),
          final_btc_price: (calculation.finalBtcPrice || calculation.currentBtcPriceInCurrency || currentBtcPrice).toString()
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('Goal saved successfully!');
        await loadGoals();
        setTargetBtc(1.0);
        setTimeframeYears(5);
        setTargetDate('');
        setCurrentHoldings('');
        setMonthlyBudget(500);
        setCalculation(null);
        setGoalName('Bitcoin Savings Goal');
        setSelectedScenarioId('stable');
      } else {
        alert('Failed to save goal: ' + result.error);
      }
    } catch (error) {
      console.error('Error saving goal:', error);
      alert('Failed to save goal');
    } finally {
      setSavingGoal(false);
    }
  };
  
  const deleteGoal = async (goalId: number) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;
    
    try {
      const response = await fetch(`/api/goals/${goalId}`, { method: 'DELETE' });
      const result = await response.json();
      
      if (result.success) {
        await loadGoals();
      } else {
        alert('Failed to delete goal: ' + result.error);
      }
    } catch (error) {
      console.error('Error deleting goal:', error);
      alert('Failed to delete goal');
    }
  };
  
  const recalculateGoalSilently = async (goalId: number) => {
    try {
      const response = await fetch(`/api/goals/${goalId}/recalculate`, { method: 'POST' });
      const result = await response.json();
      
      if (result.success) {
        setGoalRecalculations(prev => {
          const newMap = new Map(prev);
          newMap.set(goalId, { goalId, ...result.data });
          return newMap;
        });
      }
    } catch (error) {
      console.error('Error recalculating goal:', error);
    }
  };

  const recalculateGoal = async (goalId: number) => {
    setRecalculatingGoalId(goalId);
    
    try {
      const response = await fetch(`/api/goals/${goalId}/recalculate`, { method: 'POST' });
      const result = await response.json();
      
      if (result.success) {
        if (result.data.goal_achieved || result.data.goal_expired) {
          alert(result.data.message);
        } else {
          setGoalRecalculations(prev => {
            const newMap = new Map(prev);
            newMap.set(goalId, { goalId, ...result.data });
            return newMap;
          });
        }
      } else {
        alert('Failed to recalculate goal: ' + result.error);
      }
    } catch (error) {
      console.error('Error recalculating goal:', error);
      alert('Failed to recalculate goal');
    } finally {
      setRecalculatingGoalId(null);
    }
  };
  
  const calculateDCAStrategy = async () => {
    setCalculating(true);
    
    try {
      const today = new Date();
      const targetDateObj = new Date(today.getFullYear() + timeframeYears, today.getMonth(), today.getDate());
      const calculatedTargetDate = targetDateObj.toISOString().split('T')[0];
      setTargetDate(calculatedTargetDate);
      
      const target = targetBtc;
      
      if (!target || target <= 0) {
        setCalculation({
          monthlyBtcNeeded: 0, monthlyFiatNeeded: 0, totalMonths: 0,
          projectedCompletionDate: '', isFeasible: false,
          message: 'Please enter a valid target BTC amount'
        });
        setCalculating(false);
        return;
      }
      
      if (timeframeYears <= 0) {
        setCalculation({
          monthlyBtcNeeded: 0, monthlyFiatNeeded: 0, totalMonths: 0,
          projectedCompletionDate: '', isFeasible: false,
          message: 'Please select a valid timeframe'
        });
        setCalculating(false);
        return;
      }
      
      if (selectedScenarioId === 'custom') {
        const growthRate = parseFloat(customGrowthRate);
        if (isNaN(growthRate) || growthRate < -100 || growthRate > 500) {
          setCalculation({
            monthlyBtcNeeded: 0, monthlyFiatNeeded: 0, totalMonths: 0,
            projectedCompletionDate: '', isFeasible: false,
            message: 'Please enter a valid custom growth rate between -100% and +500%'
          });
          setCalculating(false);
          return;
        }
      }
      
      const response = await fetch('/api/goals/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_btc: targetBtc.toString(),
          current_holdings: currentHoldings || '0',
          target_date: calculatedTargetDate,
          selected_scenario: selectedScenarioId,
          custom_growth_rate: selectedScenarioId === 'custom' ? (parseFloat(customGrowthRate) / 100) : undefined,
          frequency: dcaFrequency
        })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        setCalculation({
          monthlyBtcNeeded: 0, monthlyFiatNeeded: 0, totalMonths: 0,
          projectedCompletionDate: '', isFeasible: false,
          message: result.error || 'Error calculating strategy'
        });
        setCalculating(false);
        return;
      }
      
      if (result.data.already_achieved) {
        setCalculation({
          monthlyBtcNeeded: 0, monthlyFiatNeeded: 0, totalMonths: 0,
          projectedCompletionDate: targetDateObj.toLocaleDateString(),
          isFeasible: true,
          message: 'Congratulations! You already have enough BTC to meet your goal!'
        });
        setCalculating(false);
        return;
      }
      
      const { selected_scenario, all_scenarios, total_months, currency } = result.data;
      const monthlyBtcNeeded = selected_scenario.totalBtcNeeded / total_months;
      const monthlyFiatNeeded = selected_scenario.averageMonthlyFiat;
      
      if (currency) setSelectedCurrency(currency);
      
      const isFeasible = !monthlyBudget || monthlyFiatNeeded <= monthlyBudget;
      
      let message = '';
      if (isFeasible) {
        if (monthlyBudget && monthlyFiatNeeded < monthlyBudget * 0.8) {
          message = 'Goal is easily achievable with your budget! You could even reach it faster.';
        } else if (monthlyBudget) {
          message = 'Goal is achievable with your monthly budget.';
        } else {
          message = `You'll need to invest approximately ${formatCurrency(monthlyFiatNeeded, currency)} per month (${selected_scenario.scenario.name} scenario).`;
        }
      } else {
        const shortfall = monthlyFiatNeeded - monthlyBudget;
        message = `Your budget falls short by ${formatCurrency(shortfall, currency)} per month. Consider extending your timeline or increasing your budget.`;
      }
      
      setCalculation({
        monthlyBtcNeeded, monthlyFiatNeeded, totalMonths: total_months,
        projectedCompletionDate: targetDateObj.toLocaleDateString(),
        isFeasible, message,
        selectedScenario: selected_scenario.scenario,
        allScenarios: all_scenarios,
        totalFiatNeeded: selected_scenario.totalFiatNeeded,
        finalBtcPrice: selected_scenario.finalProjectedPrice,
        currentBtcPriceInCurrency: result.data.current_btc_price
      });
      
    } catch (error) {
      console.error('Calculation error:', error);
      setCalculation({
        monthlyBtcNeeded: 0, monthlyFiatNeeded: 0, totalMonths: 0,
        projectedCompletionDate: '', isFeasible: false,
        message: 'Error calculating strategy. Please check your inputs.'
      });
    } finally {
      setCalculating(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-3">
            <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">Loading goals...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold mb-1">Goals & Strategy</h1>
          <p className="text-muted-foreground">
            Set savings goals, automate purchases, and analyze your DCA strategy
          </p>
        </div>

        {/* Tab Navigation */}
        <TabNavigation
          tabs={[
            { id: 'goals', label: 'My Goals', badge: goals.length, content: renderGoalsTab() },
            { id: 'calculator', label: 'DCA Calculator', content: renderCalculatorTab() },
            { id: 'auto-dca', label: 'Auto DCA', content: <AutoDCATab /> },
            { id: 'backtest', label: 'Backtest', content: renderBacktestTab() },
            { id: 'analysis', label: 'Analysis', content: renderAnalysisTab() }
          ]}
          initialTabId="goals"
        />
      </div>
    </AppLayout>
  );

  // ============================================================
  // TAB CONTENT RENDERERS
  // ============================================================

  function renderGoalsTab() {
    return (
      <div className="space-y-6">
        {goals.length === 0 ? (
          <Card>
            <CardContent className="py-16">
              <div className="text-center space-y-4">
                <div className="size-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <TargetIcon className="size-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">No active goals yet</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    Use the DCA Calculator to create your first Bitcoin savings goal
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {goals.map((goal) => {
              const recalc = goalRecalculations.get(goal.id);
              const isRecalculating = recalculatingGoalId === goal.id;
              const currencySymbol = goal.currency === 'EUR' ? '€' : '$';
              
              return (
                <Card key={goal.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{goal.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="gap-1">
                            {goal.price_scenario === 'bear' ? '🐻' : 
                             goal.price_scenario === 'conservative' ? '📉' :
                             goal.price_scenario === 'stable' ? '📊' :
                             goal.price_scenario === 'moderate' ? '📈' : 
                             goal.price_scenario === 'bull' ? '🚀' : '⚙️'}
                            <span className="capitalize">{goal.price_scenario}</span>
                            <span className="text-muted-foreground">
                              ({goal.scenario_growth_rate >= 0 ? '+' : ''}{(goal.scenario_growth_rate * 100).toFixed(0)}%/yr)
                            </span>
                          </Badge>
                          {recalc && recalc.current && (
                            <Badge className={recalc.current.is_on_track 
                              ? 'bg-profit/10 text-profit border-profit/20' 
                              : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                            }>
                              {recalc.current.is_on_track ? (
                                <><CheckCircleIcon className="size-3 mr-1" /> On Track</>
                              ) : (
                                <><AlertCircleIcon className="size-3 mr-1" /> Behind</>
                              )}
                            </Badge>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => recalculateGoal(goal.id)}
                          disabled={isRecalculating}
                        >
                          <RefreshCwIcon className={cn("size-4", isRecalculating && "animate-spin")} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteGoal(goal.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <TrashIcon className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Progress Bar (if recalc available) */}
                    {recalc && recalc.current && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-semibold">{recalc.current.progress_percent.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all",
                              recalc.current.is_on_track ? 'bg-profit' : 'bg-amber-500'
                            )}
                            style={{ width: `${Math.min(recalc.current.progress_percent, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>{recalc.current.current_holdings.toFixed(6)} BTC</span>
                          <span>{goal.target_btc_amount.toFixed(6)} BTC</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <TargetIcon className="size-3" /> Target
                        </p>
                        <p className="font-semibold font-mono">{goal.target_btc_amount.toFixed(6)} ₿</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <CalendarIcon className="size-3" /> Target Date
                        </p>
                        <p className="font-semibold">{new Date(goal.target_date).toLocaleDateString()}</p>
                      </div>
                      <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <CircleDollarSignIcon className="size-3" /> Monthly
                        </p>
                        <p className="font-semibold text-primary">
                          {currencySymbol}{goal.monthly_fiat_needed.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <ClockIcon className="size-3" /> Duration
                        </p>
                        <p className="font-semibold">{goal.total_months} months</p>
                      </div>
                    </div>
                    
                    {/* Current Status (if recalc) */}
                    {recalc && recalc.current && (
                      <div className={cn(
                        "p-3 rounded-lg border",
                        recalc.current.is_on_track 
                          ? 'bg-profit/5 border-profit/20' 
                          : 'bg-amber-500/5 border-amber-500/20'
                      )}>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">BTC Price:</span>
                            <span className="font-medium">
                              {formatCurrency(recalc.current.btc_price, selectedCurrency)}
                              <span className={cn(
                                "text-xs ml-1",
                                recalc.current.price_change_percent >= 0 ? 'text-profit' : 'text-loss'
                              )}>
                                ({recalc.current.price_change_percent >= 0 ? '+' : ''}{recalc.current.price_change_percent.toFixed(1)}%)
                              </span>
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Remaining:</span>
                            <span className="font-medium">{recalc.current.remaining_months} mo</span>
                          </div>
                          <div className="flex justify-between col-span-2">
                            <span className="text-muted-foreground">New Monthly:</span>
                            <span className="font-medium">
                              {formatCurrency(recalc.projection.monthly_fiat_needed, selectedCurrency)}
                              {recalc.projection.monthly_change_percent !== 0 && (
                                <span className={cn(
                                  "text-xs ml-1",
                                  recalc.projection.monthly_change_percent < 0 ? 'text-profit' : 'text-loss'
                                )}>
                                  ({recalc.projection.monthly_change_percent >= 0 ? '+' : ''}{recalc.projection.monthly_change_percent.toFixed(0)}%)
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {goal.is_completed && (
                      <div className="p-3 bg-profit/10 border border-profit/20 rounded-lg text-center">
                        <CheckCircleIcon className="size-5 text-profit inline mr-2" />
                        <span className="text-profit font-medium">
                          Completed on {new Date(goal.completed_at!).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderCalculatorTab() {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalculatorIcon className="size-5" />
              DCA Strategy Calculator
            </CardTitle>
            <CardDescription>
              Calculate how much you need to invest regularly to reach your Bitcoin goal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Current BTC Price */}
            {currentBtcPrice > 0 && (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current BTC Price:</span>
                <span className="text-lg font-bold text-primary">{formatCurrency(currentBtcPrice, selectedCurrency)}</span>
              </div>
            )}

            {/* Scenario Selector */}
            {availableScenarios.length > 0 && (
              <div className="space-y-3">
                <Label>Price Scenario</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                  {availableScenarios.map((scenario) => (
                    <button
                      key={scenario.id}
                      onClick={() => setSelectedScenarioId(scenario.id)}
                      className={cn(
                        "p-3 rounded-lg border-2 transition-all text-center",
                        selectedScenarioId === scenario.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <div className="text-2xl mb-1">{scenario.icon}</div>
                      <div className={cn("text-xs font-semibold", scenario.color)}>{scenario.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {scenario.id === 'custom' ? 'Custom' : 
                          `${scenario.annualGrowthRate >= 0 ? '+' : ''}${(scenario.annualGrowthRate * 100).toFixed(0)}%/yr`}
                      </div>
                    </button>
                  ))}
                </div>
                
                {selectedScenarioId === 'custom' && (
                  <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-lg space-y-2">
                    <Label>Custom Annual Growth Rate</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={customGrowthRate}
                        onChange={(e) => setCustomGrowthRate(e.target.value)}
                        placeholder="20"
                        className="w-32"
                      />
                      <span className="text-sm">% per year</span>
                    </div>
                  </div>
                )}
                
                <p className="text-xs text-muted-foreground">
                  {availableScenarios.find(s => s.id === selectedScenarioId)?.description}
                </p>
              </div>
            )}

            {/* Calculator Form */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="goalName">Goal Name</Label>
                <Input
                  id="goalName"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  placeholder="Bitcoin Savings Goal"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="dcaFrequency">DCA Frequency</Label>
                <select
                  id="dcaFrequency"
                  value={dcaFrequency}
                  onChange={(e) => setDcaFrequency(e.target.value as DCAFrequency)}
                  className="w-full h-10 px-3 bg-background border border-input rounded-md"
                >
                  <option value="monthly">Monthly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="weekly">Weekly</option>
                  <option value="daily">Daily</option>
                </select>
              </div>
            </div>

            {/* Sliders */}
            <div className="space-y-6">
              {/* Target BTC */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Target BTC Amount</Label>
                  <Input
                    type="number"
                    min="0.01"
                    max="21"
                    step="0.01"
                    value={targetBtc}
                    onChange={(e) => setTargetBtc(parseFloat(e.target.value) || 0.01)}
                    className="w-28 text-right font-bold text-primary"
                  />
                </div>
                <input
                  type="range"
                  min="0.01"
                  max="10"
                  step="0.01"
                  value={Math.min(targetBtc, 10)}
                  onChange={(e) => setTargetBtc(parseFloat(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0.01 ₿</span>
                  <span>10 ₿</span>
                </div>
              </div>

              {/* Timeframe */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Timeframe (Years)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={timeframeYears}
                    onChange={(e) => setTimeframeYears(parseInt(e.target.value) || 1)}
                    className="w-28 text-right font-bold text-primary"
                  />
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={Math.min(timeframeYears, 20)}
                  onChange={(e) => setTimeframeYears(parseInt(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1 year</span>
                  <span>20 years</span>
                </div>
              </div>

              {/* Current Holdings */}
              <div className="space-y-2">
                <Label>Current Holdings (BTC)</Label>
                <Input
                  type="number"
                  value={currentHoldings}
                  onChange={(e) => setCurrentHoldings(e.target.value)}
                  placeholder="0.0"
                  step="0.001"
                />
                {portfolioBtc > 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircleIcon className="size-3 text-profit" />
                    Auto-loaded from your portfolio
                  </p>
                )}
              </div>

              {/* Monthly Budget */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Monthly Budget (Optional)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100000"
                    value={monthlyBudget}
                    onChange={(e) => setMonthlyBudget(parseInt(e.target.value) || 0)}
                    className="w-32 text-right font-bold text-primary"
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="5000"
                  step="50"
                  value={Math.min(monthlyBudget, 5000)}
                  onChange={(e) => setMonthlyBudget(parseInt(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatCurrency(0, selectedCurrency)}</span>
                  <span>{formatCurrency(5000, selectedCurrency)}</span>
                </div>
              </div>
            </div>

            <Button
              onClick={calculateDCAStrategy}
              disabled={calculating || !targetBtc || targetBtc <= 0 || timeframeYears <= 0}
              className="w-full"
              size="lg"
            >
              {calculating ? (
                <><RefreshCwIcon className="size-4 mr-2 animate-spin" /> Calculating...</>
              ) : (
                <><CalculatorIcon className="size-4 mr-2" /> Calculate Strategy</>
              )}
            </Button>

            {/* Results */}
            {calculation && (
              <div className={cn(
                "p-6 rounded-lg border",
                calculation.isFeasible 
                  ? 'bg-profit/5 border-profit/20' 
                  : 'bg-amber-500/5 border-amber-500/20'
              )}>
                <div className="text-center mb-6">
                  <p className={cn(
                    "text-sm font-medium",
                    calculation.isFeasible ? 'text-profit' : 'text-amber-600'
                  )}>
                    {calculation.isFeasible ? <CheckCircleIcon className="size-4 inline mr-1" /> : <AlertCircleIcon className="size-4 inline mr-1" />}
                    {calculation.message}
                  </p>
                </div>

                {calculation.isFeasible && calculation.monthlyBtcNeeded > 0 && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="p-4 bg-background rounded-lg border text-center">
                        <p className="text-xs text-muted-foreground mb-1">Monthly BTC</p>
                        <p className="text-xl font-bold text-primary font-mono">{calculation.monthlyBtcNeeded.toFixed(6)} ₿</p>
                        <p className="text-xs text-muted-foreground">{(calculation.monthlyBtcNeeded * 100000000).toLocaleString()} sats</p>
                      </div>
                      <div className="p-4 bg-background rounded-lg border text-center">
                        <p className="text-xs text-muted-foreground mb-1">Monthly Investment</p>
                        <p className="text-xl font-bold text-primary">{formatCurrency(calculation.monthlyFiatNeeded, selectedCurrency)}</p>
                      </div>
                      <div className="p-4 bg-background rounded-lg border text-center">
                        <p className="text-xs text-muted-foreground mb-1">Duration</p>
                        <p className="text-xl font-bold">{calculation.totalMonths} months</p>
                        <p className="text-xs text-muted-foreground">{(calculation.totalMonths / 12).toFixed(1)} years</p>
                      </div>
                      <div className="p-4 bg-background rounded-lg border text-center">
                        <p className="text-xs text-muted-foreground mb-1">Completion</p>
                        <p className="text-lg font-bold">{calculation.projectedCompletionDate}</p>
                      </div>
                    </div>

                    {/* Scenario Comparison Table */}
                    {calculation.allScenarios && calculation.allScenarios.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-semibold mb-3">Compare All Scenarios</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2 px-2">Scenario</th>
                                <th className="text-right py-2 px-2">Avg Monthly</th>
                                <th className="text-right py-2 px-2">Total Cost</th>
                                <th className="text-right py-2 px-2">Final BTC Price</th>
                              </tr>
                            </thead>
                            <tbody>
                              {calculation.allScenarios.map((scenCalc) => (
                                <tr 
                                  key={scenCalc.scenario.id}
                                  className={cn(
                                    "border-b",
                                    scenCalc.scenario.id === selectedScenarioId && 'bg-primary/5'
                                  )}
                                >
                                  <td className="py-2 px-2">
                                    <div className="flex items-center gap-2">
                                      <span>{scenCalc.scenario.icon}</span>
                                      <div>
                                        <div className={cn("font-medium text-xs", scenCalc.scenario.color)}>{scenCalc.scenario.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                          {scenCalc.scenario.annualGrowthRate >= 0 ? '+' : ''}{(scenCalc.scenario.annualGrowthRate * 100).toFixed(0)}%/yr
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="text-right py-2 px-2 font-semibold">{formatCurrency(scenCalc.averageMonthlyFiat, selectedCurrency)}</td>
                                  <td className="text-right py-2 px-2">{formatCurrency(scenCalc.totalFiatNeeded, selectedCurrency)}</td>
                                  <td className="text-right py-2 px-2 text-muted-foreground">{formatCurrency(scenCalc.finalProjectedPrice, selectedCurrency)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <Button onClick={saveGoalToDatabase} disabled={savingGoal} className="w-full">
                      {savingGoal ? 'Saving...' : 'Save as Goal'}
                    </Button>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  function renderBacktestTab() {
    return (
      <div className="space-y-6">
        <DCABacktestSimulator defaultCurrency={selectedCurrency} />
      </div>
    );
  }

  function renderAnalysisTab() {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">DCA Performance Analysis</h2>
            <p className="text-sm text-muted-foreground">Analyze your Dollar Cost Averaging strategy</p>
          </div>
          <Button variant="outline" onClick={loadDCAAnalysis} disabled={dcaLoading}>
            <RefreshCwIcon className={cn("size-4 mr-2", dcaLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {dcaLoading && !dcaAnalysis && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center space-y-3">
                <div className="size-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-muted-foreground">Analyzing your DCA strategy...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {dcaError && !dcaAnalysis && (
          <Card>
            <CardContent className="py-8 text-center">
              <AlertCircleIcon className="size-8 text-destructive mx-auto mb-2" />
              <p className="text-destructive">{dcaError}</p>
            </CardContent>
          </Card>
        )}

        {dcaAnalysis && dcaAnalysis.score && (
          <div className="space-y-6">
            {/* Score Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3Icon className="size-4" />
                    Overall Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">{(dcaAnalysis.score.overall || 0).toFixed(1)}/10</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(dcaAnalysis.score.overall || 0) >= 8 ? 'Excellent!' :
                     (dcaAnalysis.score.overall || 0) >= 6 ? 'Good' :
                     (dcaAnalysis.score.overall || 0) >= 4 ? 'Room to Improve' : 'Needs Work'}
                  </p>
                </CardContent>
              </Card>

              {dcaAnalysis.timing && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ClockIcon className="size-4" />
                      Timing
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-primary">{(dcaAnalysis.score.timing || 0).toFixed(1)}/10</div>
                    <div className="flex justify-between text-xs mt-2">
                      <span className="text-profit">{(dcaAnalysis.timing.btcBoughtBelowCurrent || 0).toFixed(0)}% dips</span>
                      <span className="text-loss">{(dcaAnalysis.timing.btcBoughtAboveCurrent || 0).toFixed(0)}% pumps</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {dcaAnalysis.consistency && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TargetIcon className="size-4" />
                      Consistency
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-primary">{(dcaAnalysis.score.consistency || 0).toFixed(1)}/10</div>
                    <div className="text-xs text-muted-foreground mt-2">
                      {dcaAnalysis.consistency.totalPurchases} purchases • {(dcaAnalysis.consistency.consistency || 0).toFixed(0)}% consistent
                    </div>
                  </CardContent>
                </Card>
              )}

              {dcaAnalysis.summary && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUpIcon className="size-4" />
                      Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-primary">{(dcaAnalysis.score.performance || 0).toFixed(1)}/10</div>
                    <div className={cn(
                      "text-xs mt-2 font-medium",
                      (dcaAnalysis.summary.totalPnL || 0) >= 0 ? 'text-profit' : 'text-loss'
                    )}>
                      {(dcaAnalysis.summary.totalPnL || 0) >= 0 ? '+' : ''}{(dcaAnalysis.summary.totalPnLPercent || 0).toFixed(1)}% P&L
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* What-If & Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {dcaAnalysis.whatIfScenarios && dcaAnalysis.whatIfScenarios.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ZapIcon className="size-4" />
                      What-If Scenarios
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {dcaAnalysis.whatIfScenarios.map((scenario, index) => (
                        <div 
                          key={index}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg",
                            index === 0 ? 'bg-primary/5 border border-primary/20' : 'bg-muted/50'
                          )}
                        >
                          <div>
                            <p className="font-medium text-sm">{scenario.name}</p>
                            <p className="text-xs text-muted-foreground">{scenario.btcHoldings.toFixed(4)} ₿</p>
                          </div>
                          <div className="text-right">
                            <p className={cn(
                              "font-bold",
                              scenario.pnl >= 0 ? 'text-profit' : 'text-loss'
                            )}>
                              {scenario.pnl >= 0 ? '+' : ''}{formatCurrency(scenario.pnl, selectedCurrency)}
                            </p>
                            <p className="text-xs text-muted-foreground">{scenario.pnlPercentage.toFixed(1)}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {dcaAnalysis.priceDistribution && dcaAnalysis.priceDistribution.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3Icon className="size-4" />
                      Purchase Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {dcaAnalysis.priceDistribution.map((range, index) => (
                        <div key={index} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{range.range}</span>
                            <span className="font-medium">{range.transactions} tx • {range.percentage.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${range.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
}
