import React, { useState, useEffect } from 'react';
import { manufacturingApi, masterApi, inventoryApi } from '../../lib/api';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { toast } from 'sonner';
import { Plus, FlaskConical, Loader2, Play, CheckCircle, Shield, Undo2 } from 'lucide-react';
import { cn, formatNumber, formatDate, getStatusColor } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';

export const FillingOrdersPage = () => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('Admin');
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [saving, setSaving] = useState(false);
  const { subscribe } = useWebSocket();

  const [formData, setFormData] = useState({
    product_id: '',
    recipe_id: '',
    planned_quantity: '',
    target_location_id: '',
    notes: ''
  });

  const [actualQuantity, setActualQuantity] = useState('');
  const [planLoading, setPlanLoading] = useState(false);
  const [wipChoice, setWipChoice] = useState({ lot_number: '', quantity: '' });
  const [wipLots, setWipLots] = useState([]);
  const [packagingChoices, setPackagingChoices] = useState([]);

  const fetchData = async () => {
    try {
      const [ordersRes, productsRes, recipesRes, locationsRes] = await Promise.all([
        manufacturingApi.listFillingOrders(),
        masterApi.listProducts(),
        masterApi.listRecipes(),
        masterApi.listLocations()
      ]);
      setOrders(ordersRes.data);
      setProducts(productsRes.data);
      setRecipes(recipesRes.data);
      setLocations(locationsRes.data);
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
    const unsub = subscribe('filling.updated', fetchData);
    return () => unsub();
  }, [subscribe]);

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await manufacturingApi.createFillingOrder(formData);
      toast.success('Filling order created');
      setDialogOpen(false);
      setFormData({ product_id: '', recipe_id: '', planned_quantity: '', target_location_id: '', notes: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create order');
    } finally {
      setSaving(false);
    }
  };

  const handleStartOrder = async (order) => {
    try {
      await manufacturingApi.startFillingOrder(order.id);
      toast.success('Filling order started');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start order');
    }
  };

  const openFillDialog = async (order) => {
    setSelectedOrder(order);
    setActualQuantity(order.planned_quantity.toString());
    setActionDialogOpen(true);
    setPlanLoading(true);
    try {
      const response = await manufacturingApi.getConsumptionPlan(order.id);
      const plan = response.data;
      const firstWipLot = plan.wip.lots[0];
      setWipLots(plan.wip.lots);
      setWipChoice({
        lot_number: firstWipLot?.lot_number || '',
        quantity: plan.wip.suggested_quantity != null ? String(plan.wip.suggested_quantity) : ''
      });
      setPackagingChoices(plan.packaging.map((p) => ({
        material_id: p.material_id,
        name: p.name,
        uom: p.uom,
        lots: p.lots,
        available: p.available,
        lot_number: p.lots[0]?.lot_number || '',
        quantity: String(p.suggested_quantity)
      })));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to load consumption plan');
    } finally {
      setPlanLoading(false);
    }
  };

  const updatePackagingChoice = (index, field, value) => {
    const next = [...packagingChoices];
    next[index] = { ...next[index], [field]: value };
    setPackagingChoices(next);
  };

  const handleCompleteOrder = async () => {
    if (!selectedOrder || !actualQuantity) return;
    setSaving(true);

    try {
      if (wipChoice.lot_number && parseFloat(wipChoice.quantity) > 0) {
        await manufacturingApi.consumeWip(selectedOrder.id, wipChoice.lot_number, parseFloat(wipChoice.quantity));
      }
      for (const p of packagingChoices) {
        if (p.lot_number && parseFloat(p.quantity) > 0) {
          await manufacturingApi.consumePackaging(selectedOrder.id, p.material_id, p.lot_number, parseFloat(p.quantity));
        }
      }
      const result = await manufacturingApi.completeFillingOrder(selectedOrder.id, parseFloat(actualQuantity));
      toast.success(`Filling completed! FG Lot: ${result.data.fg_lot_number}`);
      setActionDialogOpen(false);
      setSelectedOrder(null);
      setActualQuantity('');
      setWipChoice({ lot_number: '', quantity: '' });
      setWipLots([]);
      setPackagingChoices([]);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete order');
    } finally {
      setSaving(false);
    }
  };

  const handleRelease = async (order) => {
    try {
      await manufacturingApi.releaseFillingOrder(order.id);
      toast.success('Filling order released');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to release');
    }
  };

  const handleCancel = async (order) => {
    const warning = order.status === 'Released' || order.status === 'Completed'
      ? `This will reverse ${order.filling_number}: delete its Finished Goods lot and give back the WIP/packaging it consumed. Continue?`
      : `Cancel ${order.filling_number}? This can't be undone.`;
    if (!confirm(warning)) return;
    try {
      await manufacturingApi.cancelFillingOrder(order.id);
      toast.success('Filling order cancelled and reversed');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel order');
    }
  };

  const getProductName = (id) => products.find(p => p.id === id)?.name || 'Unknown';
  const getRecipeName = (id) => recipes.find(r => r.id === id)?.name || 'Unknown';
  const getLocationName = (id) => locations.find(l => l.id === id)?.name || 'Unknown';

  const filteredRecipes = formData.product_id 
    ? recipes.filter(r => r.product_id === formData.product_id)
    : recipes;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F5132]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="filling-orders-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Filling Orders</h1>
          <p className="text-slate-500">Convert WIP batches to finished goods</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary gap-2" data-testid="create-filling-btn">
              <Plus className="w-4 h-4" />
              New Filling Order
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Filling Order</DialogTitle>
              <DialogDescription>Plan filling from WIP to finished goods</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div className="space-y-2">
                <Label>Product *</Label>
                <Select
                  value={formData.product_id}
                  onValueChange={(v) => setFormData({ ...formData, product_id: v, recipe_id: '' })}
                >
                  <SelectTrigger data-testid="filling-product-select">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Recipe *</Label>
                <Select
                  value={formData.recipe_id}
                  onValueChange={(v) => setFormData({ ...formData, recipe_id: v })}
                >
                  <SelectTrigger data-testid="filling-recipe-select">
                    <SelectValue placeholder="Select recipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredRecipes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} (v{r.version})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Planned Quantity (units) *</Label>
                <Input
                  type="number"
                  value={formData.planned_quantity}
                  onChange={(e) => setFormData({ ...formData, planned_quantity: e.target.value })}
                  placeholder="Number of units to fill"
                  required
                  data-testid="filling-quantity-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Target Location *</Label>
                <Select
                  value={formData.target_location_id}
                  onValueChange={(v) => setFormData({ ...formData, target_location_id: v })}
                >
                  <SelectTrigger data-testid="filling-location-select">
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
                  data-testid="filling-notes-input"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="btn-primary" disabled={saving} data-testid="save-filling-btn">
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Order
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Fill Order Dialog: record real WIP + packaging consumption, then complete */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fill Order {selectedOrder?.filling_number}</DialogTitle>
            <DialogDescription>
              Record what's actually consumed to produce this batch of finished goods.
            </DialogDescription>
          </DialogHeader>

          {planLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Planned Quantity</Label>
                <p className="text-lg font-semibold">{selectedOrder?.planned_quantity} units</p>
              </div>

              <div className="space-y-2 border-t pt-3">
                <Label className="text-xs uppercase text-slate-500">WIP Lot Consumed</Label>
                <div className="flex gap-2">
                  <Select
                    value={wipChoice.lot_number}
                    onValueChange={(v) => setWipChoice({ ...wipChoice, lot_number: v })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="No WIP lots available" />
                    </SelectTrigger>
                    <SelectContent>
                      {wipLots.length === 0 && <SelectItem value="none" disabled>No available WIP lot</SelectItem>}
                      {wipLots.map((l) => (
                        <SelectItem key={l.lot_number} value={l.lot_number}>
                          {l.lot_number} ({formatNumber(l.quantity_available, 2)} {l.unit_of_measure})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    className="w-28"
                    value={wipChoice.quantity}
                    onChange={(e) => setWipChoice({ ...wipChoice, quantity: e.target.value })}
                    placeholder="Qty"
                  />
                </div>
                <p className="text-xs text-slate-400">Suggested quantity is estimated from the product's fill size - adjust to the real amount used.</p>
              </div>

              <div className="space-y-3 border-t pt-3">
                <Label className="text-xs uppercase text-slate-500">Packaging Consumed</Label>
                {packagingChoices.length === 0 && (
                  <p className="text-sm text-slate-400">No packaging BOM found for this recipe.</p>
                )}
                {packagingChoices.map((p, idx) => (
                  <div key={p.material_id} className="space-y-1">
                    <p className="text-sm font-medium">{p.name} <span className="text-xs text-slate-400">({formatNumber(p.available, 2)} {p.uom} available)</span></p>
                    <div className="flex gap-2">
                      <Select
                        value={p.lot_number}
                        onValueChange={(v) => updatePackagingChoice(idx, 'lot_number', v)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="No lot available" />
                        </SelectTrigger>
                        <SelectContent>
                          {p.lots.length === 0 && <SelectItem value="none" disabled>No available lot</SelectItem>}
                          {p.lots.map((l) => (
                            <SelectItem key={l.lot_number} value={l.lot_number}>
                              {l.lot_number} ({formatNumber(l.quantity_available, 2)} {p.uom})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        className="w-28"
                        value={p.quantity}
                        onChange={(e) => updatePackagingChoice(idx, 'quantity', e.target.value)}
                        placeholder="Qty"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2 border-t pt-3">
                <Label>Actual Units Produced *</Label>
                <Input
                  type="number"
                  value={actualQuantity}
                  onChange={(e) => setActualQuantity(e.target.value)}
                  placeholder="Enter actual units"
                  data-testid="actual-units-input"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="btn-primary"
              onClick={handleCompleteOrder}
              disabled={saving || planLoading || !actualQuantity}
              data-testid="confirm-complete-filling-btn"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Record &amp; Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-slate-200">
        <CardHeader className="py-3 px-4 border-b border-slate-100">
          <Badge variant="secondary">{orders.length} filling orders</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs uppercase">Filling #</TableHead>
                <TableHead className="text-xs uppercase">Product</TableHead>
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
                    <TableCell className="lot-number">{order.filling_number}</TableCell>
                    <TableCell>{getProductName(order.product_id)}</TableCell>
                    <TableCell>{getRecipeName(order.recipe_id)}</TableCell>
                    <TableCell>{getLocationName(order.target_location_id)}</TableCell>
                    <TableCell className="text-right">{formatNumber(order.planned_quantity, 0)}</TableCell>
                    <TableCell className="text-right">
                      {order.actual_quantity ? formatNumber(order.actual_quantity, 0) : '-'}
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
                            data-testid={`start-filling-${order.filling_number}`}
                          >
                            <Play className="w-3 h-3 mr-1" /> Start
                          </Button>
                        )}
                        {order.status === 'In Progress' && (
                          <Button
                            size="sm"
                            className="btn-primary"
                            onClick={() => openFillDialog(order)}
                            data-testid={`complete-filling-${order.filling_number}`}
                          >
                            <CheckCircle className="w-3 h-3 mr-1" /> Fill Order
                          </Button>
                        )}
                        {order.status === 'Completed' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleRelease(order)}
                            data-testid={`release-filling-${order.filling_number}`}
                          >
                            <Shield className="w-3 h-3 mr-1" /> Release
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => handleCancel(order)}
                            data-testid={`cancel-filling-${order.filling_number}`}
                          >
                            <Undo2 className="w-3 h-3 mr-1" /> Cancel
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <FlaskConical className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No filling orders found</p>
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
