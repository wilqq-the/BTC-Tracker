'use client';

import React from 'react';
import AppLayout from './AppLayout';
import DashboardGrid from './dashboard/DashboardGrid';

export default function Dashboard() {
  return (
    <AppLayout>
      <DashboardGrid />
    </AppLayout>
  );
} 