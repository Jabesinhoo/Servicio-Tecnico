import React, { useEffect, useRef } from 'react';

// Store strokes in normalized coordinates so rotating/resizing never erases ink.
export default function ResponsiveSignaturePad({ onChange, clearToken = 0 }) {
  const canvasRef = useRef(null);
  const strokes = useRef([]);
  const pointer = useRef(null);
  const callback = useRef(onChange);
  useEffect(() => { callback.current = onChange; }, [onChange]);

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = '#111827'; ctx.fillStyle = '#111827';
    ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const stroke of strokes.current) {
      ctx.beginPath();
      stroke.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x * rect.width, p.y * rect.height);
        else ctx.lineTo(p.x * rect.width, p.y * rect.height);
      });
      if (stroke.length === 1) {
        ctx.arc(stroke[0].x * rect.width, stroke[0].y * rect.height, 1.2, 0, Math.PI * 2);
        ctx.fill();
      } else ctx.stroke();
    }
  };
  useEffect(() => {
    const canvas = canvasRef.current;
    const observer = new ResizeObserver(() => { redraw(); });
    observer.observe(canvas);
    redraw(); callback.current?.(canvas, false);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    strokes.current = []; pointer.current = null;
    redraw(); callback.current?.(canvasRef.current, false);
  }, [clearToken]);
  const point = e => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const start = e => {
    if (pointer.current !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault(); pointer.current = e.pointerId;
    strokes.current.push([point(e)]); canvasRef.current.setPointerCapture(e.pointerId);
    redraw(); callback.current?.(canvasRef.current, true);
  };
  const move = e => {
    if (pointer.current !== e.pointerId) return;
    e.preventDefault(); const samples=e.nativeEvent?.getCoalescedEvents?.()||[];
    for(const sample of samples)strokes.current.at(-1).push(point(sample));
    strokes.current.at(-1).push(point(e)); redraw();
  };
  const stop = e => {
    if (pointer.current !== e.pointerId) return;
    pointer.current = null;
    if (canvasRef.current.hasPointerCapture(e.pointerId)) canvasRef.current.releasePointerCapture(e.pointerId);
    callback.current?.(canvasRef.current, strokes.current.length > 0);
  };
  return <canvas ref={canvasRef} aria-label="Área para dibujar la firma" onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} className="service-signature w-full h-44 sm:h-52 rounded-xl border-2 border-dashed border-slate-300 touch-none cursor-crosshair" />;
}
