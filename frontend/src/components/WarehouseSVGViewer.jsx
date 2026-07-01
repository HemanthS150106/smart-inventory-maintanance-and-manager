import { useState, useEffect, useRef } from 'react';

export default function WarehouseSVGViewer({ svgContent, mode, containerId = "svg-viewer-container" }) {
  const containerRef = useRef(null);
  const [scale,     setScale]     = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart,  setDragStart]  = useState({ x: 0, y: 0 });
  const [dragOrigin, setDragOrigin] = useState({ x: 0, y: 0 });

  // Fit SVG to container on load
  useEffect(() => {
    if (!containerRef.current || !svgContent) return;
    const container = containerRef.current;
    const cw = container.clientWidth  || 800;
    const ch = container.clientHeight || 500;
    const svgW = 3200;
    const svgH = 2000;
    const fitScale = Math.min(cw / svgW, ch / svgH) * 0.95;
    setScale(fitScale);
    setTranslate({
      x: (cw - svgW * fitScale) / 2,
      y: (ch - svgH * fitScale) / 2
    });
  }, [svgContent]);

  function handleWheel(e) {
    e.preventDefault();
    const delta     = e.deltaY > 0 ? 0.85 : 1.15;
    const newScale  = Math.min(10, Math.max(0.05,
                      scale * delta));
    // Zoom toward mouse position
    const rect = containerRef.current.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;
    setTranslate(t => ({
      x: mx - (mx - t.x) * (newScale / scale),
      y: my - (my - t.y) * (newScale / scale)
    }));
    setScale(newScale);
  }

  function handleMouseDown(e) {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragOrigin({ ...translate });
  }

  function handleMouseMove(e) {
    if (!isDragging) return;
    setTranslate({
      x: dragOrigin.x + (e.clientX - dragStart.x),
      y: dragOrigin.y + (e.clientY - dragStart.y)
    });
  }

  function handleMouseUp() { setIsDragging(false); }

  function resetView() {
    const container = containerRef.current;
    if (!container) return;
    const cw = container.clientWidth  || 800;
    const ch = container.clientHeight || 500;
    const fitScale = Math.min(cw/3200, ch/2000) * 0.95;
    setScale(fitScale);
    setTranslate({
      x: (cw - 3200 * fitScale) / 2,
      y: (ch - 2000 * fitScale) / 2
    });
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Zoom controls */}
      <div style={{
        position: 'absolute', top: '12px', right: '12px',
        zIndex: 10, display: 'flex', gap: '6px',
        flexDirection: 'column'
      }}>
        {[
          { label: '+',    action: () => setScale(s =>
              Math.min(10, s * 1.25)) },
          { label: '−',    action: () => setScale(s =>
              Math.max(0.05, s / 1.25)) },
          { label: '⊡',    action: resetView },
        ].map(btn => (
          <button key={btn.label} onClick={btn.action}
            style={{
              width: '36px', height: '36px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px', background: 'white',
              cursor: 'pointer', fontSize: '18px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center'
            }}>
            {btn.label}
          </button>
        ))}
      </div>

      {/* Zoom level indicator */}
      <div style={{
        position: 'absolute', bottom: '12px', right: '12px',
        zIndex: 10, background: 'rgba(255,255,255,0.9)',
        padding: '4px 10px', borderRadius: '6px',
        fontSize: '12px', color: '#64748b',
        border: '1px solid #e2e8f0'
      }}>
        {Math.round(scale * 100)}%
      </div>

      {/* Instruction hint */}
      <div style={{
        position: 'absolute', bottom: '12px', left: '12px',
        zIndex: 10, background: 'rgba(255,255,255,0.85)',
        padding: '4px 10px', borderRadius: '6px',
        fontSize: '11px', color: '#94a3b8',
        border: '1px solid #e2e8f0'
      }}>
        Scroll to zoom · Drag to pan
      </div>

      {/* SVG container */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          width: '100%',
          height: '70vh',          // fixed height so it fits page
          overflow: 'hidden',
          cursor: isDragging ? 'grabbing' : 'grab',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          position: 'relative'
        }}
      >
        <div
          id={containerId}
          style={{
            transform: `translate(${translate.x}px, 
                        ${translate.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.1s'
          }}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </div>
    </div>
  );
}
