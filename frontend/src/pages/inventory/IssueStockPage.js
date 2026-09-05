import React, { useState, useEffect } from 'react';
import { inventoryApi, masterApi } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Combobox } from '../../components/ui/combobox';
import { toast } from 'sonner';
import { MinusCircle, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

const emptyForm = {
  item_type: 'raw_material',
  item_id: '',
  lot_number: '',
  quantity: '',
  reason: 'lab_use',
  direction: 'out',
  notes: ''
};

export const IssueStockPage = () => {
  const [rawMaterials, setRawMaterials] = useState([]);
  const [packagingMaterials, setPackagingMaterials] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    const load = async () => {
      try {
        const [rmRes, pkgRes, reasonRes] = await Promise.all([
          masterApi.listRawMaterials(),
          masterApi.listPackagingMaterials(),
          inventoryApi.getIssueReasons()
        ]);
        setRawMaterials(rmRes.data);
        setPackagingMaterials(pkgRes.data);
        setReasons(reasonRes.data);
      } catch (error) {
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Stock leaves a specific lot, not a material in general - so the lot list has to
  // reload whenever the chosen material changes.
  useEffect(() => {
    if (!formData.item_id) {
      setLots([]);
      return;
    }
    const loadLots = async () => {
      try {
        const res = await inventoryApi.getStock({
          item_type: formData.item_type,
          item_id: formData.item_id
        });
        setLots(res.data.filter((l) => l.quantity_available > 0));
      } catch (error) {
        setLots([]);
      }
    };
    loadLots();
  }, [formData.item_id, formData.item_type]);

  const materials = formData.item_type === 'raw_material' ? rawMaterials : packagingMaterials;
  const selectedLot = lots.find((l) => l.lot_number === formData.lot_number);
  const selectedReason = reasons.find((r) => r.code === formData.reason);
  const canAddStock = selectedReason?.can_add_stock;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setResult(null);
    try {
      const res = await inventoryApi.issue({
        item_id: formData.item_id,
        item_type: formData.item_type,
        lot_number: formData.lot_number,
        location_id: selectedLot.location_id,
        quantity: parseFloat(formData.quantity),
        reason: formData.reason,
        direction: canAddStock ? formData.direction : 'out',
        notes: formData.notes
      });
      setResult(res.data);
      toast.success(res.data.message);
      setFormData({ ...formData, quantity: '', notes: '', lot_number: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to record');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F5132]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="issue-stock-page">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Issue Stock</h1>
        <p className="text-slate-500">
          Record material used outside production - lab work, QA samples, spillage - or correct a lot after a physical count
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200">
          <CardHeader className="py-3 px-4 border-b border-slate-100">
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Material Type *</Label>
                <Select
                  value={formData.item_type}
                  onValueChange={(v) => setFormData({ ...formData, item_type: v, item_id: '', lot_number: '' })}
                >
                  <SelectTrigger data-testid="issue-type-select">
                    <SelectValue />
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
                  data-testid="issue-material-select"
                  value={formData.item_id}
                  onValueChange={(v) => setFormData({ ...formData, item_id: v, lot_number: '' })}
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
                <Label>Lot *</Label>
                <Combobox
                  data-testid="issue-lot-select"
                  value={formData.lot_number}
                  onValueChange={(v) => setFormData({ ...formData, lot_number: v })}
                  placeholder={formData.item_id ? 'Select lot' : 'Choose a material first'}
                  searchPlaceholder="Search lots..."
                  emptyText="No stock available for this material."
                  options={lots.map((l) => ({
                    value: l.lot_number,
                    label: `${l.lot_number} - ${l.quantity_available} ${l.unit_of_measure || ''}`
                  }))}
                />
                {selectedLot && (
                  <p className="text-xs text-slate-400">
                    {selectedLot.quantity_available} {selectedLot.unit_of_measure} available in this lot
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Reason *</Label>
                <Select
                  value={formData.reason}
                  onValueChange={(v) => setFormData({ ...formData, reason: v, direction: 'out' })}
                >
                  <SelectTrigger data-testid="issue-reason-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {reasons.map((r) => (
                      <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {canAddStock && (
                <div className="space-y-2">
                  <Label>Direction *</Label>
                  <Select
                    value={formData.direction}
                    onValueChange={(v) => setFormData({ ...formData, direction: v })}
                  >
                    <SelectTrigger data-testid="issue-direction-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="out">Count was lower - reduce stock</SelectItem>
                      <SelectItem value="in">Count was higher - add stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="How much"
                  required
                  data-testid="issue-quantity-input"
                />
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="What it was for - optional but useful later"
                  data-testid="issue-notes-input"
                />
              </div>

              <Button
                type="submit"
                className="w-full btn-primary gap-2"
                disabled={saving || !formData.item_id || !formData.lot_number || !formData.quantity}
                data-testid="issue-submit-btn"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <MinusCircle className="w-4 h-4" />}
                Record
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {result && (
            <Card className="border-emerald-200 bg-emerald-50">
              <CardHeader className="py-3 px-4 border-b border-emerald-100">
                <CardTitle className="text-base text-emerald-800 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Recorded
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <p className="text-sm text-emerald-700">{result.message}</p>
                <p className="text-sm">
                  Lot <span className="lot-number font-bold">{result.lot_number}</span> changed by{' '}
                  <span className="font-bold">{result.quantity}</span>
                </p>
                <p className="text-sm text-emerald-700">
                  Remaining in lot: <span className="font-bold">{result.remaining}</span>
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="border-amber-200 bg-amber-50">
            <CardHeader className="py-3 px-4 border-b border-amber-100">
              <CardTitle className="text-base text-amber-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Why this matters
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 text-sm text-amber-900 space-y-2">
              <p>
                Material used in the lab or pulled as a sample still leaves the building. If it isn't
                recorded here, system stock stays high while the drum goes down, and every count from
                then on is out by that amount.
              </p>
              <p>
                Stock is issued against a specific lot so traceability holds. If a lot is ever recalled,
                the amount that went to the lab is as traceable as the amount that went into a batch.
              </p>
              <p>
                Nothing is deleted - each entry is a ledger row showing who recorded it and why, and it
                can be reversed from the Transactions page.
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="py-3 px-4 border-b border-slate-100">
              <CardTitle className="text-base">Reasons</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2">
                {reasons.map((r) => (
                  <Badge key={r.code} variant="secondary" className="font-normal">
                    {r.label}
                    {r.can_add_stock && <span className="ml-1 text-slate-400">(can add)</span>}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
