import { useRef, useState, useEffect, useCallback } from 'react'

interface SwipeGestureOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  threshold?: number
  preventScrollOnSwipe?: boolean
}

interface SwipeState {
  isSwipeActive: boolean
  translateX: number
  isSwiped: boolean
  swipeDirection: 'left' | 'right' | null
}

export const useSwipeGesture = (options: SwipeGestureOptions) => {
  const {
    onSwipeLeft,
    onSwipeRight,
    threshold = 60,
    preventScrollOnSwipe = true,
  } = options

  const elementRef = useRef<HTMLDivElement>(null)
  const [swipeState, setSwipeState] = useState<SwipeState>({
    isSwipeActive: false,
    translateX: 0,
    isSwiped: false,
    swipeDirection: null,
  })

  const startX = useRef<number>(0)
  const currentX = useRef<number>(0)
  const isDragging = useRef<boolean>(false)
  const hasMovedBeyondThreshold = useRef<boolean>(false)

  const resetSwipe = useCallback(() => {
    setSwipeState({
      isSwipeActive: false,
      translateX: 0,
      isSwiped: false,
      swipeDirection: null,
    })
    hasMovedBeyondThreshold.current = false
    isDragging.current = false
  }, [])

  const handleStart = useCallback((clientX: number) => {
    startX.current = clientX
    currentX.current = clientX
    isDragging.current = true
    hasMovedBeyondThreshold.current = false
    
    setSwipeState(prev => ({
      ...prev,
      isSwipeActive: true,
    }))
  }, [])

  const handleMove = useCallback((clientX: number, preventDefault: () => void) => {
    if (!isDragging.current) return

    currentX.current = clientX
    const deltaX = currentX.current - startX.current
    const absDistance = Math.abs(deltaX)

    // Prevent scrolling if we've moved significantly horizontally
    if (preventScrollOnSwipe && absDistance > 10) {
      preventDefault()
    }

    // Only update if we've moved beyond a small threshold to avoid jittery updates
    if (absDistance > 5) {
      hasMovedBeyondThreshold.current = absDistance > threshold

      setSwipeState(prev => ({
        ...prev,
        translateX: deltaX,
        swipeDirection: deltaX > 0 ? 'right' : 'left',
        isSwiped: hasMovedBeyondThreshold.current,
      }))
    }
  }, [threshold, preventScrollOnSwipe])

  const handleEnd = useCallback(() => {
    if (!isDragging.current) return

    const deltaX = currentX.current - startX.current
    const absDistance = Math.abs(deltaX)
    
    if (absDistance > threshold) {
      // Trigger swipe action
      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight()
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft()
      }
    }

    // Always reset after handling
    setTimeout(resetSwipe, 100)
  }, [threshold, onSwipeLeft, onSwipeRight, resetSwipe])

  // Mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    handleStart(e.clientX)
  }, [handleStart])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    handleMove(e.clientX, () => e.preventDefault())
  }, [handleMove])

  const handleMouseUp = useCallback(() => {
    handleEnd()
  }, [handleEnd])

  // Touch events
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX)
  }, [handleStart])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX, () => e.preventDefault())
  }, [handleMove])

  const handleTouchEnd = useCallback(() => {
    handleEnd()
  }, [handleEnd])

  // Prevent click events when swiping
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (hasMovedBeyondThreshold.current || swipeState.isSwipeActive) {
      e.preventDefault()
      e.stopPropagation()
      return false
    }
  }, [swipeState.isSwipeActive])

  // Effect to add mouse event listeners to document when dragging
  useEffect(() => {
    if (!isDragging.current) return

    const handleDocumentMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, () => e.preventDefault())
    }

    const handleDocumentMouseUp = () => {
      handleEnd()
    }

    document.addEventListener('mousemove', handleDocumentMouseMove)
    document.addEventListener('mouseup', handleDocumentMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove)
      document.removeEventListener('mouseup', handleDocumentMouseUp)
    }
  }, [handleMove, handleEnd])

  return {
    elementRef,
    swipeState,
    handlers: {
      onMouseDown: handleMouseDown,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onClick: handleClick,
    },
    resetSwipe,
  }
}