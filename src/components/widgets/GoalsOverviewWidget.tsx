'use client';

import React, { useState, useEffect } from 'react';
import { WidgetCard, WidgetEmptyState } from '@/components/ui/widget-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WidgetProps } from '@/lib/dashboard-types';
import { TargetIcon, ExternalLinkIcon, TrendingUpIcon, TrendingDownIcon, MinusIcon, ZapIcon, RocketIcon } from 'lucide-react';
import Link from 'next/link';

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
  monthly_fiat_needed: number;
  is_completed: boolean;
  created_at: string;
}

/**
 * Goals Overview Widget
 * Shows a summary of Bitcoin savings goals
 */
export default function GoalsOverviewWidget({ id, onRefresh }: WidgetProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [portfolioBtc, setPortfolioBtc] = useState<number>(0);
  const [maxGoals] = useState<number>(5);

  useEffect(() => {
    loadGoals();
    loadPortfolio();
  }, []);

  const loadGoals = async () => {
    try {
      const response = await fetch('/api/goals');
      const result = await response.json();
      
      if (result.success && result.data) {
        const activeGoals = result.data.filter((g: Goal) => !g.is_completed);
        setGoals(activeGoals);
      }
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPortfolio = async () => {
    try {
      const response = await fetch('/api/portfolio-metrics');
      const result = await response.json();
      
      if (result.success && result.data?.totalBtc !== undefined) {
        setPortfolioBtc(result.data.totalBtc);
      }
    } catch (error) {
      console.error('Error loading portfolio:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadGoals();
    await loadPortfolio();
    setRefreshing(false);
    onRefresh?.();
  };

  const calculateProgress = (goal: Goal) => {
    const progress = (portfolioBtc / goal.target_btc_amount) * 100;
    return Math.min(progress, 100);
  };

  const getScenarioIcon = (scenario: string) => {
    switch (scenario) {
      case 'bear': return TrendingDownIcon;
      case 'conservative': return TrendingDownIcon;
      case 'stable': return MinusIcon;
      case 'moderate': return TrendingUpIcon;
      case 'bull': return RocketIcon;
      default: return TargetIcon;
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 50) return 'bg-blue-500';
    return 'bg-btc-500';
  };

  const getProgressBadge = (progress: number) => {
    if (progress >= 80) return 'default';
    if (progress >= 50) return 'secondary';
    return 'outline';
  };

  return (
    <WidgetCard
      title="Savings Goals"
      icon={TargetIcon}
      badge={goals.length > 0 && <Badge variant="secondary">{goals.length} active</Badge>}
      loading={loading}
      error={null}
      onRefresh={handleRefresh}
      refreshing={refreshing}
      noPadding
      contentClassName="overflow-hidden"
      footer={
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href="/goals">
            {goals.length === 0 ? 'Create First Goal' : 'View All Goals'}
            <ExternalLinkIcon className="size-3.5 ml-2" />
          </Link>
        </Button>
      }
    >
      {goals.length === 0 ? (
        <WidgetEmptyState
          icon={TargetIcon}
          title="No active goals yet"
          description="Create your first savings goal to start tracking progress"
        />
      ) : (
        <div className="divide-y overflow-auto flex-1">
          {goals.slice(0, maxGoals).map((goal) => {
            const progress = calculateProgress(goal);
            const daysUntilTarget = Math.ceil(
              (new Date(goal.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
            const ScenarioIcon = getScenarioIcon(goal.price_scenario);

            return (
              <div key={goal.id} className="p-3 hover:bg-accent transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <ScenarioIcon className="size-4 text-muted-foreground shrink-0" />
                      <h4 className="text-sm font-medium truncate">
                        {goal.name}
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Target: {goal.target_btc_amount.toFixed(4)} ₿
                    </p>
                  </div>
                  <Badge variant={getProgressBadge(progress)}>
                    {progress.toFixed(0)}%
                  </Badge>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-muted rounded-full h-1.5 mb-2 overflow-hidden">
                  <div 
                    className={`h-1.5 rounded-full transition-all ${getProgressColor(progress)}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {goal.currency === 'EUR' ? '€' : '$'}{goal.monthly_fiat_needed.toLocaleString()}/mo
                  </span>
                  <span>
                    {daysUntilTarget > 0 ? `${daysUntilTarget}d left` : 'Overdue'}
                  </span>
                </div>
              </div>
            );
          })}
          {goals.length > maxGoals && (
            <div className="p-2 text-center">
              <Link
                href="/goals"
                className="text-xs text-btc-500 hover:text-btc-600 font-medium"
              >
                +{goals.length - maxGoals} more goals
              </Link>
            </div>
          )}
        </div>
      )}
    </WidgetCard>
  );
}
