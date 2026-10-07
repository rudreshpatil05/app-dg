const API_BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');

function buildApiUrl(endpoint) {
  return `${API_BASE}${endpoint}`;
}

function authHeaders() {
  const accessToken = localStorage.getItem('dg_access_token');
  const activeBusinessId = localStorage.getItem('dg_active_business_id');
  return {
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(activeBusinessId ? { 'X-Active-Business-Id': activeBusinessId } : {})
  };
}

export async function apiRequest(endpoint, method = 'GET', body = null, customHeaders = {}) {
  const accessToken = localStorage.getItem('dg_access_token');

  const headers = {
    'Content-Type': 'application/json',
    ...authHeaders(),
    ...customHeaders
  };

  const config = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(buildApiUrl(endpoint), config);
  } catch (error) {
    throw new Error('Unable to connect to server');
  }

  if (!response.ok) {
    let errorMsg = 'An unexpected error occurred';
    try {
      const errData = await response.json();
      errorMsg = errData.detail || errorMsg;
    } catch (e) {
      errorMsg = response.statusText;
    }
    if (response.status === 401 && accessToken) {
      window.dispatchEvent(new Event('dg-auth-expired'));
      errorMsg = 'Session expired. Please login again';
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

async function downloadFile(endpoint, filename, fallbackMessage) {
  const response = await fetch(buildApiUrl(endpoint), { headers: authHeaders() });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail || fallbackMessage);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const api = {
  // Auth & Store
  login: (username, password) => apiRequest('/auth/login', 'POST', { username, password }),
  getMe: () => apiRequest('/auth/me'),
  getStaff: () => apiRequest('/auth/staff'),
  getBusiness: () => apiRequest('/auth/business'),
  getBusinesses: () => apiRequest('/auth/businesses'),
  switchBusiness: (businessId) => apiRequest(`/auth/switch-business?business_id=${businessId}`, 'POST'),
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
  downloadSalesPdf: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    await downloadFile(`/reports/sales-summary/pdf${query ? `?${query}` : ''}`, `dg-retail-sales-${params.start_date || 'all'}-to-${params.end_date || 'all'}.pdf`, 'Could not generate PDF');
  },
  downloadSalesXlsx: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    await downloadFile(`/reports/sales-summary/xlsx${query ? `?${query}` : ''}`, `dg-retail-sales-${params.start_date || 'all'}-to-${params.end_date || 'all'}.xlsx`, 'Could not generate Excel file');
  },
  downloadExportCsv: (reportType) => downloadFile(`/reports/export/csv?report_type=${encodeURIComponent(reportType)}`, `dg-retail-${reportType}.csv`, 'Could not generate CSV file'),

  // Settings & Audit
  getAuditLogs: () => apiRequest('/settings/audit-logs'),
  getNotifications: (unreadOnly = false) => apiRequest(`/settings/notifications?unread_only=${unreadOnly}`),
  markNotificationRead: (id) => apiRequest(`/settings/notifications/${id}/read`, 'PUT'),
  downloadBackup: () => downloadFile('/settings/backup/export-json', 'dg-retail-backup.json', 'Could not generate backup')
};
