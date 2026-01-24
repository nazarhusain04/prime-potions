import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { 
  Download, 
  Upload, 
  FileSpreadsheet,
  Package,
  Boxes,
  Beaker,
  CheckCircle,
  AlertCircle,
  Loader2,
  Lock,
  Info
} from 'lucide-react';
import api from '../lib/api';

export const ExcelSyncPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadType, setUploadType] = useState(null);

  const handleDownload = async (type) => {
    try {
      const endpoints = {
        raw: '/excel/prime-potions/raw-materials',
        packaging: '/excel/prime-potions/packaging',
        batching: '/excel/prime-potions/batching-template',
      };
      
      const filenames = {
        raw: 'RAW-Material_Master_Inventory.xlsx',
        packaging: 'Master_Inventory_Packaging.xlsx',
        batching: 'Batching_Template.xlsx',
      };
      
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}${endpoints[type]}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filenames[type];
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      toast.success(`${type} exported successfully`);
    } catch (error) {
      toast.error('Export failed: ' + error.message);
    }
  };

  const handleFileSelect = (e, type) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadType(type);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadType) return;
    
    setUploading(true);
    setUploadResult(null);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const endpoints = {
        raw: '/excel/prime-potions/import-raw-materials',
        packaging: '/excel/prime-potions/import-packaging',
      };
      
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}${endpoints[uploadType]}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          },
          body: formData
        }
      );
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.detail?.message || result.detail || 'Import failed');
      }
      
      setUploadResult(result);
      toast.success(`Import complete: ${result.created} created, ${result.updated} updated`);
    } catch (error) {
      toast.error('Import failed: ' + error.message);
      setUploadResult({ error: error.message });
    } finally {
      setUploading(false);
    }
  };

  const ExportCard = ({ title, description, icon: Icon, type, color }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Button 
          className="w-full" 
          variant="outline"
          onClick={() => handleDownload(type)}
          data-testid={`export-${type}-btn`}
        >
          <Download className="w-4 h-4 mr-2" />
          Export to Excel
        </Button>
      </CardContent>
    </Card>
  );

  const ImportCard = ({ title, description, icon: Icon, type, color }) => (
    <Card className={`hover:shadow-md transition-shadow ${!isAdmin ? 'opacity-60' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base flex items-center gap-2">
              {title}
              {!isAdmin && <Lock className="w-3 h-3 text-gray-400" />}
            </CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isAdmin ? (
          <div className="space-y-2">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => handleFileSelect(e, type)}
              className="hidden"
              id={`upload-${type}`}
              data-testid={`upload-${type}-input`}
            />
            <label htmlFor={`upload-${type}`}>
              <Button 
                className="w-full cursor-pointer" 
                variant="outline"
                asChild
              >
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  Select File
                </span>
              </Button>
            </label>
            {selectedFile && uploadType === type && (
              <div className="text-xs text-gray-500 truncate">
                Selected: {selectedFile.name}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-500 text-center py-2">
            Admin access required for import
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6" data-testid="excel-sync-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="w-7 h-7" />
            Excel Sync
          </h1>
          <p className="text-gray-500">Export and import data using Prime Potions Excel templates</p>
        </div>
        {user && (
          <Badge variant={isAdmin ? "default" : "secondary"}>
            {user.role}
          </Badge>
        )}
      </div>

      {/* Info Banner */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-3">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Prime Potions Template Mode</p>
              <p className="text-blue-600">
                Exports and imports use your exact Excel column headers and sheet names. 
                Inventory transactions are created through ERP workflows only - Excel import updates master data.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Export Data</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ExportCard
            title="Raw Materials"
            description="RAW-MASTER INV sheet with exact headers"
            icon={Package}
            type="raw"
            color="bg-green-600"
          />
          <ExportCard
            title="Packaging"
            description="Master inventory-Packaging sheet"
            icon={Boxes}
            type="packaging"
            color="bg-blue-600"
          />
          <ExportCard
            title="Batching Template"
            description="Prime Potions batching sheet format"
            icon={Beaker}
            type="batching"
            color="bg-purple-600"
          />
        </div>
      </div>

      {/* Import Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          Import Data
          {!isAdmin && <Badge variant="outline" className="text-xs">Admin Only</Badge>}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ImportCard
            title="Raw Materials"
            description="Update master data from RAW-MASTER INV"
            icon={Package}
            type="raw"
            color="bg-green-600"
          />
          <ImportCard
            title="Packaging"
            description="Update master data from Master inventory-Packaging"
            icon={Boxes}
            type="packaging"
            color="bg-blue-600"
          />
        </div>

        {/* Upload Button & Results */}
        {isAdmin && selectedFile && (
          <Card className="mt-4">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">Type: {uploadType}</p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => { setSelectedFile(null); setUploadType(null); setUploadResult(null); }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleUpload} 
                    disabled={uploading}
                    data-testid="apply-import-btn"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Apply Import
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Import Results */}
              {uploadResult && !uploadResult.error && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 text-green-700 font-medium">
                    <CheckCircle className="w-5 h-5" />
                    Import Successful
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Created:</span>
                      <span className="ml-2 font-bold text-green-600">{uploadResult.created}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Updated:</span>
                      <span className="ml-2 font-bold text-blue-600">{uploadResult.updated}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Skipped:</span>
                      <span className="ml-2 font-bold text-gray-600">{uploadResult.skipped || 0}</span>
                    </div>
                  </div>
                  {uploadResult.errors?.length > 0 && (
                    <div className="mt-2 text-sm text-red-600">
                      Errors: {uploadResult.errors.join(', ')}
                    </div>
                  )}
                </div>
              )}

              {uploadResult?.error && (
                <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-5 h-5" />
                    Import Failed: {uploadResult.error}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Template Info */}
      <Card className="bg-gray-50">
        <CardHeader>
          <CardTitle className="text-base">Template Reference</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <div>
            <p className="font-medium">Raw Materials Sheet: RAW-MASTER INV</p>
            <p className="text-gray-500 text-xs">
              ITEM CODE | INTERNAL LOT # | Ingredient Name | SUPPLIER LOT # | Tracking key | Opening stock | Inventory on hand | EXPIRY / RETEST Date | VENDOR / MANUFACTURER | INCI NAME | Primary Inv Zone | 2ND Inv Zone | CoA | Container Type | UoM | Notes | Minimum stock | Stock status
            </p>
          </div>
          <div>
            <p className="font-medium">Packaging Sheet: Master inventory-Packaging</p>
            <p className="text-gray-500 text-xs">
              Item Name | sub category | category | Client | Supplier | Size or Specs | UOM | Opening Stock | On Hand | Active | Storage location | Minimum Stock | Stock Status
            </p>
          </div>
          <div>
            <p className="font-medium">Batching Sheet (row 4 headers):</p>
            <p className="text-gray-500 text-xs">
              Ingredient Formula | Inv Loc. | Qty Required | Add Order | Added | Kg Sum | Process Notes | Batch Notes | [blank] | Qty on Hand (kg) | ENTER % QTY HERE | [blank] | [blank] | Enter individual Quantities...
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExcelSyncPage;
