import React, { useState, useEffect } from 'react';
import { traceabilityApi } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { 
  Search, 
  ArrowRight, 
  ArrowLeft, 
  GitBranch, 
  Loader2,
  Package,
  Factory,
  Boxes,
  ChevronRight,
  ChevronDown,
  History,
  AlertCircle
} from 'lucide-react';
import api from '../lib/api';

// Tree Node Component for visual genealogy
const TraceNode = ({ node, depth = 0, expanded, onToggle }) => {
  const [isExpanded, setIsExpanded] = useState(expanded || depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  
  const getNodeIcon = (type) => {
    switch (type?.toUpperCase()) {
      case 'RAW': return <Package className="w-4 h-4 text-green-600" />;
      case 'WIP': return <Factory className="w-4 h-4 text-blue-600" />;
      case 'FG': return <Boxes className="w-4 h-4 text-purple-600" />;
      default: return <Package className="w-4 h-4 text-gray-600" />;
    }
  };

  const getNodeColor = (type) => {
    switch (type?.toUpperCase()) {
      case 'RAW': return 'border-l-green-500 bg-green-50';
      case 'WIP': return 'border-l-blue-500 bg-blue-50';
      case 'FG': return 'border-l-purple-500 bg-purple-50';
      default: return 'border-l-gray-500 bg-gray-50';
    }
  };

  return (
    <div className="ml-4" style={{ marginLeft: depth > 0 ? '24px' : '0' }}>
      <div 
        className={`flex items-center gap-2 p-2 rounded-r border-l-4 ${getNodeColor(node.type)} mb-1 cursor-pointer hover:shadow-sm transition-shadow`}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        {hasChildren && (
          <span className="text-gray-400">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
        )}
        {!hasChildren && <span className="w-4" />}
        {getNodeIcon(node.type)}
        <div className="flex-1">
          <div className="font-medium text-sm">{node.name || node.item_name}</div>
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <span className="font-mono">{node.lot_number || node.lot_code}</span>
            {node.quantity && <span>• {node.quantity} {node.uom || 'KG'}</span>}
          </div>
        </div>
        <Badge variant="outline" className="text-xs">{node.type}</Badge>
      </div>
      {hasChildren && isExpanded && (
        <div className="border-l border-dashed border-gray-300 ml-3">
          {node.children.map((child, idx) => (
            <TraceNode key={idx} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

// Transaction History Component
const TransactionHistory = ({ transactions }) => (
  <div className="space-y-2">
    {transactions.map((tx, idx) => (
      <div 
        key={idx} 
        className={`flex items-center justify-between p-3 rounded-lg border ${
          tx.quantity > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            tx.quantity > 0 ? 'bg-green-100' : 'bg-red-100'
          }`}>
            {tx.quantity > 0 ? (
              <ArrowRight className="w-4 h-4 text-green-600" />
            ) : (
              <ArrowLeft className="w-4 h-4 text-red-600" />
            )}
          </div>
          <div>
            <div className="font-medium text-sm">{tx.transaction_type}</div>
            <div className="text-xs text-gray-500">
              {tx.reference_type && `${tx.reference_type}: ${tx.reference_code || tx.reference_id}`}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={`font-mono font-bold ${tx.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {tx.quantity > 0 ? '+' : ''}{tx.quantity?.toFixed(2)} {tx.unit_of_measure}
          </div>
          <div className="text-xs text-gray-400">
            {new Date(tx.created_at).toLocaleString()}
          </div>
        </div>
      </div>
    ))}
    {transactions.length === 0 && (
      <div className="text-center py-8 text-gray-500">
        <History className="w-8 h-8 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">No transactions found</p>
      </div>
    )}
  </div>
);

export const TraceabilityPage = () => {
  const [lotNumber, setLotNumber] = useState('');
  const [itemId, setItemId] = useState('');
  const [traceDirection, setTraceDirection] = useState('forward');
  const [traceResult, setTraceResult] = useState(null);
  const [whereUsedResult, setWhereUsedResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recentLots, setRecentLots] = useState([]);
  const [activeTab, setActiveTab] = useState('trace');

  useEffect(() => {
    // Fetch recent lots for quick access
    const fetchRecentLots = async () => {
      try {
        const response = await api.get('/inventory/transactions?limit=20');
        const lots = [...new Set((response.data || response || []).map(t => t.lot_number).filter(Boolean))];
        setRecentLots(lots.slice(0, 10));
      } catch (error) {
        console.error('Failed to fetch recent lots:', error);
      }
    };
    fetchRecentLots();
  }, []);

  const handleTrace = async () => {
    if (!lotNumber.trim()) {
      toast.error('Please enter a lot number');
      return;
    }

    setLoading(true);
    setTraceResult(null);

    try {
      const endpoint = traceDirection === 'forward' 
        ? `/traceability/forward/${encodeURIComponent(lotNumber.trim())}`
        : `/traceability/backward/${encodeURIComponent(lotNumber.trim())}`;
      
      const response = await api.get(endpoint);
      setTraceResult(response);
      
      if (!response || (Array.isArray(response) && response.length === 0)) {
        toast.info('No traceability data found for this lot');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Lot not found in traceability chain');
    } finally {
      setLoading(false);
    }
  };

  const handleWhereUsed = async () => {
    if (!itemId.trim()) {
      toast.error('Please enter an item ID or SKU');
      return;
    }

    setLoading(true);
    setWhereUsedResult(null);

    try {
      const response = await api.get(`/traceability/where-used/${encodeURIComponent(itemId.trim())}`);
      setWhereUsedResult(response);
      
      if (!response || (Array.isArray(response) && response.length === 0)) {
        toast.info('No usage data found for this item');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Item not found');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="traceability-page">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Traceability</h1>
        <p className="text-slate-500">Track lot genealogy forward and backward through production</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="trace" className="gap-2">
            <GitBranch className="w-4 h-4" />
            Trace Lot
          </TabsTrigger>
          <TabsTrigger value="whereused" className="gap-2">
            <Search className="w-4 h-4" />
            Where Used
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="w-4 h-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* TRACE LOT TAB */}
        <TabsContent value="trace" className="space-y-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[200px] space-y-2">
                  <Label>Lot Number</Label>
                  <Input
                    value={lotNumber}
                    onChange={(e) => setLotNumber(e.target.value)}
                    placeholder="Enter lot number (e.g., RM-241215-0001)"
                    data-testid="trace-lot-input"
                    onKeyPress={(e) => e.key === 'Enter' && handleTrace()}
                  />
                  {recentLots.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-xs text-gray-400">Recent:</span>
                      {recentLots.slice(0, 5).map((lot, idx) => (
                        <Badge 
                          key={idx} 
                          variant="outline" 
                          className="cursor-pointer hover:bg-blue-50 text-xs"
                          onClick={() => setLotNumber(lot)}
                        >
                          {lot}
                        </Badge>
                      ))}
                    </div>
                  )}
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
                          <ArrowLeft className="w-4 h-4" /> Backward (Genealogy)
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleTrace} disabled={loading} className="btn-primary">
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Tracing...</>
                  ) : (
                    <><Search className="w-4 h-4 mr-2" /> Trace</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Trace Results */}
          {traceResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="w-5 h-5" />
                  {traceDirection === 'forward' ? 'Forward Trace' : 'Backward Trace'} Results
                  <Badge variant="outline">{lotNumber}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {traceResult.tree ? (
                  <TraceNode node={traceResult.tree} />
                ) : traceResult.lot ? (
                  <div className="space-y-4">
                    {/* Lot Info */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-2">Lot Information</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Lot Number:</span>
                          <p className="font-mono">{traceResult.lot.lot_number}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Item:</span>
                          <p>{traceResult.lot.item_name || traceResult.lot.item_id}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Quantity:</span>
                          <p>{traceResult.lot.quantity_on_hand?.toFixed(2)} {traceResult.lot.unit_of_measure || 'KG'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Status:</span>
                          <Badge>{traceResult.lot.status || 'Available'}</Badge>
                        </div>
                      </div>
                    </div>

                    {/* Used In */}
                    {traceResult.used_in && traceResult.used_in.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <ArrowRight className="w-4 h-4" /> Used In ({traceResult.used_in.length})
                        </h4>
                        <div className="space-y-2">
                          {traceResult.used_in.map((usage, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <div>
                                <p className="font-medium">{usage.batch_code || usage.reference_code}</p>
                                <p className="text-sm text-gray-500">{usage.item_name || usage.formula_name}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-mono">{usage.qty_used?.toFixed(2)} {usage.uom}</p>
                                <p className="text-xs text-gray-400">{new Date(usage.created_at).toLocaleDateString()}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Source Lots (backward trace) */}
                    {traceResult.source_lots && traceResult.source_lots.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <ArrowLeft className="w-4 h-4" /> Source Materials ({traceResult.source_lots.length})
                        </h4>
                        <div className="space-y-2">
                          {traceResult.source_lots.map((source, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                              <div>
                                <p className="font-medium">{source.item_name || source.name}</p>
                                <p className="text-sm text-gray-500 font-mono">{source.lot_code || source.lot_number}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-mono">{source.qty_used?.toFixed(2)} {source.uom}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Transactions */}
                    {traceResult.transactions && traceResult.transactions.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Transaction History</h4>
                        <TransactionHistory transactions={traceResult.transactions} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <AlertCircle className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p>No traceability data found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* WHERE USED TAB */}
        <TabsContent value="whereused" className="space-y-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[200px] space-y-2">
                  <Label>Item ID or SKU</Label>
                  <Input
                    value={itemId}
                    onChange={(e) => setItemId(e.target.value)}
                    placeholder="Enter item ID or SKU"
                    data-testid="where-used-input"
                    onKeyPress={(e) => e.key === 'Enter' && handleWhereUsed()}
                  />
                </div>
                <Button onClick={handleWhereUsed} disabled={loading} className="btn-primary">
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Searching...</>
                  ) : (
                    <><Search className="w-4 h-4 mr-2" /> Find Usage</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {whereUsedResult && (
            <Card>
              <CardHeader>
                <CardTitle>Where Used Results</CardTitle>
              </CardHeader>
              <CardContent>
                {whereUsedResult.batches && whereUsedResult.batches.length > 0 ? (
                  <div className="space-y-2">
                    {whereUsedResult.batches.map((batch, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                        <div>
                          <p className="font-medium">{batch.batch_code}</p>
                          <p className="text-sm text-gray-500">{batch.formula_name}</p>
                        </div>
                        <div className="text-right">
                          <Badge>{batch.status}</Badge>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(batch.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p>No usage found for this item</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Trace Queries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <History className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>Trace history will appear here</p>
                <p className="text-sm text-gray-400 mt-1">Start by tracing a lot number above</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Legend */}
      <Card className="bg-gray-50">
        <CardContent className="py-3">
          <div className="flex items-center gap-6 text-sm">
            <span className="text-gray-500">Legend:</span>
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-green-600" />
              <span>Raw Material</span>
            </div>
            <div className="flex items-center gap-2">
              <Factory className="w-4 h-4 text-blue-600" />
              <span>WIP</span>
            </div>
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-purple-600" />
              <span>Finished Good</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TraceabilityPage;
