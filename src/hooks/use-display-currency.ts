import { useState, useEffect } from 'react';

/**
 * Hook to retrieve the user's display currency settings and exchange rate
 * from portfolio-metrics (single API call, no double-fetch of settings + exchange-rates).
 */
export function useDisplayCurrency() {
  const [mainCurrency, setMainCurrency] = useState('USD');
  const [secondaryCurrency, setSecondaryCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/portfolio-metrics');
        const result = await res.json();
        if (result.success && result.data) {
          const main = result.data.mainCurrency || 'USD';
          setMainCurrency(main);
          setSecondaryCurrency(result.data.secondaryCurrency || main);
          setExchangeRate(result.data.mainToSecondaryRate || 1);
        }
      } catch { /* keep defaults */ }
      finally { setLoading(false); }
    };
    load();
  }, []);

  return { mainCurrency, secondaryCurrency, exchangeRate, loading };
}
