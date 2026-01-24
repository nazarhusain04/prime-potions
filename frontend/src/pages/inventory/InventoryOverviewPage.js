import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { 
  Search, 
  Package, 
  AlertTriangle, 
  RefreshCw, 
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';

export const InventoryOverviewPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    type: '',
    category: '',
    belowMinOnly: false
  });
  const [pagination, setPagination] = useState({
    skip: 0,
    limit: 50,
    total: 0
  });
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        skip: pagination.skip,
        limit: pagination.limit
      });
      
      if (filters.search) params.append('search', filters.search);
      if (filters.type) params.append('item_type', filters.type);
      if (filters.category) params.append('category', filters.category);
      if (filters.belowMinOnly) params.append('below_min_only', 'true');

      const response = await api.get(`/inventory/onhand?${params}`);
      setItems(response.items || []);
      setPagination(prev => ({ ...prev, total: response.total || 0 }));
    } catch (error) {
      toast.error('Failed to load inventory');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [pagination.skip, pagination.limit, filters]);

  const fetchLowStockAlerts = async () => {
    try {
      const response = await api.get('/inventory/alerts/low-stock');
      setLowStockAlerts(response.alerts || []);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    }
  };

  useEffect(() => {
    fetchInventory();
    fetchLowStockAlerts();
  }, [fetchInventory]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, skip: 0 }));
    fetchInventory();
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, skip: 0 }));
  };

  const handleViewDetail = async (item) => {
    try {
      const response = await api.get(`/inventory/onhand/${item.id}`);
      setSelectedItem(response);
      setShowDetail(true);
    } catch (error) {
      toast.error('Failed to load item details');
    }
  };

  const getStockStatusBadge = (status) => {
    switch (status) {
      case 'OUT_OF_STOCK':
        return <Badge variant="destructive">Out of Stock</Badge>;
      case 'LOW_STOCK':
        return <Badge className="bg-yellow-500">Low Stock</Badge>;
      case 'IN_STOCK':
        return <Badge className="bg-green-500">In Stock</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'RAW': return 'Raw Material';
      case 'PACK': return 'Packaging';
      case 'FG': return 'Finished Good';
      case 'WIP': return 'WIP';
      default: return type;
    }
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const currentPage = Math.floor(pagination.skip / pagination.limit) + 1;

  return (
    <div className="space-y-6" data-testid="inventory-overview-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory Overview</h1>
          <p className="text-gray-500">Real-time on-hand inventory with stock alerts</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => { fetchInventory(); fetchLowStockAlerts(); }}
            data-testid="refresh-btn"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" data-testid="export-btn">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {lowStockAlerts.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-yellow-700">
              <AlertTriangle className="w-5 h-5" />
              Low Stock Alerts ({lowStockAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStockAlerts.slice(0, 10).map((alert, idx) => (
                <Badge 
                  key={idx} 
                  variant="outline" 
                  className="bg-white border-yellow-300 cursor-pointer hover:bg-yellow-100"
                  onClick={() => handleViewDetail(alert)}
                >
                  {alert.name} ({alert.on_hand_qty} / {alert.min_stock_level})
                </Badge>
              ))}
              {lowStockAlerts.length > 10 && (
                <Badge variant="secondary">+{lowStockAlerts.length - 10} more</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by SKU or name..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-9"
                  data-testid="search-input"
                />
              </div>
            </div>

            <div className="w-40">
              <label className="text-sm font-medium mb-1 block">Type</label>
              <Select 
                value={filters.type || 'all'} 
                onValueChange={(v) => handleFilterChange('type', v === 'all' ? '' : v)}
              >
                <SelectTrigger data-testid="type-filter">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="RAW">Raw Materials</SelectItem>
                  <SelectItem value="PACK">Packaging</SelectItem>
                  <SelectItem value="FG">Finished Goods</SelectItem>
                  <SelectItem value="WIP">Work in Progress</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="belowMinOnly"
                checked={filters.belowMinOnly}
                onChange={(e) => handleFilterChange('belowMinOnly', e.target.checked)}
                className="rounded border-gray-300"
                data-testid="below-min-checkbox"
              />
              <label htmlFor="belowMinOnly" className="text-sm">Below min only</label>
            </div>

            <Button type="submit" data-testid="apply-filters-btn">
              <Filter className="w-4 h-4 mr-2" />
              Apply
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">On Hand</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Available</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Reserved</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Min Stock</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading inventory...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                      No inventory items found
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr 
                      key={item.id || idx} 
                      className={`hover:bg-gray-50 ${item.stock_status === 'LOW_STOCK' ? 'bg-yellow-50' : ''} ${item.stock_status === 'OUT_OF_STOCK' ? 'bg-red-50' : ''}`}
                      data-testid={`inventory-row-${idx}`}
                    >
                      <td className="px-4 py-3 text-sm font-mono">{item.sku || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium">{item.name}</div>
                        {item.category && <div className="text-xs text-gray-500">{item.category}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{getTypeLabel(item.type)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className={item.stock_status === 'OUT_OF_STOCK' ? 'text-red-600 font-bold' : ''}>
                          {(item.on_hand_qty || 0).toFixed(2)}
                        </span>
                        <span className="text-gray-400 text-xs ml-1">{item.unit_of_measure || 'EA'}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">
                        {(item.available_qty || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">
                        {(item.reserved_qty || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {item.min_stock_level || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStockStatusBadge(item.stock_status)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleViewDetail(item)}
                          data-testid={`view-detail-${idx}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <div className="text-sm text-gray-500">
              Showing {pagination.skip + 1} to {Math.min(pagination.skip + pagination.limit, pagination.total)} of {pagination.total} items
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setPagination(prev => ({ ...prev, skip: prev.skip - prev.limit }))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm">Page {currentPage} of {totalPages || 1}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPagination(prev => ({ ...prev, skip: prev.skip + prev.limit }))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Item Detail Modal */}
      {showDetail && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDetail(false)}>
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{selectedItem.item?.name || 'Item Details'}</span>
                <Button variant="ghost" size="sm" onClick={() => setShowDetail(false)}>×</Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">{selectedItem.totals?.on_hand?.toFixed(2) || 0}</div>
                  <div className="text-xs text-blue-600">On Hand</div>
                </div>
                <div className="bg-green-50 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">{selectedItem.totals?.available?.toFixed(2) || 0}</div>
                  <div className="text-xs text-green-600">Available</div>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-orange-600">{selectedItem.totals?.reserved?.toFixed(2) || 0}</div>
                  <div className="text-xs text-orange-600">Reserved</div>
                </div>
              </div>

              {/* Lots */}
              {selectedItem.lots && selectedItem.lots.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Lot Breakdown</h4>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1 text-left">Lot #</th>
                        <th className="px-2 py-1 text-left">Location</th>
                        <th className="px-2 py-1 text-right">Qty</th>
                        <th className="px-2 py-1 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedItem.lots.map((lot, idx) => (
                        <tr key={idx}>
                          <td className="px-2 py-1 font-mono text-xs">{lot.lot_number}</td>
                          <td className="px-2 py-1">{lot.location_id}</td>
                          <td className="px-2 py-1 text-right">{lot.quantity_on_hand?.toFixed(2)}</td>
                          <td className="px-2 py-1 text-center">
                            <Badge variant="outline" className="text-xs">{lot.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Recent Transactions */}
              {selectedItem.recent_transactions && selectedItem.recent_transactions.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Recent Transactions</h4>
                  <div className="space-y-1 max-h-40 overflow-auto">
                    {selectedItem.recent_transactions.slice(0, 5).map((tx, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm bg-gray-50 px-2 py-1 rounded">
                        <span className={tx.quantity > 0 ? 'text-green-600' : 'text-red-600'}>
                          {tx.quantity > 0 ? '+' : ''}{tx.quantity?.toFixed(2)} {tx.unit_of_measure}
                        </span>
                        <span className="text-gray-500 capitalize">{tx.transaction_type}</span>
                        <span className="text-xs text-gray-400">{new Date(tx.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default InventoryOverviewPage;
