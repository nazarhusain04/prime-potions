import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

// Create axios instance
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// FastAPI validation errors (422) return `detail` as a list of {type, loc, msg, ...}
// objects (or occasionally a single such object) instead of a string. Pages generally
// do `toast.error(error.response?.data?.detail || '...')`, which crashes React if
// `detail` isn't a string - so normalize it here, once, for every request.
const stringifyErrorDetail = (detail) => {
  if (typeof detail === 'string' || detail == null) return detail;
  const errors = Array.isArray(detail) ? detail : [detail];
  const messages = errors
    .map((e) => (e && typeof e === 'object' ? e.msg : null))
    .filter(Boolean);
  if (messages.length) return messages.join('; ');
  try {
    return JSON.stringify(detail);
  } catch {
    return 'Request failed';
  }
};

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    if (error.response?.data && 'detail' in error.response.data) {
      error.response.data.detail = stringifyErrorDetail(error.response.data.detail);
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  getMe: () => api.get('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword }),
};

// Users API
export const usersApi = {
  list: () => api.get('/users'),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
};

// Settings API
export const settingsApi = {
  getCompany: () => api.get('/settings/company'),
  updateCompany: (data) => api.put('/settings/company', data),
};

// Master Data API
export const masterApi = {
  // Units
  listUnits: () => api.get('/master/units'),
  getUnit: (id) => api.get(`/master/units/${id}`),
  createUnit: (data) => api.post('/master/units', data),
  updateUnit: (id, data) => api.put(`/master/units/${id}`, data),

  // Locations
  listLocations: () => api.get('/master/locations'),
  getLocation: (id) => api.get(`/master/locations/${id}`),
  createLocation: (data) => api.post('/master/locations', data),
  updateLocation: (id, data) => api.put(`/master/locations/${id}`, data),

  // Raw Materials
  listRawMaterials: () => api.get('/master/raw-materials'),
  getRawMaterial: (id) => api.get(`/master/raw-materials/${id}`),
  createRawMaterial: (data) => api.post('/master/raw-materials', data),
  updateRawMaterial: (id, data) => api.put(`/master/raw-materials/${id}`, data),

  // Packaging Materials
  listPackagingMaterials: () => api.get('/master/packaging-materials'),
  getPackagingMaterial: (id) => api.get(`/master/packaging-materials/${id}`),
  createPackagingMaterial: (data) => api.post('/master/packaging-materials', data),
  updatePackagingMaterial: (id, data) => api.put(`/master/packaging-materials/${id}`, data),
  deletePackagingMaterial: (id) => api.delete(`/master/packaging-materials/${id}`),

  // Products
  listProducts: () => api.get('/master/products'),
  getProduct: (id) => api.get(`/master/products/${id}`),
  createProduct: (data) => api.post('/master/products', data),
  updateProduct: (id, data) => api.put(`/master/products/${id}`, data),
  
  // Recipes
  listRecipes: (productId) => api.get('/master/recipes', { params: { product_id: productId } }),
  getRecipe: (id) => api.get(`/master/recipes/${id}`),
  createRecipe: (data) => api.post('/master/recipes', data),
  updateRecipe: (id, data) => api.put(`/master/recipes/${id}`, data),
  deleteRecipe: (id) => api.delete(`/master/recipes/${id}`),
};

// Inventory API
export const inventoryApi = {
  getStock: (params) => api.get('/inventory/stock', { params }),
  getStockSummary: () => api.get('/inventory/stock/summary'),
  listTransactions: (params) => api.get('/inventory/transactions', { params }),
  createTransaction: (data) => api.post('/inventory/transactions', data),
  updateTransaction: (id, data) => api.put(`/inventory/transactions/${id}`, data),
  deleteTransaction: (id) => api.delete(`/inventory/transactions/${id}`),
  receive: (params) => api.post('/inventory/receive', null, { params }),
  transfer: (data) => api.post('/inventory/transfer', data),
  getIssueReasons: () => api.get('/inventory/issue-reasons'),
  issue: (data) => api.post('/inventory/issue', data),
};

// Manufacturing API
export const manufacturingApi = {
  // Batch Orders
  listBatchOrders: (status) => api.get('/manufacturing/batch-orders', { params: { status } }),
  getBatchOrder: (id) => api.get(`/manufacturing/batch-orders/${id}`),
  createBatchOrder: (data) => api.post('/manufacturing/batch-orders', data),
  startBatchOrder: (id) => api.post(`/manufacturing/batch-orders/${id}/start`),
  consumeMaterials: (id, consumptions) => api.post(`/manufacturing/batch-orders/${id}/consume`, consumptions),
  completeBatchOrder: (id, actualQuantity) => api.post(`/manufacturing/batch-orders/${id}/complete`, null, { params: { actual_quantity: actualQuantity } }),
  qaHoldBatch: (id) => api.post(`/manufacturing/batch-orders/${id}/qa-hold`),
  releaseBatch: (id) => api.post(`/manufacturing/batch-orders/${id}/release`),
  
  // Filling Orders
  listFillingOrders: (status) => api.get('/manufacturing/filling-orders', { params: { status } }),
  getFillingOrder: (id) => api.get(`/manufacturing/filling-orders/${id}`),
  createFillingOrder: (data) => api.post('/manufacturing/filling-orders', data),
  startFillingOrder: (id) => api.post(`/manufacturing/filling-orders/${id}/start`),
  getConsumptionPlan: (id) => api.get(`/manufacturing/filling-orders/${id}/consumption-plan`),
  consumeWip: (id, wipLotNumber, quantity) => api.post(`/manufacturing/filling-orders/${id}/consume-wip`, null, { params: { wip_lot_number: wipLotNumber, quantity } }),
  consumePackaging: (id, materialId, lotNumber, quantity) => api.post(`/manufacturing/filling-orders/${id}/consume-packaging`, null, { params: { material_id: materialId, lot_number: lotNumber, quantity } }),
  completeFillingOrder: (id, actualQuantity) => api.post(`/manufacturing/filling-orders/${id}/complete`, null, { params: { actual_quantity: actualQuantity } }),
  releaseFillingOrder: (id) => api.post(`/manufacturing/filling-orders/${id}/release`),
  cancelFillingOrder: (id) => api.delete(`/manufacturing/filling-orders/${id}`),
  
  // Feasibility
  getFeasibility: (productId) => api.get(`/manufacturing/feasibility/${productId}`),
  getWipOnFloor: () => api.get('/manufacturing/wip-on-floor'),
};

// Traceability API
export const traceabilityApi = {
  traceForward: (lotNumber) => api.get(`/traceability/forward/${lotNumber}`),
  traceBackward: (lotNumber) => api.get(`/traceability/backward/${lotNumber}`),
  whereUsed: (itemId, itemType) => api.get(`/traceability/where-used/${itemId}`, { params: { item_type: itemType } }),
};

// Dashboard API
export const dashboardApi = {
  getSummary: () => api.get('/dashboard/summary'),
};

// Audit Logs API
export const auditApi = {
  list: (params) => api.get('/audit-logs', { params }),
};

// WebSocket connection
export const createWebSocket = (onMessage) => {
  const wsUrl = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');
  const ws = new WebSocket(`${wsUrl}/ws`);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (e) {
      console.error('WebSocket message parse error:', e);
    }
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected');
  };
  
  return ws;
};

export default api;
