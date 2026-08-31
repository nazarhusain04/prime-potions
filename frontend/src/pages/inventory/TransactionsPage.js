import React, { useState, useEffect } from 'react';
import { inventoryApi, masterApi } from '../../lib/api';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { toast } from 'sonner';
import { Search, FileText, RefreshCw, Edit, Trash2, Loader2 } from 'lucide-react';
import { cn, formatNumber, formatDate } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';

export const TransactionsPage = () => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('Admin');
  const [transactions, setTransactions] = useState([]);
  const [itemsById, setItemsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const [txRes, rawRes, pkgRes] = await Promise.all([
        inventoryApi.listTransactions({ limit: 10000 }),
        masterApi.listRawMaterials(),
        masterApi.listPackagingMaterials()
      ]);
      setTransactions(txRes.data);
      const idMap = {};
      [...rawRes.data, ...pkgRes.data].forEach((it) => {
        idMap[it.id] = it;
      });
      setItemsById(idMap);
    } catch (error) {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getItem = (id) => itemsById[id];

  const handleEditTx = (tx) => {
    setSelectedTx(tx);
    setEditQuantity(String(Math.abs(tx.quantity)));
    setEditNotes(tx.notes || '');
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedTx || !editQuantity) return;
    setSaving(true);
    try {
      await inventoryApi.updateTransaction(selectedTx.id, {
        quantity: parseFloat(editQuantity),
        notes: editNotes
      });
      toast.success('Transaction updated - stock recalculated');
      setEditDialogOpen(false);
      setSelectedTx(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update transaction');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTx = async (tx) => {
    const item = getItem(tx.item_id);
    if (!confirm(`Delete this ${tx.transaction_type} transaction for ${item?.name || tx.lot_number} (${formatNumber(Math.abs(tx.quantity), 2)} ${tx.unit_of_measure})? Stock will be recalculated from what's left.`)) return;
    try {
      await inventoryApi.deleteTransaction(tx.id);
      toast.success('Transaction deleted - stock recalculated');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete transaction');
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const item = getItem(t.item_id);
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query ||
      t.lot_number.toLowerCase().includes(query) ||
      item?.sku?.toLowerCase().includes(query) ||
      item?.name?.toLowerCase().includes(query) ||
      t.notes?.toLowerCase().includes(query);
    const matchesType = selectedType === 'all' || t.transaction_type === selectedType;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F5132]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="transactions-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory Transactions</h1>
          <p className="text-slate-500">Complete ledger of all inventory movements</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-2" data-testid="refresh-transactions-btn">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="py-3 px-4 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by lot number, item, or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="search-transactions-input"
              />
            </div>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-40" data-testid="filter-transaction-type">
                <SelectValue placeholder="Transaction type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="receive">Receive</SelectItem>
                <SelectItem value="issue">Issue</SelectItem>
                <SelectItem value="produce">Produce</SelectItem>
                <SelectItem value="adjust">Adjust</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
                <SelectItem value="scrap">Scrap</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="secondary">{filteredTransactions.length} transactions</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs uppercase">Date/Time</TableHead>
                <TableHead className="text-xs uppercase">Type</TableHead>
                <TableHead className="text-xs uppercase">Item</TableHead>
                <TableHead className="text-xs uppercase">Lot Number</TableHead>
                <TableHead className="text-xs uppercase text-right">Quantity</TableHead>
                <TableHead className="text-xs uppercase">Unit</TableHead>
                <TableHead className="text-xs uppercase">Notes</TableHead>
                <TableHead className="text-xs uppercase">Status</TableHead>
                <TableHead className="text-xs uppercase">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => {
                  const item = getItem(tx.item_id);
                  return (
                  <TableRow key={tx.id} className="hover:bg-slate-50">
                    <TableCell className="text-xs text-slate-500">
                      {formatDate(tx.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-xs">
                        {tx.transaction_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item ? (
                        <>
                          <p className="font-medium text-slate-900 text-sm">{item.name}</p>
                          <p className="text-xs text-slate-400">{item.sku}</p>
                        </>
                      ) : (
                        <span className="capitalize text-xs text-slate-400">{tx.item_type.replace('_', ' ')}</span>
                      )}
                    </TableCell>
                    <TableCell className="lot-number">{tx.lot_number}</TableCell>
                    <TableCell className={cn(
                      "text-right font-medium",
                      tx.quantity > 0 ? "text-emerald-600" : "text-red-600"
                    )}>
                      {tx.quantity > 0 ? '+' : ''}{formatNumber(tx.quantity, 2)}
                    </TableCell>
                    <TableCell>{tx.unit_of_measure}</TableCell>
                    <TableCell className="text-xs text-slate-500 max-w-xs truncate" title={tx.notes}>
                      {tx.notes || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs", 
                        tx.status === 'Available' ? 'status-available' :
                        tx.status === 'Reserved' ? 'status-reserved' :
                        tx.status === 'Quarantine' ? 'status-quarantine' :
                        'bg-gray-100 text-gray-800'
                      )}>
                        {tx.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {isAdmin && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => handleEditTx(tx)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteTx(tx)}>
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No transactions found</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>
              {selectedTx?.transaction_type} of {getItem(selectedTx?.item_id)?.name || selectedTx?.lot_number} - stock will be recalculated from the corrected ledger after saving.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Quantity ({selectedTx?.unit_of_measure})</Label>
              <Input
                type="number"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="btn-primary" onClick={handleSaveEdit} disabled={saving || !editQuantity}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
