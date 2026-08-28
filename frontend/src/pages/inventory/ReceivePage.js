import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { inventoryApi, masterApi } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Combobox } from '../../components/ui/combobox';
import { toast } from 'sonner';
import { Package, Loader2, CheckCircle } from 'lucide-react';

export const ReceivePage = () => {
  const navigate = useNavigate();
  const [rawMaterials, setRawMaterials] = useState([]);
  const [packagingMaterials, setPackagingMaterials] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  
  const [formData, setFormData] = useState({
    item_type: 'raw_material',
    item_id: '',
    quantity: '',
    location_id: '',
    lot_number: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rmRes, pkgRes, locRes] = await Promise.all([
          masterApi.listRawMaterials(),
          masterApi.listPackagingMaterials(),
          masterApi.listLocations()
        ]);
        setRawMaterials(rmRes.data);
        setPackagingMaterials(pkgRes.data);
        setLocations(locRes.data);
      } catch (error) {
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setResult(null);

    const material = formData.item_type === 'raw_material'
      ? rawMaterials.find(m => m.id === formData.item_id)
      : packagingMaterials.find(m => m.id === formData.item_id);

    try {
      const response = await inventoryApi.receive({
        item_id: formData.item_id,
        item_type: formData.item_type,
        quantity: parseFloat(formData.quantity),
        unit_of_measure: material?.unit_of_measure || 'EA',
        location_id: formData.location_id,
        lot_number: formData.lot_number || undefined
      });
      
      setResult(response.data);
      toast.success(`Received ${formData.quantity} units. Lot: ${response.data.lot_number}`);
      
      // Reset form but keep type and location
      setFormData({
        ...formData,
        item_id: '',
        quantity: '',
        lot_number: ''
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to receive inventory');
    } finally {
      setSaving(false);
    }
  };

  const materials = formData.item_type === 'raw_material' ? rawMaterials : packagingMaterials;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F5132]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="receive-page">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Receive Inventory</h1>
        <p className="text-slate-500">Record incoming materials into inventory</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200">
          <CardHeader className="py-3 px-4 border-b border-slate-100">
            <CardTitle className="text-base">Receipt Details</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Material Type *</Label>
                <Select
                  value={formData.item_type}
                  onValueChange={(v) => setFormData({ ...formData, item_type: v, item_id: '' })}
                >
                  <SelectTrigger data-testid="receive-type-select">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="raw_material">Raw Material</SelectItem>
                    <SelectItem value="packaging_material">Packaging Material</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Material *</Label>
                <Combobox
                  data-testid="receive-material-select"
                  value={formData.item_id}
                  onValueChange={(v) => setFormData({ ...formData, item_id: v })}
                  placeholder="Select material"
                  searchPlaceholder="Search by name or SKU..."
                  emptyText="No material found."
                  options={materials.map((m) => ({
                    value: m.id,
                    label: `${m.name} (${m.sku}) - ${m.unit_of_measure}`
                  }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="Enter quantity"
                  required
                  data-testid="receive-quantity-input"
                />
              </div>

              <div className="space-y-2">
                <Label>Location *</Label>
                <Combobox
                  data-testid="receive-location-select"
                  value={formData.location_id}
                  onValueChange={(v) => setFormData({ ...formData, location_id: v })}
                  placeholder="Select location"
                  searchPlaceholder="Search locations..."
                  emptyText="No location found."
                  options={locations.map((l) => ({
                    value: l.id,
                    label: `${l.name} (${l.code})`
                  }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Lot Number (optional)</Label>
                <Input
                  value={formData.lot_number}
                  onChange={(e) => setFormData({ ...formData, lot_number: e.target.value })}
                  placeholder="Auto-generated if blank"
                  data-testid="receive-lot-input"
                />
                <p className="text-xs text-slate-400">Leave blank to auto-generate</p>
              </div>

              <Button 
                type="submit" 
                className="w-full btn-primary gap-2" 
                disabled={saving || !formData.item_id || !formData.quantity || !formData.location_id}
                data-testid="receive-submit-btn"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Package className="w-4 h-4" />
                )}
                Receive Inventory
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Success Result */}
        {result && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardHeader className="py-3 px-4 border-b border-emerald-100">
              <CardTitle className="text-base text-emerald-800 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Receipt Successful
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-emerald-600">Lot Number Created:</p>
                  <p className="lot-number text-lg font-bold text-emerald-800">{result.lot_number}</p>
                </div>
                <div className="pt-3 border-t border-emerald-200">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate('/inventory/stock')}
                    data-testid="view-stock-btn"
                  >
                    View Stock
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
