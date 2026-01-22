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
import { Plus, Ruler, Loader2 } from 'lucide-react';

export const UnitsPage = () => {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: 'weight',
    base_unit: '',
    conversion_factor: 1.0
  });

  const categories = [
    { value: 'weight', label: 'Weight' },
    { value: 'volume', label: 'Volume' },
    { value: 'count', label: 'Count' }
  ];

  const fetchData = async () => {
    try {
      const response = await masterApi.listUnits();
      setUnits(response.data);
    } catch (error) {
      toast.error('Failed to load units');
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
      await masterApi.createUnit({
        ...formData,
        base_unit: formData.base_unit || null
      });
      toast.success('Unit created');
      setDialogOpen(false);
      setFormData({ code: '', name: '', category: 'weight', base_unit: '', conversion_factor: 1.0 });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create unit');
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
    <div className="space-y-6" data-testid="units-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Units of Measure</h1>
          <p className="text-slate-500">Manage measurement units and conversions</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary gap-2" data-testid="add-unit-btn">
              <Plus className="w-4 h-4" />
              Add Unit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Unit of Measure</DialogTitle>
              <DialogDescription>Create a new measurement unit</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="KG"
                    required
                    data-testid="unit-code-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) => setFormData({ ...formData, category: v })}
                  >
                    <SelectTrigger data-testid="unit-category-select">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Kilogram"
                  required
                  data-testid="unit-name-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="base_unit">Base Unit (optional)</Label>
                  <Select
                    value={formData.base_unit}
                    onValueChange={(v) => setFormData({ ...formData, base_unit: v })}
                  >
                    <SelectTrigger data-testid="unit-base-select">
                      <SelectValue placeholder="None (is base)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None (is base unit)</SelectItem>
                      {units.filter(u => !u.base_unit).map((u) => (
                        <SelectItem key={u.id} value={u.code}>{u.name} ({u.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="conversion">Conversion Factor</Label>
                  <Input
                    id="conversion"
                    type="number"
                    step="0.0001"
                    value={formData.conversion_factor}
                    onChange={(e) => setFormData({ ...formData, conversion_factor: parseFloat(e.target.value) || 1 })}
                    data-testid="unit-conversion-input"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="btn-primary" disabled={saving} data-testid="save-unit-btn">
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
          <Badge variant="secondary">{units.length} units</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs uppercase">Code</TableHead>
                <TableHead className="text-xs uppercase">Name</TableHead>
                <TableHead className="text-xs uppercase">Category</TableHead>
                <TableHead className="text-xs uppercase">Base Unit</TableHead>
                <TableHead className="text-xs uppercase">Conversion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.length > 0 ? (
                units.map((unit) => (
                  <TableRow key={unit.id} className="hover:bg-slate-50">
                    <TableCell className="lot-number">{unit.code}</TableCell>
                    <TableCell className="font-medium">{unit.name}</TableCell>
                    <TableCell className="capitalize">{unit.category}</TableCell>
                    <TableCell>{unit.base_unit || '-'}</TableCell>
                    <TableCell>{unit.conversion_factor}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Ruler className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No units found</p>
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
