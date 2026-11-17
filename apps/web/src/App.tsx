import { useEffect, useState } from 'react';
import { Activity, ArrowUpRight, Database, Github, ShoppingBasket } from 'lucide-react';

type Health = { status: string; service: string; database: string; timestamp: string };
const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiUrl}/health`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`API returned HTTP ${response.status}`);
        return (await response.json()) as Health;
      })
      .then(setHealth)
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name !== 'AbortError') setError(reason.message);
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="page-shell">
      <nav className="topbar">
        <a className="brand" href="/" aria-label="ShoppingMarket home">
          <span className="brand-mark"><ShoppingBasket size={21} /></span>
          <span>Shopping<span className="brand-accent">Market</span></span>
        </a>
        <a className="github-link" href="https://github.com/eraso711-coder/ShoppingMarket" target="_blank" rel="noreferrer">
          <Github size={17} /> Repository <ArrowUpRight size={14} />
        </a>
      </nav>
      <section className="hero">
        <div className="eyebrow"><span className="eyebrow-dot" /> PHASE 1 · FOUNDATION</div>
        <h1>Smarter shopping<br /><span>starts together.</span></h1>
        <p className="intro">A shared family space to organize shopping lists, compare supermarket prices, and make every purchase count.</p>
        <div className="status-card">
          <div className="status-heading">
            <div className="status-icon"><Activity size={19} /></div>
            <div><strong>Development environment</strong><span>Live API connectivity check</span></div>
          </div>
          <div className="status-row"><span>Backend API</span><span className={health ? 'status-value online' : error ? 'status-value offline' : 'status-value pending'}><i />{health ? 'Connected' : error ? 'Unavailable' : 'Checking…'}</span></div>
          <div className="status-row"><span>PostgreSQL</span><span className={health?.database === 'ok' ? 'status-value online' : error ? 'status-value offline' : 'status-value pending'}><i />{health?.database === 'ok' ? 'Connected' : error ? 'Not connected' : 'Checking…'}</span></div>
          {error && <p className="status-error">{error}. Start the API and PostgreSQL to enable the health check.</p>}
          {health && <p className="status-footnote">Last checked: {new Date(health.timestamp).toLocaleTimeString()}</p>}
        </div>
        <div className="feature-grid">
          <article className="feature-card"><span className="feature-number">01</span><Database size={20} /><h2>One shared space</h2><p>Family members work from the same product catalog and shopping lists.</p></article>
          <article className="feature-card"><span className="feature-number">02</span><ShoppingBasket size={20} /><h2>Compare prices</h2><p>Keep historical prices and compare offers across supermarkets.</p></article>
        </div>
      </section>
      <footer>Built for families · Currency default: COP</footer>
    </main>
  );
}
