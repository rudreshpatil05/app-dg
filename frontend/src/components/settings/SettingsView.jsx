import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { Settings, Shield, Download, FileText, CheckCircle, Smartphone } from 'lucide-react';

export default function SettingsView() {
  const { business, setBusiness, staffList, showToast, isOwner, formatDate } = useApp();

  const [bizForm, setBizForm] = useState({ ...business });
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  useEffect(() => {
    setBizForm({ ...business });
    if (isOwner) {
      loadAuditLogs();
    }
  }, [business, isOwner]);

  const loadAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const logs = await api.getAuditLogs();
      setAuditLogs(logs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleSaveBusiness = async (e) => {
    e.preventDefault();
    try {
      const updated = await api.updateBusiness(bizForm);
      setBusiness(updated);
      showToast('Store settings and GST profile updated!');
    } catch (err) {
      showToast(err.message || 'Update failed', 'error');
    }
  };

  const handleDownloadBackup = () => {
    window.open(api.getBackupExportUrl(), '_blank');
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl">
      
      {/* Header */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-600" />
            Store Settings & System Audit Logs
          </h2>
          <p className="text-xs text-slate-500">Configure business GSTIN, POS thermal printer width, staff permissions, and backup data</p>
        </div>
        {isOwner && (
          <button
            onClick={handleDownloadBackup}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold shadow-xs"
          >
            <Download className="w-4 h-4 text-emerald-400" /> Download Full JSON Backup
          </button>
        )}
      </div>

      {/* Store Profile Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 border-b pb-2">Business & GST Billing Profile</h3>

        <form onSubmit={handleSaveBusiness} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700">Store Name *</label>
              <input
                type="text"
                required
                value={bizForm.name || ''}
                onChange={(e) => setBizForm({ ...bizForm, name: e.target.value })}
                className="w-full p-2 mt-1 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 font-bold"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700">GSTIN *</label>
              <input
                type="text"
                value={bizForm.gstin || ''}
                onChange={(e) => setBizForm({ ...bizForm, gstin: e.target.value })}
                className="w-full p-2 mt-1 border border-slate-200 rounded-lg font-mono font-bold text-emerald-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700">Phone Number</label>
              <input
                type="tel"
                value={bizForm.phone || ''}
                onChange={(e) => setBizForm({ ...bizForm, phone: e.target.value })}
                className="w-full p-2 mt-1 border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700">UPI ID for Customer QR</label>
              <input
                type="text"
                value={bizForm.upi_id || ''}
                onChange={(e) => setBizForm({ ...bizForm, upi_id: e.target.value })}
                className="w-full p-2 mt-1 border border-slate-200 rounded-lg font-mono text-indigo-700 font-semibold"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700">Thermal Printer Width</label>
              <select
                value={bizForm.thermal_printer_width || '80mm'}
                onChange={(e) => setBizForm({ ...bizForm, thermal_printer_width: e.target.value })}
                className="w-full p-2 mt-1 border border-slate-200 rounded-lg bg-white font-semibold"
              >
                <option value="80mm">80mm (Standard POS Thermal)</option>
                <option value="58mm">58mm (Small Thermal Printer)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700">Address</label>
            <input
              type="text"
              value={bizForm.address || ''}
              onChange={(e) => setBizForm({ ...bizForm, address: e.target.value })}
              className="w-full p-2 mt-1 border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700">Invoice Terms & Conditions (Printed on receipts)</label>
            <textarea
              rows={2}
              value={bizForm.terms_and_conditions || ''}
              onChange={(e) => setBizForm({ ...bizForm, terms_and_conditions: e.target.value })}
              className="w-full p-2 mt-1 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm text-xs"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>

      {/* Staff & Roles Directory */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 border-b pb-2">Authorized Store Staff & Role-Based Access</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {staffList.map((s) => (
            <div key={s.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">{s.full_name}</p>
                <p className="text-[11px] text-slate-500">Username: {s.username} • PIN: {s.pin ? '••••' : 'None'}</p>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                s.role_code === 'OWNER' ? 'bg-purple-100 text-purple-800' :
                s.role_code === 'MANAGER' ? 'bg-blue-100 text-blue-800' :
                s.role_code === 'ACCOUNTANT' ? 'bg-emerald-100 text-emerald-800' :
                'bg-amber-100 text-amber-800'
              }`}>
                {s.role_code}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Audit Logs Table (Owner & Manager only) */}
      {isOwner && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-600" />
              Immutable Activity Audit Trail
            </h3>
            <span className="text-[11px] text-slate-500">Last 50 actions logged</span>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">User & Role</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Entity</th>
                  <th className="p-3">Details / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/70">
                    <td className="p-3 font-mono text-slate-500 text-[11px]">{formatDate(l.created_at)}</td>
                    <td className="p-3 font-semibold text-slate-900">{l.user_name} ({l.role})</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-mono font-bold text-[10px] text-slate-800">
                        {l.action}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600">{l.entity_type} #{l.entity_id || '-'}</td>
                    <td className="p-3 text-slate-500 text-[11px] max-w-xs truncate">{l.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
