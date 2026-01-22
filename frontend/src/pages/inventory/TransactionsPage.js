import React, { useState, useEffect } from 'react';
import { inventoryApi } from '../../lib/api';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { toast } from 'sonner';
import { Search, FileText, RefreshCw } from 'lucide-react';
import { cn, formatNumber, formatDate } from '../../lib/utils';

export const TransactionsPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');

  const fetchData = async () => {
    try {
      const response = await inventoryApi.listTransactions({ limit: 500 });
      setTransactions(response.data);
    } catch (error) {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.lot_number.toLowerCase().includes(searchQuery.toLowerCase());
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
                placeholder="Search by lot number..."
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
                <TableHead className="text-xs uppercase">Item Type</TableHead>
                <TableHead className="text-xs uppercase">Lot Number</TableHead>
                <TableHead className="text-xs uppercase text-right">Quantity</TableHead>
                <TableHead className="text-xs uppercase">Unit</TableHead>
                <TableHead className="text-xs uppercase">Reference</TableHead>
                <TableHead className="text-xs uppercase">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => (
                  <TableRow key={tx.id} className="hover:bg-slate-50">
                    <TableCell className="text-xs text-slate-500">
                      {formatDate(tx.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-xs">
                        {tx.transaction_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize text-xs">
                      {tx.item_type.replace('_', ' ')}
                    </TableCell>
                    <TableCell className="lot-number">{tx.lot_number}</TableCell>
                    <TableCell className={cn(
                      "text-right font-medium",
                      tx.quantity > 0 ? "text-emerald-600" : "text-red-600"
                    )}>
                      {tx.quantity > 0 ? '+' : ''}{formatNumber(tx.quantity, 2)}
                    </TableCell>
                    <TableCell>{tx.unit_of_measure}</TableCell>
                    <TableCell className="text-xs">
                      {tx.reference_type ? (
                        <span className="text-slate-500">
                          {tx.reference_type.replace('_', ' ')}
                        </span>
                      ) : '-'}
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
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No transactions found</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
