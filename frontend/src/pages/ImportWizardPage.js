import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { toast } from 'sonner';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  FileSpreadsheet,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Wand2,
  ArrowRight,
  Settings2,
  Eye
} from 'lucide-react';

const STEPS = [
  { id: 'upload', title: 'Upload File', description: 'Select your Excel file' },
  { id: 'select', title: 'Select Sheet', description: 'Choose which sheet to import' },
  { id: 'map', title: 'Map Columns', description: 'Match Excel columns to ERP fields' },
  { id: 'preview', title: 'Preview', description: 'Review changes before applying' },
  { id: 'complete', title: 'Complete', description: 'Import finished' }
];

const ERP_FIELDS = {
  raw_materials: [
    { key: 'item_code', label: 'Item Code / SKU', required: true },
    { key: 'name', label: 'Name / Description', required: true },
    { key: 'manufacturer', label: 'Manufacturer / Vendor', required: false },
    { key: 'inci_name', label: 'INCI Name', required: false },
    { key: 'location', label: 'Storage Location', required: false },
    { key: 'uom', label: 'Unit of Measure', required: false },
    { key: 'minimum_stock', label: 'Minimum Stock Level', required: false },
    { key: 'category', label: 'Category', required: false },
    { key: 'notes', label: 'Notes', required: false },
  ],
  packaging: [
    { key: 'name', label: 'Item Name', required: true },
    { key: 'category', label: 'Category', required: false },
    { key: 'sub_category', label: 'Sub Category', required: false },
    { key: 'supplier', label: 'Supplier', required: false },
    { key: 'size_specs', label: 'Size / Specifications', required: false },
    { key: 'uom', label: 'Unit of Measure', required: false },
    { key: 'location', label: 'Storage Location', required: false },
    { key: 'minimum_stock', label: 'Minimum Stock Level', required: false },
  ],
  inventory_receipt: [
    { key: 'item_code', label: 'Item Code / SKU', required: true },
    { key: 'lot_number', label: 'Lot Number', required: true },
    { key: 'quantity', label: 'Quantity', required: true },
    { key: 'uom', label: 'Unit of Measure', required: false },
    { key: 'location', label: 'Location', required: false },
    { key: 'expiry_date', label: 'Expiry Date', required: false },
  ]
};

export const ImportWizardPage = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [dataType, setDataType] = useState('raw_materials');
  const [fieldMappings, setFieldMappings] = useState({});
  const [preview, setPreview] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`
  });

  // Step 1: Upload file
  const onDrop = useCallback(async (acceptedFiles) => {
    const uploadedFile = acceptedFiles[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/excel/import-wizard/analyze`,
        {
          method: 'POST',
          headers: getAuthHeader(),
          body: formData
        }
      );

      if (!response.ok) throw new Error('Analysis failed');

      const data = await response.json();
      setAnalysis(data.analysis);
      
      // Auto-select first sheet
      if (data.analysis.sheets?.length > 0) {
        const firstSheet = data.analysis.sheets[0];
        setSelectedSheet(firstSheet);
        
        // Auto-detect data type and set suggested mappings
        setDataType(firstSheet.suggested_type || 'raw_materials');
        setFieldMappings(firstSheet.suggested_mappings || {});
      }

      setCurrentStep(1);
      toast.success('File analyzed successfully');
    } catch (error) {
      toast.error('Failed to analyze file: ' + error.message);
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

  // Step 2: Select sheet
  const handleSheetSelect = (sheet) => {
    setSelectedSheet(sheet);
    setDataType(sheet.suggested_type || 'raw_materials');
    setFieldMappings(sheet.suggested_mappings || {});
  };

  // Step 3: Update field mapping
  const updateMapping = (excelColumn, erpField) => {
    setFieldMappings(prev => ({
      ...prev,
      [excelColumn]: erpField === 'skip' ? undefined : erpField
    }));
  };

  // Step 4: Generate preview
  const generatePreview = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const params = new URLSearchParams({
        sheet_name: selectedSheet.name,
        data_type: dataType,
        field_mappings: JSON.stringify(fieldMappings)
      });

      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/excel/import-wizard/preview?${params}`,
        {
          method: 'POST',
          headers: getAuthHeader(),
          body: formData
        }
      );

      if (!response.ok) throw new Error('Preview failed');

      const data = await response.json();
      setPreview(data);
      setCurrentStep(3);
    } catch (error) {
      toast.error('Failed to generate preview: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 5: Apply import
  const applyImport = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const params = new URLSearchParams({
        sheet_name: selectedSheet.name,
        data_type: dataType,
        field_mappings: JSON.stringify(fieldMappings)
      });

      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/excel/import-wizard/apply?${params}`,
        {
          method: 'POST',
          headers: getAuthHeader(),
          body: formData
        }
      );

      if (!response.ok) throw new Error('Import failed');

      const result = await response.json();
      setImportResult(result);
      setCurrentStep(4);
      toast.success(`Import complete: ${result.created} created, ${result.updated} updated`);
    } catch (error) {
      toast.error('Import failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const goToStep = (step) => {
    if (step < currentStep) setCurrentStep(step);
  };

  const resetWizard = () => {
    setCurrentStep(0);
    setFile(null);
    setAnalysis(null);
    setSelectedSheet(null);
    setFieldMappings({});
    setPreview(null);
    setImportResult(null);
  };

  return (
    <div className="space-y-6" data-testid="import-wizard-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wand2 className="w-7 h-7" />
          Import Wizard
        </h1>
        <p className="text-gray-500">Step-by-step guide to import your Excel data</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
        {STEPS.map((step, idx) => (
          <div 
            key={step.id} 
            className={`flex items-center cursor-pointer ${idx <= currentStep ? 'opacity-100' : 'opacity-40'}`}
            onClick={() => goToStep(idx)}
          >
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
              ${idx < currentStep ? 'bg-green-500 text-white' : 
                idx === currentStep ? 'bg-blue-500 text-white' : 
                'bg-gray-200 text-gray-500'}
            `}>
              {idx < currentStep ? <Check className="w-5 h-5" /> : idx + 1}
            </div>
            <div className="ml-2 hidden md:block">
              <p className="font-medium text-sm">{step.title}</p>
              <p className="text-xs text-gray-500">{step.description}</p>
            </div>
            {idx < STEPS.length - 1 && (
              <ChevronRight className="w-5 h-5 mx-4 text-gray-300" />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {/* STEP 1: Upload */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
                  ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}
                `}
              >
                <input {...getInputProps()} data-testid="file-upload-input" />
                {loading ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                    <p className="font-medium">Analyzing file...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload className="w-12 h-12 text-gray-400 mb-4" />
                    <p className="font-medium text-lg">
                      {isDragActive ? 'Drop your file here' : 'Drag & drop your Excel file'}
                    </p>
                    <p className="text-gray-500 mt-2">or click to browse</p>
                    <p className="text-xs text-gray-400 mt-4">Supports .xlsx and .xls files</p>
                  </div>
                )}
              </div>

              {file && (
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <FileSpreadsheet className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Select Sheet */}
          {currentStep === 1 && analysis && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Select Sheet to Import</h3>
              <p className="text-gray-500 text-sm">Choose which sheet contains your data</p>
              
              <div className="grid gap-3">
                {analysis.sheets.map((sheet, idx) => (
                  <div
                    key={idx}
                    className={`
                      p-4 border rounded-lg cursor-pointer transition-all
                      ${selectedSheet?.name === sheet.name 
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                        : 'border-gray-200 hover:border-blue-300'}
                    `}
                    onClick={() => handleSheetSelect(sheet)}
                    data-testid={`sheet-option-${idx}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="w-6 h-6 text-green-600" />
                        <div>
                          <p className="font-medium">{sheet.name}</p>
                          <p className="text-sm text-gray-500">
                            {sheet.row_count} rows • {sheet.headers.length} columns
                          </p>
                        </div>
                      </div>
                      {sheet.suggested_type && (
                        <Badge variant="outline" className="capitalize">
                          {sheet.suggested_type.replace('_', ' ')}
                        </Badge>
                      )}
                    </div>
                    {sheet.headers.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {sheet.headers.slice(0, 6).map((h, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{h}</Badge>
                        ))}
                        {sheet.headers.length > 6 && (
                          <Badge variant="secondary" className="text-xs">+{sheet.headers.length - 6} more</Badge>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-4 pt-4">
                <Label>Import as:</Label>
                <Select value={dataType} onValueChange={setDataType}>
                  <SelectTrigger className="w-48" data-testid="data-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="raw_materials">Raw Materials</SelectItem>
                    <SelectItem value="packaging">Packaging</SelectItem>
                    <SelectItem value="inventory_receipt">Inventory Receipt</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setCurrentStep(0)}>
                  <ChevronLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button onClick={() => setCurrentStep(2)} disabled={!selectedSheet}>
                  Continue <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Map Columns */}
          {currentStep === 2 && selectedSheet && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">Map Columns</h3>
                  <p className="text-gray-500 text-sm">Match Excel columns to ERP fields</p>
                </div>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Settings2 className="w-3 h-3" />
                  Auto-mapped {Object.keys(fieldMappings).length} columns
                </Badge>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-1/3">Excel Column</TableHead>
                      <TableHead className="w-1/12 text-center">
                        <ArrowRight className="w-4 h-4 mx-auto" />
                      </TableHead>
                      <TableHead className="w-1/3">ERP Field</TableHead>
                      <TableHead className="w-1/6">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSheet.headers.map((header, idx) => {
                      const mappedField = fieldMappings[header];
                      const erpField = ERP_FIELDS[dataType]?.find(f => f.key === mappedField);
                      const isRequired = erpField?.required;

                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{header}</TableCell>
                          <TableCell className="text-center">
                            <ArrowRight className="w-4 h-4 mx-auto text-gray-300" />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={mappedField || 'skip'}
                              onValueChange={(v) => updateMapping(header, v)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Skip this column" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="skip">
                                  <span className="text-gray-400">Skip this column</span>
                                </SelectItem>
                                {ERP_FIELDS[dataType]?.map((field) => (
                                  <SelectItem key={field.key} value={field.key}>
                                    {field.label} {field.required && <span className="text-red-500">*</span>}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {mappedField ? (
                              <Badge className="bg-green-500">
                                <Check className="w-3 h-3 mr-1" /> Mapped
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Skipped</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                  <ChevronLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button onClick={generatePreview} disabled={loading}>
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                  ) : (
                    <><Eye className="w-4 h-4 mr-2" /> Preview Changes</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: Preview */}
          {currentStep === 3 && preview && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Preview Changes</h3>
              <p className="text-gray-500 text-sm">Review what will happen when you apply this import</p>

              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="pt-4 text-center">
                    <div className="text-3xl font-bold text-green-600">{preview.summary.to_create}</div>
                    <div className="text-sm text-green-700">To Create</div>
                  </CardContent>
                </Card>
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-4 text-center">
                    <div className="text-3xl font-bold text-blue-600">{preview.summary.to_update}</div>
                    <div className="text-sm text-blue-700">To Update</div>
                  </CardContent>
                </Card>
                <Card className="bg-gray-50 border-gray-200">
                  <CardContent className="pt-4 text-center">
                    <div className="text-3xl font-bold text-gray-600">{preview.summary.unchanged}</div>
                    <div className="text-sm text-gray-700">Unchanged</div>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="pt-4 text-center">
                    <div className="text-3xl font-bold text-red-600">{preview.summary.errors}</div>
                    <div className="text-sm text-red-700">Errors</div>
                  </CardContent>
                </Card>
              </div>

              {/* Details */}
              {preview.preview.to_create.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-green-600">New Records ({preview.preview.to_create.length})</h4>
                  <div className="border rounded-lg max-h-40 overflow-auto">
                    {preview.preview.to_create.slice(0, 10).map((item, idx) => (
                      <div key={idx} className="p-2 border-b last:border-b-0 text-sm">
                        {item.key || JSON.stringify(item.record).slice(0, 50)}...
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {preview.preview.to_update.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-blue-600">Updates ({preview.preview.to_update.length})</h4>
                  <div className="border rounded-lg max-h-40 overflow-auto">
                    {preview.preview.to_update.slice(0, 10).map((item, idx) => (
                      <div key={idx} className="p-2 border-b last:border-b-0 text-sm">
                        <span className="font-medium">{item.key}</span>
                        <span className="text-gray-500 ml-2">{item.changes?.length} field(s) changed</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {preview.preview.errors.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-red-600">Errors ({preview.preview.errors.length})</h4>
                  <div className="border border-red-200 rounded-lg bg-red-50 p-3">
                    {preview.preview.errors.map((err, idx) => (
                      <div key={idx} className="text-sm text-red-700">
                        <AlertCircle className="w-4 h-4 inline mr-1" />
                        {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setCurrentStep(2)}>
                  <ChevronLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button onClick={applyImport} disabled={loading} className="btn-primary">
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...</>
                  ) : (
                    <><Check className="w-4 h-4 mr-2" /> Apply Import</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 5: Complete */}
          {currentStep === 4 && importResult && (
            <div className="text-center py-8 space-y-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
              
              <div>
                <h3 className="text-2xl font-bold text-green-600">Import Complete!</h3>
                <p className="text-gray-500 mt-2">Your data has been successfully imported</p>
              </div>

              <div className="flex justify-center gap-8">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{importResult.created}</div>
                  <div className="text-sm text-gray-500">Created</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{importResult.updated}</div>
                  <div className="text-sm text-gray-500">Updated</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-600">{importResult.skipped}</div>
                  <div className="text-sm text-gray-500">Skipped</div>
                </div>
              </div>

              {importResult.errors?.length > 0 && (
                <div className="bg-red-50 p-4 rounded-lg text-left max-w-md mx-auto">
                  <h4 className="font-medium text-red-600 mb-2">Some errors occurred:</h4>
                  <ul className="text-sm text-red-700 list-disc list-inside">
                    {importResult.errors.slice(0, 5).map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Button onClick={resetWizard} className="btn-primary">
                Import Another File
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ImportWizardPage;
