import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { AuthProvider } from './contexts/AuthContext';
import { CompanyProvider } from './contexts/CompanyContext';
import { WebSocketProvider } from './contexts/WebSocketContext';

// Layout
import { MainLayout } from './components/layout/MainLayout';

// Pages
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';

// Master Data
import { ProductsPage } from './pages/master/ProductsPage';
import { RawMaterialsPage } from './pages/master/RawMaterialsPage';
import { PackagingPage } from './pages/master/PackagingPage';
import { RecipesPage } from './pages/master/RecipesPage';
import { LocationsPage } from './pages/master/LocationsPage';
import { UnitsPage } from './pages/master/UnitsPage';

// Inventory
import { StockPage } from './pages/inventory/StockPage';
import { TransactionsPage } from './pages/inventory/TransactionsPage';
import { ReceivePage } from './pages/inventory/ReceivePage';
import { InventoryOverviewPage } from './pages/inventory/InventoryOverviewPage';

// Manufacturing
import { BatchOrdersPage } from './pages/manufacturing/BatchOrdersPage';
import { FillingOrdersPage } from './pages/manufacturing/FillingOrdersPage';
import { FeasibilityPage } from './pages/manufacturing/FeasibilityPage';
import { WipOnFloorPage } from './pages/manufacturing/WipOnFloorPage';

// Traceability
import { TraceabilityPage } from './pages/TraceabilityPage';

// Excel Sync & Batching
import { ExcelSyncPage } from './pages/ExcelSyncPage';
import { BatchingWorkspacePage } from './pages/BatchingWorkspacePage';
import { FormulasPage } from './pages/FormulasPage';
import { ImportWizardPage } from './pages/ImportWizardPage';

// Admin
import { UsersPage } from './pages/admin/UsersPage';
import { CompanySettingsPage } from './pages/admin/CompanySettingsPage';
import { AuditLogsPage } from './pages/admin/AuditLogsPage';

import './App.css';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CompanyProvider>
          <WebSocketProvider>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<LoginPage />} />
              
              {/* Protected Routes */}
              <Route element={<MainLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                
                {/* Master Data */}
                <Route path="/master/products" element={<ProductsPage />} />
                <Route path="/master/raw-materials" element={<RawMaterialsPage />} />
                <Route path="/master/packaging" element={<PackagingPage />} />
                <Route path="/master/recipes" element={<RecipesPage />} />
                <Route path="/master/locations" element={<LocationsPage />} />
                <Route path="/master/units" element={<UnitsPage />} />
                
                {/* Inventory */}
                <Route path="/inventory/overview" element={<InventoryOverviewPage />} />
                <Route path="/inventory/stock" element={<StockPage />} />
                <Route path="/inventory/transactions" element={<TransactionsPage />} />
                <Route path="/inventory/receive" element={<ReceivePage />} />
                
                {/* Manufacturing */}
                <Route path="/manufacturing/batches" element={<BatchOrdersPage />} />
                <Route path="/manufacturing/filling" element={<FillingOrdersPage />} />
                <Route path="/manufacturing/feasibility" element={<FeasibilityPage />} />
                <Route path="/manufacturing/wip" element={<WipOnFloorPage />} />
                
                {/* Traceability */}
                <Route path="/traceability" element={<TraceabilityPage />} />
                
                {/* Excel Sync & Batching */}
                <Route path="/excel-sync" element={<ExcelSyncPage />} />
                <Route path="/import-wizard" element={<ImportWizardPage />} />
                <Route path="/batching" element={<BatchingWorkspacePage />} />
                <Route path="/formulas" element={<FormulasPage />} />
                
                {/* Admin */}
                <Route path="/admin/users" element={<UsersPage />} />
                <Route path="/admin/settings" element={<CompanySettingsPage />} />
                <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
              </Route>
              
              {/* Redirects */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            <Toaster position="top-right" richColors />
          </WebSocketProvider>
        </CompanyProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
