import React, { useState, useEffect } from 'react';
import { manufacturingApi, masterApi } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { toast } from 'sonner';
import { Calculator, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { formatNumber } from '../../lib/utils';

export const FeasibilityPage = () => {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [feasibility, setFeasibility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await masterApi.listProducts();
        setProducts(response.data);
      } catch (error) {
        toast.error('Failed to load products');
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const handleCalculate = async () => {
    if (!selectedProduct) return;
    setCalculating(true);
    setFeasibility(null);

    try {
      const response = await manufacturingApi.getFeasibility(selectedProduct);
      setFeasibility(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to calculate feasibility');
    } finally {
      setCalculating(false);
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
    <div className="space-y-6" data-testid="feasibility-page">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Feasibility Calculator</h1>
        <p className="text-slate-500">Calculate max finished units producible now, limited by raw material or packaging stock - whichever runs out first</p>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="py-3 px-4 border-b border-slate-100">
          <CardTitle className="text-base">Select Product</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger className="w-80" data-testid="feasibility-product-select">
                <SelectValue placeholder="Select a product to analyze" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              className="btn-primary gap-2" 
              onClick={handleCalculate}
              disabled={!selectedProduct || calculating}
              data-testid="calculate-feasibility-btn"
            >
              {calculating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Calculator className="w-4 h-4" />
              )}
              Calculate
            </Button>
          </div>
        </CardContent>
      </Card>

      {feasibility && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Result Card */}
          <Card className="border-slate-200">
            <CardHeader className="py-3 px-4 border-b border-slate-100">
              <CardTitle className="text-base">Feasibility Result</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <p className="text-sm text-slate-500 mb-2">Maximum Feasible Quantity</p>
                <p className="text-5xl font-bold text-[#0F5132]" data-testid="max-feasible-qty">
                  {formatNumber(feasibility.max_feasible_quantity, feasibility.quantity_label === 'units' ? 0 : 2)}
                </p>
                <p className="text-sm text-slate-400 mt-1">{feasibility.quantity_label || 'units'}</p>
              </div>

              <div className={`flex items-center gap-2 p-3 rounded-md ${
                feasibility.max_feasible_quantity > 0 
                  ? 'bg-emerald-50 text-emerald-800' 
                  : 'bg-red-50 text-red-800'
              }`}>
                {feasibility.max_feasible_quantity > 0 ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
                <div>
                  <p className="font-medium">Bottleneck</p>
                  <p className="text-sm" data-testid="bottleneck-reason">{feasibility.bottleneck}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Components Breakdown */}
          <Card className="border-slate-200">
            <CardHeader className="py-3 px-4 border-b border-slate-100">
              <CardTitle className="text-base">Component Analysis</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                {feasibility.components.map((comp, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-md">
                    <div>
                      <p className="font-medium text-sm">{comp.name}</p>
                      <p className="text-xs text-slate-500 capitalize flex items-center gap-1.5">
                        {comp.type.replace('_', ' ')}
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{comp.stage || 'ingredient'}</Badge>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">
                        <span className="text-slate-500">Available:</span>{' '}
                        <span className="font-semibold">{formatNumber(comp.available, 2)} {comp.uom}</span>
                      </p>
                      <p className="text-xs text-slate-400">
                        Max output: {formatNumber(comp.max_units, comp.stage === 'packaging' ? 1 : 2)} {comp.stage === 'packaging' ? 'units' : 'KG'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
