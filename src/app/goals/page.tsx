'use client';

import React, { useState, useEffect } from 'react';
import { ThemedCard, ThemedText, ThemedButton } from '@/components/ui/ThemeProvider';
import AppLayout from '@/components/AppLayout';
import { formatCurrency } from '@/lib/theme';

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
  // New scenario-based fields
  selectedScenario?: PriceScenario;
  allScenarios?: ScenarioCalculation[];
  totalFiatNeeded?: number;
  finalBtcPrice?: number;
  currentBtcPriceInCurrency?: number; // BTC price in user's main currency
}

interface Goal {
  id: number;
  name: string;
  target_btc_amount: number;
  target_date: string;
  current_holdings: number;
  monthly_budget: number | null;
  currency: string;
  // Scenario data
  price_scenario: string;
  scenario_growth_rate: number;
  // Calculated values
  monthly_btc_needed: number;
  monthly_fiat_needed: number;
  total_fiat_needed: number;
  total_months: number;
  initial_btc_price: number;
  final_btc_price: number;
  // Status
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
  
  // DCA Analysis
  const [dcaAnalysis, setDcaAnalysis] = useState<DCAAnalysisResult | null>(null);
  const [dcaLoading, setDcaLoading] = useState(false);
  const [dcaError, setDcaError] = useState<string>('');
  
  // Calculator inputs
  const [targetBtc, setTargetBtc] = useState<number>(1.0);
  const [timeframeYears, setTimeframeYears] = useState<number>(5);
  const [targetDate, setTargetDate] = useState<string>('');
  const [currentHoldings, setCurrentHoldings] = useState<string>('');
  const [monthlyBudget, setMonthlyBudget] = useState<number>(500);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('EUR');
  const [goalName, setGoalName] = useState<string>('Bitcoin Savings Goal');
  
  // Scenario selection
  const [availableScenarios, setAvailableScenarios] = useState<PriceScenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('stable');
  const [customGrowthRate, setCustomGrowthRate] = useState<string>('20');
  
  // Calculation results
  const [calculation, setCalculation] = useState<DCACalculation | null>(null);
  const [calculating, setCalculating] = useState(false);
  
  // Dynamic goal tracking
  const [goalRecalculations, setGoalRecalculations] = useState<Map<number, GoalRecalculation>>(new Map());
  const [recalculatingGoalId, setRecalculatingGoalId] = useState<number | null>(null);

  useEffect(() => {
    loadCurrentBitcoinPrice();
    loadGoals();
    loadPortfolioHoldings();
    loadScenarios();
    loadDCAAnalysis(); // Load DCA analysis on mount
    setLoading(false);
  }, []);
  
  const loadCurrentBitcoinPrice = async () => {
    try {
      // Use portfolio-metrics API to get BTC price already converted to user's main currency
      // This ensures consistency with the dashboard/portfolio display
      const response = await fetch('/api/portfolio-metrics');
      const result = await response.json();
      
      if (result.success && result.data) {
        const btcPrice = result.data.currentBtcPrice; // Already in user's main currency
        const mainCurrency = result.data.mainCurrency || 'USD';
        
        console.log('[Goals] BTC price in', mainCurrency + ':', btcPrice);
        
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
        
        // Auto-recalculate all active goals on page load
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
        
        // Only auto-fill if holdings > 0
        if (holdings > 0) {
          setCurrentHoldings(holdings.toFixed(8)); // Auto-fill the input
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
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: goalName,
          target_btc_amount: targetBtc.toString(),
          target_date: targetDate,
          current_holdings: currentHoldings || '0',
          monthly_budget: monthlyBudget > 0 ? monthlyBudget.toString() : null,
          currency: selectedCurrency,
          // Scenario data
          price_scenario: selectedScenarioId,
          scenario_growth_rate: selectedScenarioId === 'custom' 
            ? (parseFloat(customGrowthRate) / 100) 
            : (calculation.selectedScenario?.annualGrowthRate || 0),
          // Calculated values
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
        alert('✅ Goal saved successfully!');
        await loadGoals(); // Reload goals list
        
        // Reset calculator
        setTargetBtc(1.0);
        setTimeframeYears(5);
        setTargetDate('');
        setCurrentHoldings('');
        setMonthlyBudget(500);
        setCalculation(null);
        setGoalName('Bitcoin Savings Goal');
        setSelectedScenarioId('stable');
      } else {
        alert('❌ Failed to save goal: ' + result.error);
      }
    } catch (error) {
      console.error('Error saving goal:', error);
      alert('❌ Failed to save goal');
    } finally {
      setSavingGoal(false);
    }
  };
  
  const deleteGoal = async (goalId: number) => {
    if (!confirm('Are you sure you want to delete this goal?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/goals/${goalId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        await loadGoals(); // Reload goals list
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
      const response = await fetch(`/api/goals/${goalId}/recalculate`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Store recalculation data silently (no alerts)
        setGoalRecalculations(prev => {
          const newMap = new Map(prev);
          newMap.set(goalId, {
            goalId,
            ...result.data
          });
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
      const response = await fetch(`/api/goals/${goalId}/recalculate`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        if (result.data.goal_achieved || result.data.goal_expired) {
          alert(result.data.message);
        } else {
          // Store recalculation data
          setGoalRecalculations(prev => {
            const newMap = new Map(prev);
            newMap.set(goalId, {
              goalId,
              ...result.data
            });
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
      // Calculate target date from timeframe
      const today = new Date();
      const targetDateObj = new Date(today.getFullYear() + timeframeYears, today.getMonth(), today.getDate());
      const calculatedTargetDate = targetDateObj.toISOString().split('T')[0];
      setTargetDate(calculatedTargetDate); // Update state for display
      
      // Validate inputs
      const target = targetBtc;
      const holdings = parseFloat(currentHoldings || '0');
      const budget = monthlyBudget;
      
      if (!target || target <= 0) {
        setCalculation({
          monthlyBtcNeeded: 0,
          monthlyFiatNeeded: 0,
          totalMonths: 0,
          projectedCompletionDate: '',
          isFeasible: false,
          message: 'Please enter a valid target BTC amount'
        });
        setCalculating(false);
        return;
      }
      
      if (timeframeYears <= 0) {
        setCalculation({
          monthlyBtcNeeded: 0,
          monthlyFiatNeeded: 0,
          totalMonths: 0,
          projectedCompletionDate: '',
          isFeasible: false,
          message: 'Please select a valid timeframe'
        });
        setCalculating(false);
        return;
      }
      
      // For custom scenario, use the user-defined growth rate
      let actualScenarioId = selectedScenarioId;
      if (selectedScenarioId === 'custom') {
        // Validate custom growth rate
        const growthRate = parseFloat(customGrowthRate);
        if (isNaN(growthRate) || growthRate < -100 || growthRate > 500) {
          setCalculation({
            monthlyBtcNeeded: 0,
            monthlyFiatNeeded: 0,
            totalMonths: 0,
            projectedCompletionDate: '',
            isFeasible: false,
            message: 'Please enter a valid custom growth rate between -100% and +500%'
          });
          setCalculating(false);
          return;
        }
      }
      
      // Call API to calculate all scenarios
      const response = await fetch('/api/goals/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          target_btc: targetBtc.toString(),
          current_holdings: currentHoldings || '0',
          target_date: calculatedTargetDate,
          selected_scenario: selectedScenarioId,
          custom_growth_rate: selectedScenarioId === 'custom' ? (parseFloat(customGrowthRate) / 100) : undefined
        })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        setCalculation({
          monthlyBtcNeeded: 0,
          monthlyFiatNeeded: 0,
          totalMonths: 0,
          projectedCompletionDate: '',
          isFeasible: false,
          message: result.error || 'Error calculating strategy'
        });
        setCalculating(false);
        return;
      }
      
      if (result.data.already_achieved) {
        setCalculation({
          monthlyBtcNeeded: 0,
          monthlyFiatNeeded: 0,
          totalMonths: 0,
          projectedCompletionDate: targetDateObj.toLocaleDateString(),
          isFeasible: true,
          message: '🎉 Congratulations! You already have enough BTC to meet your goal!'
        });
        setCalculating(false);
        return;
      }
      
      // Extract calculation data
      const { selected_scenario, all_scenarios, total_months, currency } = result.data;
      const monthlyBtcNeeded = selected_scenario.totalBtcNeeded / total_months;
      const monthlyFiatNeeded = selected_scenario.averageMonthlyFiat;
      
      // Update currency from API response (user's current main currency)
      if (currency) {
        setSelectedCurrency(currency);
      }
      
      // Check if budget is sufficient
      const isFeasible = !budget || monthlyFiatNeeded <= budget;
      
      let message = '';
      if (isFeasible) {
        if (budget && monthlyFiatNeeded < budget * 0.8) {
          message = '✅ Goal is easily achievable with your budget! You could even reach it faster.';
        } else if (budget) {
          message = '✅ Goal is achievable with your monthly budget.';
        } else {
          message = `💡 You'll need to invest approximately ${formatCurrency(monthlyFiatNeeded, currency)} per month (${selected_scenario.scenario.name} scenario).`;
        }
      } else {
        const shortfall = monthlyFiatNeeded - budget;
        message = `⚠️ Your budget falls short by ${formatCurrency(shortfall, currency)} per month. Consider extending your timeline or increasing your budget.`;
      }
      
      setCalculation({
        monthlyBtcNeeded,
        monthlyFiatNeeded,
        totalMonths: total_months,
        projectedCompletionDate: targetDateObj.toLocaleDateString(),
        isFeasible,
        message,
        selectedScenario: selected_scenario.scenario,
        allScenarios: all_scenarios,
        totalFiatNeeded: selected_scenario.totalFiatNeeded,
        finalBtcPrice: selected_scenario.finalProjectedPrice,
        currentBtcPriceInCurrency: result.data.current_btc_price // Store converted price from API
      });
      
    } catch (error) {
      console.error('Calculation error:', error);
      setCalculation({
        monthlyBtcNeeded: 0,
        monthlyFiatNeeded: 0,
        totalMonths: 0,
        projectedCompletionDate: '',
        isFeasible: false,
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
          <ThemedText variant="secondary">Loading goals...</ThemedText>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-btc-text-primary mb-2">
              Bitcoin Goals & DCA Calculator
            </h1>
            <ThemedText variant="secondary" className="text-sm md:text-base">
              Set savings goals, analyze your DCA strategy, and track your progress
            </ThemedText>
          </div>
        </div>

        {/* Active Goals Section */}
        <section>
          <h2 className="text-lg font-semibold text-btc-text-primary mb-4">
            Active Goals
          </h2>
          {goals.length === 0 ? (
            <ThemedCard>
              <div className="text-center py-12">
                <div className="text-4xl mb-4">🎯</div>
                <h3 className="text-lg font-medium text-btc-text-secondary mb-2">
                  No active goals yet
                </h3>
                <ThemedText variant="muted" className="mb-4">
                  Use the DCA Calculator below to create your first Bitcoin savings goal
                </ThemedText>
              </div>
            </ThemedCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {goals.map((goal) => {
                const recalc = goalRecalculations.get(goal.id);
                const isRecalculating = recalculatingGoalId === goal.id;
                
                return (
                  <ThemedCard key={goal.id}>
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <h3 className="text-lg font-semibold text-btc-text-primary">
                          {goal.name}
                        </h3>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => recalculateGoal(goal.id)}
                            disabled={isRecalculating}
                            className="px-3 py-1.5 bg-bitcoin/10 hover:bg-bitcoin/20 text-bitcoin hover:text-bitcoin-dark text-xs font-medium rounded-md border border-bitcoin/20 hover:border-bitcoin/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Recalculate based on current BTC price"
                          >
                            {isRecalculating ? '↻ Calculating...' : '↻ Recalculate'}
                          </button>
                          <button
                            onClick={() => deleteGoal(goal.id)}
                            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-medium rounded-md border border-red-500/20 hover:border-red-500/40 transition-all duration-200"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                      
                      {/* Scenario Badge + Status */}
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                        <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-btc-bg-secondary rounded-full border border-btc-border-primary">
                          <span className="text-base">
                            {goal.price_scenario === 'bear' ? '🐻' : 
                             goal.price_scenario === 'conservative' ? '📉' :
                             goal.price_scenario === 'stable' ? '📊' :
                             goal.price_scenario === 'moderate' ? '📈' : 
                             goal.price_scenario === 'bull' ? '🚀' : '⚙️'}
                          </span>
                          <span className={`text-xs font-medium capitalize ${
                            goal.price_scenario === 'custom' ? 'text-purple-600 dark:text-purple-400' : 'text-btc-text-secondary'
                          }`}>
                            {goal.price_scenario} Scenario
                          </span>
                          <span className="text-xs text-btc-text-secondary">
                            ({goal.scenario_growth_rate >= 0 ? '+' : ''}{(goal.scenario_growth_rate * 100).toFixed(0)}%/yr)
                          </span>
                        </div>
                        {recalc && (
                          <div className={`px-3 py-1 rounded-full text-xs font-bold ${recalc.current.is_on_track ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-orange-500/20 text-orange-600 dark:text-orange-400'}`}>
                            {recalc.current.is_on_track ? '✅ On Track' : '⚠️ Behind'}
                          </div>
                        )}
                      </div>
                      
                      {/* 2-Column Grid: Original Plan | Current Status */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {/* ORIGINAL PLAN Section */}
                        <div className="border border-btc-border-primary rounded-lg p-3 bg-btc-bg-primary">
                        <div className="text-xs font-semibold text-btc-text-secondary uppercase mb-2">
                          Original Plan ({new Date(goal.created_at).toLocaleDateString()})
                        </div>
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <ThemedText variant="secondary">Target:</ThemedText>
                            <ThemedText variant="primary" className="font-semibold">
                              {goal.target_btc_amount.toFixed(8)} BTC
                            </ThemedText>
                          </div>
                          <div className="flex justify-between">
                            <ThemedText variant="secondary">Target Date:</ThemedText>
                            <ThemedText variant="primary">
                              {new Date(goal.target_date).toLocaleDateString()}
                            </ThemedText>
                          </div>
                          <div className="flex justify-between">
                            <ThemedText variant="secondary">Monthly:</ThemedText>
                            <ThemedText variant="primary" className="font-semibold">
                              {goal.currency === 'EUR' ? '€' : '$'}{goal.monthly_fiat_needed.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </ThemedText>
                          </div>
                          <div className="flex justify-between">
                            <ThemedText variant="secondary">Total Cost:</ThemedText>
                            <ThemedText variant="primary">
                              {goal.currency === 'EUR' ? '€' : '$'}{goal.total_fiat_needed.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </ThemedText>
                          </div>
                          <div className="flex justify-between">
                            <ThemedText variant="secondary">Duration:</ThemedText>
                            <ThemedText variant="primary">
                              {goal.total_months} months
                              {goal.total_months >= 12 && ` (${(goal.total_months / 12).toFixed(1)} yrs)`}
                            </ThemedText>
                          </div>
                          <div className="flex justify-between pt-1.5 border-t border-btc-border-primary">
                            <ThemedText variant="secondary" className="text-xs">BTC Price:</ThemedText>
                            <ThemedText variant="primary" className="text-xs">
                              {goal.currency === 'EUR' ? '€' : '$'}{goal.initial_btc_price.toLocaleString(undefined, { maximumFractionDigits: 0 })} → {goal.currency === 'EUR' ? '€' : '$'}{goal.final_btc_price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </ThemedText>
                          </div>
                        </div>
                      </div>
                      
                        {/* CURRENT STATUS Section (auto-loaded) */}
                        {recalc && (
                          <div className={`border-2 rounded-lg p-3 ${
                            recalc.current.is_on_track 
                              ? 'border-green-500/50 bg-green-500/5' 
                              : 'border-orange-500/50 bg-orange-500/5'
                          }`}>
                            <div className="text-xs font-semibold text-btc-text-secondary uppercase mb-2">
                              Current Status
                            </div>
                            
                            {/* Progress Bar */}
                            <div className="mb-3">
                              <div className="flex justify-between text-xs mb-1">
                                <ThemedText variant="secondary">Progress:</ThemedText>
                                <ThemedText variant="primary" className="font-semibold">
                                  {recalc.current.progress_percent.toFixed(1)}%
                                </ThemedText>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full transition-all ${
                                    recalc.current.is_on_track ? 'bg-green-500' : 'bg-orange-500'
                                  }`}
                                  style={{ width: `${Math.min(recalc.current.progress_percent, 100)}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-xs mt-1">
                                <ThemedText variant="muted">
                                  {recalc.current.current_holdings.toFixed(8)} BTC
                                </ThemedText>
                                <ThemedText variant="muted">
                                  {goal.target_btc_amount.toFixed(8)} BTC
                                </ThemedText>
                              </div>
                            </div>
                            
                            {/* Current Stats */}
                            <div className="space-y-1.5 text-sm">
                              <div className="flex justify-between">
                                <ThemedText variant="secondary">BTC Price Now:</ThemedText>
                                <ThemedText variant="primary" className="font-semibold">
                                  {formatCurrency(recalc.current.btc_price, selectedCurrency)}
                                  <span className={`ml-1 text-xs ${recalc.current.price_change_percent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    ({recalc.current.price_change_percent >= 0 ? '+' : ''}{recalc.current.price_change_percent.toFixed(1)}%)
                                  </span>
                                </ThemedText>
                              </div>
                              <div className="flex justify-between">
                                <ThemedText variant="secondary">Monthly Needed:</ThemedText>
                                <ThemedText variant="primary" className="font-semibold">
                                  {formatCurrency(recalc.projection.monthly_fiat_needed, selectedCurrency)}
                                  {recalc.projection.monthly_change_percent !== 0 && (
                                    <span className={`ml-1 text-xs ${recalc.projection.monthly_change_percent >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                      ({recalc.projection.monthly_change_percent >= 0 ? '+' : ''}{recalc.projection.monthly_change_percent.toFixed(0)}%)
                                    </span>
                                  )}
                                </ThemedText>
                              </div>
                              <div className="flex justify-between">
                                <ThemedText variant="secondary">Still Needed:</ThemedText>
                                <ThemedText variant="primary">
                                  {recalc.current.btc_still_needed.toFixed(8)} BTC
                                </ThemedText>
                              </div>
                              <div className="flex justify-between">
                                <ThemedText variant="secondary">Time Remaining:</ThemedText>
                                <ThemedText variant="primary">
                                  {recalc.current.remaining_months} months
                                  {recalc.current.remaining_months >= 12 && (
                                    <span className="text-xs text-btc-text-secondary ml-1">
                                      ({(recalc.current.remaining_months / 12).toFixed(1)} yrs)
                                    </span>
                                  )}
                                </ThemedText>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Completed Badge */}
                      {goal.is_completed && (
                        <div className="mt-3 p-2 bg-green-500/10 border border-green-500/20 rounded text-green-600 dark:text-green-400 text-sm text-center">
                          ✅ Completed on {new Date(goal.completed_at!).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </ThemedCard>
                );
              })}
            </div>
          )}
        </section>

        {/* DCA Calculator Section */}
        <section>
          <h2 className="text-lg font-semibold text-btc-text-primary mb-4">
            DCA Calculator
          </h2>
          <ThemedCard>
            <div className="space-y-4">
              <ThemedText variant="secondary" className="text-sm">
                Calculate how much you need to invest regularly to reach your Bitcoin goal
              </ThemedText>
              
              {/* Current BTC Price Display */}
              {currentBtcPrice > 0 && (
                <div className="mb-4 p-3 bg-bitcoin/10 border border-bitcoin/20 rounded-lg">
                  <ThemedText variant="secondary" className="text-sm">
                    Current BTC Price: <span className="font-semibold text-bitcoin">{formatCurrency(currentBtcPrice, selectedCurrency)}</span>
                  </ThemedText>
                </div>
              )}

              {/* Price Scenario Selector */}
              {availableScenarios.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-btc-text-primary mb-3">
                    Price Scenario
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                    {availableScenarios.map((scenario) => (
                      <button
                        key={scenario.id}
                        onClick={() => setSelectedScenarioId(scenario.id)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          selectedScenarioId === scenario.id
                            ? 'border-bitcoin bg-bitcoin/10 shadow-md'
                            : 'border-btc-border-primary bg-btc-bg-secondary hover:border-bitcoin/50'
                        }`}
                      >
                        <div className="text-2xl mb-1">{scenario.icon}</div>
                        <div className={`text-xs font-semibold ${scenario.color}`}>
                          {scenario.name}
                        </div>
                        <div className="text-xs text-btc-text-secondary mt-1">
                          {scenario.id === 'custom' ? 'Custom' : 
                            `${scenario.annualGrowthRate >= 0 ? '+' : ''}${(scenario.annualGrowthRate * 100).toFixed(0)}%/yr`
                          }
                        </div>
                      </button>
                    ))}
                  </div>
                  
                  {/* Custom Growth Rate Input */}
                  {selectedScenarioId === 'custom' && (
                    <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg">
                      <label className="block text-sm font-medium text-btc-text-primary mb-2">
                        Custom Annual Growth Rate
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          value={customGrowthRate}
                          onChange={(e) => setCustomGrowthRate(e.target.value)}
                          placeholder="20"
                          step="5"
                          min="-100"
                          max="500"
                          className="w-32 px-3 py-2 bg-btc-bg-secondary border border-btc-border-primary rounded-lg text-btc-text-primary focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                        <span className="text-sm text-btc-text-primary font-medium">% per year</span>
                      </div>
                      <ThemedText variant="muted" className="text-xs mt-2">
                        Enter your own growth rate estimate. Positive values for growth, negative for decline.
                      </ThemedText>
                    </div>
                  )}
                  
                  <ThemedText variant="muted" className="text-xs mt-2">
                    {availableScenarios.find(s => s.id === selectedScenarioId)?.description}
                    {selectedScenarioId === 'custom' && ` (${parseFloat(customGrowthRate) >= 0 ? '+' : ''}${customGrowthRate}%/yr)`}
                  </ThemedText>
                </div>
              )}

              {/* Calculator Form with Sliders */}
              <div className="space-y-6 mt-6">
                {/* Goal Name */}
                <div>
                  <label className="block text-sm font-medium text-btc-text-primary mb-2">
                    Goal Name
                  </label>
                  <input
                    type="text"
                    value={goalName}
                    onChange={(e) => setGoalName(e.target.value)}
                    placeholder="Bitcoin Savings Goal"
                    className="w-full px-3 py-2 bg-btc-bg-secondary border border-btc-border-primary rounded-lg text-btc-text-primary focus:ring-2 focus:ring-bitcoin focus:border-bitcoin"
                  />
                </div>
                
                {/* Target BTC Amount - Slider + Input */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-btc-text-primary">
                      Target BTC Amount *
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      max="21"
                      step="0.01"
                      value={targetBtc}
                      onChange={(e) => setTargetBtc(parseFloat(e.target.value) || 0.01)}
                      className="w-24 px-2 py-1 text-right font-bold text-bitcoin bg-btc-bg-secondary border border-btc-border-primary rounded focus:ring-2 focus:ring-bitcoin focus:border-bitcoin"
                    />
                  </div>
                  <input
                    type="range"
                    min="0.01"
                    max="10"
                    step="0.01"
                    value={Math.min(targetBtc, 10)}
                    onChange={(e) => setTargetBtc(parseFloat(e.target.value))}
                    className="w-full h-2 bg-btc-bg-secondary rounded-lg appearance-none cursor-pointer accent-bitcoin"
                  />
                  <div className="flex justify-between text-xs text-btc-text-secondary mt-1">
                    <span>0.01 ₿</span>
                    <span>10 ₿</span>
                  </div>
                </div>

                {/* Timeframe - Slider + Input */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-btc-text-primary">
                      Timeframe *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      step="1"
                      value={timeframeYears}
                      onChange={(e) => setTimeframeYears(parseInt(e.target.value) || 1)}
                      className="w-24 px-2 py-1 text-right font-bold text-bitcoin bg-btc-bg-secondary border border-btc-border-primary rounded focus:ring-2 focus:ring-bitcoin focus:border-bitcoin"
                    />
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="1"
                    value={Math.min(timeframeYears, 20)}
                    onChange={(e) => setTimeframeYears(parseInt(e.target.value))}
                    className="w-full h-2 bg-btc-bg-secondary rounded-lg appearance-none cursor-pointer accent-bitcoin"
                  />
                  <div className="flex justify-between text-xs text-btc-text-secondary mt-1">
                    <span>1 year</span>
                    <span>20 years</span>
                  </div>
                </div>

                {/* Current Holdings - Input */}
                <div>
                  <label className="block text-sm font-medium text-btc-text-primary mb-2">
                    Current Holdings (BTC)
                  </label>
                  <input
                    type="number"
                    value={currentHoldings}
                    onChange={(e) => setCurrentHoldings(e.target.value)}
                    placeholder="0.0"
                    step="0.001"
                    className="w-full px-3 py-2 bg-btc-bg-secondary border border-btc-border-primary rounded-lg text-btc-text-primary focus:ring-2 focus:ring-bitcoin focus:border-bitcoin"
                  />
                  <ThemedText variant="muted" className="text-xs mt-1">
                    {portfolioBtc > 0 ? '✓ Auto-loaded from your portfolio' : 'Your current BTC balance'}
                  </ThemedText>
                </div>

                {/* Monthly Budget - Slider + Input */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-btc-text-primary">
                      Monthly Budget (Optional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100000"
                      step="50"
                      value={monthlyBudget}
                      onChange={(e) => setMonthlyBudget(parseInt(e.target.value) || 0)}
                      className="w-28 px-2 py-1 text-right font-bold text-bitcoin bg-btc-bg-secondary border border-btc-border-primary rounded focus:ring-2 focus:ring-bitcoin focus:border-bitcoin"
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="5000"
                    step="50"
                    value={Math.min(monthlyBudget, 5000)}
                    onChange={(e) => setMonthlyBudget(parseInt(e.target.value))}
                    className="w-full h-2 bg-btc-bg-secondary rounded-lg appearance-none cursor-pointer accent-bitcoin"
                  />
                  <div className="flex justify-between text-xs text-btc-text-secondary mt-1">
                    <span>{formatCurrency(0, selectedCurrency)}</span>
                    <span>{formatCurrency(5000, selectedCurrency)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <ThemedButton
                  variant="primary"
                  onClick={calculateDCAStrategy}
                  disabled={calculating || !targetBtc || targetBtc <= 0 || timeframeYears <= 0}
                  className="bg-bitcoin hover:bg-bitcoin-dark disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {calculating ? 'Calculating...' : 'Calculate Strategy'}
                </ThemedButton>
              </div>

              {/* Results Display */}
              {calculation && (
                <div className={`mt-6 p-6 rounded-lg border ${
                  calculation.isFeasible 
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                    : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                }`}>
                  <div className="space-y-4">
                    {/* Message */}
                    <div className="text-center pb-4 border-b border-current border-opacity-20">
                      <ThemedText className="text-base font-medium">
                        {calculation.message}
                      </ThemedText>
                    </div>

                    {/* Results Grid */}
                    {calculation.isFeasible && calculation.monthlyBtcNeeded > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                          <ThemedText variant="secondary" className="text-xs mb-1">
                            Monthly BTC Purchase
                          </ThemedText>
                          <div className="text-2xl font-bold text-bitcoin">
                            {calculation.monthlyBtcNeeded.toFixed(8)} ₿
                          </div>
                          <ThemedText variant="muted" className="text-xs mt-1">
                            {(calculation.monthlyBtcNeeded * 100000000).toLocaleString()} sats
                          </ThemedText>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                          <ThemedText variant="secondary" className="text-xs mb-1">
                            Monthly Investment
                          </ThemedText>
                          <div className="text-2xl font-bold text-bitcoin">
                            {formatCurrency(calculation.monthlyFiatNeeded, selectedCurrency)}
                          </div>
                          <ThemedText variant="muted" className="text-xs mt-1">
                            At current price
                          </ThemedText>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                          <ThemedText variant="secondary" className="text-xs mb-1">
                            Duration
                          </ThemedText>
                          <div className="text-2xl font-bold text-btc-text-primary">
                            {calculation.totalMonths} months
                          </div>
                          <ThemedText variant="muted" className="text-xs mt-1">
                            {(calculation.totalMonths / 12).toFixed(1)} years
                          </ThemedText>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                          <ThemedText variant="secondary" className="text-xs mb-1">
                            Completion Date
                          </ThemedText>
                          <div className="text-xl font-bold text-btc-text-primary">
                            {calculation.projectedCompletionDate}
                          </div>
                          <ThemedText variant="muted" className="text-xs mt-1">
                            Projected target
                          </ThemedText>
                        </div>
                      </div>
                    )}

                    {/* Scenario Comparison Table */}
                    {calculation.allScenarios && calculation.allScenarios.length > 0 && (
                      <div className="mt-6">
                        <h3 className="text-sm font-semibold text-btc-text-primary mb-3">
                          Compare All Scenarios
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-btc-border-primary">
                                <th className="text-left py-2 px-2 text-btc-text-secondary font-medium">Scenario</th>
                                <th className="text-right py-2 px-2 text-btc-text-secondary font-medium">Avg Monthly</th>
                                <th className="text-right py-2 px-2 text-btc-text-secondary font-medium">Total Cost</th>
                                <th className="text-right py-2 px-2 text-btc-text-secondary font-medium">Final BTC Price</th>
                              </tr>
                            </thead>
                            <tbody>
                              {calculation.allScenarios.map((scenCalc) => (
                                <tr 
                                  key={scenCalc.scenario.id}
                                  className={`border-b border-btc-border-primary/50 ${
                                    scenCalc.scenario.id === selectedScenarioId ? 'bg-bitcoin/5' : ''
                                  }`}
                                >
                                  <td className="py-3 px-2">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-lg">{scenCalc.scenario.icon}</span>
                                      <div>
                                        <div className={`font-medium ${scenCalc.scenario.color}`}>
                                          {scenCalc.scenario.name}
                                        </div>
                                        <div className="text-xs text-btc-text-secondary">
                                          {scenCalc.scenario.annualGrowthRate >= 0 ? '+' : ''}
                                          {(scenCalc.scenario.annualGrowthRate * 100).toFixed(0)}%/yr
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="text-right py-3 px-2 font-semibold text-btc-text-primary">
                                    {formatCurrency(scenCalc.averageMonthlyFiat, selectedCurrency)}
                                  </td>
                                  <td className="text-right py-3 px-2 font-semibold text-btc-text-primary">
                                    {formatCurrency(scenCalc.totalFiatNeeded, selectedCurrency)}
                                  </td>
                                  <td className="text-right py-3 px-2 text-btc-text-secondary">
                                    {formatCurrency(scenCalc.finalProjectedPrice, selectedCurrency)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <ThemedText variant="muted" className="text-xs mt-2">
                          💡 Tip: Different scenarios show how BTC price changes affect your investment needs
                        </ThemedText>
                      </div>
                    )}

                    {/* Action Button */}
                    {calculation.isFeasible && calculation.monthlyBtcNeeded > 0 && (
                      <div className="text-center pt-4">
                        <ThemedButton
                          variant="primary"
                          className="bg-bitcoin hover:bg-bitcoin-dark"
                          onClick={saveGoalToDatabase}
                          disabled={savingGoal}
                        >
                          {savingGoal ? 'Saving...' : 'Save as Goal'}
                        </ThemedButton>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </ThemedCard>
        </section>

        {/* DCA Performance Analysis Section */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-btc-text-primary">
              DCA Performance Analysis
            </h2>
            <ThemedButton
              variant="secondary"
              onClick={loadDCAAnalysis}
              disabled={dcaLoading}
            >
              {dcaLoading ? 'Analyzing...' : 'Refresh Analysis'}
            </ThemedButton>
          </div>

          {dcaLoading && !dcaAnalysis && (
            <ThemedCard>
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bitcoin mx-auto mb-4"></div>
                <ThemedText variant="muted">Analyzing your DCA strategy...</ThemedText>
              </div>
            </ThemedCard>
          )}

          {dcaError && !dcaAnalysis && (
            <ThemedCard>
              <div className="text-center py-8">
                <ThemedText className="text-red-500">{dcaError}</ThemedText>
              </div>
            </ThemedCard>
          )}

          {dcaAnalysis && dcaAnalysis.score && (
            <div className="space-y-6">
              {/* 4-Column Metrics: Overall Score + 3 Components */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Overall DCA Score */}
                <ThemedCard>
                  <h3 className="font-semibold text-btc-text-primary mb-4 flex items-center">
                    <span className="mr-2">📊</span>
                    Overall Score
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <ThemedText variant="muted" className="text-xs mb-1">DCA Quality</ThemedText>
                      <div className="text-2xl font-bold text-bitcoin">
                        {(dcaAnalysis.score.overall || 0).toFixed(1)}/10
                      </div>
                    </div>
                    <div className="pt-3 border-t border-btc-border-primary">
                      <ThemedText variant="muted" className="text-xs">
                        {(dcaAnalysis.score.overall || 0) >= 8 ? 'Excellent Strategy!' :
                         (dcaAnalysis.score.overall || 0) >= 6 ? 'Good Performance' :
                         (dcaAnalysis.score.overall || 0) >= 4 ? 'Room to Improve' :
                         'Adjust Strategy'}
                      </ThemedText>
                    </div>
                  </div>
                </ThemedCard>

                {/* Timing Analysis */}
                {dcaAnalysis.timing && (
                  <ThemedCard>
                    <h3 className="font-semibold text-btc-text-primary mb-4 flex items-center">
                      <span className="mr-2">⏰</span>
                      Timing
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <ThemedText variant="muted" className="text-xs mb-1">Score</ThemedText>
                        <div className="text-2xl font-bold text-bitcoin">
                          {(dcaAnalysis.score.timing || 0).toFixed(1)}/10
                        </div>
                      </div>
                      <div className="pt-3 border-t border-btc-border-primary">
                        <div className="flex justify-between mb-1">
                          <ThemedText variant="muted" className="text-xs">Bought Dips</ThemedText>
                          <ThemedText className="text-sm font-medium text-green-600">
                            {(dcaAnalysis.timing.btcBoughtBelowCurrent || 0).toFixed(0)}%
                          </ThemedText>
                        </div>
                        <div className="flex justify-between">
                          <ThemedText variant="muted" className="text-xs">Bought Pumps</ThemedText>
                          <ThemedText className="text-sm font-medium text-orange-600">
                            {(dcaAnalysis.timing.btcBoughtAboveCurrent || 0).toFixed(0)}%
                          </ThemedText>
                        </div>
                      </div>
                    </div>
                  </ThemedCard>
                )}

                {/* Consistency Analysis */}
                {dcaAnalysis.consistency && (
                  <ThemedCard>
                    <h3 className="font-semibold text-btc-text-primary mb-4 flex items-center">
                      <span className="mr-2">🎯</span>
                      Consistency
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <ThemedText variant="muted" className="text-xs mb-1">Score</ThemedText>
                        <div className="text-2xl font-bold text-bitcoin">
                          {(dcaAnalysis.score.consistency || 0).toFixed(1)}/10
                        </div>
                      </div>
                      <div className="pt-3 border-t border-btc-border-primary">
                        <div className="flex justify-between mb-1">
                          <ThemedText variant="muted" className="text-xs">Total Purchases</ThemedText>
                          <ThemedText className="text-sm font-medium">
                            {dcaAnalysis.consistency.totalPurchases || 0}
                          </ThemedText>
                        </div>
                        <div className="flex justify-between">
                          <ThemedText variant="muted" className="text-xs">Consistency</ThemedText>
                          <ThemedText className="text-sm font-medium">
                            {(dcaAnalysis.consistency.consistency || 0).toFixed(0)}%
                          </ThemedText>
                        </div>
                      </div>
                    </div>
                  </ThemedCard>
                )}

                {/* Performance Analysis */}
                {dcaAnalysis.summary && (
                  <ThemedCard>
                    <h3 className="font-semibold text-btc-text-primary mb-4 flex items-center">
                      <span className="mr-2">📈</span>
                      Performance
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <ThemedText variant="muted" className="text-xs mb-1">Score</ThemedText>
                        <div className="text-2xl font-bold text-bitcoin">
                          {(dcaAnalysis.score.performance || 0).toFixed(1)}/10
                        </div>
                      </div>
                      <div className="pt-3 border-t border-btc-border-primary">
                        <div className="flex justify-between mb-1">
                          <ThemedText variant="muted" className="text-xs">Unrealized P&L</ThemedText>
                          <ThemedText className={`text-sm font-medium ${(dcaAnalysis.summary.totalPnL || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {(dcaAnalysis.summary.totalPnL || 0) >= 0 ? '+' : ''}
                            {(dcaAnalysis.summary.totalPnLPercent || 0).toFixed(1)}%
                          </ThemedText>
                        </div>
                        <div className="flex justify-between">
                          <ThemedText variant="muted" className="text-xs">Avg Buy Price</ThemedText>
                          <ThemedText className="text-sm font-medium">
                            {formatCurrency(dcaAnalysis.summary.avgBuyPrice || 0, selectedCurrency)}
                          </ThemedText>
                        </div>
                      </div>
                    </div>
                  </ThemedCard>
                )}
              </div>

              {/* What-If Scenarios + Price Distribution Grid */}
              {(dcaAnalysis.whatIfScenarios?.length > 0 || dcaAnalysis.priceDistribution?.length > 0) && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {/* What-If Scenarios Comparison */}
                  {dcaAnalysis.whatIfScenarios && dcaAnalysis.whatIfScenarios.length > 0 && (
                    <ThemedCard>
                      <h3 className="font-semibold text-btc-text-primary mb-3 flex items-center text-sm">
                        <span className="mr-2">🔮</span>
                        What-If Scenarios
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-btc-border-primary">
                              <th className="text-left py-2 px-1 font-semibold text-btc-text-primary">Strategy</th>
                              <th className="text-right py-2 px-1 font-semibold text-btc-text-primary">BTC</th>
                              <th className="text-right py-2 px-1 font-semibold text-btc-text-primary">P&L</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dcaAnalysis.whatIfScenarios.map((scenario, index) => (
                              <tr 
                                key={index}
                                className={`border-b border-btc-border-primary ${index === 0 ? 'bg-bitcoin/5' : ''}`}
                              >
                                <td className="py-2 px-1">
                                  <div className="font-medium text-btc-text-primary text-xs">{scenario.name}</div>
                                </td>
                                <td className="text-right py-2 px-1 text-btc-text-secondary text-xs">
                                  {scenario.btcHoldings.toFixed(4)} ₿
                                </td>
                                <td className={`text-right py-2 px-1 font-medium text-xs ${scenario.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {scenario.pnl >= 0 ? '+' : ''}{formatCurrency(Math.abs(scenario.pnl), selectedCurrency)}
                                  <span className="block text-[10px] text-btc-text-secondary">
                                    ({scenario.pnlPercentage.toFixed(1)}%)
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </ThemedCard>
                  )}

                  {/* Price Distribution */}
                  {dcaAnalysis.priceDistribution && dcaAnalysis.priceDistribution.length > 0 && (
                    <ThemedCard>
                      <h3 className="font-semibold text-btc-text-primary mb-3 flex items-center text-sm">
                        <span className="mr-2">📊</span>
                        Purchase Distribution
                      </h3>
                      <div className="space-y-2">
                        {dcaAnalysis.priceDistribution.map((range, index) => (
                          <div key={index} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <ThemedText variant="muted">
                                {range.range}
                              </ThemedText>
                              <ThemedText className="font-medium">
                                {range.transactions} tx • {range.percentage.toFixed(1)}%
                              </ThemedText>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div 
                                className="bg-bitcoin h-2 rounded-full transition-all"
                                style={{ width: `${range.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ThemedCard>
                  )}
                </div>
              )}

            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}

