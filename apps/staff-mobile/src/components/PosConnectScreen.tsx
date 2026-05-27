import { useState, useEffect } from 'react'
import { Wifi, WifiOff, CheckCircle, AlertCircle, Loader, RefreshCw } from 'lucide-react'
import { usePosStore } from '../stores/posStore'
import { useNetworkStore } from '../stores/networkStore'
import { pingPos } from '../lib/posApi'
import './PosConnectScreen.css'

export default function PosConnectScreen() {
  const { posUrl, setPosUrl, setConnected, clearPosUrl } = usePosStore()
  const { localIp, isOnLan, suggestedSubnet, isLoading: netLoading, refresh } = useNetworkStore()
  const [input, setInput] = useState(posUrl ?? '')
  const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle')
  const [scanning, setScanning] = useState(false)

  // Detect local network on mount
  useEffect(() => {
    refresh()
  }, [])

  // When subnet is known and input is blank, pre-fill subnet prefix
  useEffect(() => {
    if (suggestedSubnet && !input.trim()) {
      setInput(suggestedSubnet)
    }
  }, [suggestedSubnet])

  const normalise = (raw: string) => {
    let url = raw.trim()
    if (!url.startsWith('http')) url = `http://${url}`
    return url
  }

  const handleConnect = async () => {
    if (!input.trim()) return
    const url = normalise(input)
    setStatus('checking')
    const ok = await pingPos(url)
    if (ok) {
      setPosUrl(url)
      setConnected(true)
      setStatus('ok')
    } else {
      setConnected(false)
      setStatus('fail')
    }
  }

  // Scan common ports on every host .1–.20 in the detected subnet
  // Probes all ports for a given host in parallel, then moves to next host.
  const handleScan = async () => {
    if (!suggestedSubnet) return
    setScanning(true)
    const ports = [3847]
    for (let i = 1; i <= 20; i++) {
      const host = `${suggestedSubnet}${i}`
      const results = await Promise.all(
        ports.map(async (port) => {
          const candidate = `http://${host}:${port}`
          const ok = await pingPos(candidate)
          return ok ? candidate : null
        })
      )
      const found = results.find(Boolean)
      if (found) {
        const display = found.replace('http://', '')
        setInput(display)
        setPosUrl(found)
        setConnected(true)
        setStatus('ok')
        setScanning(false)
        return
      }
    }
    setScanning(false)
    setStatus('fail')
  }

  const handleDisconnect = () => {
    clearPosUrl()
    setInput('')
    setStatus('idle')
  }

  return (
    <div className="pos-connect">
      <div className="connect-card glass">
        <Wifi size={32} className="connect-icon" />
        <h2 className="connect-title">Connect to POS</h2>

        {/* Network status badge */}
        <div className={`network-badge ${isOnLan ? 'on-lan' : 'off-lan'}`}>
          {netLoading ? (
            <><Loader size={13} className="spin" /> Detecting network…</>
          ) : isOnLan ? (
            <><Wifi size={13} /> Local network · {localIp}</>
          ) : (
            <><WifiOff size={13} /> No local network detected</>
          )}
          <button className="refresh-btn" onClick={refresh} title="Refresh">
            <RefreshCw size={12} />
          </button>
        </div>

        {!isOnLan && !netLoading && (
          <p className="connect-warn">
            Orders and KDS require a local WiFi connection to the POS.
          </p>
        )}

        <p className="connect-hint">
          Enter the POS IP (port 3847 is auto-detected).<br />
          Enable the LAN server in POS → Settings → Devices.
        </p>

        <input
          className="connect-input"
          type="text"
          placeholder="192.168.1.10:3847"
          value={input}
          onChange={(e) => { setInput(e.target.value); setStatus('idle') }}
          onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
          autoCapitalize="none"
          spellCheck={false}
        />

        {status === 'ok' && (
          <div className="connect-status ok">
            <CheckCircle size={15} /> Connected to {posUrl}
          </div>
        )}
        {status === 'fail' && (
          <div className="connect-status fail">
            <AlertCircle size={15} /> Could not reach POS. Check IP and port.
          </div>
        )}

        <div className="connect-actions">
          <button
            className="connect-btn tap-feedback"
            onClick={handleConnect}
            disabled={status === 'checking' || scanning || !input.trim()}
          >
            {status === 'checking' ? <Loader size={16} className="spin" /> : <Wifi size={16} />}
            {status === 'checking' ? 'Checking…' : 'Connect'}
          </button>

          {isOnLan && suggestedSubnet && (
            <button
              className="scan-btn tap-feedback"
              onClick={handleScan}
              disabled={scanning || status === 'checking'}
            >
              {scanning ? <Loader size={14} className="spin" /> : <RefreshCw size={14} />}
              {scanning ? 'Scanning…' : 'Auto-scan'}
            </button>
          )}
        </div>

        {posUrl && (
          <button className="disconnect-btn tap-feedback" onClick={handleDisconnect}>
            Disconnect
          </button>
        )}
      </div>
    </div>
  )
}
