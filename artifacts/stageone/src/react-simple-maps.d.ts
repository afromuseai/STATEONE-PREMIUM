declare module "react-simple-maps" {
  import * as React from "react"

  export interface ComposableMapProps {
    projection?: string
    projectionConfig?: Record<string, unknown>
    width?: number
    height?: number
    style?: React.CSSProperties
    children?: React.ReactNode
  }
  export const ComposableMap: React.FC<ComposableMapProps>

  export interface ZoomableGroupProps {
    zoom?: number
    minZoom?: number
    maxZoom?: number
    center?: [number, number]
    children?: React.ReactNode
  }
  export const ZoomableGroup: React.FC<ZoomableGroupProps>

  export interface GeographiesProps {
    geography: string | Record<string, unknown>
    children: (props: { geographies: GeographyItem[] }) => React.ReactNode
  }
  export interface GeographyItem {
    rsmKey: string
    [key: string]: unknown
  }
  export const Geographies: React.FC<GeographiesProps>

  export interface GeographyProps {
    key?: string
    geography: GeographyItem
    style?: { default?: React.CSSProperties; hover?: React.CSSProperties; pressed?: React.CSSProperties }
    onMouseEnter?: (event: React.MouseEvent) => void
    onMouseLeave?: (event: React.MouseEvent) => void
  }
  export const Geography: React.FC<GeographyProps>

  export interface MarkerProps {
    coordinates: [number, number]
    onMouseEnter?: (event: React.MouseEvent) => void
    onMouseLeave?: (event: React.MouseEvent) => void
    children?: React.ReactNode
  }
  export const Marker: React.FC<MarkerProps>
}
