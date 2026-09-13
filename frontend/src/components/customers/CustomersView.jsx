import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { 
  Users, Search, Plus, MessageSquare, ArrowDownLeft, 
  ArrowUpRight, DollarSign, QrCode, CreditCard, X, CheckCircle
} from 'lucide-react';

export default function CustomersView() {
  const { formatINR, formatDate, showToast } = useApp();

  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [balanceFilter, setBalanceFilter] = useState('ALL'); // 'ALL' or 'OWES_MONEY'
  const [showPayModal, setShowPayModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Payment form state
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');

  // Add customer form
  const [newCust, setNewCust] = useState({ name: '', phone: '', city: 'Pune', opening_balance: '' });

  useEffect(() => {
    loadCustomers();
  }, [balanceFilter]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await api.getCustomers({ balance_filter: balanceFilter === 'OWES_MONEY' ? 'OWES_MONEY' : undefined });
      setCustomers(data);
      if (data.length > 0 && !selectedCustomer) {
        selectCustomer(data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectCustomer = async (cust) => {
    setSelectedCustomer(cust);
    try {
      const entries = await api.getCustomerLedger(cust.id);
      setLedgerEntries(entries);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReceivePayment = async (e) => {
    e.preventDefault();
    if (!payAmount || Number(payAmount) <= 0) {
      showToast('Enter a valid collection amount', 'error');
      return;
    }

    try {
      await api.receivePayment(selectedCustomer.id, {
        customer_id: selectedCustomer.id,
        amount: Number(payAmount),
        payment_method: payMethod,
        reference_number: payRef || null,
        notes: payNotes || 'Customer payment collection'
      });

      showToast(`Received ₹${payAmount} from ${selectedCustomer.name}!`);
      setShowPayModal(false);
      setPayAmount('');
      setPayRef('');
      setPayNotes('');
      
      // Reload customer & ledger
      loadCustomers();
      const updatedCust = await api.getCustomerDetails(selectedCustomer.id);
      selectCustomer(updatedCust);
    } catch (err) {
      showToast(err.message || 'Payment collection failed', 'error');
    }
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!newCust.name || !newCust.phone) {
      showToast('Name and mobile number are required', 'error');
      return;
    }

    try {
      const created = await api.createCustomer({
        name: newCust.name,
        phone: newCust.phone,
        city: newCust.city,
        opening_balance: Number(newCust.opening_balance) || 0
      });

      showToast(`Customer ${created.name} added!`);
      setShowAddModal(false);
      setNewCust({ name: '', phone: '', city: 'Pune', opening_balance: '' });
      loadCustomers();
      selectCustomer(created);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const sendWhatsAppReminder = async (custId) => {
    try {
      const res = await api.getCustomerWhatsappLink(custId);
      window.open(res.link, '_blank');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery) ||
    c.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalOutstandingAll = customers.reduce((sum, c) => sum + (c.current_balance > 0 ? c.current_balance : 0), 0);

  return (
    <div className="p-4 lg:p-6 space-y-5">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            Customer Khata & Credit Ledger
          </h2>
          <p className="text-xs text-slate-500">Khatabook-style digital credit book, payment collections, and WhatsApp statements</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
            <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider block">Total Outstanding</span>
            <span className="text-sm font-extrabold text-amber-900 font-display">{formatINR(totalOutstandingAll)}</span>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        </div>
      </div>

      {/* Main Split: Left = Customer List, Right = Khatabook Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: Customer Directory */}
        <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[650px] overflow-hidden">
          {/* Search & Filter */}
          <div className="p-3 border-b border-slate-200 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customer name, phone, or city..."
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-emerald-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setBalanceFilter('ALL')}
                className={`flex-1 py-1 rounded-lg text-xs font-semibold border ${
                  balanceFilter === 'ALL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                All Customers ({customers.length})
              </button>
              <button
                onClick={() => setBalanceFilter('OWES_MONEY')}
                className={`flex-1 py-1 rounded-lg text-xs font-semibold border ${
                  balanceFilter === 'OWES_MONEY' ? 'bg-rose-600 text-white border-rose-600' : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                Owes Money ({customers.filter(c => c.current_balance > 0).length})
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredCustomers.map((cust) => {
              const isSelected = selectedCustomer?.id === cust.id;
              const hasDue = cust.current_balance > 0;

              return (
                <div
                  key={cust.id}
                  onClick={() => selectCustomer(cust)}
                  className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected ? 'bg-emerald-50/80 border-l-4 border-emerald-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="truncate">
                    <h4 className="text-xs font-bold text-slate-900 truncate">{cust.name}</h4>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">{cust.phone} • {cust.city}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className={`text-xs font-bold font-display ${hasDue ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {formatINR(cust.current_balance)}
                    </p>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {hasDue ? 'Pending Due' : 'Cleared'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Customer Ledger Statement */}
        <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[650px] overflow-hidden">
          {selectedCustomer ? (
            <>
              {/* Profile Card */}
              <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-display">{selectedCustomer.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">Mobile: {selectedCustomer.phone} • {selectedCustomer.city}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => sendWhatsAppReminder(selectedCustomer.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Statement
                  </button>
                  <button
                    onClick={() => setShowPayModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold shadow-xs"
                  >
                    <DollarSign className="w-3.5 h-3.5" /> Receive Payment
                  </button>
                </div>
              </div>

              {/* Khatabook Net Status Bar */}
              <div className="grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-200 bg-white text-center py-2.5">
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Total Purchases</span>
                  <p className="text-xs font-bold text-slate-800 font-display mt-0.5">{formatINR(selectedCustomer.total_purchases)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Total Paid</span>
                  <p className="text-xs font-bold text-emerald-600 font-display mt-0.5">{formatINR(selectedCustomer.total_paid)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Net Balance Due</span>
                  <p className={`text-xs font-bold font-display mt-0.5 ${selectedCustomer.current_balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatINR(selectedCustomer.current_balance)}
                  </p>
                </div>
              </div>

              {/* Transactions Timeline */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Transaction Ledger History ({ledgerEntries.length})
                </div>

                {ledgerEntries.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    No transactions recorded for this customer yet.
                  </div>
                ) : (
                  ledgerEntries.map((e) => (
                    <div
                      key={e.id}
                      className="p-3 rounded-xl border border-slate-200/80 bg-slate-50 flex items-center justify-between text-xs hover:bg-white transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-xl mt-0.5 ${
                          e.credit > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {e.credit > 0 ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{e.notes || e.entry_type}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {formatDate(e.created_at)} • Mode: {e.payment_method || 'CREDIT'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        {e.debit > 0 && (
                          <p className="font-bold text-rose-600 font-display">
                            - {formatINR(e.debit)}
                          </p>
                        )}
                        {e.credit > 0 && (
                          <p className="font-bold text-emerald-600 font-display">
                            + {formatINR(e.credit)}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Bal: {formatINR(e.balance)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
              Select a customer from the left directory to view ledger
            </div>
          )}
        </div>
      </div>

      {/* Receive Payment Modal */}
      {showPayModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Receive Payment (Khata)</h3>
              <button onClick={() => setShowPayModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReceivePayment} className="space-y-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <p className="text-[11px] text-slate-500">Customer: <span className="font-bold text-slate-800">{selectedCustomer.name}</span></p>
                <p className="text-[11px] text-rose-600 font-semibold mt-0.5">Current Balance Due: {formatINR(selectedCustomer.current_balance)}</p>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Amount Received (₹) *</label>
                <input
                  type="number"
                  required
                  autoFocus
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full p-2.5 mt-1 border border-emerald-300 rounded-xl font-bold text-base text-emerald-800 bg-emerald-50/50 outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Payment Mode</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full p-2 mt-1 border border-slate-200 rounded-lg bg-white font-semibold"
                >
                  <option value="CASH">Cash in Hand</option>
                  <option value="UPI">Shop UPI (PhonePe / GPay)</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="BANK">Bank Transfer (NEFT/RTGS)</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Transaction Ref / Note</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="e.g. UPI Ref: 490192841"
                  className="w-full p-2 mt-1 border border-slate-200 rounded-lg"
                />
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
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs"
                >
                  Save & Update Balance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Add New Customer</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  value={newCust.name}
                  onChange={(e) => setNewCust({ ...newCust, name: e.target.value })}
                  placeholder="e.g. Rahul Patil"
                  className="w-full p-2 mt-1 border border-slate-200 rounded-lg outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Mobile Number (10-Digit) *</label>
                <input
                  type="tel"
                  maxLength={10}
                  required
                  value={newCust.phone}
                  onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })}
                  placeholder="e.g. 9822012345"
                  className="w-full p-2 mt-1 border border-slate-200 rounded-lg font-mono outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">City / Area</label>
                <input
                  type="text"
                  value={newCust.city}
                  onChange={(e) => setNewCust({ ...newCust, city: e.target.value })}
                  placeholder="Pune, Maharashtra"
                  className="w-full p-2 mt-1 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Opening Balance (if any)</label>
                <input
                  type="number"
                  value={newCust.opening_balance}
                  onChange={(e) => setNewCust({ ...newCust, opening_balance: e.target.value })}
                  placeholder="0 (Positive means owes money)"
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
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs"
                >
                  Create Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
