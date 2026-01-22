import React, { useState } from 'react';
import { traceabilityApi } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { toast } from 'sonner';
import { Search, ArrowRight, ArrowLeft, GitBranch, Loader2 } from 'lucide-react';

export const TraceabilityPage = () => {
  const [lotNumber, setLotNumber] = useState('');
  const [traceDirection, setTraceDirection] = useState('forward');
  const [traceResult, setTraceResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleTrace = async () => {
    if (!lotNumber.trim()) {
      toast.error('Please enter a lot number');
      return;
    }

    setLoading(true);
    setTraceResult(null);

    try {
      let response;
      if (traceDirection === 'forward') {
        response = await traceabilityApi.traceForward(lotNumber.trim());
      } else {
        response = await traceabilityApi.traceBackward(lotNumber.trim());
      }
      setTraceResult(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Lot not found in traceability chain');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="traceability-page">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Traceability</h1>
        <p className="text-slate-500">Track lot genealogy forward and backward</p>
      </div>

      {/* Search */}
      <Card className="border-slate-200">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px] space-y-2">
              <Label>Lot Number</Label>
              <Input
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                placeholder="Enter lot number (e.g., RM-241215-0001)"
                data-testid="trace-lot-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Direction</Label>
              <Select value={traceDirection} onValueChange={setTraceDirection}>
                <SelectTrigger className="w-48" data-testid="trace-direction-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="forward">
                    <span className="flex items-center gap-2">
                      <ArrowRight className="w-4 h-4" /> Forward (Where Used)
                    </span>
                  </SelectItem>
                  <SelectItem value="backward">
                    <span className="flex items-center gap-2">
                      <ArrowLeft className="w-4 h-4" /> Backward (Origin)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              className="btn-primary gap-2" 
              onClick={handleTrace}
              disabled={loading}
              data-testid="trace-btn"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Trace
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {traceResult && (
        <Card className="border-slate-200">
          <CardHeader className="py-3 px-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-[#0F5132]" />
              <CardTitle className="text-base">
                {traceDirection === 'forward' ? 'Forward Trace' : 'Backward Trace'}
              </CardTitle>
              <Badge variant="outline" className="lot-number ml-2">
                {traceResult.source_lot || traceResult.lot_number}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {traceDirection === 'forward' ? (
              <ForwardTraceResult data={traceResult} />
            ) : (
              <BackwardTraceResult data={traceResult} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const ForwardTraceResult = ({ data }) => (
  <div className="space-y-6">
    <p className="text-sm text-slate-600">
      Tracing lot <span className="lot-number">{data.source_lot}</span> forward through production...
    </p>

    {/* Batches */}
    <div>
      <h4 className="font-semibold text-sm text-slate-700 mb-2">Used in Batch Orders</h4>
      {data.batches?.length > 0 ? (
        <div className="space-y-2">
          {data.batches.map((batch, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-md">
              <div>
                <p className="lot-number">{batch.batch_number}</p>
                {batch.wip_lot_number && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    WIP Lot: <span className="lot-number">{batch.wip_lot_number}</span>
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm">Consumed: {batch.quantity_consumed}</p>
                <Badge variant="outline" className="text-xs">{batch.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">Not used in any batches</p>
      )}
    </div>

    {/* Filling Orders */}
    <div>
      <h4 className="font-semibold text-sm text-slate-700 mb-2">Used in Filling Orders</h4>
      {data.filling_orders?.length > 0 ? (
        <div className="space-y-2">
          {data.filling_orders.map((filling, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-md">
              <div>
                <p className="lot-number">{filling.filling_number}</p>
                {filling.fg_lot_number && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    FG Lot: <span className="lot-number">{filling.fg_lot_number}</span>
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">From WIP: {filling.wip_lot_consumed}</p>
                <Badge variant="outline" className="text-xs">{filling.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">Not used in any filling orders</p>
      )}
    </div>
  </div>
);

const BackwardTraceResult = ({ data }) => (
  <div className="space-y-6">
    <p className="text-sm text-slate-600">
      Tracing lot <span className="lot-number">{data.lot_number}</span> backward to origin...
    </p>

    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">Lot Type:</span>
      <Badge variant="outline" className="capitalize">{data.lot_type?.replace('_', ' ')}</Badge>
    </div>

    {/* Filling Order Info */}
    {data.filling_order && (
      <div>
        <h4 className="font-semibold text-sm text-slate-700 mb-2">From Filling Order</h4>
        <div className="p-3 bg-slate-50 rounded-md">
          <p className="lot-number">{data.filling_order.filling_number}</p>
          <Badge variant="outline" className="text-xs mt-1">{data.filling_order.status}</Badge>
        </div>
      </div>
    )}

    {/* WIP Lots Consumed */}
    {data.wip_lots_consumed?.length > 0 && (
      <div>
        <h4 className="font-semibold text-sm text-slate-700 mb-2">WIP Batches Used</h4>
        <div className="space-y-2">
          {data.wip_lots_consumed.map((wip, idx) => (
            <div key={idx} className="p-3 bg-amber-50 rounded-md">
              <p className="lot-number">{wip.lot_number}</p>
              <p className="text-xs text-slate-500 mt-0.5">Quantity: {wip.quantity}</p>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Packaging Used */}
    {data.packaging_consumed?.length > 0 && (
      <div>
        <h4 className="font-semibold text-sm text-slate-700 mb-2">Packaging Used</h4>
        <div className="space-y-2">
          {data.packaging_consumed.map((pkg, idx) => (
            <div key={idx} className="p-3 bg-blue-50 rounded-md">
              <p className="font-medium text-sm">{pkg.material_name}</p>
              <p className="lot-number text-xs mt-0.5">{pkg.lot_number}</p>
              <p className="text-xs text-slate-500">Quantity: {pkg.quantity}</p>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Raw Materials */}
    {data.raw_materials?.length > 0 && (
      <div>
        <h4 className="font-semibold text-sm text-slate-700 mb-2">Raw Materials (Origin)</h4>
        <div className="space-y-2">
          {data.raw_materials.map((rm, idx) => (
            <div key={idx} className="p-3 bg-emerald-50 rounded-md">
              <p className="font-medium text-sm">{rm.material_name}</p>
              <p className="lot-number text-xs mt-0.5">{rm.lot_number}</p>
              <p className="text-xs text-slate-500">
                Quantity: {rm.quantity} • Via Batch: {rm.via_batch}
              </p>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* For WIP lots */}
    {data.batch_order && (
      <div>
        <h4 className="font-semibold text-sm text-slate-700 mb-2">From Batch Order</h4>
        <div className="p-3 bg-slate-50 rounded-md">
          <p className="lot-number">{data.batch_order.batch_number}</p>
          <Badge variant="outline" className="text-xs mt-1">{data.batch_order.status}</Badge>
        </div>
      </div>
    )}

    {data.raw_materials_consumed?.length > 0 && (
      <div>
        <h4 className="font-semibold text-sm text-slate-700 mb-2">Raw Materials Consumed</h4>
        <div className="space-y-2">
          {data.raw_materials_consumed.map((rm, idx) => (
            <div key={idx} className="p-3 bg-emerald-50 rounded-md">
              <p className="lot-number">{rm.lot_number}</p>
              <p className="text-xs text-slate-500">
                Material: {rm.material_id} • Quantity: {rm.quantity}
              </p>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);
