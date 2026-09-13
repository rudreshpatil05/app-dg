import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [business, setBusiness] = useState({
    name: 'Shree Ganesh Mobile & Electronics',
    phone: '9822012345',
    city: 'Pune',
    gstin: '27AABCS1429B1Z8',
    upi_id: 'shreeganesh@icici',
    invoice_prefix: 'SGM',
    thermal_printer_width: '80mm'
  });

  const [currentRole, setCurrentRole] = useState(localStorage.getItem('dg_user_role') || 'OWNER');
  const [currentUserId, setCurrentUserId] = useState(localStorage.getItem('dg_user_id') || '1');
  const [staffList, setStaffList] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [globalSearch, setGlobalSearch] = useState('');
  const [globalSearchResult, setGlobalSearchResult] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [toast, setToast] = useState(null);

  // Load initial business info and staff
  useEffect(() => {
    loadBusinessAndStaff();
    loadNotifications();
  }, [currentRole]);

  const loadBusinessAndStaff = async () => {
    try {
      const bizData = await api.getBusiness();
      setBusiness(bizData);
      const staffData = await api.getStaff();
      setStaffList(staffData);
    } catch (err) {
      console.warn('Could not load initial business info:', err.message);
    }
  };

  const loadNotifications = async () => {
    try {
      const notifs = await api.getNotifications(false);
      setNotifications(notifs);
    } catch (err) {
      console.warn('Could not load notifications:', err.message);
    }
  };

  const switchRole = (roleCode, userId = null) => {
    localStorage.setItem('dg_user_role', roleCode);
    if (userId) {
      localStorage.setItem('dg_user_id', String(userId));
      setCurrentUserId(String(userId));
    }
    setCurrentRole(roleCode);
    showToast(`Switched active terminal role to ${roleCode}`, 'info');
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Indian Rupee Currency Formatter (1,25,000.00)
  const formatINR = (val) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <AppContext.Provider
      value={{
        business,
        setBusiness,
        currentRole,
        currentUserId,
        staffList,
        switchRole,
        activeTab,
        setActiveTab,
        globalSearch,
        setGlobalSearch,
        globalSearchResult,
        setGlobalSearchResult,
        notifications,
        loadNotifications,
        showToast,
        formatINR,
        formatDate,
        isOwner: currentRole === 'OWNER',
        isManager: currentRole === 'MANAGER' || currentRole === 'OWNER',
        isStaff: currentRole === 'STAFF',
        isAccountant: currentRole === 'ACCOUNTANT' || currentRole === 'OWNER',
      }}
    >
      {children}

      {/* Global Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium animate-bounce border transition-all duration-300"
          style={{
            backgroundColor: toast.type === 'error' ? '#fef2f2' : (toast.type === 'info' ? '#eff6ff' : '#f0fdf4'),
            borderColor: toast.type === 'error' ? '#f87171' : (toast.type === 'info' ? '#60a5fa' : '#4ade80'),
            color: toast.type === 'error' ? '#991b1b' : (toast.type === 'info' ? '#1e40af' : '#166534')
          }}
        >
          <span>{toast.type === 'error' ? '⚠️' : (toast.type === 'info' ? 'ℹ️' : '✅')}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
