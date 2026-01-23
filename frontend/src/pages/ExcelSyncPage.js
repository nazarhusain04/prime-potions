import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { 
  Upload, 
  Download, 
  FileSpreadsheet, 
  ArrowRight, 
  CheckCircle, 
  AlertTriangle,
  Loader2,
  Plus,
  X
} from 'lucide-react';
import api from '../lib/api';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const ExcelSyncPage = () => {
  const [activeTab, setActiveTab] = useState('import');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [mappingType, setMappingType] = useState('raw_material');
  const [fieldMappings, setFieldMappings] = useState({});
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [step, setStep] = useState(1);

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploadedFile(file);
    setLoading(true);
    setAnalysis(null);
    setSelectedSheet('');
    setFieldMappings({});
    setPreview(null);
    setStep(1);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/excel/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setAnalysis(response.data.analysis);
      toast.success('File analyzed successfully');
    } catch (error) {
      toast.error('Failed to analyze file');
      setUploadedFile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 1
  });

  const handleSheetSelect = async (sheetName) => {
    setSelectedSheet(sheetName);
    const sheet = analysis.sheets.find(s => s.name === sheetName);
    
    if (sheet) {
      // Get suggested mappings
      try {
        const response = await api.post('/excel/suggest-mappings', sheet.headers, {
          params: { mapping_type: mappingType }
        });
        setFieldMappings(response.data.suggestions);
      } catch (error) {
        // Use empty mappings
        const emptyMappings = {};
        sheet.headers.forEach(h => emptyMappings[h] = null);
        setFieldMappings(emptyMappings);
      }
    }
    setStep(2);
  };

  const handlePreview = async () => {
    if (!uploadedFile || !selectedSheet) return;
    setLoading(true);

    const formData = new FormData();
    formData.append('file', uploadedFile);

    try {
      const response = await api.post('/excel/preview-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        params: { sheet_name: selectedSheet, mapping_type: mappingType }
      });
      setPreview(response.data.preview);
      setStep(3);
      toast.success('Preview generated');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate preview');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!uploadedFile || !selectedSheet) return;
    setApplying(true);

    const formData = new FormData();
    formData.append('file', uploadedFile);

    try {
      const response = await api.post('/excel/apply-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        params: { 
          sheet_name: selectedSheet, 
          mapping_type: mappingType,
          field_mappings: JSON.stringify(fieldMappings)
        }
      });
      
      toast.success(`Import complete! Created: ${response.data.created}, Updated: ${response.data.updated}`);
      
      // Reset
      setUploadedFile(null);
      setAnalysis(null);
      setSelectedSheet('');
      setFieldMappings({});
      setPreview(null);
      setStep(1);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Import failed');
    } finally {
      setApplying(false);
    }
  };

  const handleDownloadTemplate = async (templateType) => {
    try {
      const response = await api.get(`/excel/download-template/${templateType}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${templateType}_template.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Template downloaded');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const selectedSheetInfo = analysis?.sheets.find(s => s.name === selectedSheet);

  return (
    <div className="space-y-6" data-testid="excel-sync-page">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Excel Sync</h1>
        <p className="text-slate-500">Import and export data via Excel workbooks</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="import" data-testid="tab-import">
            <Upload className="w-4 h-4 mr-2" /> Import
          </TabsTrigger>
          <TabsTrigger value="export" data-testid="tab-export">
            <Download className="w-4 h-4 mr-2" /> Export Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-6">
          {/* Step Indicator */}
          <div className="flex items-center gap-4 text-sm">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-[#0F5132]' : 'text-slate-400'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-[#0F5132] text-white' : 'bg-slate-200'}`}>1</span>
              Upload
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300" />
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-[#0F5132]' : 'text-slate-400'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-[#0F5132] text-white' : 'bg-slate-200'}`}>2</span>
              Map Fields
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300" />
            <div className={`flex items-center gap-2 ${step >= 3 ? 'text-[#0F5132]' : 'text-slate-400'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-[#0F5132] text-white' : 'bg-slate-200'}`}>3</span>
              Preview & Apply
            </div>
          </div>

          {/* Step 1: Upload */}
          <Card className="border-slate-200">
            <CardHeader className="py-3 px-4 border-b border-slate-100">
              <CardTitle className="text-base">Step 1: Upload Excel File</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                      isDragActive ? 'border-[#0F5132] bg-[#0F5132]/5' : 'border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <input {...getInputProps()} data-testid="file-upload-input" />
                    {loading ? (
                      <Loader2 className="w-12 h-12 mx-auto text-slate-400 animate-spin" />
                    ) : uploadedFile ? (
                      <div>
                        <FileSpreadsheet className="w-12 h-12 mx-auto text-[#0F5132] mb-2" />
                        <p className="font-medium text-slate-900">{uploadedFile.name}</p>
                        <p className="text-sm text-slate-500">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-12 h-12 mx-auto text-slate-400 mb-2" />
                        <p className="font-medium text-slate-700">
                          {isDragActive ? 'Drop the file here' : 'Drag & drop Excel file here'}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">or click to browse (.xlsx, .xls)</p>
                      </div>
                    )}
                  </div>
                </div>

                {analysis && (
                  <div>
                    <Label className="mb-2 block">Select Sheet & Data Type</Label>
                    <div className="space-y-3">
                      <Select value={mappingType} onValueChange={setMappingType}>
                        <SelectTrigger data-testid="mapping-type-select">
                          <SelectValue placeholder="Data type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="raw_material">Raw Materials</SelectItem>
                          <SelectItem value="packaging">Packaging Materials</SelectItem>
                        </SelectContent>
                      </Select>

                      <div className="space-y-2">
                        {analysis.sheets.map((sheet) => (
                          <button
                            key={sheet.name}
                            onClick={() => handleSheetSelect(sheet.name)}
                            className={`w-full text-left p-3 rounded-md border transition-colors ${
                              selectedSheet === sheet.name 
                                ? 'border-[#0F5132] bg-[#0F5132]/5' 
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                            data-testid={`sheet-${sheet.name}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{sheet.name}</span>
                              <Badge variant="secondary">{sheet.row_count} rows</Badge>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              {sheet.headers.slice(0, 4).join(', ')}{sheet.headers.length > 4 ? '...' : ''}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Field Mappings */}
          {step >= 2 && selectedSheetInfo && (
            <Card className="border-slate-200">
              <CardHeader className="py-3 px-4 border-b border-slate-100">
                <CardTitle className="text-base">Step 2: Review Field Mappings</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <p className="text-sm text-slate-500 mb-4">
                  Review the auto-detected mappings. Adjust if needed.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(fieldMappings).map(([sourceCol, targetField]) => (
                    <div key={sourceCol} className="flex items-center gap-2 p-2 bg-slate-50 rounded-md">
                      <span className="text-sm font-medium text-slate-700 flex-1 truncate" title={sourceCol}>
                        {sourceCol}
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <Badge className={targetField ? 'bg-[#0F5132]' : 'bg-slate-300'}>
                        {targetField || 'unmapped'}
                      </Badge>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <Button 
                    className="btn-primary gap-2" 
                    onClick={handlePreview}
                    disabled={loading}
                    data-testid="preview-btn"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Preview Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Preview */}
          {step >= 3 && preview && (
            <Card className="border-slate-200">
              <CardHeader className="py-3 px-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Step 3: Preview Changes</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-100 text-emerald-800">
                      <Plus className="w-3 h-3 mr-1" /> {preview.summary.to_create} new
                    </Badge>
                    <Badge className="bg-amber-100 text-amber-800">
                      {preview.summary.to_update} updates
                    </Badge>
                    {preview.summary.errors > 0 && (
                      <Badge className="bg-red-100 text-red-800">
                        {preview.summary.errors} errors
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {preview.create.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-sm text-emerald-700 mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" /> Will Create ({preview.create.length})
                    </h4>
                    <div className="max-h-40 overflow-y-auto">
                      <Table>
                        <TableBody>
                          {preview.create.slice(0, 10).map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="lot-number">{item.key}</TableCell>
                              <TableCell className="text-sm text-slate-600">
                                {item.record.name || item.record.item_code || '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {preview.update.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-sm text-amber-700 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Will Update ({preview.update.length})
                    </h4>
                    <div className="max-h-40 overflow-y-auto">
                      <Table>
                        <TableBody>
                          {preview.update.slice(0, 10).map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="lot-number">{item.key}</TableCell>
                              <TableCell className="text-xs text-slate-500">
                                {Object.keys(item.changes).join(', ')}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex justify-end gap-3">
                  <Button variant="outline" onClick={() => { setStep(1); setPreview(null); }}>
                    Cancel
                  </Button>
                  <Button 
                    className="btn-primary gap-2" 
                    onClick={handleApply}
                    disabled={applying || preview.summary.to_create + preview.summary.to_update === 0}
                    data-testid="apply-import-btn"
                  >
                    {applying && <Loader2 className="w-4 h-4 animate-spin" />}
                    Apply Import
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="export" className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader className="py-3 px-4 border-b border-slate-100">
              <CardTitle className="text-base">Download Templates</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-sm text-slate-500 mb-4">
                Download Excel templates to prepare data for import.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => handleDownloadTemplate('raw_materials')}
                  className="p-4 border border-slate-200 rounded-lg hover:border-[#0F5132] hover:bg-[#0F5132]/5 transition-colors text-left"
                  data-testid="download-raw-materials-template"
                >
                  <FileSpreadsheet className="w-8 h-8 text-[#0F5132] mb-2" />
                  <p className="font-medium">Raw Materials Template</p>
                  <p className="text-sm text-slate-500">Import raw material master data</p>
                </button>

                <button
                  onClick={() => handleDownloadTemplate('packaging')}
                  className="p-4 border border-slate-200 rounded-lg hover:border-[#0F5132] hover:bg-[#0F5132]/5 transition-colors text-left"
                  data-testid="download-packaging-template"
                >
                  <FileSpreadsheet className="w-8 h-8 text-[#0F5132] mb-2" />
                  <p className="font-medium">Packaging Template</p>
                  <p className="text-sm text-slate-500">Import packaging materials</p>
                </button>

                <button
                  onClick={() => handleDownloadTemplate('inventory_receipt')}
                  className="p-4 border border-slate-200 rounded-lg hover:border-[#0F5132] hover:bg-[#0F5132]/5 transition-colors text-left"
                  data-testid="download-inventory-template"
                >
                  <FileSpreadsheet className="w-8 h-8 text-[#0F5132] mb-2" />
                  <p className="font-medium">Inventory Receipt Template</p>
                  <p className="text-sm text-slate-500">Record inventory receipts</p>
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
