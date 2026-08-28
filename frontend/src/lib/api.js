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

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
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
  createUnit: (data) => api.post('/master/units', data),
  
  // Locations
  listLocations: () => api.get('/master/locations'),
  getLocation: (id) => api.get(`/master/locations/${id}`),
  createLocation: (data) => api.post('/master/locations', data),
  
  // Raw Materials
  listRawMaterials: () => api.get('/master/raw-materials'),
  getRawMaterial: (id) => api.get(`/master/raw-materials/${id}`),
  createRawMaterial: (data) => api.post('/master/raw-materials', data),
  updateRawMaterial: (id, data) => api.put(`/master/raw-materials/${id}`, data),
  
  // Packaging Materials
  listPackagingMaterials: () => api.get('/master/packaging-materials'),
  getPackagingMaterial: (id) => api.get(`/master/packaging-materials/${id}`),
  createPackagingMaterial: (data) => api.post('/master/packaging-materials', data),
  
  // Products
  listProducts: () => api.get('/master/products'),
  getProduct: (id) => api.get(`/master/products/${id}`),
  createProduct: (data) => api.post('/master/products', data),
  
  // Recipes
  listRecipes: (productId) => api.get('/master/recipes', { params: { product_id: productId } }),
  getRecipe: (id) => api.get(`/master/recipes/${id}`),
  createRecipe: (data) => api.post('/master/recipes', data),
};

// Inventory API
export const inventoryApi = {
  getStock: (params) => api.get('/inventory/stock', { params }),
  getStockSummary: () => api.get('/inventory/stock/summary'),
  listTransactions: (params) => api.get('/inventory/transactions', { params }),
  createTransaction: (data) => api.post('/inventory/transactions', data),
  receive: (params) => api.post('/inventory/receive', null, { params }),
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
  consumeWip: (id, wipLotNumber, quantity) => api.post(`/manufacturing/filling-orders/${id}/consume-wip`, null, { params: { wip_lot_number: wipLotNumber, quantity } }),
  consumePackaging: (id, materialId, lotNumber, quantity) => api.post(`/manufacturing/filling-orders/${id}/consume-packaging`, null, { params: { material_id: materialId, lot_number: lotNumber, quantity } }),
  completeFillingOrder: (id, actualQuantity) => api.post(`/manufacturing/filling-orders/${id}/complete`, null, { params: { actual_quantity: actualQuantity } }),
  releaseFillingOrder: (id) => api.post(`/manufacturing/filling-orders/${id}/release`),
  
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

// Seed API
export const seedApi = {
  seed: () => api.post('/seed'),
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
