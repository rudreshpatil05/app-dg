import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { 
  CreditCard, Calendar, CheckCircle2, AlertCircle, 
  MessageSquare, DollarSign, User, Smartphone, X
} from 'lucide-react';

export default function EMIPlansView() {
  const { formatINR, formatDate, showToast } = useApp();

  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [emiStats, setEmiStats] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [pendingFilter, setPendingFilter] = useState('ALL');
  const [pendingSearch, setPendingSearch] = useState('');
  const [pendingStartDate, setPendingStartDate] = useState('');
  const [pendingEndDate, setPendingEndDate] = useState('');
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [targetInstallment, setTargetInstallment] = useState(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMethod, setCollectMethod] = useState('CASH');
  const [collectRef, setCollectRef] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEmiData();
  }, [statusFilter]);

  const loadEmiData = async () => {
    setLoading(true);
    try {
      const [plansData, statsData] = await Promise.all([
        api.getEmiPlans(statusFilter === 'ALL' ? {} : { status_filter: statusFilter }),
        api.getEmiDashboard()
      ]);
      setPlans(plansData);
      setEmiStats(statsData);
      if (plansData.length > 0 && !selectedPlan) {
        selectPlan(plansData[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectPlan = async (plan) => {
    try {
      const fullPlan = await api.getEmiPlanDetails(plan.id);
      setSelectedPlan(fullPlan);
      return fullPlan;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const collectFromTrackingRow = async (planId, installmentId = null) => {
    const fullPlan = await selectPlan({ id: planId });
    const installment = fullPlan?.installments?.find((item) => item.id === installmentId) || null;
    if (fullPlan) openCollectDialog(installment);
  };

  const filteredPendingPlans = (emiStats?.pending_plans || []).filter((plan) => {
    const matchesFilter = pendingFilter === 'ALL' ||
      (pendingFilter === 'DUE_TODAY' && plan.days_to_due === 0) ||
      (pendingFilter === 'OVERDUE' && plan.days_to_due < 0) ||
      (pendingFilter === 'UPCOMING' && plan.days_to_due > 0);
    const search = pendingSearch.trim().toLowerCase();
    const matchesSearch = !search || `${plan.customer_name} ${plan.customer_phone} ${plan.product_name}`.toLowerCase().includes(search);
    const matchesStart = !pendingStartDate || !plan.next_due_date || plan.next_due_date >= pendingStartDate;
    const matchesEnd = !pendingEndDate || !plan.next_due_date || plan.next_due_date <= pendingEndDate;
    return matchesFilter && matchesSearch && matchesStart && matchesEnd;
  });

  const openCollectDialog = (inst = null) => {
    setTargetInstallment(inst);
    setCollectAmount(inst ? String(inst.balance_due) : String(selectedPlan?.emi_amount || ''));
    setShowCollectModal(true);
  };

  const handleCollectPayment = async (e) => {
    e.preventDefault();
    if (!collectAmount || Number(collectAmount) <= 0) {
      showToast('Enter a valid collection amount', 'error');
      return;
    }

    try {
      await api.collectEmiPayment(selectedPlan.id, {
        installment_id: targetInstallment ? targetInstallment.id : null,
        amount: Number(collectAmount),
        payment_method: collectMethod,
        reference_number: collectRef || null,
        notes: `EMI Collection for ${selectedPlan.product_name}`
      });

      showToast(`Collected EMI payment ₹${collectAmount}!`);
      setShowCollectModal(false);
      setCollectAmount('');
      setCollectRef('');
      
      // Reload plans and active plan
      loadEmiData();
      const updated = await api.getEmiPlanDetails(selectedPlan.id);
      setSelectedPlan(updated);
    } catch (err) {
      showToast(err.message || 'Collection failed', 'error');
    }
  };

  const sendWhatsAppReminder = async (installmentId) => {
    try {
      const res = await api.getEmiInstallmentWhatsappLink(installmentId);
      window.open(res.link, '_blank');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-600" />
            Store-Financed Customer EMI Management
          </h2>
          <p className="text-xs text-slate-500">Dedicated store financing engine with installment schedules, collections, and overdue alerts</p>
        </div>

        {/* Quick Filter */}
        <div className="flex items-center gap-2">
          {['ALL', 'ACTIVE', 'COMPLETED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                statusFilter === st ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* EMI Stats Row */}
      {emiStats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active Customers</span>
            <p className="text-xl font-extrabold text-slate-900 font-display mt-0.5">{emiStats.total_active_customers}</p>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total EMI Amount</span>
            <p className="text-xl font-extrabold text-indigo-900 font-display mt-0.5">{formatINR(emiStats.total_emi_amount)}</p>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Collected</span>
            <p className="text-xl font-extrabold text-emerald-700 font-display mt-0.5">{formatINR(emiStats.total_collected)}</p>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Remaining</span>
            <p className="text-xl font-extrabold text-indigo-900 font-display mt-0.5">{formatINR(emiStats.total_remaining)}</p>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Due Today</span>
            <p className="text-xl font-extrabold text-amber-700 font-display mt-0.5">{formatINR(emiStats.due_today)}</p>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Overdue Dues</span>
            <p className="text-xl font-extrabold text-rose-600 font-display mt-0.5">{formatINR(emiStats.overdue_amount)}</p>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Upcoming EMIs</span>
            <p className="text-xl font-extrabold text-slate-900 font-display mt-0.5">{emiStats.upcoming_count}</p>
          </div>
        </div>
      )}

      {emiStats && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-amber-50/60 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">EMIs Due Today - {formatDate(emiStats.today)}</h3>
                <p className="text-[11px] text-slate-500">{emiStats.due_today_count} installment(s) requiring collection</p>
              </div>
              <Calendar className="w-4 h-4 text-amber-600" />
            </div>
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {emiStats.due_today_items?.length ? emiStats.due_today_items.map((item) => (
                <div key={item.installment_id} className="p-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{item.customer_name} <span className="font-normal text-slate-500">({item.customer_phone})</span></p>
                    <p className="text-[11px] text-slate-500 truncate">{item.product_name} · Installment #{item.installment_number} · {formatDate(item.due_date)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-amber-700">{formatINR(item.amount)}</span>
                    <button onClick={() => collectFromTrackingRow(item.plan_id, item.installment_id)} className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold">Collect</button>
                  </div>
                </div>
              )) : <p className="p-6 text-center text-xs text-slate-400">No EMI installments are due today.</p>}
            </div>
          </section>

          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/60 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Pending EMIs</h3>
                  <p className="text-[11px] text-slate-500">Customer-level balances and next due dates</p>
                </div>
                <select value={pendingFilter} onChange={(e) => setPendingFilter(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white font-semibold">
                  <option value="ALL">All Pending</option><option value="DUE_TODAY">Due Today</option><option value="OVERDUE">Overdue</option><option value="UPCOMING">Upcoming</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input value={pendingSearch} onChange={(e) => setPendingSearch(e.target.value)} placeholder="Search customer or product" className="sm:col-span-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5" />
                <input type="date" value={pendingStartDate} onChange={(e) => setPendingStartDate(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5" />
                <input type="date" value={pendingEndDate} onChange={(e) => setPendingEndDate(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5" />
              </div>
            </div>
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {filteredPendingPlans.length ? filteredPendingPlans.map((plan) => (
                <div key={plan.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{plan.customer_name} <span className="font-normal text-slate-500">({plan.customer_phone})</span></p>
                    <p className="text-[11px] text-slate-500 truncate">{plan.product_name} · {plan.paid_installments} paid / {plan.remaining_installments} remaining · Next: {plan.next_due_date ? formatDate(plan.next_due_date) : 'Complete'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-slate-900">{formatINR(plan.balance_remaining)}</p>
                    <p className={`text-[10px] font-semibold ${plan.days_to_due < 0 ? 'text-rose-600' : plan.days_to_due === 0 ? 'text-amber-600' : 'text-slate-500'}`}>{plan.days_to_due < 0 ? `${Math.abs(plan.days_to_due)} days overdue` : plan.days_to_due === 0 ? 'Due today' : `${plan.days_to_due} days upcoming`}</p>
                  </div>
                </div>
              )) : <p className="p-6 text-center text-xs text-slate-400">No pending EMI plans match the selected filters.</p>}
            </div>
          </section>
        </div>
      )}

      {/* Main Grid: Left = Active EMI Contracts, Right = Detailed Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left: Contracts Directory */}
        <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[600px] overflow-hidden">
          <div className="p-3 border-b border-slate-200 bg-slate-50/50">
            <span className="text-xs font-bold text-slate-700">Customer EMI Contracts ({plans.length})</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {plans.map((p) => {
              const isSelected = selectedPlan?.id === p.id;
              const hasOverdue = p.balance_remaining > 0 && p.status === 'ACTIVE';

              return (
                <div
                  key={p.id}
                  onClick={() => selectPlan(p)}
                  className={`p-3.5 cursor-pointer transition-colors ${
                    isSelected ? 'bg-indigo-50/80 border-l-4 border-indigo-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{p.product_name}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Cust: {p.customer_name} ({p.customer_phone})</p>
                      {p.imei && <p className="text-[10px] font-mono text-slate-400">IMEI: {p.imei}</p>}
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        p.status === 'ACTIVE' ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {p.status}
                      </span>
                      <p className="text-xs font-bold text-slate-800 font-display mt-1">{formatINR(p.balance_remaining)} due</p>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{p.number_of_installments} Installments of {formatINR(p.emi_amount)}</span>
                    <span className="text-emerald-700 font-semibold">{formatINR(p.total_paid)} Paid</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Contract's Schedule */}
        <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[600px] overflow-hidden">
          {selectedPlan ? (
            <>
              {/* Header Info */}
              <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-900">{selectedPlan.product_name}</h3>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                      {selectedPlan.number_of_installments} Months EMI
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Customer: <span className="font-semibold text-slate-800">{selectedPlan.customer_name}</span> ({selectedPlan.customer_phone})
                  </p>
                </div>
                <button
                  onClick={() => openCollectDialog()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  <DollarSign className="w-3.5 h-3.5" /> Collect Next EMI
                </button>
              </div>

              {/* Financial Progress Bar */}
              <div className="p-4 bg-white border-b border-slate-200 space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-600">Repayment Progress: {formatINR(selectedPlan.total_paid)} of {formatINR(selectedPlan.total_repayable)}</span>
                  <span className="text-indigo-600">{Math.round((selectedPlan.total_paid / selectedPlan.total_repayable) * 100)}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (selectedPlan.total_paid / selectedPlan.total_repayable) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Installment Schedule Table */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Monthly Installment Schedule
                </div>

                <div className="space-y-2">
                  {selectedPlan.installments?.map((inst) => {
                    const isPaid = inst.status === 'PAID';
                    const isOverdue = inst.status === 'OVERDUE';
                    const latestPayment = inst.payments?.[inst.payments.length - 1];

                    return (
                      <div
                        key={inst.id}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs hover:bg-white transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                            isPaid ? 'bg-emerald-100 text-emerald-800' :
                            isOverdue ? 'bg-rose-100 text-rose-800' :
                            'bg-slate-200 text-slate-700'
                          }`}>
                            #{inst.installment_number}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">
                              Due Date: {formatDate(inst.due_date)}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {isPaid ? `Paid on ${formatDate(inst.paid_date)}${latestPayment ? ` · ${formatINR(latestPayment.amount)} via ${latestPayment.payment_method}` : ''}` : `Paid: ${formatINR(inst.paid_amount)} · Amount Due: ${formatINR(inst.balance_due)}`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            isPaid ? 'bg-emerald-100 text-emerald-800' :
                            isOverdue ? 'bg-rose-100 text-rose-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            ● {inst.status}
                          </span>

                          <div className="text-right">
                            <span className="font-bold text-slate-800 font-display block">{formatINR(inst.emi_amount)}</span>
                          </div>

                          {!isPaid && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openCollectDialog(inst)}
                                className="px-2.5 py-1 bg-slate-900 hover:bg-black text-white rounded-lg text-[11px] font-bold"
                              >
                                Collect
                              </button>
                              <button
                                onClick={() => sendWhatsAppReminder(inst.id)}
                                title="Send WhatsApp Reminder"
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                              >
                                <MessageSquare className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
              Select an EMI plan from the list to view installments
            </div>
          )}
        </div>
      </div>

      {/* Collect EMI Modal */}
      {showCollectModal && selectedPlan && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Collect EMI Installment</h3>
              <button onClick={() => setShowCollectModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCollectPayment} className="space-y-3 text-xs">
              <div className="bg-indigo-50 p-2.5 rounded-xl border border-indigo-200 text-[11px]">
                <p>Customer: <span className="font-bold text-indigo-900">{selectedPlan.customer_name}</span></p>
                <p className="mt-0.5">Device: <span className="font-semibold">{selectedPlan.product_name}</span></p>
                <p className="font-bold text-indigo-900 mt-1">Remaining Plan Balance: {formatINR(selectedPlan.balance_remaining)}</p>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Collection Amount (₹) *</label>
                <input
                  type="number"
                  required
                  autoFocus
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  className="w-full p-2.5 mt-1 border border-indigo-300 rounded-xl font-bold text-base text-indigo-900 bg-indigo-50/50 outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Payment Mode</label>
                <select
                  value={collectMethod}
                  onChange={(e) => setCollectMethod(e.target.value)}
                  className="w-full p-2 mt-1 border border-slate-200 rounded-lg bg-white font-semibold"
                >
                  <option value="CASH">Cash in Hand</option>
                  <option value="UPI">Shop UPI (PhonePe / GPay)</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="BANK">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Reference / Receipt Number</label>
                <input
                  type="text"
                  value={collectRef}
                  onChange={(e) => setCollectRef(e.target.value)}
                  placeholder="e.g. UTR / Txn ID"
                  className="w-full p-2 mt-1 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCollectModal(false)}
                  className="flex-1 py-2 border border-slate-300 rounded-xl font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs"
                >
                  Confirm Collection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
