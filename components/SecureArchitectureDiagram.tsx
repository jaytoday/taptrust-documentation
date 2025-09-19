'use client';

import { useEffect, useRef } from 'react';

export function SecureArchitectureDiagram({
  className,
}: { className?: string }) {
  const diagramRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const isAnimating = useRef(true);
  const isLoopRunning = useRef(false);

  useEffect(() => {
    const diagram = diagramRef.current;
    if (!diagram) return;

    // Get all the elements we need
    const elements = {
      client: diagram.querySelector('.client') as HTMLElement,
      keymgmt: diagram.querySelector('.keymgmt') as HTMLElement,
      aiinf: diagram.querySelector('.aiinf') as HTMLElement,
      storage: diagram.querySelector('.storage') as HTMLElement,
      conn1: diagram.querySelector('#conn1') as HTMLElement,
      conn2: diagram.querySelector('#conn2') as HTMLElement,
      conn3: diagram.querySelector('#conn3') as HTMLElement,
      packet: diagram.querySelector('.packet') as HTMLElement,
    };

    const endpoints: Record<string, any> = {
      cToKm: null,
      cToAi: null,
      cToSt: null,
    };

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const raf = () =>
      new Promise((r) => requestAnimationFrame(r as FrameRequestCallback));

    function getBox(el: HTMLElement) {
      if (!diagram) return { cx: 0, cy: 0, hw: 0, hh: 0 };
      const r = el.getBoundingClientRect();
      const d = diagram.getBoundingClientRect();
      return {
        cx: r.left + r.width / 2 - d.left,
        cy: r.top + r.height / 2 - d.top,
        hw: r.width / 2,
        hh: r.height / 2,
      };
    }

    function edgePoint(
      cx: number,
      cy: number,
      hw: number,
      hh: number,
      dx: number,
      dy: number,
    ) {
      if (dx === 0 && dy === 0) return { x: cx, y: cy };
      const ex = hw / Math.abs(dx || 1e-9);
      const ey = hh / Math.abs(dy || 1e-9);
      const t = Math.min(ex, ey);
      const inset = 2;
      const x = cx + dx * t;
      const y = cy + dy * t;
      const L = Math.hypot(dx, dy) || 1;
      return { x: x - (dx / L) * inset, y: y - (dy / L) * inset };
    }

    function connectEdges(
      fromEl: HTMLElement,
      toEl: HTMLElement,
      lineEl: HTMLElement,
    ) {
      const A = getBox(fromEl);
      const B = getBox(toEl);
      const dx = B.cx - A.cx;
      const dy = B.cy - A.cy;
      const start = edgePoint(A.cx, A.cy, A.hw, A.hh, dx, dy);
      const end = edgePoint(B.cx, B.cy, B.hw, B.hh, -dx, -dy);
      const len = Math.hypot(end.x - start.x, end.y - start.y);
      const angle =
        (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
      lineEl.style.left = `${start.x}px`;
      lineEl.style.top = `${start.y}px`;
      lineEl.style.width = `${len}px`;
      lineEl.style.transform = `rotate(${angle}deg)`;
      return { start, end, len };
    }

    function layoutConnections() {
      endpoints.cToKm = connectEdges(
        elements.client,
        elements.keymgmt,
        elements.conn1,
      );
      endpoints.cToAi = connectEdges(
        elements.client,
        elements.aiinf,
        elements.conn2,
      );
      endpoints.cToSt = connectEdges(
        elements.client,
        elements.storage,
        elements.conn3,
      );
    }

    function highlight(el: HTMLElement, on = true) {
      el.style.transform = on ? 'scale(1.05)' : 'scale(1)';
      el.style.boxShadow = on
        ? '0 8px 25px rgba(30, 64, 175, 0.4)'
        : '0 4px 12px rgba(0,0,0,0.1)';
    }

    function animatePacketAlong(
      seg: any,
      packetEl: HTMLElement,
      duration = 1200,
      delay = 0,
    ) {
      if (!packetEl) return Promise.resolve();

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          packetEl.style.opacity = '1';
          const t0 = performance.now();
          let animationId: number;

          const step = (t: number) => {
            const p = Math.min(1, (t - t0) / duration);
            const x = seg.start.x + (seg.end.x - seg.start.x) * p;
            const y = seg.start.y + (seg.end.y - seg.start.y) * p;
            packetEl.style.left = `${x}px`;
            packetEl.style.top = `${y}px`;

            if (p < 1) {
              animationId = requestAnimationFrame(step);
            } else {
              packetEl.style.opacity = '0';
              resolve();
            }
          };

          animationId = requestAnimationFrame(step);
          animationRef.current = animationId;
        }, delay);
      });
    }

    function hidePacket() {
      if (elements.packet) {
        elements.packet.style.opacity = '0';
        elements.packet.style.left = '0px';
        elements.packet.style.top = '0px';
      }
    }

    function animatePacketAlongReverse(
      seg: any,
      packetEl: HTMLElement,
      duration = 1200,
      delay = 0,
    ) {
      if (!packetEl) return Promise.resolve();

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          packetEl.style.opacity = '1';
          const t0 = performance.now();
          let animationId: number;

          const step = (t: number) => {
            const p = Math.min(1, (t - t0) / duration);
            // Reverse direction: start from end, go to start
            const x = seg.end.x + (seg.start.x - seg.end.x) * p;
            const y = seg.end.y + (seg.start.y - seg.end.y) * p;
            packetEl.style.left = `${x}px`;
            packetEl.style.top = `${y}px`;

            if (p < 1) {
              animationId = requestAnimationFrame(step);
            } else {
              packetEl.style.opacity = '0';
              resolve();
            }
          };

          animationId = requestAnimationFrame(step);
          animationRef.current = animationId;
        }, delay);
      });
    }

    async function showLineAndBidirectionalAnimate(
      lineEl: HTMLElement,
      seg: any,
      dur: number,
    ) {
      layoutConnections();
      lineEl.classList.add('active');
      await raf();

      // Single packet in both directions
      await animatePacketAlong(seg, elements.packet, dur, 0);
      await sleep(100);
      await animatePacketAlongReverse(seg, elements.packet, dur, 0);

      lineEl.classList.remove('active');
      hidePacket();
    }

    async function runCycle() {
      // Client <-> Key Management (bidirectional)
      highlight(elements.client, true);
      highlight(elements.keymgmt, true);
      highlight(elements.aiinf, false);
      highlight(elements.storage, false);
      await showLineAndBidirectionalAnimate(
        elements.conn1,
        endpoints.cToKm,
        600,
      );
      await sleep(100);

      // Client <-> AI Inference (bidirectional)
      highlight(elements.keymgmt, false);
      highlight(elements.aiinf, true);
      await showLineAndBidirectionalAnimate(
        elements.conn2,
        endpoints.cToAi,
        600,
      );
      await sleep(100);

      // Client <-> Storage (bidirectional)
      highlight(elements.aiinf, false);
      highlight(elements.storage, true);
      await showLineAndBidirectionalAnimate(
        elements.conn3,
        endpoints.cToSt,
        600,
      );
      await sleep(100);

      highlight(elements.client, false);
      highlight(elements.storage, false);
    }

    async function mainLoop() {
      if (isLoopRunning.current) return;
      isLoopRunning.current = true;

      const runLoop = async () => {
        let cycleCount = 0;
        while (isAnimating.current) {
          try {
            cycleCount++;
            await runCycle();
            await sleep(1000);
          } catch (error) {
            console.warn('Animation cycle error:', error);
            await sleep(1000);
          }
        }
      };

      await runLoop();
      isLoopRunning.current = false;
    }

    // Initial setup
    layoutConnections();

    // Start the animation loop
    const startAnimation = async () => {
      try {
        await sleep(100);

        if (
          !elements.client ||
          !elements.keymgmt ||
          !elements.aiinf ||
          !elements.storage ||
          !elements.conn1 ||
          !elements.conn2 ||
          !elements.conn3 ||
          !elements.packet
        ) {
          setTimeout(startAnimation, 1000);
          return;
        }

        await mainLoop();
      } catch (error) {
        console.error('Animation loop error:', error);
        setTimeout(startAnimation, 2000);
      }
    };
    startAnimation();

    // Handle window resize
    const handleResize = () => {
      layoutConnections();
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      isAnimating.current = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div
      ref={diagramRef}
      className={`relative w-full h-[120px] md:h-[140px] flex flex-row items-center justify-center gap-6 md:gap-12 px-4 py-2 my-6 ${className || ''}`}
      style={{ minHeight: '120px' }}
    >
      {/* Left: Client over Storage */}
      <div className="flex flex-col items-center gap-3">
        <div className="module client w-20 h-10 md:w-24 md:h-12 flex items-center justify-center bg-gray-600 text-white font-bold text-xs rounded-lg border-2 border-gray-500 shadow-md transition-all">
          CLIENT
        </div>
        <div
          style={{ fontSize: '0.5rem', lineHeight: '1.3' }}
          className="module storage w-20 h-8 md:w-24 md:h-10 flex items-center justify-center bg-gray-700 text-white text-xs text-center px-2 rounded-lg border-2 border-gray-600 shadow-md transition-all"
        >
          ENCRYPTED STORAGE
        </div>
      </div>
      
      {/* Right: Key Mgmt over AI */}
      <div className="flex flex-col gap-3">
        <div
          style={{ fontSize: '0.5rem', lineHeight: '1.3' }}
          className="module keymgmt w-20 h-10 md:w-24 md:h-12 flex flex-col items-center justify-center bg-blue-600 text-white text-xs text-center px-2 rounded-lg border-2 border-blue-500 shadow-md transition-all"
        >
          PRIVATE AUTH
        </div>
        <div
          style={{ fontSize: '0.5rem', lineHeight: '1.3' }}
          className="module aiinf w-20 h-8 md:w-24 md:h-10 flex items-center justify-center bg-blue-700 text-white text-xs text-center px-2 rounded-lg border-2 border-blue-600 shadow-md transition-all"
        >
          PRIVATE AI
        </div>
      </div>

      {/* Connection lines */}
      <div
        className="connection absolute h-1 bg-gray-400 rounded-full opacity-0"
        id="conn1"
      ></div>
      <div
        className="connection absolute h-1 bg-gray-400 rounded-full opacity-0"
        id="conn2"
      ></div>
      <div
        className="connection absolute h-1 bg-gray-400 rounded-full opacity-0"
        id="conn3"
      ></div>

      {/* Packet indicator */}
      <div className="packet absolute w-3 h-3 bg-blue-500 rounded-full shadow-lg opacity-0 transition-opacity duration-300"></div>

      <style jsx>{`
        .connection {
          transform-origin: 0 50%;
          transition: opacity 0.12s ease;
          z-index: 1;
        }
        .connection.active {
          opacity: 1;
          animation: pulseLine 800ms ease-in-out;
          background: linear-gradient(90deg, #1e40af, #059669, #3b82f6);
          box-shadow: 0 0 6px rgba(30, 64, 175, 0.5);
        }
        .packet {
          z-index: 3;
          pointer-events: none;
          animation: packetPulse 1s ease-in-out infinite;
          box-shadow: 0 0 12px rgba(30, 64, 175, 0.8);
        }
        @keyframes pulseLine {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes packetPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}