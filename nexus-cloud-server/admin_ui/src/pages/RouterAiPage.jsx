import { useEffect, useState } from 'react';
import { adminFetch } from '../lib/adminApi';
import { useToast } from '../context/ToastContext';

export default function RouterAiPage() {
  const { push } = useToast();
  const [pool, setPool] = useState(null);
  const [funding, setFunding] = useState(null);
  const [deposit, setDeposit] = useState('');

  const load = async () => {
    const [p, f] = await Promise.all([
      adminFetch('/polza/pool-status').catch(() => null),
      adminFetch('/platform/funding').catch(() => null),
    ]);
    setPool(p);
    setFunding(f);
    if (f?.polza_org_balance_rub != null) setDeposit(String(Math.round(f.polza_org_balance_rub)));
    else if (f?.routerai_deposit_rub != null) setDeposit(String(Math.round(f.routerai_deposit_rub)));
  };

  useEffect(() => {
    load();
  }, []);

  const saveDeposit = async () => {
    try {
      await adminFetch('/platform/polza-deposit', {
        method: 'PATCH',
        body: JSON.stringify({ deposit_rub: Number(deposit) }),
      });
      push('Баланс Polza обновлён');
      load();
    } catch (e) {
      push(e.message, 'err');
    }
  };

  const verifyMaster = async () => {
    try {
      const r = await adminFetch('/polza/verify-backend');
      push(r.message || 'Мастер-ключ OK');
    } catch (e) {
      push(e.message, 'err');
    }
  };

  return (
    <>
      <h1 className="page-title">Polza.ai</h1>
      <div className="toolbar">
        <button type="button" className="btn" onClick={load}>
          Обновить
        </button>
        <button type="button" className="btn btn-primary" onClick={verifyMaster}>
          Проверить backend-ключ
        </button>
      </div>
      <div className="field" style={{ maxWidth: 280 }}>
        <label>Баланс org (₽)</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={deposit} onChange={(e) => setDeposit(e.target.value)} type="number" step="0.01" />
          <button type="button" className="btn btn-primary" onClick={saveDeposit}>
            OK
          </button>
        </div>
      </div>
      <pre className="pre-box">{JSON.stringify({ pool, funding }, null, 2)}</pre>
    </>
  );
}
