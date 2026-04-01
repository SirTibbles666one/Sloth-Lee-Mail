import { useState, useRef, useEffect } from 'react'

export function useResizable(initialSize = { w: 520, h: 420 }) {
  const windowRef   = useRef(null)
  const isResizing  = useRef(false)
  const resizeDir   = useRef('nw')
  const resizeStart = useRef({})
  const [size, setSize] = useState(initialSize)

  const handleResizeMouseDown = (e, dir) => {
    e.preventDefault()
    e.stopPropagation()
    isResizing.current  = true
    resizeDir.current   = dir
    resizeStart.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h }
  }

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isResizing.current) return
      const dir = resizeDir.current
      const dx  = resizeStart.current.x - e.clientX
      const dy  = resizeStart.current.y - e.clientY
      setSize({
        w: dir === 'n' ? resizeStart.current.w : Math.max(380, resizeStart.current.w + dx),
        h: dir === 'w' ? resizeStart.current.h : Math.max(300, resizeStart.current.h + dy),
      })
    }
    const onMouseUp = () => { isResizing.current = false }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup',   onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup',   onMouseUp)
    }
  }, [])

  return { windowRef, size, handleResizeMouseDown }
}
