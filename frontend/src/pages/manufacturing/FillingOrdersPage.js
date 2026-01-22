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
import { Plus, FlaskConical, Loader2, Play, CheckCircle, Shield } from 'lucide-react';
import { cn, formatNumber, formatDate, getStatusColor } from '../../lib/utils';

export const FillingOrdersPage = () => {
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

  const handleCompleteOrder = async () => {
    if (!selectedOrder || !actualQuantity) return;
    setSaving(true);

    try {
      const result = await manufacturingApi.completeFillingOrder(selectedOrder.id, parseFloat(actualQuantity));
      toast.success(`Filling completed! FG Lot: ${result.data.fg_lot_number}`);
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

  const handleRelease = async (order) => {
    try {
      await manufacturingApi.releaseFillingOrder(order.id);
      toast.success('Filling order released');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to release');
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

      {/* Complete Order Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Filling Order</DialogTitle>
            <DialogDescription>
              Enter the actual units produced for filling {selectedOrder?.filling_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Planned Quantity</Label>
              <p className="text-lg font-semibold">{selectedOrder?.planned_quantity} units</p>
            </div>
            <div className="space-y-2">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              className="btn-primary" 
              onClick={handleCompleteOrder} 
              disabled={saving || !actualQuantity}
              data-testid="confirm-complete-filling-btn"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Complete Filling
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
                            onClick={() => {
                              setSelectedOrder(order);
                              setActualQuantity(order.planned_quantity.toString());
                              setActionDialogOpen(true);
                            }}
                            data-testid={`complete-filling-${order.filling_number}`}
                          >
                            <CheckCircle className="w-3 h-3 mr-1" /> Complete
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
