import React from 'react';
import { NavLink } from 'react-router-dom';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  Package,
  FlaskConical,
  Boxes,
  Factory,
  ClipboardList,
  GitBranch,
  Settings,
  Users,
  FileText,
  MapPin,
  Ruler,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Beaker
} from 'lucide-react';
import { cn } from '../../lib/utils';

const menuItems = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
    roles: ['Admin', 'Production', 'Warehouse', 'QA', 'Viewer']
  },
  {
    label: 'Batching',
    icon: Beaker,
    roles: ['Admin', 'Production'],
    children: [
      { label: 'Workspace', path: '/batching', icon: Factory },
      { label: 'Formulas', path: '/formulas', icon: ClipboardList }
    ]
  },
  {
    label: 'Excel Sync',
    icon: FileSpreadsheet,
    path: '/excel-sync',
    roles: ['Admin', 'Warehouse', 'Production']
  },
  {
    label: 'Master Data',
    icon: Package,
    roles: ['Admin', 'Production', 'Warehouse', 'QA', 'Viewer'],
    children: [
      { label: 'Products', path: '/master/products', icon: FlaskConical },
      { label: 'Raw Materials', path: '/master/raw-materials', icon: FlaskConical },
      { label: 'Packaging', path: '/master/packaging', icon: Boxes },
      { label: 'Recipes / BOM', path: '/master/recipes', icon: ClipboardList },
      { label: 'Locations', path: '/master/locations', icon: MapPin },
      { label: 'Units', path: '/master/units', icon: Ruler }
    ]
  },
  {
    label: 'Inventory',
    icon: Boxes,
    roles: ['Admin', 'Production', 'Warehouse', 'QA', 'Viewer'],
    children: [
      { label: 'Stock Overview', path: '/inventory/stock', icon: Boxes },
      { label: 'Transactions', path: '/inventory/transactions', icon: FileText },
      { label: 'Receive', path: '/inventory/receive', icon: Package }
    ]
  },
  {
    label: 'Manufacturing',
    icon: Factory,
    roles: ['Admin', 'Production', 'QA'],
    children: [
      { label: 'Batch Orders', path: '/manufacturing/batches', icon: Factory },
      { label: 'Filling Orders', path: '/manufacturing/filling', icon: FlaskConical },
      { label: 'WIP on Floor', path: '/manufacturing/wip', icon: Boxes },
      { label: 'Feasibility', path: '/manufacturing/feasibility', icon: ClipboardList }
    ]
  },
  {
    label: 'Traceability',
    icon: GitBranch,
    path: '/traceability',
    roles: ['Admin', 'Production', 'Warehouse', 'QA', 'Viewer']
  },
  {
    label: 'Administration',
    icon: Settings,
    roles: ['Admin'],
    children: [
      { label: 'Users', path: '/admin/users', icon: Users },
      { label: 'Company Settings', path: '/admin/settings', icon: Settings },
      { label: 'Audit Logs', path: '/admin/audit-logs', icon: FileText }
    ]
  }
];

const SidebarItem = ({ item, collapsed }) => {
  const { hasRole } = useAuth();
  const [expanded, setExpanded] = React.useState(false);

  if (!hasRole(item.roles)) return null;

  const Icon = item.icon;

  if (item.children) {
    return (
      <div className="mb-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "w-full flex items-center justify-between px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors rounded-md mx-2",
            expanded && "bg-slate-100"
          )}
          data-testid={`sidebar-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <div className="flex items-center gap-3">
            <Icon className="w-5 h-5" />
            {!collapsed && <span>{item.label}</span>}
          </div>
          {!collapsed && (expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
        </button>
        {expanded && !collapsed && (
          <div className="ml-4 mt-1 space-y-1">
            {item.children.map((child) => (
              <NavLink
                key={child.path}
                to={child.path}
                className={({ isActive }) => cn(
                  "sidebar-item text-xs",
                  isActive && "active"
                )}
                data-testid={`sidebar-${child.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <child.icon className="w-4 h-4" />
                <span>{child.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={item.path}
      className={({ isActive }) => cn(
        "sidebar-item mb-1",
        isActive && "active"
      )}
      data-testid={`sidebar-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <Icon className="w-5 h-5" />
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  );
};

export const Sidebar = ({ collapsed = false }) => {
  const { company } = useCompany();

  return (
    <aside className={cn(
      "sidebar h-screen flex flex-col transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-md flex items-center justify-center text-white font-bold text-lg"
            style={{ backgroundColor: company.primary_color }}
          >
            PP
          </div>
          {!collapsed && (
            <div>
              <h1 className="font-bold text-slate-900 text-sm leading-tight">
                {company.company_name}
              </h1>
              <p className="text-xs text-slate-500">ERP System</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto scrollbar-thin">
        {menuItems.map((item) => (
          <SidebarItem key={item.label} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-slate-200 text-xs text-slate-400 text-center">
          © {company.company_name}
        </div>
      )}
    </aside>
  );
};
