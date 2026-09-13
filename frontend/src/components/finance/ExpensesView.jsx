import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { ReceiptText, Plus, Search, DollarSign, X } from 'lucide-react';

export default function ExpensesView() {
  const { formatINR, formatDate, showToast } = useApp();

  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadExpensesData();
  }, []);

  const loadExpensesData = async () => {
    setLoading(true);
    try {
      const [expData, catsData] = await Promise.all([
        api.getExpenses(),
        api.getExpenseCategories()
      ]);
      setExpenses(expData);
      setCategories(catsData);
      if (catsData.length > 0 && !categoryId) setCategoryId(catsData[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      showToast('Enter a valid expense amount', 'error');
      return;
    }

    try {
      await api.createExpense({
        category_id: Number(categoryId),
        amount: Number(amount),
        expense_date: expenseDate,
        payment_method: paymentMethod,
        vendor: vendor || null,
        notes: notes || null
      });

      showToast(`Expense of ₹${amount} recorded!`);
      setShowAddModal(false);
      setAmount('');
      setVendor('');
      setNotes('');
      loadExpensesData();
    } catch (err) {
      showToast(err.message || 'Failed to record expense', 'error');
    }
  };

  const totalExpenseSum = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="p-4 lg:p-6 space-y-5">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-rose-600" />
            Store Expense Management
          </h2>
          <p className="text-xs text-slate-500">Track operating overheads (Rent, Electricity, Tea, Salaries) impacting net margins</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
            <span className="text-[10px] text-rose-800 font-bold uppercase tracking-wider block">Total Recorded Expenses</span>
            <span className="text-sm font-extrabold text-rose-900 font-display">{formatINR(totalExpenseSum)}</span>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <th className="p-3.5">Category</th>
              <th className="p-3.5">Date</th>
              <th className="p-3.5">Vendor / Payee</th>
              <th className="p-3.5">Payment Method</th>
              <th className="p-3.5 text-right">Amount</th>
              <th className="p-3.5">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {expenses.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="p-3.5 font-bold text-slate-900">{e.category_name}</td>
                <td className="p-3.5 text-slate-600">{formatDate(e.expense_date)}</td>
                <td className="p-3.5 font-medium text-slate-800">{e.vendor || 'General Overhead'}</td>
                <td className="p-3.5 font-semibold text-slate-600">{e.payment_method}</td>
                <td className="p-3.5 text-right font-bold text-rose-600 font-display">{formatINR(e.amount)}</td>
                <td className="p-3.5 text-slate-500 text-[11px]">{e.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Add Store Expense</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Category *</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full p-2 mt-1 border border-slate-200 rounded-lg bg-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  autoFocus
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 1500"
                  className="w-full p-2.5 mt-1 border border-rose-300 rounded-xl font-bold text-base text-rose-800 bg-rose-50/50 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700">Date</label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full p-2 mt-1 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Payment Mode</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full p-2 mt-1 border border-slate-200 rounded-lg bg-white font-semibold"
                  >
                    <option value="CASH">Cash Drawer</option>
                    <option value="UPI">Shop UPI</option>
                    <option value="BANK">Bank A/C</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Vendor / Payee</label>
                <input
                  type="text"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="e.g. Tea Stall, MSEDCL, Landlord"
                  className="w-full p-2 mt-1 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Notes / Bill Reference</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Monthly shop maintenance"
                  className="w-full p-2 mt-1 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 border border-slate-300 rounded-xl font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-xs"
                >
                  Record Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
