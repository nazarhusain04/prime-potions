import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { inventoryApi, masterApi } from '../../lib/api';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Combobox } from '../../components/ui/combobox';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import { Search, Boxes, RefreshCw, ArrowRightLeft, Loader2 } from 'lucide-react';
import { cn, formatNumber, getStatusColor } from '../../lib/utils';

export const StockPage = () => {
  const [stock, setStock] = useState([]);
  const [locations, setLocations] = useState([]);
  const [itemsById, setItemsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState(null);
  const [moveForm, setMoveForm] = useState({ to_location_id: '', quantity: '', notes: '' });
  const [moving, setMoving] = useState(false);
  const { subscribe } = useWebSocket();

  const fetchData = async () => {
    try {
      const [stockRes, locationsRes, rawRes, pkgRes] = await Promise.all([
        inventoryApi.getStock(),
        masterApi.listLocations(),
        masterApi.listRawMaterials(),
        masterApi.listPackagingMaterials()
      ]);
      setStock(stockRes.data);
      setLocations(locationsRes.data);
      const idMap = {};
      [...rawRes.data, ...pkgRes.data].forEach((it) => {
        idMap[it.id] = it;
      });
      setItemsById(idMap);
    } catch (error) {
      toast.error('Failed to load stock data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const unsub = subscribe('inventory.updated', fetchData);
    return () => unsub();
  }, [subscribe]);

  const getLocationName = (id) => locations.find(l => l.id === id)?.name || 'Unknown';
  const getItem = (id) => itemsById[id];

  const openMoveDialog = (stockItem) => {
    setMoveTarget(stockItem);
    setMoveForm({ to_location_id: '', quantity: String(stockItem.quantity_available), notes: '' });
    setMoveDialogOpen(true);
  };

  const handleMove = async (e) => {
    e.preventDefault();
    if (!moveTarget) return;
    setMoving(true);
    try {
      await inventoryApi.transfer({
        item_id: moveTarget.item_id,
        item_type: moveTarget.item_type,
        lot_number: moveTarget.lot_number,
        from_location_id: moveTarget.location_id,
        to_location_id: moveForm.to_location_id,
        quantity: parseFloat(moveForm.quantity),
        notes: moveForm.notes
      });
      toast.success(`Moved ${moveForm.quantity} ${moveTarget.unit_of_measure} to ${getLocationName(moveForm.to_location_id)}`);
      setMoveDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to move stock');
    } finally {
      setMoving(false);
    }
  };

  const filteredStock = stock.filter(s => {
    const item = getItem(s.item_id);
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query ||
      s.lot_number.toLowerCase().includes(query) ||
      item?.sku?.toLowerCase().includes(query) ||
      item?.name?.toLowerCase().includes(query);
    const matchesType = selectedType === 'all' || s.item_type === selectedType;
    const matchesLocation = selectedLocation === 'all' || s.location_id === selectedLocation;
    return matchesSearch && matchesType && matchesLocation;
  });

  const groupedByType = {
    raw_material: filteredStock.filter(s => s.item_type === 'raw_material'),
    packaging_material: filteredStock.filter(s => s.item_type === 'packaging_material'),
    wip_batch: filteredStock.filter(s => s.item_type === 'wip_batch'),
    finished_good: filteredStock.filter(s => s.item_type === 'finished_good')
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F5132]" />
      </div>
    );
  }

  const StockTable = ({ items, emptyMessage }) => (
    <Table>
      <TableHeader>
        <TableRow className="bg-slate-50">
          <TableHead className="text-xs uppercase">Item</TableHead>
          <TableHead className="text-xs uppercase">Lot Number</TableHead>
          <TableHead className="text-xs uppercase">Location</TableHead>
          <TableHead className="text-xs uppercase text-right">On Hand</TableHead>
          <TableHead className="text-xs uppercase text-right">Available</TableHead>
          <TableHead className="text-xs uppercase text-right">Reserved</TableHead>
          <TableHead className="text-xs uppercase">Unit</TableHead>
          <TableHead className="text-xs uppercase">Status</TableHead>
          <TableHead className="text-xs uppercase">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length > 0 ? (
          items.map((stockItem, idx) => {
            const item = getItem(stockItem.item_id);
            return (
              <TableRow key={idx} className="hover:bg-slate-50">
                <TableCell>
                  {item ? (
                    <>
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-400">{item.sku}</p>
                    </>
                  ) : (
                    <span className="text-slate-400 text-xs">Unknown item</span>
                  )}
                </TableCell>
                <TableCell className="lot-number">{stockItem.lot_number}</TableCell>
                <TableCell>{getLocationName(stockItem.location_id)}</TableCell>
                <TableCell className="text-right font-medium">{formatNumber(stockItem.quantity_on_hand, 2)}</TableCell>
                <TableCell className="text-right text-emerald-600">{formatNumber(stockItem.quantity_available, 2)}</TableCell>
                <TableCell className="text-right text-amber-600">{formatNumber(stockItem.quantity_reserved, 2)}</TableCell>
                <TableCell>{stockItem.unit_of_measure}</TableCell>
                <TableCell>
                  <Badge className={cn("text-xs", getStatusColor(stockItem.status))}>
                    {stockItem.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={stockItem.quantity_available <= 0}
                    onClick={() => openMoveDialog(stockItem)}
                    data-testid={`move-stock-${stockItem.lot_number}`}
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    Move
                  </Button>
                </TableCell>
              </TableRow>
            );
          })
        ) : (
          <TableRow>
            <TableCell colSpan={9} className="text-center py-8">
              <Boxes className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">{emptyMessage}</p>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6" data-testid="stock-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock Overview</h1>
          <p className="text-slate-500">Live inventory by lot and location</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-2" data-testid="refresh-stock-btn">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-slate-200">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by lot number, item name, or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="search-stock-input"
              />
            </div>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-48" data-testid="filter-type-select">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="raw_material">Raw Materials</SelectItem>
                <SelectItem value="packaging_material">Packaging</SelectItem>
                <SelectItem value="wip_batch">WIP Batches</SelectItem>
                <SelectItem value="finished_good">Finished Goods</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="w-48" data-testid="filter-location-select">
                <SelectValue placeholder="Filter by location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary">{filteredStock.length} lots</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stock Tables */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">All ({filteredStock.length})</TabsTrigger>
          <TabsTrigger value="raw_material" data-testid="tab-raw">Raw Materials ({groupedByType.raw_material.length})</TabsTrigger>
          <TabsTrigger value="packaging" data-testid="tab-pkg">Packaging ({groupedByType.packaging_material.length})</TabsTrigger>
          <TabsTrigger value="wip" data-testid="tab-wip">WIP ({groupedByType.wip_batch.length})</TabsTrigger>
          <TabsTrigger value="finished" data-testid="tab-fg">Finished ({groupedByType.finished_good.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card className="border-slate-200">
            <CardContent className="p-0">
              <StockTable items={filteredStock} emptyMessage="No stock found" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="raw_material">
          <Card className="border-slate-200">
            <CardContent className="p-0">
              <StockTable items={groupedByType.raw_material} emptyMessage="No raw material stock" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packaging">
          <Card className="border-slate-200">
            <CardContent className="p-0">
              <StockTable items={groupedByType.packaging_material} emptyMessage="No packaging stock" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wip">
          <Card className="border-slate-200">
            <CardContent className="p-0">
              <StockTable items={groupedByType.wip_batch} emptyMessage="No WIP batches on floor" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finished">
          <Card className="border-slate-200">
            <CardContent className="p-0">
              <StockTable items={groupedByType.finished_good} emptyMessage="No finished goods in stock" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Stock</DialogTitle>
            <DialogDescription>
              {moveTarget && (
                <>
                  Lot <span className="lot-number">{moveTarget.lot_number}</span> - currently at{' '}
                  <strong>{getLocationName(moveTarget.location_id)}</strong>, {formatNumber(moveTarget.quantity_available, 2)} {moveTarget.unit_of_measure} available
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleMove} className="space-y-4">
            <div className="space-y-2">
              <Label>Move To *</Label>
              <Combobox
                data-testid="move-to-location-select"
                value={moveForm.to_location_id}
                onValueChange={(v) => setMoveForm({ ...moveForm, to_location_id: v })}
                placeholder="Select destination location"
                searchPlaceholder="Search locations..."
                emptyText="No location found."
                options={locations
                  .filter((l) => l.id !== moveTarget?.location_id)
                  .map((l) => ({ value: l.id, label: `${l.name} (${l.code})` }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Quantity *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={moveTarget?.quantity_available}
                value={moveForm.quantity}
                onChange={(e) => setMoveForm({ ...moveForm, quantity: e.target.value })}
                required
                data-testid="move-quantity-input"
              />
              <p className="text-xs text-slate-400">
                Up to {moveTarget ? formatNumber(moveTarget.quantity_available, 2) : 0} {moveTarget?.unit_of_measure} available
              </p>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                value={moveForm.notes}
                onChange={(e) => setMoveForm({ ...moveForm, notes: e.target.value })}
                placeholder="e.g. relocating to real packaging zone"
                data-testid="move-notes-input"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMoveDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="btn-primary"
                disabled={moving || !moveForm.to_location_id || !moveForm.quantity}
                data-testid="confirm-move-btn"
              >
                {moving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Move Stock
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
