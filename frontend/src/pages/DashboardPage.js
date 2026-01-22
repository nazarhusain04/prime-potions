import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi, manufacturingApi } from '../lib/api';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useCompany } from '../contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
  FlaskConical, 
  Boxes, 
  Package, 
  Factory,
  TrendingUp,
  ArrowRight,
  Clock,
  RefreshCw
} from 'lucide-react';
import { cn, formatNumber, formatDate, getStatusColor } from '../lib/utils';

const KPICard = ({ title, value, subtitle, icon: Icon, trend, color = '#0F5132' }) => (
  <Card className="kpi-card card-hover">
    <CardContent className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 mb-1">{title}</p>
          <p className="kpi-value" style={{ color }}>{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div 
          className="w-10 h-10 rounded-md flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-3 text-xs">
          <TrendingUp className="w-3 h-3 text-emerald-500" />
          <span className="text-emerald-600">{trend}</span>
        </div>
      )}
    </CardContent>
  </Card>
);

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { company } = useCompany();
  const { subscribe, connected } = useWebSocket();
  const [summary, setSummary] = useState(null);
  const [wipOnFloor, setWipOnFloor] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, wipRes] = await Promise.all([
        dashboardApi.getSummary(),
        manufacturingApi.getWipOnFloor()
      ]);
      setSummary(summaryRes.data);
      setWipOnFloor(wipRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    // Subscribe to real-time updates
    const unsubInventory = subscribe('inventory.updated', fetchData);
    const unsubBatch = subscribe('batch.updated', fetchData);
    const unsubFilling = subscribe('filling.updated', fetchData);

    return () => {
      unsubInventory();
      unsubBatch();
      unsubFilling();
    };
  }, [subscribe, fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F5132]" />
      </div>
    );
  }

  const rm = summary?.raw_materials || {};
  const pkg = summary?.packaging_materials || {};
  const wip = summary?.wip_batches || {};
  const fg = summary?.finished_goods || {};

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">Live inventory overview for {company.company_name}</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchData}
          className="gap-2"
          data-testid="refresh-dashboard-btn"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Connection Status */}
      {!connected && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
          Real-time updates disconnected. Dashboard will refresh manually.
        </div>
      )}

      {/* KPI Cards */}
      <div className="bento-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Raw Materials"
          value={formatNumber(rm.total_on_hand || 0, 0)}
          subtitle={`${rm.lot_count || 0} lots`}
          icon={FlaskConical}
          color="#0F5132"
        />
        <KPICard
          title="Packaging"
          value={formatNumber(pkg.total_on_hand || 0, 0)}
          subtitle={`${pkg.lot_count || 0} lots`}
          icon={Package}
          color="#334155"
        />
        <KPICard
          title="WIP Batches"
          value={formatNumber(wip.total_on_hand || 0, 0)}
          subtitle={`${wip.lot_count || 0} batches on floor`}
          icon={Factory}
          color="#D97706"
        />
        <KPICard
          title="Finished Goods"
          value={formatNumber(fg.total_available || 0, 0)}
          subtitle={`${fg.lot_count || 0} lots ready to ship`}
          icon={Boxes}
          color="#10B981"
        />
      </div>

      {/* Active Orders Row */}
      <div className="bento-grid grid-cols-1 lg:grid-cols-2">
        {/* Active Batch Orders */}
        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b border-slate-100">
            <CardTitle className="text-base font-semibold">Active Batch Orders</CardTitle>
            <Badge variant="secondary">{summary?.active_batch_orders || 0}</Badge>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-center py-4">
              <Factory className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">
                {summary?.active_batch_orders || 0} batch orders in progress
              </p>
              <Button 
                variant="link" 
                className="mt-2 text-[#0F5132]"
                onClick={() => navigate('/manufacturing/batches')}
                data-testid="view-batches-btn"
              >
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Active Filling Orders */}
        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b border-slate-100">
            <CardTitle className="text-base font-semibold">Active Filling Orders</CardTitle>
            <Badge variant="secondary">{summary?.active_filling_orders || 0}</Badge>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-center py-4">
              <FlaskConical className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">
                {summary?.active_filling_orders || 0} filling orders in progress
              </p>
              <Button 
                variant="link" 
                className="mt-2 text-[#0F5132]"
                onClick={() => navigate('/manufacturing/filling')}
                data-testid="view-filling-btn"
              >
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* WIP on Floor & Recent Transactions */}
      <div className="bento-grid grid-cols-1 lg:grid-cols-2">
        {/* WIP on Floor */}
        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b border-slate-100">
            <CardTitle className="text-base font-semibold">WIP on Floor</CardTitle>
            <Badge variant="secondary">{wipOnFloor?.total_lots || 0} lots</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {wipOnFloor?.lots?.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {wipOnFloor.lots.slice(0, 5).map((lot, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 hover:bg-slate-50">
                    <div>
                      <p className="lot-number text-xs">{lot.lot_number}</p>
                      <p className="text-sm text-slate-600 mt-0.5">{lot.product_name || 'Product'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{formatNumber(lot.quantity_available, 1)}</p>
                      <Badge className={cn("text-xs", getStatusColor(lot.status || lot.batch_status))}>
                        {lot.status || lot.batch_status || 'Available'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Boxes className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No WIP batches on floor</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b border-slate-100">
            <CardTitle className="text-base font-semibold">Recent Transactions</CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/inventory/transactions')}
              data-testid="view-transactions-btn"
            >
              View All
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {summary?.recent_transactions?.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {summary.recent_transactions.slice(0, 5).map((tx, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 hover:bg-slate-50">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {tx.transaction_type}
                        </Badge>
                        <span className="lot-number text-xs">{tx.lot_number}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(tx.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "font-semibold",
                        tx.quantity > 0 ? "text-emerald-600" : "text-red-600"
                      )}>
                        {tx.quantity > 0 ? '+' : ''}{formatNumber(tx.quantity, 2)}
                      </p>
                      <p className="text-xs text-slate-400">{tx.unit_of_measure}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No recent transactions</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border-slate-200">
        <CardHeader className="py-3 px-4 border-b border-slate-100">
          <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <Button 
              className="btn-primary gap-2"
              onClick={() => navigate('/inventory/receive')}
              data-testid="quick-receive-btn"
            >
              <Package className="w-4 h-4" />
              Receive Inventory
            </Button>
            <Button 
              variant="outline"
              className="gap-2"
              onClick={() => navigate('/manufacturing/batches')}
              data-testid="quick-batch-btn"
            >
              <Factory className="w-4 h-4" />
              New Batch Order
            </Button>
            <Button 
              variant="outline"
              className="gap-2"
              onClick={() => navigate('/manufacturing/filling')}
              data-testid="quick-filling-btn"
            >
              <FlaskConical className="w-4 h-4" />
              New Filling Order
            </Button>
            <Button 
              variant="outline"
              className="gap-2"
              onClick={() => navigate('/traceability')}
              data-testid="quick-trace-btn"
            >
              <TrendingUp className="w-4 h-4" />
              Trace Lot
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
