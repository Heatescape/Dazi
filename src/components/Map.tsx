'use client'

import { useEffect, useRef, useState } from 'react'
import type { Activity } from '@/lib/types'
import { ACTIVITY_TYPE_LABELS, SYDNEY_CENTER } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface MapProps {
  activities: Activity[]
  onLocationSelect?: (lat: number, lng: number, name: string) => void
  selectionMode?: boolean
}

type MapInstance = {
  jumpTo: (opts: object) => void
  getCanvas: () => HTMLCanvasElement
  on: (event: string, handler: unknown) => void
  remove: () => void
}

export default function Map({ activities, onLocationSelect, selectionMode = false }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapInstance | null>(null)
  const markersRef = useRef<{ remove: () => void }[]>([])
  const router = useRouter()
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationDenied, setLocationDenied] = useState(false)
  const [geoReady, setGeoReady] = useState(false)

  useEffect(() => {
    // 5-second timeout so map doesn't hang indefinitely waiting for GPS
    const timer = setTimeout(() => {
      if (!geoReady) { setLocationDenied(true); setGeoReady(true) }
    }, 5000)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer)
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGeoReady(true)
      },
      () => {
        clearTimeout(timer)
        setLocationDenied(true)
        setGeoReady(true)
      },
    )

    return () => clearTimeout(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize map once we know the starting center
  useEffect(() => {
    if (!geoReady || !mapContainer.current || mapRef.current) return

    const center = userLocation
      ? [userLocation.lng, userLocation.lat]
      : [SYDNEY_CENTER.lng, SYDNEY_CENTER.lat]

    import('mapbox-gl').then((mapboxgl) => {
      mapboxgl.default.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

      const map = new mapboxgl.default.Map({
        container: mapContainer.current!,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: center as [number, number],
        zoom: 14,
      })

      mapRef.current = map as unknown as MapInstance

      if (selectionMode) {
        map.getCanvas().style.cursor = 'crosshair'
        map.on('click', async (e: { lngLat: { lat: number; lng: number } }) => {
          const { lat, lng } = e.lngLat
          const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&language=zh`
          )
          const data = await res.json()
          const placeName = data.features?.[0]?.place_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
          onLocationSelect?.(lat, lng, placeName)

          markersRef.current.forEach((m) => m.remove())
          markersRef.current = []

          const marker = new mapboxgl.default.Marker({ color: '#2563EB' })
            .setLngLat([lng, lat])
            .addTo(map)
          markersRef.current = [marker]
        })
      }
    })
  }, [geoReady, userLocation, selectionMode, onLocationSelect])

  // Update activity markers when activities change
  useEffect(() => {
    if (!mapRef.current || selectionMode) return

    import('mapbox-gl').then((mapboxgl) => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []

      activities.forEach((activity) => {
        const el = document.createElement('div')
        el.className = 'cursor-pointer text-2xl'
        el.innerHTML = ACTIVITY_TYPE_LABELS[activity.type].split(' ')[0]
        el.title = ACTIVITY_TYPE_LABELS[activity.type]

        const marker = new mapboxgl.default.Marker({ element: el })
          .setLngLat([activity.location_lng, activity.location_lat])
          .addTo(mapRef.current as unknown as mapboxgl.Map)

        el.addEventListener('click', () => router.push(`/activity/${activity.id}`))
        markersRef.current.push(marker)
      })
    })
  }, [activities, selectionMode, router])

  const handleRecenter = () => {
    if (!mapRef.current || !userLocation) return
    mapRef.current.jumpTo({ center: [userLocation.lng, userLocation.lat], zoom: 14 })
  }

  return (
    <div className="relative w-full h-full">
      {locationDenied && (
        <div className="absolute top-2 left-2 right-2 z-10 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
          请允许定位权限以查看附近活动（已显示悉尼市区）
        </div>
      )}
      {!geoReady && (
        <div className="absolute inset-0 bg-gray-100 rounded-lg animate-pulse z-10" />
      )}
      <div ref={mapContainer} className="w-full h-full rounded-lg" />
      {userLocation && (
        <button
          onClick={handleRecenter}
          className="absolute bottom-4 right-4 z-10 bg-white rounded-full w-10 h-10 shadow-md flex items-center justify-center text-gray-600 hover:bg-gray-50 active:bg-gray-100"
          title="回到我的位置"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M12 2a7 7 0 0 1 7 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 0 1 7-7zm0 4.5A2.5 2.5 0 1 0 12 11.5 2.5 2.5 0 0 0 12 6.5z"/>
          </svg>
        </button>
      )}
    </div>
  )
}
