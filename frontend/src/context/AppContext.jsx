import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from '../api/client';

const AppContext = createContext();

const ROLE_ACCESS = {
  OWNER: ['*'],
  MANAGER: ['dashboard', 'pos', 'sales', 'inventory', 'customers', 'emi', 'purchases', 'suppliers', 'cashbank', 'expenses', 'exchange', 'repairs', 'warranty', 'reports'],
  STAFF: ['dashboard', 'pos', 'sales', 'inventory', 'customers', 'emi', 'exchange', 'repairs', 'warranty'],
  ACCOUNTANT: ['dashboard', 'sales', 'customers', 'emi', 'suppliers', 'cashbank', 'expenses', 'reports'],
};

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

  const [accessToken, setAccessToken] = useState(localStorage.getItem('dg_access_token'));
  const [currentRole, setCurrentRole] = useState(localStorage.getItem('dg_user_role') || null);
  const [currentUserId, setCurrentUserId] = useState(localStorage.getItem('dg_user_id') || null);
  const [currentUser, setCurrentUser] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [availableBusinesses, setAvailableBusinesses] = useState([]);
  const [activeBusinessId, setActiveBusinessId] = useState(localStorage.getItem('dg_active_business_id') || null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [globalSearch, setGlobalSearch] = useState('');
  const [globalSearchResult, setGlobalSearchResult] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [toast, setToast] = useState(null);
  const authLoadVersion = useRef(0);

  useEffect(() => {
    const handleAuthExpired = () => logout();
    window.addEventListener('dg-auth-expired', handleAuthExpired);
    return () => window.removeEventListener('dg-auth-expired', handleAuthExpired);
  }, []);

  useEffect(() => {
    const loadVersion = ++authLoadVersion.current;
    if (accessToken) loadBusinessContext(loadVersion);
  }, [accessToken]);

  const loadBusinessContext = async (loadVersion) => {
    try {
      const userData = await api.getMe();
      if (loadVersion !== authLoadVersion.current) return;
      setCurrentUser(userData);
      setCurrentRole(userData.role_code);
      setCurrentUserId(String(userData.id));
      localStorage.setItem('dg_user_role', userData.role_code);
      localStorage.setItem('dg_user_id', String(userData.id));
      const businesses = await api.getBusinesses();
      if (loadVersion !== authLoadVersion.current) return;
      setAvailableBusinesses(businesses);
      const storedId = localStorage.getItem('dg_active_business_id');
      const selected = businesses.find((store) => String(store.id) === storedId) || businesses[0];
      if (selected) {
        localStorage.setItem('dg_active_business_id', String(selected.id));
        setActiveBusinessId(String(selected.id));
      }
      const bizData = await api.getBusiness();
      if (loadVersion !== authLoadVersion.current) return;
      setBusiness(bizData);
      if (userData.role_code === 'OWNER') {
        const staffData = await api.getStaff();
        if (loadVersion !== authLoadVersion.current) return;
        setStaffList(staffData);
      } else {
        setStaffList([]);
      }
      await loadNotifications();
    } catch (err) {
      console.warn('Could not load initial business info:', err.message);
    }
  };

  const login = async (username, password) => {
    const response = await api.login(username, password);
    localStorage.setItem('dg_access_token', response.access_token);
    localStorage.setItem('dg_user_role', response.user.role_code);
    localStorage.setItem('dg_user_id', String(response.user.id));
    localStorage.setItem('dg_active_business_id', String(response.business.id));
    setCurrentUser(response.user);
    setCurrentRole(response.user.role_code);
    setCurrentUserId(String(response.user.id));
    setActiveBusinessId(String(response.business.id));
    setBusiness(response.business);
    setAccessToken(response.access_token);
  };

  const logout = () => {
    ['dg_access_token', 'dg_user_role', 'dg_user_id', 'dg_active_business_id'].forEach((key) => localStorage.removeItem(key));
    setAccessToken(null);
    setCurrentUser(null);
    setCurrentRole(null);
    setCurrentUserId(null);
    setAvailableBusinesses([]);
    setStaffList([]);
    setNotifications([]);
  };

  const switchBusiness = async (businessId) => {
    const selected = await api.switchBusiness(businessId);
    localStorage.setItem('dg_active_business_id', String(selected.id));
    setActiveBusinessId(String(selected.id));
    setBusiness(selected);
    const [staffData] = await Promise.all([api.getStaff(), loadNotifications()]);
    setStaffList(staffData);
    setGlobalSearch('');
    setGlobalSearchResult(null);
    setActiveTab('dashboard');
    showToast(`Switched to ${selected.name}`, 'info');
  };

  const loadNotifications = async () => {
    try {
      const notifs = await api.getNotifications(false);
      setNotifications(notifs);
    } catch (err) {
      console.warn('Could not load notifications:', err.message);
    }
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
        currentUser,
        accessToken,
        isAuthenticated: Boolean(accessToken),
        login,
        logout,
        staffList,
        availableBusinesses,
        activeBusinessId,
        switchBusiness,
        canAccess: (moduleId) => currentRole === 'OWNER' || (ROLE_ACCESS[currentRole] || []).includes(moduleId),
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
