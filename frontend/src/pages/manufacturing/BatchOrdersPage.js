import React, { useState, useEffect } from 'react';
import { manufacturingApi, masterApi, inventoryApi } from '../../lib/api';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { toast } from 'sonner';
import { Plus, Factory, Loader2, Play, CheckCircle, AlertTriangle, Shield } from 'lucide-react';
import { cn, formatNumber, formatDate, getStatusColor } from '../../lib/utils';

export const BatchOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [saving, setSaving] = useState(false);
  const { subscribe } = useWebSocket();

  const [formData, setFormData] = useState({
    recipe_id: '',
    planned_quantity: '',
    target_location_id: '',
    notes: ''
  });

  const [actualQuantity, setActualQuantity] = useState('');

  const fetchData = async () => {
    try {
      const [ordersRes, recipesRes, locationsRes, stockRes] = await Promise.all([
        manufacturingApi.listBatchOrders(),
        masterApi.listRecipes(),
        masterApi.listLocations(),
        inventoryApi.getStock({ item_type: 'raw_material' })
      ]);
      setOrders(ordersRes.data);
      setRecipes(recipesRes.data);
      setLocations(locationsRes.data);
      setStock(stockRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const unsub = subscribe('batch.updated', fetchData);
    return () => unsub();
  }, [subscribe]);

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await manufacturingApi.createBatchOrder(formData);
      toast.success('Batch order created');
      setDialogOpen(false);
      setFormData({ recipe_id: '', planned_quantity: '', target_location_id: '', notes: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create order');
    } finally {
      setSaving(false);
    }
  };

  const handleStartOrder = async (order) => {
    try {
      await manufacturingApi.startBatchOrder(order.id);
      toast.success('Batch order started');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start order');
    }
  };

  const handleCompleteOrder = async () => {
    if (!selectedOrder || !actualQuantity) return;
    setSaving(true);

    try {
      const result = await manufacturingApi.completeBatchOrder(selectedOrder.id, parseFloat(actualQuantity));
      toast.success(`Batch completed! WIP Lot: ${result.data.wip_lot_number}`);
      setActionDialogOpen(false);
      setSelectedOrder(null);
      setActualQuantity('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete order');
    } finally {
      setSaving(false);
    }
  };

  const handleQaHold = async (order) => {
    try {
      await manufacturingApi.qaHoldBatch(order.id);
      toast.success('Batch placed on QA hold');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to place on hold');
    }
  };

  const handleRelease = async (order) => {
    try {
      await manufacturingApi.releaseBatch(order.id);
      toast.success('Batch released');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to release');
    }
  };

  const getRecipeName = (id) => recipes.find(r => r.id === id)?.name || 'Unknown';
  const getLocationName = (id) => locations.find(l => l.id === id)?.name || 'Unknown';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F5132]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="batch-orders-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Batch Orders</h1>
          <p className="text-slate-500">Manage WIP batch production</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary gap-2" data-testid="create-batch-btn">
              <Plus className="w-4 h-4" />
              New Batch Order
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Batch Order</DialogTitle>
              <DialogDescription>Plan a new batch production</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div className="space-y-2">
                <Label>Recipe *</Label>
                <Select
                  value={formData.recipe_id}
                  onValueChange={(v) => setFormData({ ...formData, recipe_id: v })}
                >
                  <SelectTrigger data-testid="batch-recipe-select">
                    <SelectValue placeholder="Select recipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {recipes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} (v{r.version})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Planned Quantity *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.planned_quantity}
                  onChange={(e) => setFormData({ ...formData, planned_quantity: e.target.value })}
                  placeholder="Enter quantity"
                  required
                  data-testid="batch-quantity-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Target Location *</Label>
                <Select
                  value={formData.target_location_id}
                  onValueChange={(v) => setFormData({ ...formData, target_location_id: v })}
                >
                  <SelectTrigger data-testid="batch-location-select">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional notes"
                  data-testid="batch-notes-input"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="btn-primary" disabled={saving} data-testid="save-batch-btn">
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Order
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Complete Order Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Batch Order</DialogTitle>
            <DialogDescription>
              Enter the actual quantity produced for batch {selectedOrder?.batch_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Planned Quantity</Label>
              <p className="text-lg font-semibold">{selectedOrder?.planned_quantity}</p>
            </div>
            <div className="space-y-2">
              <Label>Actual Quantity Produced *</Label>
              <Input
                type="number"
                step="0.01"
                value={actualQuantity}
                onChange={(e) => setActualQuantity(e.target.value)}
                placeholder="Enter actual quantity"
                data-testid="actual-quantity-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              className="btn-primary" 
              onClick={handleCompleteOrder} 
              disabled={saving || !actualQuantity}
              data-testid="confirm-complete-btn"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Complete Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-slate-200">
        <CardHeader className="py-3 px-4 border-b border-slate-100">
          <Badge variant="secondary">{orders.length} batch orders</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs uppercase">Batch #</TableHead>
                <TableHead className="text-xs uppercase">Recipe</TableHead>
                <TableHead className="text-xs uppercase">Location</TableHead>
                <TableHead className="text-xs uppercase text-right">Planned</TableHead>
                <TableHead className="text-xs uppercase text-right">Actual</TableHead>
                <TableHead className="text-xs uppercase">Status</TableHead>
                <TableHead className="text-xs uppercase">Created</TableHead>
                <TableHead className="text-xs uppercase">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length > 0 ? (
                orders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-slate-50">
                    <TableCell className="lot-number">{order.batch_number}</TableCell>
                    <TableCell>{getRecipeName(order.recipe_id)}</TableCell>
                    <TableCell>{getLocationName(order.target_location_id)}</TableCell>
                    <TableCell className="text-right">{formatNumber(order.planned_quantity, 2)}</TableCell>
                    <TableCell className="text-right">
                      {order.actual_quantity ? formatNumber(order.actual_quantity, 2) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs", getStatusColor(order.status))}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {formatDate(order.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {order.status === 'Planned' && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleStartOrder(order)}
                            data-testid={`start-batch-${order.batch_number}`}
                          >
                            <Play className="w-3 h-3 mr-1" /> Start
                          </Button>
                        )}
                        {order.status === 'In Progress' && (
                          <Button 
                            size="sm" 
                            className="btn-primary"
                            onClick={() => {
                              setSelectedOrder(order);
                              setActualQuantity(order.planned_quantity.toString());
                              setActionDialogOpen(true);
                            }}
                            data-testid={`complete-batch-${order.batch_number}`}
                          >
                            <CheckCircle className="w-3 h-3 mr-1" /> Complete
                          </Button>
                        )}
                        {order.status === 'Completed' && (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleQaHold(order)}
                              data-testid={`qa-hold-${order.batch_number}`}
                            >
                              <AlertTriangle className="w-3 h-3 mr-1" /> QA Hold
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleRelease(order)}
                              data-testid={`release-${order.batch_number}`}
                            >
                              <Shield className="w-3 h-3 mr-1" /> Release
                            </Button>
                          </>
                        )}
                        {order.status === 'QA Hold' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleRelease(order)}
                            data-testid={`release-hold-${order.batch_number}`}
                          >
                            <Shield className="w-3 h-3 mr-1" /> Release
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Factory className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No batch orders found</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
