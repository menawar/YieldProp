'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from 'react'
import { useSearchParams } from 'next/navigation'
import {
  parsePropertiesFromEnv,
  getContractsForProperty,
  type Property,
  type PropertyContracts,
} from './properties'

const STORAGE_KEY = 'yieldprop-selected-property'

interface PropertyContextValue {
  properties: Property[]
  selectedPropertyId: string
  setSelectedPropertyId: (id: string) => void
  contracts: PropertyContracts
  selectedProperty: Property | undefined
}

const PropertyContext = createContext<PropertyContextValue | null>(null)

export function PropertyProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  const [properties] = useState<Property[]>(() => parsePropertiesFromEnv())
  const urlId = searchParams.get('property')

  const [selectedPropertyId, setSelectedIdState] = useState<string>(() => {
    if (typeof window === 'undefined') return properties[0]?.id ?? 'default'
    return (
      localStorage.getItem(STORAGE_KEY) ??
      properties[0]?.id ??
      'default'
    )
  })

  useEffect(() => {
    if (urlId && properties.some((p) => p.id === urlId)) {
      setSelectedIdState(urlId)
      localStorage.setItem(STORAGE_KEY, urlId)
    }
  }, [urlId, properties])

  const setSelectedPropertyId = useCallback((id: string) => {
    setSelectedIdState(id)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, id)
    }
  }, [])

  const selectedProperty = useMemo(
    () => properties.find((p) => p.id === selectedPropertyId),
    [properties, selectedPropertyId]
  )

  const contracts = useMemo(
    () => getContractsForProperty(properties, selectedPropertyId),
    [properties, selectedPropertyId]
  )

  const value = useMemo<PropertyContextValue>(
    () => ({
      properties,
      selectedPropertyId,
      setSelectedPropertyId,
      contracts,
      selectedProperty,
    }),
    [properties, selectedPropertyId, setSelectedPropertyId, contracts, selectedProperty]
  )

  return (
    <PropertyContext.Provider value={value}>
      {children}
    </PropertyContext.Provider>
  )
}

export function usePropertyContext(): PropertyContextValue {
  const ctx = useContext(PropertyContext)
  if (!ctx) {
    throw new Error('usePropertyContext must be used within PropertyProvider')
  }
  return ctx
}

/**
 * Hook to get contract addresses for the currently selected property.
 * Use this in place of the static CONTRACTS import.
 */
export function usePropertyContracts(): PropertyContracts {
  return usePropertyContext().contracts
}
