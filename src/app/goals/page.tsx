'use client';

import React, { useState, useEffect } from 'react';
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
import { SegmentedControl } from '@/components/ui/segmented-control';
import { WidgetEmptyState } from '@/components/ui/widget-card';
import { toast } from '@/hooks/use-toast';
import { confirm } from '@/components/ui/confirm-dialog';

// Planning
import GoalCard, { Goal, GoalRecalculation } from '@/components/planning/GoalCard';
import DCAAnalysisPanel, { DCAAnalysisResult } from '@/components/planning/DCAAnalysisPanel';
import { ScenarioIcon, btc, pct, sentenceCase } from '@/components/planning/planning-icons';

// Icons
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  RefreshCwIcon,
  TargetIcon,
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

type DCAFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

const FREQUENCY_OPTIONS: { label: string; value: DCAFrequency }[] = [
  { label: 'Monthly', value: 'monthly' },
  { label: 'Every 2 weeks', value: 'biweekly' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Daily', value: 'daily' },
];

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
  const [goalName, setGoalName] = useState<string>('Bitcoin savings goal');
  
  const [availableScenarios, setAvailableScenarios] = useState<PriceScenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('stable');
  const [customGrowthRate, setCustomGrowthRate] = useState<string>('20');
  
  const [dcaFrequency, setDcaFrequency] = useState<DCAFrequency>('monthly');
  
  const [calculation, setCalculation] = useState<DCACalculation | null>(null);
  const [calculating, setCalculating] = useState(false);
  
  const [goalRecalculations, setGoalRecalculations] = useState<Map<number, GoalRecalculation>>(new Map());
  const [recalculatingGoalId, setRecalculatingGoalId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>('goals');

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
        const mainCurrency = result.data.mainCurrency || 'USD';
        const displayCurrency = result.data.secondaryCurrency || mainCurrency;
        setSelectedCurrency(displayCurrency);

        let btcPrice = result.data.currentBtcPrice;
        if (mainCurrency !== displayCurrency) {
          try {
            const ratesRes = await fetch('/api/exchange-rates');
            const ratesData = await ratesRes.json();
            if (ratesData.rates && Array.isArray(ratesData.rates)) {
              const direct = ratesData.rates.find(
                (r: any) => r.from_currency === mainCurrency && r.to_currency === displayCurrency
              );
              if (direct) {
                btcPrice = btcPrice * direct.rate;
              } else {
                const reverse = ratesData.rates.find(
                  (r: any) => r.from_currency === displayCurrency && r.to_currency === mainCurrency
                );
                if (reverse) btcPrice = btcPrice / reverse.rate;
              }
            }
          } catch { /* keep original price */ }
        }
        setCurrentBtcPrice(btcPrice);
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
      toast({ title: 'Calculate a plan first', description: 'Press Calculate monthly amount, then save it as a goal.' });
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
        toast({ title: 'Goal saved', variant: 'success' });
        await loadGoals();
        setActiveTab('goals');
        setTargetBtc(1.0);
        setTimeframeYears(5);
        setTargetDate('');
        setCurrentHoldings('');
        setMonthlyBudget(500);
        setCalculation(null);
        setGoalName('Bitcoin savings goal');
        setSelectedScenarioId('stable');
      } else {
        toast({ title: 'Failed to save goal', description: result.error, variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error saving goal:', error);
      toast({ title: 'Failed to save goal', variant: 'destructive' });
    } finally {
      setSavingGoal(false);
    }
  };
  
  const deleteGoal = async (goalId: number) => {
    if (!(await confirm({ title: 'Delete goal?', description: 'Are you sure you want to delete this goal?', confirmText: 'Delete', destructive: true }))) return;

    try {
      const response = await fetch(`/api/goals/${goalId}`, { method: 'DELETE' });
      const result = await response.json();

      if (result.success) {
        await loadGoals();
      } else {
        toast({ title: 'Failed to delete goal', description: result.error, variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error deleting goal:', error);
      toast({ title: 'Failed to delete goal', variant: 'destructive' });
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
          toast({ title: result.data.message });
        } else {
          setGoalRecalculations(prev => {
            const newMap = new Map(prev);
            newMap.set(goalId, { goalId, ...result.data });
            return newMap;
          });
        }
      } else {
        toast({ title: 'Failed to recalculate goal', description: result.error, variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error recalculating goal:', error);
      toast({ title: 'Failed to recalculate goal', variant: 'destructive' });
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
          message: 'You already hold enough bitcoin for this goal.'
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
          message = 'Your budget covers this comfortably. You could even get there sooner.';
        } else if (monthlyBudget) {
          message = 'Your monthly budget covers this goal.';
        } else {
          message = `You'll need about ${formatCurrency(monthlyFiatNeeded, currency)} a month in the ${sentenceCase(selected_scenario.scenario.name).toLowerCase()} scenario.`;
        }
      } else {
        const shortfall = monthlyFiatNeeded - monthlyBudget;
        message = `Your budget is ${formatCurrency(shortfall, currency)} a month short. Give yourself more time or raise the budget.`;
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
      <div className="flex h-96 items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading planning" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="space-y-0.5 px-1">
        <h1 className="text-lg font-bold tracking-tight">Planning</h1>
        <p className="text-sm text-muted-foreground">Set savings goals, automate purchases and see how your buying is going.</p>
      </div>

      <TabNavigation
        aria-label="Planning sections"
        tabs={[
          { id: 'goals', label: 'My goals', badge: goals.length, content: renderGoalsTab() },
          { id: 'calculator', label: 'DCA calculator', content: renderCalculatorTab() },
          { id: 'auto-dca', label: 'Auto DCA', content: <AutoDCATab /> },
          { id: 'backtest', label: 'Backtest', content: <DCABacktestSimulator defaultCurrency={selectedCurrency} /> },
          {
            id: 'analysis',
            label: 'Analysis',
            content: (
              <DCAAnalysisPanel
                analysis={dcaAnalysis}
                loading={dcaLoading}
                error={dcaError}
                currency={selectedCurrency}
                onRefresh={loadDCAAnalysis}
              />
            ),
          },
        ]}
        activeTabId={activeTab}
        onTabChange={setActiveTab}
      />
    </div>
  );

  // ============================================================
  // TAB CONTENT RENDERERS
  // ============================================================

  function renderGoalsTab() {
    if (goals.length === 0) {
      return (
        <Card className="rounded-2xl">
          <CardContent className="py-12">
            <WidgetEmptyState
              icon={TargetIcon}
              title="No goals yet"
              description="Work out how much to buy each month in the DCA calculator, then save it as a goal to follow your progress here."
              action={
                <Button size="sm" className="rounded-full font-bold" onClick={() => setActiveTab('calculator')}>
                  Open the DCA calculator
                </Button>
              }
            />
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {goals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            recalc={goalRecalculations.get(goal.id)}
            currency={selectedCurrency}
            recalculating={recalculatingGoalId === goal.id}
            onRecalculate={() => recalculateGoal(goal.id)}
            onDelete={() => deleteGoal(goal.id)}
          />
        ))}
      </div>
    );
  }

  function renderCalculatorTab() {
    const selectedScenario = availableScenarios.find((s) => s.id === selectedScenarioId);
    const rateLabel = (scenario: PriceScenario) =>
      scenario.id === 'custom' ? 'Your rate' : `${pct(scenario.annualGrowthRate * 100, 0)} a year`;
    const rangeClass = 'h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary';
    const valueInputClass = 'h-9 w-28 rounded-full text-right font-bold tabular-nums';

    return (
      <div className="space-y-4">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-[17px] font-bold tracking-tight">DCA calculator</CardTitle>
            <CardDescription className="text-[13px]">
              Work out how much to buy regularly to reach a bitcoin goal by a date.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {currentBtcPrice > 0 && (
              <div className="flex items-baseline justify-between gap-3 rounded-2xl bg-secondary px-4 py-3">
                <span className="text-[13px] font-semibold text-muted-foreground">Bitcoin price now</span>
                <span className="text-lg font-extrabold tabular-nums">{formatCurrency(currentBtcPrice, selectedCurrency)}</span>
              </div>
            )}

            {/* Scenario selector */}
            {availableScenarios.length > 0 && (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-bold">How the price might move</Label>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    Pick a scenario for the bitcoin price over your timeframe.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {availableScenarios.map((scenario) => {
                    const selected = selectedScenarioId === scenario.id;
                    return (
                      <button
                        key={scenario.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSelectedScenarioId(scenario.id)}
                        className={cn(
                          'flex min-h-[88px] flex-col items-start gap-2 rounded-2xl p-3 text-left transition-[transform,background-color] hover:-translate-y-0.5 active:translate-y-0',
                          selected ? 'bg-tint-orange text-primary-strong ring-2 ring-primary' : 'bg-secondary hover:bg-secondary/70'
                        )}
                      >
                        <ScenarioIcon
                          id={scenario.id}
                          icon={scenario.icon}
                          className={cn('size-5', selected ? 'text-primary-strong' : 'text-muted-foreground')}
                        />
                        <span className="text-[13px] font-bold leading-tight">{sentenceCase(scenario.name)}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{rateLabel(scenario)}</span>
                      </button>
                    );
                  })}
                </div>

                {selectedScenarioId === 'custom' && (
                  <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-secondary p-4">
                    <Label htmlFor="customGrowthRate" className="text-sm font-semibold">Yearly price change</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="customGrowthRate"
                        type="number"
                        value={customGrowthRate}
                        onChange={(e) => setCustomGrowthRate(e.target.value)}
                        placeholder="20"
                        className="h-9 w-24 rounded-full bg-card text-right font-bold tabular-nums"
                      />
                      <span className="text-sm text-muted-foreground">% a year</span>
                    </div>
                  </div>
                )}

                {selectedScenario && (
                  <p className="text-[13px] text-muted-foreground">
                    {selectedScenario.description}. {selectedScenario.basis}.
                  </p>
                )}
              </div>
            )}

            {/* Goal name + frequency */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="goalName" className="text-sm font-bold">Goal name</Label>
                <Input
                  id="goalName"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  placeholder="Bitcoin savings goal"
                />
              </div>
              <div className="space-y-2">
                <span className="block text-sm font-bold">How often you buy</span>
                <SegmentedControl<DCAFrequency>
                  aria-label="How often you buy"
                  options={FREQUENCY_OPTIONS}
                  value={dcaFrequency}
                  onChange={setDcaFrequency}
                />
              </div>
            </div>

            {/* Sliders */}
            <div className="space-y-7">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="targetBtc" className="text-sm font-bold">Target amount (BTC)</Label>
                  <Input
                    id="targetBtc"
                    type="number"
                    min="0.01"
                    max="21"
                    step="0.01"
                    value={targetBtc}
                    onChange={(e) => setTargetBtc(parseFloat(e.target.value) || 0.01)}
                    className={valueInputClass}
                  />
                </div>
                <input
                  type="range"
                  min="0.01"
                  max="10"
                  step="0.01"
                  value={Math.min(targetBtc, 10)}
                  onChange={(e) => setTargetBtc(parseFloat(e.target.value))}
                  className={rangeClass}
                  aria-label="Target amount in BTC"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0.01 BTC</span>
                  <span>10 BTC</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="timeframeYears" className="text-sm font-bold">Timeframe (years)</Label>
                  <Input
                    id="timeframeYears"
                    type="number"
                    min="1"
                    max="50"
                    value={timeframeYears}
                    onChange={(e) => setTimeframeYears(parseInt(e.target.value) || 1)}
                    className={valueInputClass}
                  />
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={Math.min(timeframeYears, 20)}
                  onChange={(e) => setTimeframeYears(parseInt(e.target.value))}
                  className={rangeClass}
                  aria-label="Timeframe in years"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1 year</span>
                  <span>20 years</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currentHoldings" className="text-sm font-bold">Bitcoin you already hold</Label>
                <Input
                  id="currentHoldings"
                  type="number"
                  value={currentHoldings}
                  onChange={(e) => setCurrentHoldings(e.target.value)}
                  placeholder="0.0"
                  step="0.001"
                />
                {portfolioBtc > 0 && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2Icon className="size-3.5 text-tint-green-fg" />
                    Filled in from your portfolio
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="monthlyBudget" className="text-sm font-bold">
                    Monthly budget <span className="font-medium text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="monthlyBudget"
                    type="number"
                    min="0"
                    max="100000"
                    value={monthlyBudget}
                    onChange={(e) => setMonthlyBudget(parseInt(e.target.value) || 0)}
                    className={cn(valueInputClass, 'w-32')}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="5000"
                  step="50"
                  value={Math.min(monthlyBudget, 5000)}
                  onChange={(e) => setMonthlyBudget(parseInt(e.target.value))}
                  className={rangeClass}
                  aria-label="Monthly budget"
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
              className="h-11 w-full rounded-full font-bold"
            >
              {calculating ? (
                <><RefreshCwIcon className="size-4 animate-spin" /> Calculating...</>
              ) : (
                'Calculate monthly amount'
              )}
            </Button>
          </CardContent>
        </Card>

        {calculation && renderCalculationResult(calculation)}
      </div>
    );
  }

  function renderCalculationResult(result: DCACalculation) {
    const showFigures = result.isFeasible && result.monthlyBtcNeeded > 0;
    const sats = Math.round(result.monthlyBtcNeeded * 100_000_000);
    const tiles = [
      {
        label: 'Bitcoin each month',
        value: `${btc(result.monthlyBtcNeeded)} BTC`,
        note: `${sats.toLocaleString()} sats`,
        strong: true,
      },
      {
        label: 'Duration',
        value: `${result.totalMonths} months`,
        note: `${(result.totalMonths / 12).toFixed(1)} years`,
      },
      { label: 'Reach it by', value: result.projectedCompletionDate },
      ...(result.totalFiatNeeded ? [{ label: 'Total to invest', value: formatCurrency(result.totalFiatNeeded, selectedCurrency) }] : []),
    ];

    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-[17px] font-bold tracking-tight">Your plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            className={cn(
              'flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-semibold',
              result.isFeasible ? 'bg-tint-green text-tint-green-fg' : 'bg-tint-orange text-primary-strong'
            )}
          >
            {result.isFeasible ? (
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />
            ) : (
              <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
            )}
            <span>{result.message}</span>
          </div>

          {showFigures && (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-[15px] font-semibold text-muted-foreground">Invest each month</span>
                <span className="text-4xl font-extrabold leading-none tracking-tight tabular-nums">
                  {formatCurrency(result.monthlyFiatNeeded, selectedCurrency)}
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {tiles.map((tile) => (
                  <div key={tile.label} className="rounded-2xl bg-secondary p-4">
                    <dt className="text-[13px] font-semibold text-muted-foreground">{tile.label}</dt>
                    <dd className={cn('mt-1 text-lg font-extrabold tabular-nums', tile.strong && 'text-primary-strong')}>
                      {tile.value}
                    </dd>
                    {tile.note && <dd className="text-xs text-muted-foreground tabular-nums">{tile.note}</dd>}
                  </div>
                ))}
              </dl>

              {result.allScenarios && result.allScenarios.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold">Every scenario side by side</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead>
                        <tr className="text-left text-[13px] text-muted-foreground">
                          <th className="px-3 py-2 font-semibold">Scenario</th>
                          <th className="px-3 py-2 text-right font-semibold">Each month</th>
                          <th className="px-3 py-2 text-right font-semibold">Total cost</th>
                          <th className="px-3 py-2 text-right font-semibold">Price at the end</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.allScenarios.map((row) => {
                          const selected = row.scenario.id === selectedScenarioId;
                          return (
                            <tr key={row.scenario.id} className={cn(selected && 'bg-secondary')}>
                              <td className="rounded-l-2xl px-3 py-2.5">
                                <div className="flex items-center gap-2.5">
                                  <ScenarioIcon
                                    id={row.scenario.id}
                                    icon={row.scenario.icon}
                                    className="size-4 shrink-0 text-muted-foreground"
                                  />
                                  <div>
                                    <div className="font-semibold">{sentenceCase(row.scenario.name)}</div>
                                    <div className="text-xs text-muted-foreground tabular-nums">
                                      {pct(row.scenario.annualGrowthRate * 100, 0)} a year
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                                {formatCurrency(row.averageMonthlyFiat, selectedCurrency)}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums">
                                {formatCurrency(row.totalFiatNeeded, selectedCurrency)}
                              </td>
                              <td className="rounded-r-2xl px-3 py-2.5 text-right text-muted-foreground tabular-nums">
                                {formatCurrency(row.finalProjectedPrice, selectedCurrency)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <Button onClick={saveGoalToDatabase} disabled={savingGoal} className="h-11 w-full rounded-full font-bold">
                {savingGoal ? 'Saving...' : 'Save as goal'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  }
}
