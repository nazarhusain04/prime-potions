import React, { useState, useEffect } from 'react';
import { auditApi } from '../../lib/api';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { toast } from 'sonner';
import { FileText, Search, RefreshCw } from 'lucide-react';
import { formatDate } from '../../lib/utils';

export const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLogs = async () => {
    try {
      const response = await auditApi.list({ limit: 500 });
      setLogs(response.data);
    } catch (error) {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log =>
    log.entity_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.entity_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F5132]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="audit-logs-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
          <p className="text-slate-500">Track all system changes and actions</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs} className="gap-2" data-testid="refresh-logs-btn">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="py-3 px-4 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="search-logs-input"
              />
            </div>
            <Badge variant="secondary">{filteredLogs.length} entries</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs uppercase">Date/Time</TableHead>
                <TableHead className="text-xs uppercase">Action</TableHead>
                <TableHead className="text-xs uppercase">Entity Type</TableHead>
                <TableHead className="text-xs uppercase">Entity ID</TableHead>
                <TableHead className="text-xs uppercase">User</TableHead>
                <TableHead className="text-xs uppercase">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-slate-50">
                    <TableCell className="text-xs text-slate-500">
                      {formatDate(log.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-xs">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize text-sm">
                      {log.entity_type.replace('_', ' ')}
                    </TableCell>
                    <TableCell className="lot-number text-xs">{log.entity_id}</TableCell>
                    <TableCell className="text-xs">{log.user_id.substring(0, 8)}...</TableCell>
                    <TableCell className="text-xs text-slate-500 max-w-xs truncate">
                      {JSON.stringify(log.details)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No audit logs found</p>
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
