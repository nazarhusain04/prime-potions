import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { 
  User, 
  LogOut, 
  Settings, 
  Menu,
  Wifi,
  WifiOff
} from 'lucide-react';
import { cn, getRoleColor } from '../../lib/utils';
import logo from '../../assets/logo.png';

export const Header = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const { connected } = useWebSocket();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="glass-header sticky top-0 z-50 h-16 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="lg:hidden"
          data-testid="toggle-sidebar-btn"
        >
          <Menu className="w-5 h-5" />
        </Button>
        <img src={logo} alt="Prime Potions" className="h-8 w-auto object-contain lg:hidden" />
      </div>

      <div className="flex items-center gap-4">
        {/* Live Connection Indicator */}
        <div className={cn(
          "flex items-center gap-2 text-xs px-2 py-1 rounded-full",
          connected ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
        )}>
          {connected ? (
            <>
              <Wifi className="w-3 h-3" />
              <span>Live</span>
              <span className="w-2 h-2 bg-emerald-500 rounded-full live-indicator" />
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3" />
              <span>Offline</span>
            </>
          )}
        </div>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2" data-testid="user-menu-btn">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                <User className="w-4 h-4 text-slate-600" />
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium text-slate-900">{user?.full_name}</p>
                <p className={cn("text-xs px-1.5 py-0.5 rounded inline-block", getRoleColor(user?.role))}>
                  {user?.role}
                </p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/admin/settings')} data-testid="settings-menu-item">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600" data-testid="logout-menu-item">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
