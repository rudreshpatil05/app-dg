import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { Wrench, Plus, CheckCircle, Smartphone, AlertCircle, X } from 'lucide-react';

export default function RepairsView() {
  const { formatINR, formatDate, showToast } = useApp();

  const [repairs, setRepairs] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // New Ticket form
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    device_name: '',
    imei_or_serial: '',
    problem_description: '',
    accessories_received: 'Handset only',
    estimated_cost: '',
    advance_paid: '',
    payment_method: 'CASH',
    technician_name: 'Senior Tech',
    notes: ''
  });

  useEffect(() => {
    loadRepairs();
  }, []);

  const loadRepairs = async () => {
    setLoading(true);
    try {
      const data = await api.getRepairs();
      setRepairs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!form.customer_name || !form.customer_phone || !form.device_name || !form.problem_description) {
      showToast('Please fill all required customer and device details', 'error');
      return;
    }

    try {
      await api.createRepair({
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        device_name: form.device_name,
        imei_or_serial: form.imei_or_serial || null,
        problem_description: form.problem_description,
        accessories_received: form.accessories_received,
        estimated_cost: Number(form.estimated_cost) || 0,
        advance_paid: Number(form.advance_paid) || 0,
        payment_method: form.payment_method,
        technician_name: form.technician_name,
        notes: form.notes || null
      });

      showToast('Repair ticket created successfully!');
      setShowAddModal(false);
      setForm({
        customer_name: '', customer_phone: '', device_name: '', imei_or_serial: '',
        problem_description: '', accessories_received: 'Handset only',
        estimated_cost: '', advance_paid: '', payment_method: 'CASH',
        technician_name: 'Senior Tech', notes: ''
      });
      loadRepairs();
    } catch (err) {
      showToast(err.message || 'Failed to create repair ticket', 'error');
    }
  };

  const updateStatus = async (ticketId, status) => {
    try {
      await api.updateRepairStatus(ticketId, { status });
      showToast(`Repair status updated to ${status}`);
      loadRepairs();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
            <Wrench className="w-5 h-5 text-blue-600" />
            Repair & Service Center Job Sheets
          </h2>
          <p className="text-xs text-slate-500">Track device repair tickets, technician diagnosis, part estimates, and customer delivery</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Repair Ticket
        </button>
      </div>

      {/* Repairs Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <th className="p-3.5">Ticket #</th>
              <th className="p-3.5">Customer & Phone</th>
              <th className="p-3.5">Device & IMEI</th>
              <th className="p-3.5">Issue Description</th>
              <th className="p-3.5 text-right">Estimated Cost</th>
              <th className="p-3.5 text-right">Advance Paid</th>
              <th className="p-3.5 text-center">Status</th>
              <th className="p-3.5 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {repairs.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/70">
                <td className="p-3.5 font-bold font-mono text-slate-900">{r.ticket_number}</td>
                <td className="p-3.5">
                  <p className="font-semibold text-slate-800">{r.customer_name}</p>
                  <p className="text-[11px] text-slate-500 font-mono">{r.customer_phone}</p>
                </td>
                <td className="p-3.5">
                  <p className="font-bold text-slate-900">{r.device_name}</p>
                  {r.imei_or_serial && <p className="text-[10px] font-mono text-slate-400">IMEI: {r.imei_or_serial}</p>}
                </td>
                <td className="p-3.5 max-w-xs text-slate-600 line-clamp-2">{r.problem_description}</td>
                <td className="p-3.5 text-right font-bold text-slate-900 font-display">{formatINR(r.final_cost || r.estimated_cost)}</td>
                <td className="p-3.5 text-right font-semibold text-emerald-600 font-display">{formatINR(r.advance_paid)}</td>
                <td className="p-3.5 text-center">
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                    r.status === 'READY' ? 'bg-emerald-100 text-emerald-800' :
                    r.status === 'DELIVERED' ? 'bg-slate-100 text-slate-700' :
                    r.status === 'DIAGNOSING' ? 'bg-amber-100 text-amber-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    ● {r.status}
                  </span>
                </td>
                <td className="p-3.5 text-center">
                  <select
                    value={r.status}
                    onChange={(e) => updateStatus(r.id, e.target.value)}
                    className="text-[11px] bg-white border border-slate-200 rounded px-2 py-1 font-semibold outline-none"
                  >
                    <option value="RECEIVED">Received</option>
                    <option value="DIAGNOSING">Diagnosing</option>
                    <option value="REPAIRING">Repairing</option>
                    <option value="READY">Ready for Delivery</option>
                    <option value="DELIVERED">Delivered</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Ticket Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl p-6 border border-slate-200 space-y-4 my-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">New Repair Ticket (Job Sheet)</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={form.customer_name}
                    onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                    placeholder="e.g. Sanjay Kadam"
                    className="w-full p-2 mt-1 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Customer Mobile (10-digits) *</label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={form.customer_phone}
                    onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                    placeholder="e.g. 9822778899"
                    className="w-full p-2 mt-1 border border-slate-200 rounded-lg font-mono outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Device Name & Model *</label>
                  <input
                    type="text"
                    required
                    value={form.device_name}
                    onChange={(e) => setForm({ ...form, device_name: e.target.value })}
                    placeholder="e.g. Samsung Galaxy S22 5G"
                    className="w-full p-2 mt-1 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">IMEI or Serial Number</label>
                  <input
                    type="text"
                    value={form.imei_or_serial}
                    onChange={(e) => setForm({ ...form, imei_or_serial: e.target.value })}
                    placeholder="15-digit IMEI"
                    className="w-full p-2 mt-1 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Problem Description *</label>
                <textarea
                  rows={2}
                  required
                  value={form.problem_description}
                  onChange={(e) => setForm({ ...form, problem_description: e.target.value })}
                  placeholder="Describe damage / issues (e.g. Cracked screen, battery drain, speaker issue)"
                  className="w-full p-2 mt-1 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Estimated Cost (₹)</label>
                  <input
                    type="number"
                    value={form.estimated_cost}
                    onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })}
                    placeholder="e.g. 4500"
                    className="w-full p-2 mt-1 border border-slate-200 rounded-lg font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Advance Paid (₹)</label>
                  <input
                    type="number"
                    value={form.advance_paid}
                    onChange={(e) => setForm({ ...form, advance_paid: e.target.value })}
                    placeholder="e.g. 1000"
                    className="w-full p-2 mt-1 border border-slate-200 rounded-lg font-bold text-emerald-700"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Payment Mode</label>
                  <select
                    value={form.payment_method}
                    onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                    className="w-full p-2 mt-1 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="CARD">Card</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 border border-slate-300 rounded-xl font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs"
                >
                  Create Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
