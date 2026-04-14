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

export default function Map({ activities, onLocationSelect, selectionMode = false }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<unknown>(null)
  const markersRef = useRef<unknown[]>([])
  const router = useRouter()
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationDenied, setLocationDenied] = useState(false)

  useEffect(() => {
    // Get user location
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocationDenied(true),
    )
  }, [])

  // Fly to user location once map is ready
  useEffect(() => {
    if (!mapRef.current || !userLocation) return
    import('mapbox-gl').then(() => {
      (mapRef.current as { flyTo: (opts: object) => void }).flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 14,
        duration: 1200,
      })
    })
  }, [userLocation])

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    // Lazy load mapbox-gl
    import('mapbox-gl').then((mapboxgl) => {
      mapboxgl.default.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

      const map = new mapboxgl.default.Map({
        container: mapContainer.current!,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [SYDNEY_CENTER.lng, SYDNEY_CENTER.lat],
        zoom: 13,
      })

      mapRef.current = map

      if (selectionMode) {
        // In selection mode: click to pin location
        map.getCanvas().style.cursor = 'crosshair'
        map.on('click', async (e: { lngLat: { lat: number; lng: number } }) => {
          const { lat, lng } = e.lngLat
          // Reverse geocode with Mapbox
          const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&language=zh`
          )
          const data = await res.json()
          const placeName = data.features?.[0]?.place_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
          onLocationSelect?.(lat, lng, placeName)

          // Clear existing selection marker
          markersRef.current.forEach((m: unknown) => (m as { remove: () => void }).remove())
          markersRef.current = []

          const marker = new mapboxgl.default.Marker({ color: '#2563EB' })
            .setLngLat([lng, lat])
            .addTo(map)
          markersRef.current = [marker]
        })
      }
    })
  }, [selectionMode, onLocationSelect])

  // Update activity markers when activities change
  useEffect(() => {
    if (!mapRef.current || selectionMode) return

    import('mapbox-gl').then((mapboxgl) => {
      // Remove old markers
      markersRef.current.forEach((m: unknown) => (m as { remove: () => void }).remove())
      markersRef.current = []

      activities.forEach((activity) => {
        const el = document.createElement('div')
        el.className = 'cursor-pointer text-2xl'
        el.innerHTML = ACTIVITY_TYPE_LABELS[activity.type].split(' ')[0]
        el.title = ACTIVITY_TYPE_LABELS[activity.type]

        const marker = new mapboxgl.default.Marker({ element: el })
          .setLngLat([activity.location_lng, activity.location_lat])
          .addTo(mapRef.current as mapboxgl.Map)

        el.addEventListener('click', () => router.push(`/activity/${activity.id}`))
        markersRef.current.push(marker)
      })
    })
  }, [activities, selectionMode, router])

  return (
    <div className="relative w-full h-full">
      {locationDenied && (
        <div className="absolute top-2 left-2 right-2 z-10 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
          请允许定位权限以查看附近活动（已显示悉尼市区）
        </div>
      )}
      <div ref={mapContainer} className="w-full h-full rounded-lg" />
    </div>
  )
}
