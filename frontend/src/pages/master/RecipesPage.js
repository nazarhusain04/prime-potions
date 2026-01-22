import React, { useState, useEffect } from 'react';
import { masterApi } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
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
import { Plus, Search, ClipboardList, Loader2, Trash2 } from 'lucide-react';

export const RecipesPage = () => {
  const [recipes, setRecipes] = useState([]);
  const [products, setProducts] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [packagingMaterials, setPackagingMaterials] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    product_id: '',
    name: '',
    batch_size: 10,
    batch_unit: 'L',
    ingredients: [],
    filling_components: [],
    batch_yield_loss_percent: 2.0,
    filling_yield_loss_percent: 1.0,
    version: '1.0'
  });

  const fetchData = async () => {
    try {
      const [recipesRes, productsRes, rmRes, pkgRes, unitsRes] = await Promise.all([
        masterApi.listRecipes(),
        masterApi.listProducts(),
        masterApi.listRawMaterials(),
        masterApi.listPackagingMaterials(),
        masterApi.listUnits()
      ]);
      setRecipes(recipesRes.data);
      setProducts(productsRes.data);
      setRawMaterials(rmRes.data);
      setPackagingMaterials(pkgRes.data);
      setUnits(unitsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addIngredient = () => {
    setFormData({
      ...formData,
      ingredients: [...formData.ingredients, { material_id: '', material_type: 'raw_material', quantity: 0, unit_of_measure: '' }]
    });
  };

  const removeIngredient = (index) => {
    setFormData({
      ...formData,
      ingredients: formData.ingredients.filter((_, i) => i !== index)
    });
  };

  const updateIngredient = (index, field, value) => {
    const newIngredients = [...formData.ingredients];
    newIngredients[index][field] = value;
    setFormData({ ...formData, ingredients: newIngredients });
  };

  const addFillingComponent = () => {
    setFormData({
      ...formData,
      filling_components: [...formData.filling_components, { material_id: '', material_type: 'packaging_material', quantity: 0, unit_of_measure: '' }]
    });
  };

  const removeFillingComponent = (index) => {
    setFormData({
      ...formData,
      filling_components: formData.filling_components.filter((_, i) => i !== index)
    });
  };

  const updateFillingComponent = (index, field, value) => {
    const newComponents = [...formData.filling_components];
    newComponents[index][field] = value;
    setFormData({ ...formData, filling_components: newComponents });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await masterApi.createRecipe(formData);
      toast.success('Recipe created');
      setDialogOpen(false);
      setFormData({
        product_id: '',
        name: '',
        batch_size: 10,
        batch_unit: 'L',
        ingredients: [],
        filling_components: [],
        batch_yield_loss_percent: 2.0,
        filling_yield_loss_percent: 1.0,
        version: '1.0'
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create recipe');
    } finally {
      setSaving(false);
    }
  };

  const getProductName = (id) => products.find(p => p.id === id)?.name || 'Unknown';
  const getMaterialName = (id, type) => {
    if (type === 'raw_material') return rawMaterials.find(m => m.id === id)?.name || 'Unknown';
    return packagingMaterials.find(m => m.id === id)?.name || 'Unknown';
  };

  const filteredRecipes = recipes.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F5132]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="recipes-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recipes / BOM</h1>
          <p className="text-slate-500">Manage batch recipes and filling BOMs</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary gap-2" data-testid="add-recipe-btn">
              <Plus className="w-4 h-4" />
              Add Recipe
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Recipe / BOM</DialogTitle>
              <DialogDescription>Define batch ingredients and filling components</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Product *</Label>
                  <Select
                    value={formData.product_id}
                    onValueChange={(v) => setFormData({ ...formData, product_id: v })}
                  >
                    <SelectTrigger data-testid="recipe-product-select">
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Version</Label>
                  <Input
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    placeholder="1.0"
                    data-testid="recipe-version-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Recipe Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Healing Elixir Recipe v1"
                  required
                  data-testid="recipe-name-input"
                />
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Batch Size *</Label>
                  <Input
                    type="number"
                    value={formData.batch_size}
                    onChange={(e) => setFormData({ ...formData, batch_size: parseFloat(e.target.value) || 0 })}
                    data-testid="recipe-batch-size-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Batch Unit *</Label>
                  <Select
                    value={formData.batch_unit}
                    onValueChange={(v) => setFormData({ ...formData, batch_unit: v })}
                  >
                    <SelectTrigger data-testid="recipe-batch-unit-select">
                      <SelectValue placeholder="Unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map((u) => (
                        <SelectItem key={u.id} value={u.code}>{u.code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Batch Loss %</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.batch_yield_loss_percent}
                    onChange={(e) => setFormData({ ...formData, batch_yield_loss_percent: parseFloat(e.target.value) || 0 })}
                    data-testid="recipe-batch-loss-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Filling Loss %</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.filling_yield_loss_percent}
                    onChange={(e) => setFormData({ ...formData, filling_yield_loss_percent: parseFloat(e.target.value) || 0 })}
                    data-testid="recipe-filling-loss-input"
                  />
                </div>
              </div>

              {/* Ingredients */}
              <Card className="border-slate-200">
                <CardHeader className="py-2 px-4 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Batch Ingredients (Raw Materials)</CardTitle>
                    <Button type="button" variant="outline" size="sm" onClick={addIngredient} data-testid="add-ingredient-btn">
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  {formData.ingredients.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">No ingredients added</p>
                  ) : (
                    formData.ingredients.map((ing, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Select
                          value={ing.material_id}
                          onValueChange={(v) => updateIngredient(idx, 'material_id', v)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select material" />
                          </SelectTrigger>
                          <SelectContent>
                            {rawMaterials.map((m) => (
                              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          className="w-24"
                          placeholder="Qty"
                          value={ing.quantity || ''}
                          onChange={(e) => updateIngredient(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                        <Select
                          value={ing.unit_of_measure}
                          onValueChange={(v) => updateIngredient(idx, 'unit_of_measure', v)}
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue placeholder="Unit" />
                          </SelectTrigger>
                          <SelectContent>
                            {units.map((u) => (
                              <SelectItem key={u.id} value={u.code}>{u.code}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeIngredient(idx)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Filling Components */}
              <Card className="border-slate-200">
                <CardHeader className="py-2 px-4 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Filling Components (Packaging)</CardTitle>
                    <Button type="button" variant="outline" size="sm" onClick={addFillingComponent} data-testid="add-filling-component-btn">
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  {formData.filling_components.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">No components added</p>
                  ) : (
                    formData.filling_components.map((comp, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Select
                          value={comp.material_id}
                          onValueChange={(v) => updateFillingComponent(idx, 'material_id', v)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select packaging" />
                          </SelectTrigger>
                          <SelectContent>
                            {packagingMaterials.map((m) => (
                              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          className="w-24"
                          placeholder="Qty"
                          value={comp.quantity || ''}
                          onChange={(e) => updateFillingComponent(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                        <Select
                          value={comp.unit_of_measure}
                          onValueChange={(v) => updateFillingComponent(idx, 'unit_of_measure', v)}
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue placeholder="Unit" />
                          </SelectTrigger>
                          <SelectContent>
                            {units.map((u) => (
                              <SelectItem key={u.id} value={u.code}>{u.code}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeFillingComponent(idx)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="btn-primary" disabled={saving} data-testid="save-recipe-btn">
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Recipe
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="py-3 px-4 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search recipes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="search-recipes-input"
              />
            </div>
            <Badge variant="secondary">{filteredRecipes.length} recipes</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs uppercase">Name</TableHead>
                <TableHead className="text-xs uppercase">Product</TableHead>
                <TableHead className="text-xs uppercase">Version</TableHead>
                <TableHead className="text-xs uppercase">Batch Size</TableHead>
                <TableHead className="text-xs uppercase">Ingredients</TableHead>
                <TableHead className="text-xs uppercase">Packaging</TableHead>
                <TableHead className="text-xs uppercase">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecipes.length > 0 ? (
                filteredRecipes.map((recipe) => (
                  <TableRow key={recipe.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium">{recipe.name}</TableCell>
                    <TableCell>{getProductName(recipe.product_id)}</TableCell>
                    <TableCell className="lot-number">{recipe.version}</TableCell>
                    <TableCell>{recipe.batch_size} {recipe.batch_unit}</TableCell>
                    <TableCell>{recipe.ingredients?.length || 0} items</TableCell>
                    <TableCell>{recipe.filling_components?.length || 0} items</TableCell>
                    <TableCell>
                      <Badge className={recipe.is_active ? 'status-available' : 'bg-gray-100 text-gray-800'}>
                        {recipe.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No recipes found</p>
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
