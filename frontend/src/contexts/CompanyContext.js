import React, { createContext, useContext, useState, useEffect } from 'react';
import { settingsApi } from '../lib/api';

const CompanyContext = createContext(null);

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within CompanyProvider');
  }
  return context;
};

export const CompanyProvider = ({ children }) => {
  const [company, setCompany] = useState({
    company_name: 'Prime Potions',
    legal_name: 'Prime Potions LLC',
    logo_url: '/assets/prime-potions-logo.svg',
    primary_color: '#0F5132',
    timezone: 'UTC',
    lot_number_format: 'YYMMDD-SEQ'
  });
  const [loading, setLoading] = useState(true);

  const fetchCompany = async () => {
    try {
      const response = await settingsApi.getCompany();
      setCompany(response.data);
    } catch (error) {
      console.error('Failed to fetch company settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompany();
  }, []);

  const updateCompany = async (data) => {
    const response = await settingsApi.updateCompany(data);
    setCompany(response.data);
    return response.data;
  };

  const value = {
    company,
    loading,
    updateCompany,
    refreshCompany: fetchCompany
  };

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
};
