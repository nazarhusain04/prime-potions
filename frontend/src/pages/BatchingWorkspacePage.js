import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
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
import { 
  Plus, 
  Download, 
  Upload, 
  Factory, 
  Play, 
  CheckCircle,
  AlertTriangle,
  Shield,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Eye
} from 'lucide-react';
import api from '../lib/api';
import { cn, formatNumber, formatDate, getStatusColor } from '../lib/utils';

export const BatchingWorkspacePage = () => {
  const [workspaces, setWorkspaces] = useState([]);
  const [formulas, setFormulas] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const [formData, setFormData] = useState({
    formula_id: '',
    formula_name: '',
    planned_qty: '',
    batch_unit: 'KG',
    target_location_id: '',
    notes: ''
  });

  const fetchData = useCallback(async () => {
    try {
      const [workspacesRes, formulasRes, locationsRes] = await Promise.all([
        api.get('/batching/workspace'),
        api.get('/formulas'),
        api.get('/master/locations')
      ]);
      setWorkspaces(workspacesRes.data);
      setFormulas(formulasRes.data);
      setLocations(locationsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await api.post('/batching/workspace', formData);
      toast.success('Batching workspace created');
      setDialogOpen(false);
      setFormData({ formula_id: '', formula_name: '', planned_qty: '', batch_unit: 'KG', target_location_id: '', notes: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create workspace');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadSheet = async (workspace) => {
    try {
      const response = await api.get(`/batching/workspace/${workspace.id}/download-sheet`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `batching_${workspace.batch_code}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Batching sheet downloaded');
    } catch (error) {
      toast.error('Failed to download sheet');
    }
  };

  const handleStartBatching = async (workspace) => {
    try {
      await api.post(`/batching/workspace/${workspace.id}/start`);
      toast.success('Batching started');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start batching');
    }
  };

  const handleQaHold = async (workspace) => {
    try {
      await api.post(`/batching/workspace/${workspace.id}/qa-hold`);
      toast.success('Batch placed on QA hold');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed');
    }
  };

  const handleRelease = async (workspace) => {
    try {
      await api.post(`/batching/workspace/${workspace.id}/release`);
      toast.success('Batch released');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed');
    }
  };

  const onDropUpload = useCallback(async (acceptedFiles) => {
    if (!selectedWorkspace) return;
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post(
        `/batching/workspace/${selectedWorkspace.id}/upload-sheet`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setUploadResult(response.data);
      toast.success('Batching sheet processed!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [selectedWorkspace, fetchData]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropUpload,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxFiles: 1
  });

  const getLocationName = (id) => locations.find(l => l.id === id)?.name || 'Unknown';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F5132]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="batching-workspace-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Batching Workspace</h1>
          <p className="text-slate-500">Excel-driven batch production with inventory tracking</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-primary gap-2" data-testid="create-batch-btn">
                <Plus className="w-4 h-4" />
                New Batch
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Batching Workspace</DialogTitle>
                <DialogDescription>
                  Plan a new batch production. You can link to a formula or enter manually.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateWorkspace} className="space-y-4">
                <div className="space-y-2">
                  <Label>Formula (Optional)</Label>
                  <Select
                    value={formData.formula_id}
                    onValueChange={(v) => {
                      const formula = formulas.find(f => f.id === v);
                      setFormData({ 
                        ...formData, 
                        formula_id: v,
                        formula_name: formula?.name || formData.formula_name,
                        batch_unit: formula?.batch_unit || formData.batch_unit
                      });
                    }}
                  >
                    <SelectTrigger data-testid="formula-select">
                      <SelectValue placeholder="Select formula or leave empty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No formula (manual)</SelectItem>
                      {formulas.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Product/Formula Name *</Label>
                  <Input
                    value={formData.formula_name}
                    onChange={(e) => setFormData({ ...formData, formula_name: e.target.value })}
                    placeholder="e.g., Paume Sanitizer Mist - 185KG"
                    required
                    data-testid="formula-name-input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Planned Quantity *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.planned_qty}
                      onChange={(e) => setFormData({ ...formData, planned_qty: e.target.value })}
                      placeholder="185"
                      required
                      data-testid="planned-qty-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Select
                      value={formData.batch_unit}
                      onValueChange={(v) => setFormData({ ...formData, batch_unit: v })}
                    >
                      <SelectTrigger data-testid="batch-unit-select">
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

                <div className="space-y-2">
                  <Label>Target Location *</Label>
                  <Select
                    value={formData.target_location_id}
                    onValueChange={(v) => setFormData({ ...formData, target_location_id: v })}
                  >
                    <SelectTrigger data-testid="location-select">
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
                    placeholder="Optional batch notes"
                    data-testid="notes-input"
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="btn-primary" disabled={saving} data-testid="save-batch-btn">
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Create Workspace
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
        setUploadDialogOpen(open);
        if (!open) {
          setSelectedWorkspace(null);
          setUploadResult(null);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Completed Batching Sheet</DialogTitle>
            <DialogDescription>
              {selectedWorkspace && (
                <span>Batch: <strong>{selectedWorkspace.batch_code}</strong></span>
              )}
            </DialogDescription>
          </DialogHeader>

          {!uploadResult ? (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-[#0F5132] bg-[#0F5132]/5' : 'border-slate-300 hover:border-slate-400'
              }`}
            >
              <input {...getInputProps()} data-testid="upload-sheet-input" />
              {uploading ? (
                <Loader2 className="w-12 h-12 mx-auto text-[#0F5132] animate-spin" />
              ) : (
                <div>
                  <Upload className="w-12 h-12 mx-auto text-slate-400 mb-2" />
                  <p className="font-medium text-slate-700">
                    {isDragActive ? 'Drop the file here' : 'Drag & drop completed sheet'}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">or click to browse (.xlsx)</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-emerald-800 font-medium mb-2">
                  <CheckCircle className="w-5 h-5" />
                  Batch Completed Successfully
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">WIP Lot:</span>
                    <p className="lot-number font-bold">{uploadResult.wip_lot_number}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Actual Qty:</span>
                    <p className="font-bold">{formatNumber(uploadResult.actual_qty, 2)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Variance:</span>
                    <p className={cn("font-bold", uploadResult.variance >= 0 ? "text-emerald-600" : "text-red-600")}>
                      {uploadResult.variance >= 0 ? '+' : ''}{formatNumber(uploadResult.variance, 3)} ({formatNumber(uploadResult.variance_percent, 2)}%)
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Transactions:</span>
                    <p className="font-bold">{uploadResult.consumptions_created} consumptions</p>
                  </div>
                </div>
                {uploadResult.warnings?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-emerald-200">
                    <p className="text-xs text-amber-700 font-medium">Warnings:</p>
                    {uploadResult.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-600">• {w}</p>
                    ))}
                  </div>
                )}
              </div>
              <Button className="w-full btn-primary" onClick={() => setUploadDialogOpen(false)}>
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Workspaces Table */}
      <Card className="border-slate-200">
        <CardHeader className="py-3 px-4 border-b border-slate-100">
          <Badge variant="secondary">{workspaces.length} batching entries</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs uppercase">Batch Code</TableHead>
                <TableHead className="text-xs uppercase">Formula/Product</TableHead>
                <TableHead className="text-xs uppercase">Location</TableHead>
                <TableHead className="text-xs uppercase text-right">Planned</TableHead>
                <TableHead className="text-xs uppercase text-right">Actual</TableHead>
                <TableHead className="text-xs uppercase">WIP Lot</TableHead>
                <TableHead className="text-xs uppercase">Status</TableHead>
                <TableHead className="text-xs uppercase">Created</TableHead>
                <TableHead className="text-xs uppercase">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workspaces.length > 0 ? (
                workspaces.map((workspace) => (
                  <TableRow key={workspace.id} className="hover:bg-slate-50">
                    <TableCell className="lot-number">{workspace.batch_code}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate" title={workspace.formula_name}>
                      {workspace.formula_name}
                    </TableCell>
                    <TableCell>{getLocationName(workspace.target_location_id)}</TableCell>
                    <TableCell className="text-right">{formatNumber(workspace.planned_qty, 2)} {workspace.batch_unit}</TableCell>
                    <TableCell className="text-right">
                      {workspace.actual_qty ? `${formatNumber(workspace.actual_qty, 2)} ${workspace.batch_unit}` : '-'}
                    </TableCell>
                    <TableCell>
                      {workspace.wip_lot_number ? (
                        <span className="lot-number">{workspace.wip_lot_number}</span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs", getStatusColor(workspace.status))}>
                        {workspace.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {formatDate(workspace.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadSheet(workspace)}
                          title="Download batching sheet"
                          data-testid={`download-sheet-${workspace.batch_code}`}
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                        
                        {workspace.status === 'Planned' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStartBatching(workspace)}
                              data-testid={`start-batch-${workspace.batch_code}`}
                            >
                              <Play className="w-3 h-3 mr-1" /> Start
                            </Button>
                          </>
                        )}
                        
                        {workspace.status === 'In Progress' && (
                          <Button
                            size="sm"
                            className="btn-primary"
                            onClick={() => {
                              setSelectedWorkspace(workspace);
                              setUploadDialogOpen(true);
                            }}
                            data-testid={`upload-sheet-${workspace.batch_code}`}
                          >
                            <Upload className="w-3 h-3 mr-1" /> Upload
                          </Button>
                        )}
                        
                        {workspace.status === 'Completed' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleQaHold(workspace)}
                              data-testid={`qa-hold-${workspace.batch_code}`}
                            >
                              <AlertTriangle className="w-3 h-3 mr-1" /> QA Hold
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRelease(workspace)}
                              data-testid={`release-${workspace.batch_code}`}
                            >
                              <Shield className="w-3 h-3 mr-1" /> Release
                            </Button>
                          </>
                        )}
                        
                        {workspace.status === 'QA Hold' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRelease(workspace)}
                            data-testid={`release-hold-${workspace.batch_code}`}
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
                    <Factory className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No batching workspaces</p>
                    <p className="text-xs text-slate-400 mt-1">Create a new batch to get started</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Workflow Explanation */}
      <Card className="border-slate-200 bg-slate-50">
        <CardContent className="p-4">
          <h3 className="font-semibold text-slate-900 mb-3">Batching Workflow</h3>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-bold">1</span>
              <span className="text-slate-600">Create batch</span>
            </div>
            <span className="text-slate-300">→</span>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-bold">2</span>
              <span className="text-slate-600">Download sheet</span>
            </div>
            <span className="text-slate-300">→</span>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-xs font-bold">3</span>
              <span className="text-slate-600">Fill in Excel</span>
            </div>
            <span className="text-slate-300">→</span>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold">4</span>
              <span className="text-slate-600">Upload & complete</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
