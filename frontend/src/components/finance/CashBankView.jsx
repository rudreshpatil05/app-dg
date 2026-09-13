import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { Landmark, Wallet, QrCode, CreditCard, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

export default function CashBankView() {
  const { formatINR, formatDate, showToast } = useApp();

  const [accounts, setAccounts] = useState([]);
  const [reconSummary, setReconSummary] = useState(null);
  const [reconciliations, setReconciliations] = useState([]);
  const [actualCash, setActualCash] = useState('');
  const [reconNotes, setReconNotes] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [accs, summary, list] = await Promise.all([
        api.getAccounts(),
        api.getCashReconciliationSummary(),
        api.getCashReconciliationsList()
      ]);
      setAccounts(accs);
      setReconSummary(summary);
      setReconciliations(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = async (e) => {
    e.preventDefault();
    if (!actualCash) {
      showToast('Please enter the physically counted cash amount in drawer', 'error');
      return;
    }

    try {
      await api.submitCashReconciliation({
        target_date: new Date().toISOString().split('T')[0],
        actual_physical_cash: Number(actualCash),
        notes: reconNotes || 'Daily counter cash reconciliation'
      });

      showToast('Daily cash drawer reconciliation recorded!');
      setActualCash('');
      setReconNotes('');
      loadData();
    } catch (err) {
      showToast(err.message || 'Reconciliation failed', 'error');
    }
  };

  const discrepancy = actualCash ? Number(actualCash) - (reconSummary?.system_expected_cash || 0) : 0;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      
      {/* Header */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
          <Landmark className="w-5 h-5 text-emerald-600" />
          Cash & Bank Management with Counter Reconciliation
        </h2>
        <p className="text-xs text-slate-500">Track liquid cash, bank balances, shop UPI QR wallets, and audit physical cash counter handover</p>
      </div>

      {/* Accounts Balances Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {accounts.map((a) => (
          <div key={a.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">{a.name}</span>
              <span className={`p-1.5 rounded-lg ${
                a.account_type === 'CASH' ? 'bg-emerald-50 text-emerald-600' :
                a.account_type === 'UPI' ? 'bg-indigo-50 text-indigo-600' :
                'bg-blue-50 text-blue-600'
              }`}>
                {a.account_type === 'CASH' ? <Wallet className="w-4 h-4" /> :
                 a.account_type === 'UPI' ? <QrCode className="w-4 h-4" /> :
                 <CreditCard className="w-4 h-4" />}
              </span>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 font-display">{formatINR(a.current_balance)}</p>
            {a.account_number && <p className="text-[11px] font-mono text-slate-400">A/C: {a.account_number}</p>}
            {a.upi_id && <p className="text-[11px] text-slate-500">UPI: {a.upi_id}</p>}
          </div>
        ))}
      </div>

      {/* Daily Cash Counter Reconciliation Section */}
      {reconSummary && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-emerald-600" />
                Daily Cash Counter Handover & Reconciliation ({formatDate(reconSummary.date)})
              </h3>
              <p className="text-xs text-slate-500">Compare system computed cash vs physical currency notes in the counter drawer</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Opening Cash</span>
              <p className="font-bold text-slate-800 mt-0.5">{formatINR(reconSummary.opening_cash)}</p>
            </div>
            <div>
              <span className="text-[10px] text-emerald-700 font-semibold uppercase">+ Cash Sales</span>
              <p className="font-bold text-emerald-700 mt-0.5">+{formatINR(reconSummary.cash_sales)}</p>
            </div>
            <div>
              <span className="text-[10px] text-emerald-700 font-semibold uppercase">+ EMI / Khata Cash</span>
              <p className="font-bold text-emerald-700 mt-0.5">+{formatINR(reconSummary.emi_cash_collected + reconSummary.customer_cash_collected)}</p>
            </div>
            <div>
              <span className="text-[10px] text-rose-600 font-semibold uppercase">- Cash Expenses</span>
              <p className="font-bold text-rose-600 mt-0.5">-{formatINR(reconSummary.cash_expenses)}</p>
            </div>
            <div className="bg-emerald-100/60 p-1.5 rounded-lg">
              <span className="text-[10px] text-emerald-900 font-bold uppercase">Expected System Cash</span>
              <p className="text-sm font-extrabold text-emerald-900 font-display mt-0.5">{formatINR(reconSummary.system_expected_cash)}</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleReconcile} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end pt-2 text-xs">
            <div>
              <label className="font-semibold text-slate-700">Physically Counted Drawer Cash (₹) *</label>
              <input
                type="number"
                required
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                placeholder="Count notes in drawer..."
                className="w-full p-2 mt-1 border border-slate-300 rounded-xl font-bold text-sm outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700">Cashier Note</label>
              <input
                type="text"
                value={reconNotes}
                onChange={(e) => setReconNotes(e.target.value)}
                placeholder="e.g. 500x50, 200x25 notes counted"
                className="w-full p-2 mt-1 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <button
                type="submit"
                className="w-full py-2 bg-slate-900 hover:bg-black text-white rounded-xl font-bold shadow-xs flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Submit Reconciliation
              </button>
            </div>
          </form>

          {/* Discrepancy indicator */}
          {actualCash && (
            <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
              Math.abs(discrepancy) < 1 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              <span>{Math.abs(discrepancy) < 1 ? '✅ Cash Matched Perfectly!' : `⚠️ Cash Discrepancy Detected: ${discrepancy > 0 ? `+${formatINR(discrepancy)} Excess` : `${formatINR(discrepancy)} Shortage`}`}</span>
              <span className="font-mono">{formatINR(actualCash)} counted vs {formatINR(reconSummary.system_expected_cash)} expected</span>
            </div>
          )}
        </div>
      )}

      {/* Past Reconciliation Records */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-3.5 border-b border-slate-200 bg-slate-50/50">
          <h4 className="text-xs font-bold text-slate-700">Audit History of Daily Counter Reconciliations</h4>
        </div>
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <th className="p-3">Date</th>
              <th className="p-3 text-right">System Expected</th>
              <th className="p-3 text-right">Physical Count</th>
              <th className="p-3 text-right">Discrepancy</th>
              <th className="p-3 text-center">Audit Status</th>
              <th className="p-3">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reconciliations.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/70">
                <td className="p-3 font-semibold text-slate-900">{formatDate(r.reconciliation_date)}</td>
                <td className="p-3 text-right font-mono">{formatINR(r.system_expected_cash)}</td>
                <td className="p-3 text-right font-mono font-bold text-slate-900">{formatINR(r.actual_physical_cash)}</td>
                <td className={`p-3 text-right font-mono font-bold ${r.discrepancy < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {r.discrepancy === 0 ? '₹0.00' : formatINR(r.discrepancy)}
                </td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                    r.status === 'MATCHED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {r.status}
                  </span>
                </td>
                <td className="p-3 text-slate-500 text-[11px]">{r.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
