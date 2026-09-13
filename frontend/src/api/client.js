const API_BASE = '/api/v1';

export async function apiRequest(endpoint, method = 'GET', body = null, customHeaders = {}) {
  const currentRole = localStorage.getItem('dg_user_role') || 'OWNER';
  const currentUserId = localStorage.getItem('dg_user_id') || '1';

  const headers = {
    'Content-Type': 'application/json',
    'X-User-Role': currentRole,
    'X-User-Id': currentUserId,
    ...customHeaders
  };

  const config = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  if (!response.ok) {
    let errorMsg = 'An unexpected error occurred';
    try {
      const errData = await response.json();
      errorMsg = errData.detail || errorMsg;
    } catch (e) {
      errorMsg = response.statusText;
    }
    throw new Error(errorMsg);
  }

  // If response is CSV or blob
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('text/csv')) {
    return await response.text();
  }

  return await response.json();
}

export const api = {
  // Auth & Store
  getMe: () => apiRequest('/auth/me'),
  getStaff: () => apiRequest('/auth/staff'),
  getBusiness: () => apiRequest('/auth/business'),
  updateBusiness: (data) => apiRequest('/auth/business', 'PUT', data),
  pinLogin: (pin, business_id = 1) => apiRequest('/auth/pin-login', 'POST', { pin, business_id }),

  // Dashboard
  getDashboardSummary: () => apiRequest('/dashboard/summary'),

  // Inventory & Serial Numbers
  getCategories: () => apiRequest('/inventory/categories'),
  createCategory: (cat) => apiRequest('/inventory/categories', 'POST', cat),
  getProducts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/inventory/products${query ? `?${query}` : ''}`);
  },
  createProduct: (product) => apiRequest('/inventory/products', 'POST', product),
  getSerialNumbers: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/inventory/serial-numbers${query ? `?${query}` : ''}`);
  },
  searchImeiOrBarcode: (q) => apiRequest(`/inventory/serial-numbers/search?q=${encodeURIComponent(q)}`),
  updateSerialStatus: (serialId, data) => apiRequest(`/inventory/serial-numbers/${serialId}/status`, 'POST', data),

  // POS & Sales
  checkoutPOS: (saleData) => apiRequest('/pos/checkout', 'POST', saleData),
  getSales: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/pos/sales${query ? `?${query}` : ''}`);
  },
  getSaleDetails: (saleId) => apiRequest(`/pos/sales/${saleId}`),
  returnSale: (saleId, returnData) => apiRequest(`/pos/sales/${saleId}/return`, 'POST', returnData),

  // Customers & Khatabook
  getCustomers: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/customers${query ? `?${query}` : ''}`);
  },
  createCustomer: (customer) => apiRequest('/customers', 'POST', customer),
  getCustomerDetails: (customerId) => apiRequest(`/customers/${customerId}`),
  getCustomerLedger: (customerId) => apiRequest(`/customers/${customerId}/ledger`),
  receivePayment: (customerId, paymentData) => apiRequest(`/customers/${customerId}/receive-payment`, 'POST', paymentData),
  getCustomerWhatsappLink: (customerId) => apiRequest(`/customers/${customerId}/whatsapp-reminder`),

  // Store-Financed EMI
  getEmiDashboard: () => apiRequest('/emi/dashboard'),
  getEmiPlans: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/emi/plans${query ? `?${query}` : ''}`);
  },
  getEmiPlanDetails: (planId) => apiRequest(`/emi/plans/${planId}`),
  collectEmiPayment: (planId, paymentData) => apiRequest(`/emi/collect/${planId}`, 'POST', paymentData),
  getEmiInstallmentWhatsappLink: (installmentId) => apiRequest(`/emi/installments/${installmentId}/whatsapp-reminder`),

  // Purchases & Suppliers
  getPurchases: () => apiRequest('/purchases'),
  createPurchase: (purchaseData) => apiRequest('/purchases', 'POST', purchaseData),
  getSuppliers: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/suppliers${query ? `?${query}` : ''}`);
  },
  createSupplier: (supplier) => apiRequest('/suppliers', 'POST', supplier),
  getSupplierLedger: (supplierId) => apiRequest(`/suppliers/${supplierId}/ledger`),
  paySupplier: (supplierId, paymentData) => apiRequest(`/suppliers/${supplierId}/pay`, 'POST', paymentData),

  // Finance, Expenses & Cash Reconciliation
  getExpenseCategories: () => apiRequest('/finance/expense-categories'),
  getExpenses: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/finance/expenses${query ? `?${query}` : ''}`);
  },
  createExpense: (expenseData) => apiRequest('/finance/expenses', 'POST', expenseData),
  getAccounts: () => apiRequest('/finance/accounts'),
  getCashReconciliationSummary: (targetDate = null) => {
    return apiRequest(`/finance/cash-reconciliation/summary${targetDate ? `?target_date=${targetDate}` : ''}`);
  },
  submitCashReconciliation: (data) => apiRequest('/finance/cash-reconciliation', 'POST', data),
  getCashReconciliationsList: () => apiRequest('/finance/cash-reconciliations'),

  // Specialized: Exchange, Warranty & Repairs
  getExchangeDevices: (status = null) => apiRequest(`/specialized/exchange${status ? `?status_filter=${status}` : ''}`),
  updateExchangeStatus: (id, data) => apiRequest(`/specialized/exchange/${id}/status`, 'POST', data),
  getWarranties: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/specialized/warranty${query ? `?${query}` : ''}`);
  },
  getRepairs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/specialized/repairs${query ? `?${query}` : ''}`);
  },
  createRepair: (repairData) => apiRequest('/specialized/repairs', 'POST', repairData),
  updateRepairStatus: (ticketId, data) => apiRequest(`/specialized/repairs/${ticketId}/status`, 'PUT', data),

  // Reports
  getSalesReport: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/reports/sales-summary${query ? `?${query}` : ''}`);
  },
  getProfitLossReport: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/reports/profit-loss${query ? `?${query}` : ''}`);
  },
  getGstSummaryReport: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/reports/gst-summary${query ? `?${query}` : ''}`);
  },
  getStockValuationReport: () => apiRequest('/reports/stock-valuation'),
  getExportCsvUrl: (reportType) => `/api/v1/reports/export/csv?report_type=${reportType}`,

  // Settings & Audit
  getAuditLogs: () => apiRequest('/settings/audit-logs'),
  getNotifications: (unreadOnly = false) => apiRequest(`/settings/notifications?unread_only=${unreadOnly}`),
  markNotificationRead: (id) => apiRequest(`/settings/notifications/${id}/read`, 'PUT'),
  getBackupExportUrl: () => '/api/v1/settings/backup/export-json'
};
