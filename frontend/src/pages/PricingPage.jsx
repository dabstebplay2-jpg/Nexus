import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Coins, ArrowRight, Loader2 } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import TierPicker from '../components/TierPicker';
import LegalFooter from '../components/LegalFooter';
import { useAuth } from '../context/AuthContext';
import { LEGAL } from '../config/legal';
import { formatBalanceRub } from '../lib/formatBalance';

export default function PricingPage() {
  const navigate = useNavigate();
  const { authStatus, createTopup, checkTopup, usdRubRate, fetchProfile } = useAuth();
  const [topupAmount, setTopupAmount] = useState('1000');
  const [topupMessage, setTopupMessage] = useState('');
  const [topupBusy, setTopupBusy] = useState(false);
  const [pendingInvoice, setPendingInvoice] = useState('');

  const handleTopup = async (e) => {
    e.preventDefault();
    if (!authStatus.authorized) {
      setTopupMessage('Войдите в аккаунт, чтобы пополнить баланс.');
      return;
    }
    if (authStatus.profile?.needs_real_email) {
      setTopupMessage('Добавьте email в Настройках → Аккаунт перед оплатой.');
      return;
    }
    const amount = parseFloat(topupAmount);
    if (isNaN(amount) || amount <= 0) {
      setTopupMessage('Введите корректную сумму больше 0.');
      return;
    }

    setTopupBusy(true);
    setTopupMessage('');
    try {
      const data = await createTopup(amount);
      if (data.payment_url) {
        sessionStorage.setItem('nexus_pending_invoice', data.invoice_id);
        window.location.href = data.payment_url;
        return;
      }
      if (data.invoice_id) {
        setPendingInvoice(data.invoice_id);
        setTopupMessage(
          data.message ||
            (import.meta.env.VITE_BILLING_TEST_MODE === 'true'
              ? `Счёт на пополнение создан. Подтвердите оплату (тест).`
              : `Счёт создан. Оплатите его через ЮKassa.`)
        );
      }
    } catch (err) {
      setTopupMessage(err.message || 'Не удалось создать счёт на пополнение.');
    } finally {
      setTopupBusy(false);
    }
  };

  const handleConfirmTopupPay = async () => {
    if (!pendingInvoice) return;
    setTopupBusy(true);
    try {
      const data = await checkTopup(pendingInvoice);
      const q = data.pool_rub ?? (data.pool_usd * (usdRubRate || 90));
      setTopupMessage(`Успешно зачислено: ${formatBalanceRub(q)}!`);
      setPendingInvoice('');
      await fetchProfile();
    } catch (err) {
      setTopupMessage(err.message || 'Оплата ещё не подтверждена.');
    } finally {
      setTopupBusy(false);
    }
  };

  const rate = usdRubRate || 90;
  const poolUsd = topupAmount ? ((parseFloat(topupAmount) / rate) * 0.92).toFixed(2) : '0.00';
  const poolRub = topupAmount ? (parseFloat(topupAmount) * 0.92).toFixed(0) : '0';

  useEffect(() => {
    if (window.location.hash === '#topup') {
      document.getElementById('topup')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inv =
      params.get('invoice_id') || sessionStorage.getItem('nexus_pending_invoice');
    const isPaymentReturn =
      params.get('payment') === 'success' || Boolean(inv);
    if (!isPaymentReturn || !inv || !inv.startsWith('topup_')) return;

    if (!authStatus.authorized) {
      sessionStorage.setItem('nexus_pending_invoice', inv);
      setTopupMessage('Оплата получена. Войдите в аккаунт, чтобы зачислить баланс.');
      return;
    }

    let cancelled = false;
    (async () => {
      setTopupBusy(true);
      setTopupMessage('Проверяем оплату пополнения…');
      try {
        const data = await checkTopup(inv);
        if (cancelled) return;
        const q = data.pool_rub ?? data.pool_usd * (usdRubRate || 90);
        setTopupMessage(`Успешно зачислено: ${formatBalanceRub(q)}!`);
        setPendingInvoice('');
        sessionStorage.removeItem('nexus_pending_invoice');
        await fetchProfile();
        const url = new URL(window.location.href);
        url.searchParams.delete('payment');
        url.searchParams.delete('invoice_id');
        window.history.replaceState({}, '', url.pathname + url.search);
      } catch (err) {
        if (!cancelled) {
          setPendingInvoice(inv);
          setTopupMessage(err.message || 'Оплата ещё обрабатывается.');
        }
      } finally {
        if (!cancelled) setTopupBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus.authorized, checkTopup, fetchProfile, usdRubRate]);

  return (
    <AppShell hideHistory onOpenPricing={() => navigate('/profile')}>
      <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10">
        <div className="max-w-[min(1400px,100%)] mx-auto px-4 sm:px-6 py-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <h1 className="nx-wordmark text-4xl sm:text-5xl text-[var(--nx-text)] mb-3">
              Выберите свой план
            </h1>
            <p className="text-[var(--nx-muted)] max-w-lg mx-auto">
              Цены в ₽ по курсу ЦБ. Оплата через ЮKassa. Продавец: {LEGAL.merchantName}, ИНН{' '}
              {LEGAL.inn}.
            </p>
            <p className="text-xs text-[var(--nx-muted)] max-w-2xl mx-auto mt-3 leading-relaxed">
              Оплата через Nexus (ЮKassa). После оплаты ключ ИИ выдаётся автоматически —
              ~92% суммы тарифа становится месячным лимитом ИИ на аккаунте (8% — комиссия Nexus).
            </p>
            <p className="text-xs text-[var(--nx-muted)] max-w-2xl mx-auto mt-4 leading-relaxed">
              Ориентиры как у ChatGPT Plus ($20), Claude Max ($100 / $200) — но у Nexus{' '}
              <span className="text-cyan-400/90">~92% подписки</span> идёт в прозрачный месячный пул
              ИИ (8% — комиссия платформы). Пул можно потратить за любой срок в течение 30 дней, а
              после исчерпания — мгновенно пополнить баланс без смены тарифа.
            </p>
            <p className="text-xs text-[var(--nx-muted)] mt-4 max-w-md mx-auto">
              Оформляя подписку, вы принимаете{' '}
              <Link to="/offer" className="text-cyan-400 hover:underline">
                публичную оферту
              </Link>
              .{' '}
              <Link to="/requisites" className="text-cyan-400 hover:underline">
                Реквизиты
              </Link>
              {' · '}
              <Link to="/privacy" className="text-cyan-400 hover:underline">
                Конфиденциальность
              </Link>
            </p>
          </motion.div>

          <TierPicker
            mode={authStatus.authorized ? 'subscribe' : 'select'}
            currentTierId={authStatus.profile?.subscription_tier}
            layout="grid"
          />

          {authStatus.authorized && (
            <motion.div
              id="topup"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-12 max-w-xl mx-auto rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8 relative overflow-hidden scroll-mt-24"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none" />
              
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                  <Coins size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Быстрое пополнение баланса</h2>
                  <p className="text-xs text-[var(--nx-muted)]">Модель Pay-As-You-Go — платите только за то, что используете</p>
                </div>
              </div>

              <form onSubmit={handleTopup} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                    Сумма пополнения (₽)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="100"
                      step="100"
                      value={topupAmount}
                      onChange={(e) => {
                        setTopupAmount(e.target.value);
                        setTopupMessage('');
                      }}
                      placeholder="1000"
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white font-bold text-lg focus:outline-none focus:border-cyan-500/50 transition-colors"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">
                      RUB
                    </span>
                  </div>
                </div>

                {/* Быстрый выбор суммы */}
                <div className="grid grid-cols-4 gap-2">
                  {['500', '1000', '3000', '5000'].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => {
                        setTopupAmount(amount);
                        setTopupMessage('');
                      }}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                        topupAmount === amount
                          ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400'
                          : 'border-white/5 bg-white/[0.01] text-zinc-400 hover:border-white/10 hover:bg-white/[0.02]'
                      }`}
                    >
                      {amount} ₽
                    </button>
                  ))}
                </div>

                {/* Калькулятор зачисления */}
                {topupAmount && !isNaN(parseFloat(topupAmount)) && parseFloat(topupAmount) > 0 && (
                  <div className="rounded-xl bg-black/20 border border-white/5 p-3.5 space-y-2 text-xs">
                    <div className="flex justify-between text-zinc-400">
                      <span>Курс конвертации:</span>
                      <span className="text-white font-medium">1 $ = {rate.toFixed(2)} ₽</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Комиссия платформы (8%):</span>
                      <span className="text-white font-medium">
                        -{(parseFloat(topupAmount) * 0.08).toFixed(0)} ₽
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-white/5 pt-2 text-sm font-bold">
                      <span className="text-zinc-300">Будет зачислено на баланс:</span>
                      <span className="text-emerald-400">
                        ≈ {formatBalanceRub(poolRub)} (${poolUsd})
                      </span>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={topupBusy}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {topupBusy ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      Пополнить баланс <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>

              {pendingInvoice && (
                <div className="mt-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-3">
                  <p className="text-xs text-amber-200">
                    Создан счёт на пополнение: <code className="font-mono">{pendingInvoice}</code>
                  </p>
                  {import.meta.env.VITE_BILLING_TEST_MODE === 'true' ? (
                    <button
                      type="button"
                      onClick={handleConfirmTopupPay}
                      disabled={topupBusy}
                      className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-50"
                    >
                      {topupBusy ? 'Зачисление…' : '✓ Подтвердить оплату (тест)'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConfirmTopupPay}
                      disabled={topupBusy}
                      className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-50"
                    >
                      {topupBusy ? 'Проверка…' : 'Проверить оплату'}
                    </button>
                  )}
                </div>
              )}

              {topupMessage && (
                <p className="mt-4 text-xs text-center text-zinc-300 bg-white/5 rounded-lg py-2 px-3">
                  {topupMessage}
                </p>
              )}
            </motion.div>
          )}

          <LegalFooter className="mt-12 rounded-2xl border border-white/5 bg-black/20" />
        </div>
      </div>
    </AppShell>
  );
}