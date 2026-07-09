/**
 * useQmsWebSocket
 *
 * Shared hook that manages the WebSocket connection to the QMS backend.
 * Falls back to HTTP polling automatically if the WebSocket disconnects.
 *
 * Usage:
 *   useQmsWebSocket({
 *     onEvent: (type, data) => { ... },   // called for every WS message
 *     onLiveChange: (isLive) => { ... },  // called when connection state changes
 *     pollFn: () => fetchData(true),      // called every pollIntervalMs when offline
 *     pollIntervalMs: 5000,               // default 5 000 ms
 *   });
 */

import { useEffect, useRef } from "react";
import { WS_URL } from "../config";

/**
 * @param {object}   options
 * @param {function} options.onEvent        - (type: string, data: object) => void
 * @param {function} [options.onLiveChange] - (isLive: boolean) => void
 * @param {function} [options.pollFn]       - () => void  (polling fallback)
 * @param {number}   [options.pollIntervalMs=5000]
 */
export function useQmsWebSocket({
  onEvent,
  onLiveChange,
  pollFn,
  pollIntervalMs = 5000,
}) {
  const intervalRef = useRef(null);

  useEffect(() => {
    let ws;

    try {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        onLiveChange?.(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          onEvent?.(msg.type, msg.data);
        } catch {
          // Malformed message — ignore silently (no business logic to recover)
        }
      };

      ws.onclose = () => {
        onLiveChange?.(false);
        if (pollFn) {
          intervalRef.current = setInterval(pollFn, pollIntervalMs);
        }
      };

      ws.onerror = (error) => {
        console.debug('WebSocket error — falling back to polling:', error);
        onLiveChange?.(false);
      };
    } catch (err) {
      console.debug('WebSocket connection attempt failed:', err);
      onLiveChange?.(false);
      if (pollFn) {
        intervalRef.current = setInterval(pollFn, pollIntervalMs);
      }
    }

    return () => {
      if (ws) {
        ws.close();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
