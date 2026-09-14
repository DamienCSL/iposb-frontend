import { useEffect, useId, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { apiError, geocodeLookup } from '../api/client'

const SABAH_CENTER = [5.9788, 116.0753]
const DEFAULT_ZOOM = 11
const PINNED_ZOOM = 15

function toNum(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function makePinIcon() {
  return L.divIcon({
    className: 'geo-pin-wrap',
    html: `<div class="geo-pin"><span class="geo-pin-dot"></span></div>`,
    iconSize: [28, 40],
    iconAnchor: [14, 38],
    popupAnchor: [0, -34],
  })
}

/**
 * Leaflet map picker: search place or click/drag pin.
 * @param {{
 *   lat: string|number|null|undefined,
 *   lng: string|number|null|undefined,
 *   addressHint?: string,
 *   label?: string,
 *   height?: number,
 *   onChange: (next: { lat: number|null, lng: number|null, displayName?: string|null }) => void,
 *   onError?: (message: string) => void,
 * }} props
 */
export default function GeoLocationPicker({
  lat,
  lng,
  addressHint = '',
  label = 'Location on map',
  height = 320,
  onChange,
  onError,
}) {
  const mapId = useId().replace(/:/g, '')
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const mapElRef = useRef(null)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [placeLabel, setPlaceLabel] = useState('')
  const [hint, setHint] = useState('Click the map to drop a pin, or search an address.')

  const latN = toNum(lat)
  const lngN = toNum(lng)
  const hasPin = latN != null && lngN != null

  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return undefined

    const map = L.map(mapElRef.current, {
      center: hasPin ? [latN, lngN] : SABAH_CENTER,
      zoom: hasPin ? PINNED_ZOOM : DEFAULT_ZOOM,
      scrollWheelZoom: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)

    map.on('click', (e) => {
      placeMarker(e.latlng.lat, e.latlng.lng, { fly: false })
      setPlaceLabel('')
      setHint('Pin placed — drag to fine-tune.')
      onChange({ lat: roundCoord(e.latlng.lat), lng: roundCoord(e.latlng.lng), displayName: null })
    })

    mapRef.current = map

    if (hasPin) {
      placeMarker(latN, lngN, { fly: false })
    }

    // Leaflet needs a size recalculation after layout
    const t = window.setTimeout(() => map.invalidateSize(), 80)

    return () => {
      window.clearTimeout(t)
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // init once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (latN == null || lngN == null) {
      if (markerRef.current) {
        map.removeLayer(markerRef.current)
        markerRef.current = null
      }
      return
    }
    placeMarker(latN, lngN, { fly: true })
  }, [latN, lngN])

  function roundCoord(n) {
    return Math.round(n * 1e6) / 1e6
  }

  function placeMarker(nextLat, nextLng, { fly }) {
    const map = mapRef.current
    if (!map) return
    const latlng = L.latLng(nextLat, nextLng)
    if (!markerRef.current) {
      const marker = L.marker(latlng, { draggable: true, icon: makePinIcon() }).addTo(map)
      marker.on('dragend', () => {
        const p = marker.getLatLng()
        setPlaceLabel('')
        setHint('Pin moved — coordinates updated.')
        onChange({ lat: roundCoord(p.lat), lng: roundCoord(p.lng), displayName: null })
      })
      markerRef.current = marker
    } else {
      markerRef.current.setLatLng(latlng)
    }
    if (fly) {
      map.flyTo(latlng, Math.max(map.getZoom(), PINNED_ZOOM), { duration: 0.45 })
    } else {
      map.setView(latlng, Math.max(map.getZoom(), PINNED_ZOOM))
    }
  }

  async function runSearch(e) {
    e?.preventDefault?.()
    const q = String(query || addressHint || '').trim()
    if (!q) {
      onError?.('Enter a place name or address to search.')
      return
    }
    setSearching(true)
    try {
      const data = await geocodeLookup(q)
      if (!data?.ok || data.lat == null || data.lng == null) {
        onError?.(data?.error || 'No matching location found.')
        setHint('No match — try a more specific Sabah address.')
        return
      }
      placeMarker(data.lat, data.lng, { fly: true })
      setPlaceLabel(data.displayName || q)
      setHint(data.cached ? 'Loaded from cache.' : 'Search result pinned — drag to adjust.')
      onChange({
        lat: roundCoord(data.lat),
        lng: roundCoord(data.lng),
        displayName: data.displayName || q,
      })
    } catch (err) {
      onError?.(apiError(err))
    } finally {
      setSearching(false)
    }
  }

  function useAddressHint() {
    if (!addressHint) return
    setQuery(addressHint)
  }

  function clearPin() {
    const map = mapRef.current
    if (markerRef.current && map) {
      map.removeLayer(markerRef.current)
      markerRef.current = null
    }
    setPlaceLabel('')
    setHint('Pin cleared. Click the map or search again.')
    onChange({ lat: null, lng: null, displayName: null })
    map?.flyTo(SABAH_CENTER, DEFAULT_ZOOM, { duration: 0.4 })
  }

  return (
    <div className="geo-picker">
      <div className="geo-picker-head">
        <div>
          <div className="geo-picker-title">{label}</div>
          <div className="geo-picker-sub">{hint}</div>
        </div>
        <div className="geo-picker-coords">
          <div>
            <span className="text-muted">Lat</span>
            <strong>{hasPin ? latN.toFixed(6) : '—'}</strong>
          </div>
          <div>
            <span className="text-muted">Lng</span>
            <strong>{hasPin ? lngN.toFixed(6) : '—'}</strong>
          </div>
        </div>
      </div>

      <form className="geo-picker-search" onSubmit={runSearch}>
        <div className="input-group">
          <span className="input-group-text"><i className="bi bi-search" /></span>
          <input
            type="search"
            className="form-control"
            placeholder="Search place, street, or landmark in Sabah…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search location"
          />
          <button type="submit" className="btn btn-primary" disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </button>
          {addressHint ? (
            <button type="button" className="btn btn-outline-secondary" onClick={useAddressHint} title="Copy address field into search">
              Use address
            </button>
          ) : null}
          {hasPin ? (
            <button type="button" className="btn btn-outline-danger" onClick={clearPin}>
              Clear pin
            </button>
          ) : null}
        </div>
      </form>

      <div
        id={`geo-map-${mapId}`}
        ref={mapElRef}
        className="geo-picker-map"
        style={{ height }}
        role="application"
        aria-label="Location map"
      />

      {placeLabel ? (
        <div className="geo-picker-place">
          <i className="bi bi-geo-alt-fill" /> {placeLabel}
        </div>
      ) : null}
    </div>
  )
}
