import { useState, useEffect, useRef, useCallback } from 'react';

const WS_BASE = 'wss://language-agnostic-chatbot-btov.onrender.com/ws/chat';
/**
 * useWebSocket — manages a WebSocket connection to the Django Channels backend.
 * Handles connect, disconnect, reconnect, message dispatching, and auth token.
 */
export function useWebSocket(sessionId, token, onMessage) {
  const [status, setStatus] = useState('disconnected'); // 'connecting' | 'connected' | 'disconnected'
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectCount = useRef(0);
  const MAX_RECONNECTS = 5;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    
    // Append token query string if present for WebSocket authentication
    const tokenQuery = token ? `?token=${token}` : '';
    const wsUrl = `${WS_BASE}/${sessionId}/${tokenQuery}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      reconnectCount.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (e) {
        console.error('[WS] Failed to parse message:', e);
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      wsRef.current = null;

      if (reconnectCount.current < MAX_RECONNECTS) {
        const delay = Math.min(1000 * 2 ** reconnectCount.current, 15000);
        reconnectCount.current += 1;
        reconnectTimer.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
      ws.close();
    };
  }, [sessionId, token, onMessage]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback((message, overrideLanguage = '', attachmentPath = '', attachmentName = '') => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        message, 
        override_language: overrideLanguage,
        attachment_path: attachmentPath,
        attachment_name: attachmentName
      }));
      return true;
    }
    return false;
  }, []);

  const stopGeneration = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop_generation' }));
      return true;
    }
    return false;
  }, []);

  return { status, sendMessage, stopGeneration };
}
