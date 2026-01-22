import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createWebSocket } from '../lib/api';

const WebSocketContext = createContext(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const [ws, setWs] = useState(null);
  const [connected, setConnected] = useState(false);
  const [listeners, setListeners] = useState({});
  const [lastMessage, setLastMessage] = useState(null);

  const handleMessage = useCallback((data) => {
    setLastMessage(data);
    
    const eventType = data.event;
    if (listeners[eventType]) {
      listeners[eventType].forEach(callback => callback(data.data));
    }
  }, [listeners]);

  useEffect(() => {
    const websocket = createWebSocket(handleMessage);
    
    websocket.onopen = () => {
      setConnected(true);
    };
    
    websocket.onclose = () => {
      setConnected(false);
      // Reconnect after 3 seconds
      setTimeout(() => {
        const newWs = createWebSocket(handleMessage);
        setWs(newWs);
      }, 3000);
    };
    
    setWs(websocket);
    
    return () => {
      websocket.close();
    };
  }, [handleMessage]);

  const subscribe = useCallback((eventType, callback) => {
    setListeners(prev => ({
      ...prev,
      [eventType]: [...(prev[eventType] || []), callback]
    }));

    // Return unsubscribe function
    return () => {
      setListeners(prev => ({
        ...prev,
        [eventType]: (prev[eventType] || []).filter(cb => cb !== callback)
      }));
    };
  }, []);

  const value = {
    connected,
    lastMessage,
    subscribe
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
