// Hook WebSocket : état téléphone temps réel (device, call_state, sims, chrono).
// Reconnexion automatique. Fallback : si le WS tombe, on garde le dernier état
// connu avec un drapeau `stale`.
import { useEffect, useRef, useState } from 'react'

export function usePhoneState() {
  const [state, setState] = useState({
    device_connected: false,
    device_state: 'absent',
    call_state: 0,
    call_active: false,
    call_elapsed_s: 0,
    sims: [],
    sim_error: null,
    ts: null,
    connected_ws: false,
  })
  const wsRef = useRef(null)
  const reconnectRef = useRef(null)

  useEffect(() => {
    let stopped = false

    function connect() {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${proto}://${window.location.host}/ws/state`)
      wsRef.current = ws

      ws.onopen = () => {
        setState((s) => ({ ...s, connected_ws: true }))
      }
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data)
          setState((s) => ({ ...s, ...data, connected_ws: true }))
        } catch {
          // ignore
        }
      }
      ws.onclose = () => {
        setState((s) => ({ ...s, connected_ws: false }))
        if (!stopped) {
          reconnectRef.current = setTimeout(connect, 1500)
        }
      }
      ws.onerror = () => {
        ws.close()
      }
    }

    connect()
    return () => {
      stopped = true
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      if (wsRef.current) wsRef.current.close()
    }
  }, [])

  return state
}
