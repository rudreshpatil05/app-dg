import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { Truck, Search, Plus, DollarSign, X } from 'lucide-react';

export default function SuppliersView() {
  const { formatINR, formatDate, showToast } = useApp();

  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('BANK');
  const [payRef, setPayRef] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const data = await api.getSuppliers();
      setSuppliers(data);
      if (data.length > 0 && !selectedSupplier) {
        selectSupplier(data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectSupplier = async (sup) => {
    setSelectedSupplier(sup);
    try {
      const entries = await api.getSupplierLedger(sup.id);
      setLedger(entries);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePaySupplier = async (e) => {
    e.preventDefault();
    if (!payAmount || Number(payAmount) <= 0) {
      showToast('Enter valid payment amount', 'error');
      return;
    }

    try {
      await api.paySupplier(selectedSupplier.id, {
        supplier_id: selectedSupplier.id,
        amount: Number(payAmount),
        payment_method: payMethod,
        reference_number: payRef || null,
        notes: `Payment to ${selectedSupplier.company || selectedSupplier.name}`
      });

      showToast(`Recorded payment of ₹${payAmount} to ${selectedSupplier.company || selectedSupplier.name}!`);
      setShowPayModal(false);
      setPayAmount('');
      setPayRef('');
      loadSuppliers();
      const updated = await api.getSuppliers();
      const s = updated.find(x => x.id === selectedSupplier.id);
      if (s) selectSupplier(s);
    } catch (err) {
      showToast(err.message || 'Payment failed', 'error');
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" />
            Suppliers & Distributor Khata
          </h2>
          <p className="text-xs text-slate-500">Track payables to mobile distributors and record outgoing payments</p>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left: Supplier Directory */}
        <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[600px] overflow-hidden">
          <div className="p-3 border-b border-slate-200 bg-slate-50/50">
            <span className="text-xs font-bold text-slate-700">Mobile Distributors ({suppliers.length})</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {suppliers.map((s) => {
              const isSelected = selectedSupplier?.id === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => selectSupplier(s)}
                  className={`p-3.5 cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{s.company || s.name}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Contact: {s.name} • {s.phone}</p>
                      {s.gstin && <p className="text-[10px] text-slate-400 font-mono">GST: {s.gstin}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-900 font-display">{formatINR(s.current_balance)}</p>
                      <span className="text-[10px] text-rose-600 font-semibold">Payable</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Supplier Ledger */}
        <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[600px] overflow-hidden">
          {selectedSupplier ? (
            <>
              <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-display">{selectedSupplier.company || selectedSupplier.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">Ph: {selectedSupplier.phone} • {selectedSupplier.city}</p>
                </div>
                <button
                  onClick={() => setShowPayModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  <DollarSign className="w-3.5 h-3.5" /> Pay Supplier
                </button>
              </div>

              <div className="grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-200 bg-white text-center py-2.5 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Total Inward</span>
                  <p className="font-bold text-slate-900 font-display mt-0.5">{formatINR(selectedSupplier.total_purchases)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Total Paid</span>
                  <p className="font-bold text-emerald-600 font-display mt-0.5">{formatINR(selectedSupplier.total_paid)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Balance Due</span>
                  <p className="font-bold text-rose-600 font-display mt-0.5">{formatINR(selectedSupplier.current_balance)}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Supplier Khata Ledger History ({ledger.length})
                </div>

                {ledger.map((e) => (
                  <div key={e.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-900">{e.notes || e.entry_type}</p>
                      <p className="text-[10px] text-slate-500">{formatDate(e.created_at)} • Mode: {e.payment_method || 'CREDIT'}</p>
                    </div>
                    <div className="text-right">
                      {e.debit > 0 && <p className="font-bold text-emerald-600">- {formatINR(e.debit)}</p>}
                      {e.credit > 0 && <p className="font-bold text-rose-600">+ {formatINR(e.credit)}</p>}
                      <p className="text-[10px] text-slate-400">Bal: {formatINR(e.balance)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-400">Select a supplier to view khata</div>
          )}
        </div>
      </div>

      {/* Pay Supplier Modal */}
      {showPayModal && selectedSupplier && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Pay Distributor</h3>
              <button onClick={() => setShowPayModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePaySupplier} className="space-y-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <p>Distributor: <span className="font-bold">{selectedSupplier.company || selectedSupplier.name}</span></p>
                <p className="text-rose-600 font-semibold mt-0.5">Payable Balance: {formatINR(selectedSupplier.current_balance)}</p>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Amount to Pay (₹) *</label>
                <input
                  type="number"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full p-2.5 mt-1 border border-blue-300 rounded-xl font-bold text-base text-blue-900 bg-blue-50/50 outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Payment Mode</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full p-2 mt-1 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="BANK">Bank Transfer (NEFT/RTGS)</option>
                  <option value="UPI">Shop UPI</option>
                  <option value="CASH">Cash Drawer</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="flex-1 py-2 border border-slate-300 rounded-xl font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
