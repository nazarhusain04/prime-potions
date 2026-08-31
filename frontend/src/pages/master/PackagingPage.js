import React, { useState, useEffect } from 'react';
import { masterApi } from '../../lib/api';
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
import { Plus, Search, Package, Loader2, Edit } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const emptyFormData = {
  sku: '',
  name: '',
  description: '',
  unit_of_measure: '',
  reorder_point: 0,
  category: ''
};

export const PackagingPage = () => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('Admin');
  const [materials, setMaterials] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [formData, setFormData] = useState(emptyFormData);

  const fetchData = async () => {
    try {
      const [materialsRes, unitsRes] = await Promise.all([
        masterApi.listPackagingMaterials(),
        masterApi.listUnits()
      ]);
      setMaterials(materialsRes.data);
      setUnits(unitsRes.data);
    } catch (error) {
      toast.error('Failed to load packaging materials');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editMode && selectedMaterial) {
        await masterApi.updatePackagingMaterial(selectedMaterial.id, formData);
        toast.success('Packaging material updated');
      } else {
        await masterApi.createPackagingMaterial(formData);
        toast.success('Packaging material created');
      }
      setDialogOpen(false);
      setFormData(emptyFormData);
      setEditMode(false);
      setSelectedMaterial(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save material');
    } finally {
      setSaving(false);
    }
  };

  const handleEditMaterial = (material) => {
    setFormData({
      sku: material.sku,
      name: material.name,
      description: material.description || '',
      unit_of_measure: material.unit_of_measure,
      reorder_point: material.reorder_point || 0,
      category: material.category || ''
    });
    setSelectedMaterial(material);
    setEditMode(true);
    setDialogOpen(true);
  };

  const filteredMaterials = materials.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F5132]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="packaging-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Packaging Materials</h1>
          <p className="text-slate-500">Manage packaging material master data</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditMode(false); setSelectedMaterial(null); setFormData(emptyFormData); } }}>
          <DialogTrigger asChild>
            <Button
              className="btn-primary gap-2"
              data-testid="add-packaging-btn"
              onClick={() => { setEditMode(false); setSelectedMaterial(null); setFormData(emptyFormData); }}
            >
              <Plus className="w-4 h-4" />
              Add Packaging
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editMode ? 'Edit Packaging Material' : 'Add Packaging Material'}</DialogTitle>
              <DialogDescription>{editMode ? 'Update packaging material details' : 'Create a new packaging material'}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU *</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="PKG-001"
                    required
                    data-testid="pkg-sku-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Bottle, Cap, etc."
                    data-testid="pkg-category-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Packaging name"
                  required
                  data-testid="pkg-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  data-testid="pkg-description-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit of Measure *</Label>
                  <Select
                    value={formData.unit_of_measure}
                    onValueChange={(v) => setFormData({ ...formData, unit_of_measure: v })}
                  >
                    <SelectTrigger data-testid="pkg-unit-select">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map((u) => (
                        <SelectItem key={u.id} value={u.code}>{u.name} ({u.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reorder">Reorder Point</Label>
                  <Input
                    id="reorder"
                    type="number"
                    value={formData.reorder_point}
                    onChange={(e) => setFormData({ ...formData, reorder_point: parseFloat(e.target.value) || 0 })}
                    data-testid="pkg-reorder-input"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="btn-primary" disabled={saving} data-testid="save-pkg-btn">
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save
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
                placeholder="Search packaging..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="search-packaging-input"
              />
            </div>
            <Badge variant="secondary">{filteredMaterials.length} items</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs uppercase">SKU</TableHead>
                <TableHead className="text-xs uppercase">Name</TableHead>
                <TableHead className="text-xs uppercase">Category</TableHead>
                <TableHead className="text-xs uppercase">Unit</TableHead>
                <TableHead className="text-xs uppercase">Reorder Point</TableHead>
                <TableHead className="text-xs uppercase">Status</TableHead>
                <TableHead className="text-xs uppercase">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMaterials.length > 0 ? (
                filteredMaterials.map((material) => (
                  <TableRow key={material.id} className="hover:bg-slate-50">
                    <TableCell className="lot-number">{material.sku}</TableCell>
                    <TableCell className="font-medium">{material.name}</TableCell>
                    <TableCell>{material.category || '-'}</TableCell>
                    <TableCell>{material.unit_of_measure}</TableCell>
                    <TableCell>{material.reorder_point}</TableCell>
                    <TableCell>
                      <Badge className={material.is_active ? 'status-available' : 'bg-gray-100 text-gray-800'}>
                        {material.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isAdmin && (
                        <Button size="sm" variant="ghost" onClick={() => handleEditMaterial(material)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No packaging materials found</p>
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
