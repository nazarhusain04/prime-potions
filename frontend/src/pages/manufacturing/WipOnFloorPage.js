import React, { useState, useEffect } from 'react';
import { manufacturingApi } from '../../lib/api';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { Factory, RefreshCw } from 'lucide-react';
import { cn, formatNumber, getStatusColor } from '../../lib/utils';

export const WipOnFloorPage = () => {
  const [wipData, setWipData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { subscribe } = useWebSocket();

  const fetchData = async () => {
    try {
      const response = await manufacturingApi.getWipOnFloor();
      setWipData(response.data);
    } catch (error) {
      toast.error('Failed to load WIP data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const unsub = subscribe('batch.updated', fetchData);
    return () => unsub();
  }, [subscribe]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F5132]" />
      </div>
    );
  }

  const statuses = Object.keys(wipData?.by_status || {});

  return (
    <div className="space-y-6" data-testid="wip-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">WIP on Floor</h1>
          <p className="text-slate-500">Work-in-progress batches by status and location</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-2" data-testid="refresh-wip-btn">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Summary */}
      <Card className="border-slate-200">
        <CardContent className="py-4">
          <div className="flex items-center gap-8">
            <div>
              <p className="text-sm text-slate-500">Total WIP Lots</p>
              <p className="text-3xl font-bold text-slate-900">{wipData?.total_lots || 0}</p>
            </div>
            <div className="flex gap-4">
              {statuses.map((status) => (
                <Badge key={status} className={cn("text-sm py-1 px-3", getStatusColor(status))}>
                  {status}: {wipData.by_status[status].length}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WIP by Status */}
      {statuses.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {statuses.map((status) => (
            <Card key={status} className="border-slate-200">
              <CardHeader className="py-3 px-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{status}</CardTitle>
                  <Badge variant="secondary">{wipData.by_status[status].length} lots</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {wipData.by_status[status].map((lot, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 hover:bg-slate-50">
                      <div>
                        <p className="lot-number text-sm">{lot.lot_number}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {lot.product_name || 'Product'} • {lot.location_name || 'Location'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">
                          {formatNumber(lot.quantity_available, 2)}
                        </p>
                        <p className="text-xs text-slate-400">available</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-slate-200">
          <CardContent className="py-12 text-center">
            <Factory className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No WIP batches currently on the floor</p>
            <p className="text-sm text-slate-400 mt-1">Create a batch order to get started</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
