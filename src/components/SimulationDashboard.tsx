'use client';

import { useEffect, useRef, useState } from 'react';
import type { SimulationController, SimulationMetrics } from '@/three-shell/bootstrap';

export function SimulationDashboard() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SimulationController | null>(null);
  const [status, setStatus] = useState('INITIALIZING');
  const [metrics, setMetrics] = useState<SimulationMetrics>({ fps: 0, objects: 0 });
  const [paused, setPaused] = useState(false);
  const [autoSpawn, setAutoSpawn] = useState(true);
  const [interval, setIntervalSeconds] = useState(1);

  useEffect(() => {
    const container = viewportRef.current;
    if (!container) return;
    let cancelled = false;
    // Dynamic import guarantees browser-only evaluation of Three.js and Rapier modules.
    import('@/three-shell/bootstrap')
      .then(({ mountSimulation }) => mountSimulation(container, (next) => {
        if (!cancelled) setMetrics(next);
      }))
      .then((controller) => {
        if (cancelled) { controller.dispose(); return; }
        controllerRef.current = controller;
        setStatus('RUNNING');
      })
      .catch((error: unknown) => {
        if (!cancelled) { console.error(error); setStatus('FAILED TO INITIALIZE'); }
      });
    return () => {
      cancelled = true;
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, []);

  const togglePause = () => {
    const controller = controllerRef.current;
    if (!controller) return;
    if (controller.isPaused) {
      controller.resume(); setPaused(false); setStatus('RUNNING');
    } else {
      controller.pause(); setPaused(true); setStatus('PAUSED');
    }
  };

  return (
    <div className="shell">
      <header className="header">
        <div className="brand"><span className="mark">◈</span><div><strong>Three.js</strong><span className="brand-caption">THREESHELL / RAPIER</span></div></div>
        <div className="header-right"><span className="status-dot"/><span>{status}</span><span className="version">NEXT.JS · TYPESCRIPT</span></div>
      </header>
      <main className="layout">
        <section className="viewport-section">
          <div className="viewport" ref={viewportRef}>
            <div className="viewport-label">PHYSICS WORLD <span>LIVE SIMULATION</span></div>
            <div className="hint">DRAG TO ORBIT · SCROLL TO ZOOM</div>
          </div>
          <div className="control-bar">
            <button className="primary" disabled={status === 'INITIALIZING' || status === 'FAILED TO INITIALIZE'} onClick={() => controllerRef.current?.spawn()}>＋ Spawn object</button>
            <button disabled={status === 'INITIALIZING' || status === 'FAILED TO INITIALIZE'} onClick={togglePause}>{paused ? '▶ Resume' : 'Ⅱ Pause'}</button>
            <button disabled={status === 'INITIALIZING' || status === 'FAILED TO INITIALIZE'} onClick={() => controllerRef.current?.clear()}>Clear world</button>
            <label className="toggle"><input type="checkbox" checked={autoSpawn} onChange={(e) => { setAutoSpawn(e.target.checked); controllerRef.current?.setAutoSpawn(e.target.checked); }}/><span>Auto spawn</span></label>
          </div>
          <div className="metrics">
            <div><span>OBJECTS</span><b>{metrics.objects}</b></div>
            <div><span>SIMULATION</span><b>60 <small>Hz</small></b></div>
            <div><span>FRAMERATE</span><b>{metrics.fps || '—'}</b></div>
            <div><span>PHYSICS</span><b>RAPIER 3D</b></div>
          </div>
        </section>
        <aside className="sidebar">
          <div className="eyebrow">APPLICATION ARCHITECTURE</div>
          <h1>Behavior, not boilerplate.</h1>
          <p>ThreeShell methods orchestrate the simulation. AnimationStore holds state. Rapier only handles physics.</p>
          <div className="pipeline-heading"><span>01</span> SIMULATION <em>FIXED 60 HZ</em></div>
          <div className="pipeline"><div>spawnObjects()</div><div>simulatePhysics()</div><div>removeFallenObjects()</div></div>
          <div className="pipeline-heading"><span>02</span> PRESENTATION <em>EVERY FRAME</em></div>
          <div className="pipeline"><div>synchronizeScene()</div><div>updateCamera()</div><div>renderFrame()</div></div>
          <div className="settings">
            <div className="settings-title">SIMULATION SETTINGS</div>
            <label htmlFor="interval">Spawn interval <output>{interval.toFixed(1)}s</output></label>
            <input id="interval" type="range" min="0.2" max="3" step="0.1" value={interval} onChange={(e) => { const v = Number(e.target.value); setIntervalSeconds(v); controllerRef.current?.setSpawnInterval(v); }}/>
            <div className="detail">Objects fall under gravity, collide and bounce, then are automatically recycled.</div>
          </div>
          <div className="footnote"><span className="accent">//</span> Next.js owns the interface. The WebGL renderer owns one frame loop. Pipeline functions run sequentially in declaration order.</div>
        </aside>
      </main>
      <footer>NEXT.JS APP ROUTER <span>·</span> TYPESCRIPT <span>·</span> THREE.JS <span>·</span> RAPIER <span>·</span> CODE-FIRST PIPELINE</footer>
    </div>
  );
}
