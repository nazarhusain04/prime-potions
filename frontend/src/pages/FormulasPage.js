import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Checkbox } from '../components/ui/checkbox';
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
import { Plus, ClipboardList, Loader2, Lock, Unlock, Edit, Trash2 } from 'lucide-react';
import api from '../lib/api';
import { formatDate } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

export const FormulasPage = () => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('Admin');
  const [formulas, setFormulas] = useState([]);
  const [products, setProducts] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [selectedFormula, setSelectedFormula] = useState(null);
  const [formulaLines, setFormulaLines] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    product_ids: [],
    category: '',
    default_batch_size: 1,
    batch_unit: 'KG',
    recipe_required: false,
    variance_tolerance_percent: 2.0,
    tags: [],
    common_batch_sizes: ''
  });

  const [lineData, setLineData] = useState({
    raw_material_id: '',
    raw_material_sku: '',
    ingredient_display_name: '',
    phase: '',
    add_order: 0,
    percent: 0,
    default_qty_required: 0,
    uom: 'KG',
    optional: false,
    process_notes: '',
    batch_notes: ''
  });

  const fetchData = async () => {
    try {
      const [formulasRes, productsRes, rmRes] = await Promise.all([
        api.get('/formulas'),
        api.get('/master/products'),
        api.get('/master/raw-materials')
      ]);
      setFormulas(Array.isArray(formulasRes) ? formulasRes : formulasRes.data || []);
      setProducts(Array.isArray(productsRes) ? productsRes : productsRes.data || []);
      setRawMaterials(Array.isArray(rmRes) ? rmRes : rmRes.data || []);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetFormData = () => {
    setFormData({
      name: '',
      description: '',
      product_ids: [],
      category: '',
      default_batch_size: 1,
      batch_unit: 'KG',
      recipe_required: false,
      variance_tolerance_percent: 2.0,
      tags: [],
      common_batch_sizes: ''
    });
    setEditMode(false);
  };

  const handleCreateFormula = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        ...formData,
        common_batch_sizes: formData.common_batch_sizes
          .split(',')
          .map((s) => parseFloat(s.trim()))
          .filter((n) => !isNaN(n) && n > 0)
      };
      if (editMode && selectedFormula) {
        await api.put(`/formulas/${selectedFormula.id}`, payload);
        toast.success('Formula updated');
      } else {
        await api.post('/formulas', payload);
        toast.success('Formula created');
      }
      setDialogOpen(false);
      resetFormData();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save formula');
    } finally {
      setSaving(false);
    }
  };

  const handleEditFormula = (formula) => {
    setFormData({
      name: formula.name,
      description: formula.description || '',
      product_ids: formula.product_ids || (formula.product_id ? [formula.product_id] : []),
      category: formula.category || '',
      default_batch_size: formula.default_batch_size || 1,
      batch_unit: formula.batch_unit || 'KG',
      recipe_required: formula.recipe_required || false,
      variance_tolerance_percent: formula.variance_tolerance_percent || 2.0,
      tags: formula.tags || [],
      common_batch_sizes: (formula.common_batch_sizes || []).join(', ')
    });
    setSelectedFormula(formula);
    setEditMode(true);
    setDialogOpen(true);
  };

  const handleViewLines = async (formula) => {
    setSelectedFormula(formula);
    try {
      const response = await api.get(`/formulas/${formula.id}/lines`);
      setFormulaLines(Array.isArray(response) ? response : response.data || []);
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
      // Get the material name if we have a sku
      const material = rawMaterials.find(m => m.sku === lineData.raw_material_sku);

      // Store as percent (not a fixed qty) so this line scales correctly no matter
      // what batch size a workspace is later created at - same as every other formula.
      await api.post('/formulas/lines', {
        formula_id: selectedFormula.id,
        ...lineData,
        default_qty_required: 0,
        raw_material_id: material?.id || '',
        ingredient_display_name: lineData.ingredient_display_name || material?.name || lineData.raw_material_sku
      });
      toast.success('Line added');
      
      const response = await api.get(`/formulas/${selectedFormula.id}/lines`);
      setFormulaLines(Array.isArray(response) ? response : response.data || []);
      
      setLineData({
        raw_material_id: '',
        raw_material_sku: '',
        ingredient_display_name: '',
        phase: '',
        add_order: formulaLines.length + 1,
        percent: 0,
        default_qty_required: 0,
        uom: 'KG',
        optional: false,
        process_notes: '',
        batch_notes: ''
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add line');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFormula = async (formula) => {
    if (!confirm(`Delete formula "${formula.name}"? Past batches keep their own copy of the ingredients and won't be affected, but this recipe won't be usable for new batches anymore.`)) return;
    try {
      await api.delete(`/formulas/${formula.id}`);
      toast.success('Formula deleted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete formula');
    }
  };

  const handleDeleteLine = async (lineId) => {
    if (!confirm('Delete this ingredient line?')) return;
    try {
      await api.delete(`/formulas/lines/${lineId}`);
      toast.success('Line deleted');
      const response = await api.get(`/formulas/${selectedFormula.id}/lines`);
      setFormulaLines(Array.isArray(response) ? response : response.data || []);
    } catch (error) {
      toast.error('Failed to delete line');
    }
  };

  const getProductName = (id) => products.find(p => p.id === id)?.name || '-';
  const getMaterialName = (sku) => rawMaterials.find(m => m.sku === sku)?.name || sku;

  const toggleProductLink = (productId) => {
    setFormData((prev) => {
      const current = prev.product_ids || [];
      const next = current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId];
      return { ...prev, product_ids: next };
    });
  };

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
          <h1 className="text-2xl font-bold text-slate-900">Formulas / Recipe Library</h1>
          <p className="text-slate-500">Define formulas with optional strict recipe enforcement</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetFormData(); }}>
          <DialogTrigger asChild>
            <Button className="btn-primary gap-2" data-testid="add-formula-btn">
              <Plus className="w-4 h-4" />
              Add Formula
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editMode ? 'Edit Formula' : 'Create Formula'}</DialogTitle>
              <DialogDescription>
                {editMode ? 'Update formula settings' : 'Define a new formula with recipe_required option'}
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
                <Label>Category</Label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., Sanitizers"
                />
              </div>

              <div className="space-y-2">
                <Label>Linked Products</Label>
                <p className="text-xs text-gray-500">
                  Check every packaged product this batch can be filled into (e.g. the same base filled as a tube and a jar).
                </p>
                <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                  {products.length > 0 ? (
                    products.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={(formData.product_ids || []).includes(p.id)}
                          onCheckedChange={() => toggleProductLink(p.id)}
                        />
                        {p.name} <span className="text-gray-400">({p.sku})</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-xs text-gray-400">No products yet - create one on the Products page first</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Batch Size</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.default_batch_size}
                    onChange={(e) => setFormData({ ...formData, default_batch_size: parseFloat(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Select
                    value={formData.batch_unit}
                    onValueChange={(v) => setFormData({ ...formData, batch_unit: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KG">KG</SelectItem>
                      <SelectItem value="L">L</SelectItem>
                      <SelectItem value="G">G</SelectItem>
                      <SelectItem value="OZ">OZ</SelectItem>
                      <SelectItem value="LB">LB</SelectItem>
                      <SelectItem value="EA">EA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Common Batch Sizes</Label>
                <Input
                  value={formData.common_batch_sizes}
                  onChange={(e) => setFormData({ ...formData, common_batch_sizes: e.target.value })}
                  placeholder="e.g. 265, 175, 80"
                />
                <p className="text-xs text-slate-400">Comma-separated. Shown as quick-pick buttons when starting a new batch.</p>
              </div>

              {/* Recipe Required Toggle - KEY FEATURE */}
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {formData.recipe_required ? (
                      <Lock className="w-5 h-5 text-amber-600" />
                    ) : (
                      <Unlock className="w-5 h-5 text-gray-400" />
                    )}
                    <div>
                      <Label className="font-medium">Recipe Required</Label>
                      <p className="text-xs text-gray-500">
                        When ON, batching must match this recipe exactly
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={formData.recipe_required}
                    onCheckedChange={(checked) => setFormData({ ...formData, recipe_required: checked })}
                    data-testid="recipe-required-switch"
                  />
                </div>
                
                {formData.recipe_required && (
                  <div className="mt-3 pt-3 border-t border-amber-200">
                    <Label className="text-xs">Variance Tolerance (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.variance_tolerance_percent}
                      onChange={(e) => setFormData({ ...formData, variance_tolerance_percent: parseFloat(e.target.value) || 0 })}
                      className="mt-1 h-8"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Allowed deviation from default qty (0 = exact match required)
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetFormData(); }}>
                  Cancel
                </Button>
                <Button type="submit" className="btn-primary" disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editMode ? 'Save Changes' : 'Create Formula'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Formula Lines Dialog */}
      <Dialog open={lineDialogOpen} onOpenChange={setLineDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedFormula?.name}
              {selectedFormula?.recipe_required && (
                <Badge className="bg-amber-500">
                  <Lock className="w-3 h-3 mr-1" />
                  Strict Recipe
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Manage ingredient lines. Display names must match your Excel "Ingredient Formula" column exactly.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Existing Lines */}
            {formulaLines.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Display Name (Excel Match)</TableHead>
                    <TableHead>Material SKU</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead>%</TableHead>
                    <TableHead>Qty @ {selectedFormula?.default_batch_size} {selectedFormula?.batch_unit}</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formulaLines.map((line, idx) => {
                    const qty = line.default_qty_required > 0
                      ? line.default_qty_required
                      : (line.percent || 0) / 100 * (selectedFormula?.default_batch_size || 0);
                    return (
                    <TableRow key={line.id}>
                      <TableCell className="text-gray-400">{line.add_order || idx + 1}</TableCell>
                      <TableCell className="font-medium">{line.ingredient_display_name}</TableCell>
                      <TableCell className="font-mono text-xs">{line.raw_material_sku}</TableCell>
                      <TableCell>{line.phase || '-'}</TableCell>
                      <TableCell>{line.percent ? `${line.percent}%` : '-'}</TableCell>
                      <TableCell>{qty.toFixed(3)}</TableCell>
                      <TableCell>{line.uom}</TableCell>
                      <TableCell>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteLine(line.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">No ingredient lines yet</p>
            )}

            {/* Add Line Form */}
            <form onSubmit={handleAddLine} className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-3">Add Ingredient Line</h4>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="space-y-1">
                  <Label className="text-xs">Raw Material</Label>
                  <Select
                    value={lineData.raw_material_sku || 'none'}
                    onValueChange={(v) => {
                      const mat = rawMaterials.find(m => m.sku === v);
                      setLineData({ 
                        ...lineData, 
                        raw_material_sku: v === 'none' ? '' : v,
                        ingredient_display_name: mat?.name || ''
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select material" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select...</SelectItem>
                      {rawMaterials.map((m) => (
                        <SelectItem key={m.id} value={m.sku}>{m.name} ({m.sku})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Display Name (must match Excel exactly)</Label>
                  <Input
                    value={lineData.ingredient_display_name}
                    onChange={(e) => setLineData({ ...lineData, ingredient_display_name: e.target.value })}
                    placeholder="Name as it appears in Excel"
                  />
                </div>
              </div>
              <div className="grid grid-cols-6 gap-3 mb-3">
                <div className="space-y-1">
                  <Label className="text-xs">Phase</Label>
                  <Input
                    value={lineData.phase}
                    onChange={(e) => setLineData({ ...lineData, phase: e.target.value })}
                    placeholder="A, B..."
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Add Order</Label>
                  <Input
                    type="number"
                    value={lineData.add_order}
                    onChange={(e) => setLineData({ ...lineData, add_order: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Qty @ {selectedFormula?.default_batch_size} {selectedFormula?.batch_unit}</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={lineData.default_qty_required}
                    onChange={(e) => {
                      const qty = parseFloat(e.target.value) || 0;
                      const batchSize = selectedFormula?.default_batch_size || 0;
                      const percent = batchSize > 0 ? Math.round((qty / batchSize) * 100 * 10000) / 10000 : 0;
                      setLineData({ ...lineData, default_qty_required: qty, percent });
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">%</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={lineData.percent}
                    onChange={(e) => {
                      const percent = parseFloat(e.target.value) || 0;
                      const batchSize = selectedFormula?.default_batch_size || 0;
                      const qty = Math.round((percent / 100) * batchSize * 1000) / 1000;
                      setLineData({ ...lineData, percent, default_qty_required: qty });
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">UOM</Label>
                  <Select
                    value={lineData.uom}
                    onValueChange={(v) => setLineData({ ...lineData, uom: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KG">KG</SelectItem>
                      <SelectItem value="G">G</SelectItem>
                      <SelectItem value="L">L</SelectItem>
                      <SelectItem value="ML">ML</SelectItem>
                      <SelectItem value="OZ">OZ</SelectItem>
                      <SelectItem value="EA">EA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button type="submit" size="sm" className="btn-primary w-full" disabled={saving || !lineData.raw_material_sku}>
                    {saving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                    Add
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Process Notes</Label>
                  <Input
                    value={lineData.process_notes}
                    onChange={(e) => setLineData({ ...lineData, process_notes: e.target.value })}
                    placeholder="Process instructions"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Batch Notes</Label>
                  <Input
                    value={lineData.batch_notes}
                    onChange={(e) => setLineData({ ...lineData, batch_notes: e.target.value })}
                    placeholder="Batch-specific notes"
                  />
                </div>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Formulas Table */}
      <Card>
        <CardHeader className="py-3 px-4 border-b">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{formulas.length} formulas</Badge>
            <Badge variant="outline" className="bg-amber-50">
              <Lock className="w-3 h-3 mr-1" />
              {formulas.filter(f => f.recipe_required).length} strict
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Linked Products</TableHead>
                <TableHead>Default Size</TableHead>
                <TableHead>Recipe Mode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formulas.length > 0 ? (
                formulas.map((formula) => (
                  <TableRow key={formula.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium">{formula.name}</TableCell>
                    <TableCell>{formula.category || '-'}</TableCell>
                    <TableCell>
                      {(formula.product_ids || []).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {formula.product_ids.map((pid) => (
                            <Badge key={pid} variant="outline">{getProductName(pid)}</Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>{formula.default_batch_size} {formula.batch_unit}</TableCell>
                    <TableCell>
                      {formula.recipe_required ? (
                        <Badge className="bg-amber-500">
                          <Lock className="w-3 h-3 mr-1" />
                          Strict ({formula.variance_tolerance_percent || 0}%)
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <Unlock className="w-3 h-3 mr-1" />
                          Flexible
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={formula.status === 'Active' ? 'bg-green-500' : 'bg-gray-400'}>
                        {formula.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewLines(formula)}
                        >
                          Lines
                        </Button>
                        {isAdmin && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditFormula(formula)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteFormula(formula)}
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
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

export default FormulasPage;
