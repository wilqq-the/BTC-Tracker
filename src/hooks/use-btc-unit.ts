'use client';

import { useCallback, useEffect, useState } from 'react';
import { BtcUnit, FormatBtcOptions, formatBtc as format, otherUnit } from '@/lib/btc-unit';

const STORAGE_KEY = 'btc-tracker-unit';
const CHANGED = 'btc:unit-changed';

function readUnit(): BtcUnit {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'sats' ? 'sats' : 'btc';
  } catch {
    return 'btc';
  }
}

/**
 * The display unit for bitcoin amounts (BTC or sats), remembered on this
 * device and shared live by every component that uses the hook.
 */
export function useBtcUnit() {
  // Start with BTC on the server and first render, then read the saved choice
  const [unit, setUnitState] = useState<BtcUnit>('btc');

  useEffect(() => {
    setUnitState(readUnit());
    const sync = () => setUnitState(readUnit());
    window.addEventListener(CHANGED, sync);
    window.addEventListener('storage', sync); // other tabs
    return () => {
      window.removeEventListener(CHANGED, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setUnit = useCallback((next: BtcUnit) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable (private mode): still switch for this page
    }
    setUnitState(next);
    window.dispatchEvent(new CustomEvent(CHANGED));
  }, []);

  const formatBtc = useCallback(
    (amount: number, options?: FormatBtcOptions) => format(amount, unit, options),
    [unit]
  );

  /** The same amount in the other unit — for a secondary line under the main figure */
  const formatBtcAlt = useCallback(
    (amount: number, options?: FormatBtcOptions) => format(amount, otherUnit(unit), options),
    [unit]
  );

  return { unit, setUnit, toggleUnit: () => setUnit(otherUnit(unit)), formatBtc, formatBtcAlt };
}
