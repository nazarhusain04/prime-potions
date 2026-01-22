import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatNumber(num, decimals = 2) {
  if (num === null || num === undefined) return '-';
  return Number(num).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function getStatusColor(status) {
  const statusMap = {
    'Available': 'status-available',
    'Reserved': 'status-reserved',
    'Quarantine': 'status-quarantine',
    'Scrap': 'bg-gray-100 text-gray-800',
    'Planned': 'status-planned',
    'In Progress': 'status-in-progress',
    'Completed': 'status-completed',
    'Released': 'status-released',
    'QA Hold': 'status-quarantine',
    'Consumed': 'bg-gray-100 text-gray-800'
  };
  return statusMap[status] || 'bg-gray-100 text-gray-800';
}

export function getRoleColor(role) {
  const roleMap = {
    'Admin': 'bg-purple-100 text-purple-800',
    'Production': 'bg-blue-100 text-blue-800',
    'Warehouse': 'bg-emerald-100 text-emerald-800',
    'QA': 'bg-amber-100 text-amber-800',
    'Viewer': 'bg-gray-100 text-gray-800'
  };
  return roleMap[role] || 'bg-gray-100 text-gray-800';
}

export function hasPermission(userRole, allowedRoles) {
  return allowedRoles.includes(userRole);
}
