"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { Loader2, ImageOff } from "lucide-react"

interface CachedImageProps {
  src: string | null
  alt: string
  width?: number
  height?: number
  className?: string
  fill?: boolean
  priority?: boolean
  sizes?: string
  objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down"
  onLoad?: () => void
  onError?: () => void
  loading?: "lazy" | "eager"
  fallbackSrc?: string
}

export function CachedImage({
  src,
  alt,
  width,
  height,
  className = "",
  fill = false,
  priority = false,
  sizes,
  objectFit = "cover",
  onLoad,
  onError,
  loading = "lazy",
  fallbackSrc,
}: CachedImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const [currentSrc, setCurrentSrc] = useState<string | null>(src)
  const [retryCount, setRetryCount] = useState(0)

  // Reset state when src changes
  useEffect(() => {
    setCurrentSrc(src)
    setError(false)
    setIsLoading(true)
    setRetryCount(0)
  }, [src])

  const handleLoad = useCallback(() => {
    setIsLoading(false)
    setError(false)
    if (onLoad) onLoad()
  }, [onLoad])

  const handleError = useCallback(() => {
    // Try fallback or retry once before showing error
    if (retryCount < 1 && currentSrc) {
      setRetryCount(prev => prev + 1)
      // Add cache-busting parameter for retry
      const retryUrl = currentSrc.includes('?') 
        ? `${currentSrc}&_retry=${Date.now()}`
        : `${currentSrc}?_retry=${Date.now()}`
      setCurrentSrc(retryUrl)
      return
    }
    
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc)
      setRetryCount(0)
      return
    }
    
    setError(true)
    setIsLoading(false)
    if (onError) onError()
  }, [onError, fallbackSrc, currentSrc, retryCount])

  // No src provided
  if (!src) {
    return (
      <div className={`bg-muted flex items-center justify-center ${fill ? 'absolute inset-0' : ''} ${className}`}>
        <ImageOff className="h-6 w-6 text-muted-foreground" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={`bg-muted flex flex-col items-center justify-center gap-1 ${fill ? 'absolute inset-0' : ''} ${className}`}>
        <ImageOff className="h-5 w-5 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">Failed to load</span>
      </div>
    )
  }

  // Common image props
  const imageProps = {
    alt,
    className: `${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`,
    priority: priority || loading === "eager",
    style: { objectFit },
    onLoad: handleLoad,
    onError: handleError,
    unoptimized: true, // Skip Next.js image optimization for external/dynamic images
  }

  // Use native img for faster loading if Next.js Image causes issues
  if (fill) {
    return (
      <div className="relative w-full h-full">
        {isLoading && (
          <div className="absolute inset-0 bg-muted flex items-center justify-center z-10">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        <Image
          src={currentSrc || src}
          fill
          sizes={sizes || "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"}
          {...imageProps}
        />
      </div>
    )
  }

  return (
    <div className="relative" style={{ width: width || 400, height: height || 400 }}>
      {isLoading && (
        <div className="absolute inset-0 bg-muted flex items-center justify-center z-10">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
      <Image
        src={currentSrc || src}
        width={width || 400}
        height={height || 400}
        {...imageProps}
      />
    </div>
  )
}

