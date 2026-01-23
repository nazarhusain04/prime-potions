import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { Plus, ClipboardList, Loader2, Trash2 } from 'lucide-react';
import api from '../lib/api';
import { formatDate } from '../lib/utils';

export const FormulasPage = () => {
  const [formulas, setFormulas] = useState([]);
  const [products, setProducts] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [selectedFormula, setSelectedFormula] = useState(null);
  const [formulaLines, setFormulaLines] = useState([]);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    product_id: '',
    default_batch_size: 1,
    batch_unit: 'KG',
    tags: []
  });

  const [lineData, setLineData] = useState({
    raw_material_sku: '',
    phase: '',
    percent: 0,
    default_qty_per_batch: 0,
    uom: 'KG',
    optional: false,
    notes: ''
  });

  const fetchData = async () => {
    try {
      const [formulasRes, productsRes, rmRes] = await Promise.all([
        api.get('/formulas'),
        api.get('/master/products'),
        api.get('/master/raw-materials')
      ]);
      setFormulas(formulasRes.data);
      setProducts(productsRes.data);
      setRawMaterials(rmRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateFormula = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await api.post('/formulas', formData);
      toast.success('Formula created');
      setDialogOpen(false);
      setFormData({ name: '', description: '', product_id: '', default_batch_size: 1, batch_unit: 'KG', tags: [] });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create formula');
    } finally {
      setSaving(false);
    }
  };

  const handleViewLines = async (formula) => {
    setSelectedFormula(formula);
    try {
      const response = await api.get(`/formulas/${formula.id}/lines`);
      setFormulaLines(response.data);
      setLineDialogOpen(true);
    } catch (error) {
      toast.error('Failed to load formula lines');
    }
  };

  const handleAddLine = async (e) => {
    e.preventDefault();
    if (!selectedFormula) return;
    setSaving(true);

    try {
      await api.post('/formulas/lines', {
        formula_id: selectedFormula.id,
        ...lineData
      });
      toast.success('Line added');
      
      // Refresh lines
      const response = await api.get(`/formulas/${selectedFormula.id}/lines`);
      setFormulaLines(response.data);
      
      setLineData({ raw_material_sku: '', phase: '', percent: 0, default_qty_per_batch: 0, uom: 'KG', optional: false, notes: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add line');
    } finally {
      setSaving(false);
    }
  };

  const getProductName = (id) => products.find(p => p.id === id)?.name || '-';
  const getMaterialName = (sku) => rawMaterials.find(m => m.sku === sku)?.name || sku;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F5132]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="formulas-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Formulas / BOM</h1>
          <p className="text-slate-500">Define product formulas for batching (placeholder for full BOM)</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary gap-2" data-testid="add-formula-btn">
              <Plus className="w-4 h-4" />
              Add Formula
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Formula</DialogTitle>
              <DialogDescription>
                Define a new formula. You can add ingredient lines after creation.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateFormula} className="space-y-4">
              <div className="space-y-2">
                <Label>Formula Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Paume Sanitizer Mist Formula"
                  required
                  data-testid="formula-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  data-testid="formula-desc-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Linked Product (Optional)</Label>
                <Select
                  value={formData.product_id}
                  onValueChange={(v) => setFormData({ ...formData, product_id: v })}
                >
                  <SelectTrigger data-testid="formula-product-select">
                    <SelectValue placeholder="Select product or leave empty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No product link</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Batch Size</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.default_batch_size}
                    onChange={(e) => setFormData({ ...formData, default_batch_size: parseFloat(e.target.value) || 1 })}
                    data-testid="formula-size-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Select
                    value={formData.batch_unit}
                    onValueChange={(v) => setFormData({ ...formData, batch_unit: v })}
                  >
                    <SelectTrigger data-testid="formula-unit-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KG">KG</SelectItem>
                      <SelectItem value="L">L</SelectItem>
                      <SelectItem value="EA">EA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="btn-primary" disabled={saving} data-testid="save-formula-btn">
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Formula
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Formula Lines Dialog */}
      <Dialog open={lineDialogOpen} onOpenChange={setLineDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Formula: {selectedFormula?.name}</DialogTitle>
            <DialogDescription>
              Manage ingredient lines for this formula
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Existing Lines */}
            {formulaLines.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead>%</TableHead>
                    <TableHead>Qty/Batch</TableHead>
                    <TableHead>UOM</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formulaLines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-medium">{getMaterialName(line.raw_material_sku)}</TableCell>
                      <TableCell>{line.phase || '-'}</TableCell>
                      <TableCell>{line.percent}%</TableCell>
                      <TableCell>{line.default_qty_per_batch}</TableCell>
                      <TableCell>{line.uom}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">No ingredient lines yet</p>
            )}

            {/* Add Line Form */}
            <form onSubmit={handleAddLine} className="border-t border-slate-200 pt-4">
              <h4 className="font-semibold text-sm mb-3">Add Ingredient Line</h4>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Material</Label>
                  <Select
                    value={lineData.raw_material_sku}
                    onValueChange={(v) => setLineData({ ...lineData, raw_material_sku: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {rawMaterials.map((m) => (
                        <SelectItem key={m.id} value={m.sku}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phase</Label>
                  <Input
                    value={lineData.phase}
                    onChange={(e) => setLineData({ ...lineData, phase: e.target.value })}
                    placeholder="A, B, C..."
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Percent</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={lineData.percent}
                    onChange={(e) => setLineData({ ...lineData, percent: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Qty/Batch</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={lineData.default_qty_per_batch}
                    onChange={(e) => setLineData({ ...lineData, default_qty_per_batch: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button type="submit" size="sm" className="btn-primary" disabled={saving || !lineData.raw_material_sku}>
                  {saving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  Add Line
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Formulas Table */}
      <Card className="border-slate-200">
        <CardHeader className="py-3 px-4 border-b border-slate-100">
          <Badge variant="secondary">{formulas.length} formulas</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs uppercase">Name</TableHead>
                <TableHead className="text-xs uppercase">Product</TableHead>
                <TableHead className="text-xs uppercase">Default Size</TableHead>
                <TableHead className="text-xs uppercase">Status</TableHead>
                <TableHead className="text-xs uppercase">Created</TableHead>
                <TableHead className="text-xs uppercase">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formulas.length > 0 ? (
                formulas.map((formula) => (
                  <TableRow key={formula.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium">{formula.name}</TableCell>
                    <TableCell>{getProductName(formula.product_id)}</TableCell>
                    <TableCell>{formula.default_batch_size} {formula.batch_unit}</TableCell>
                    <TableCell>
                      <Badge className={formula.status === 'Active' ? 'status-available' : 'bg-gray-100 text-gray-800'}>
                        {formula.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {formatDate(formula.created_at)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewLines(formula)}
                        data-testid={`view-lines-${formula.id}`}
                      >
                        View Lines
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No formulas defined yet</p>
                    <p className="text-xs text-slate-400 mt-1">Formulas are optional - you can batch without them</p>
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
