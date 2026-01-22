import React, { useState } from 'react';
import { useCompany } from '../../contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { Settings, Loader2, Save } from 'lucide-react';

export const CompanySettingsPage = () => {
  const { company, updateCompany } = useCompany();
  const [formData, setFormData] = useState(company);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await updateCompany(formData);
      toast.success('Company settings updated');
    } catch (error) {
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="company-settings-page">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Company Settings</h1>
        <p className="text-slate-500">Configure company branding and preferences</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Info */}
          <Card className="border-slate-200">
            <CardHeader className="py-3 px-4 border-b border-slate-100">
              <CardTitle className="text-base">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  data-testid="company-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal_name">Legal Name</Label>
                <Input
                  id="legal_name"
                  value={formData.legal_name}
                  onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                  data-testid="legal-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  data-testid="address-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    data-testid="phone-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    data-testid="email-input"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Branding */}
          <Card className="border-slate-200">
            <CardHeader className="py-3 px-4 border-b border-slate-100">
              <CardTitle className="text-base">Branding & Configuration</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="logo_url">Logo URL</Label>
                <Input
                  id="logo_url"
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  data-testid="logo-url-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="primary_color">Primary Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="primary_color"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="flex-1"
                    data-testid="primary-color-input"
                  />
                  <div 
                    className="w-10 h-10 rounded-md border border-slate-200"
                    style={{ backgroundColor: formData.primary_color }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  data-testid="timezone-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lot_number_format">Lot Number Format</Label>
                <Input
                  id="lot_number_format"
                  value={formData.lot_number_format}
                  onChange={(e) => setFormData({ ...formData, lot_number_format: e.target.value })}
                  placeholder="YYMMDD-SEQ"
                  data-testid="lot-format-input"
                />
                <p className="text-xs text-slate-400">Default: YYMMDD-SEQ (e.g., 241215-0001)</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6">
          <Button type="submit" className="btn-primary gap-2" disabled={saving} data-testid="save-settings-btn">
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Settings
          </Button>
        </div>
      </form>
    </div>
  );
};
