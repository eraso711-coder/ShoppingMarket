function App() {
  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="ShoppingMarket home">
          <span className="brand-mark">S</span><span>ShoppingMarket</span>
        </a>
        <span className="topbar-note">A smarter way to shop together</span>
      </header>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">YOUR FAMILY SHOPPING SPACE</span>
          <h1>Good shopping starts <span>together.</span></h1>
          <p>Keep the family on the same list, compare supermarket prices, and make every shopping trip a little easier.</p>
          <div className="hero-actions"><span className="status-dot" /><span>ShoppingMarket foundation is ready</span></div>
        </div>
        <div className="preview-card" aria-label="Shopping list preview">
          <div className="preview-heading">
            <div><span className="preview-kicker">FAMILY LIST</span><h2>This week</h2></div>
            <span className="item-count">3 items</span>
          </div>
          <div className="preview-item"><span className="item-check checked">✓</span><span className="item-name completed">Fresh tomatoes</span><span className="item-quantity">1 kg</span></div>
          <div className="preview-item"><span className="item-check" /><span className="item-name">Oat milk</span><span className="item-quantity">2 units</span></div>
          <div className="preview-item"><span className="item-check" /><span className="item-name">Wholegrain bread</span><span className="item-quantity">1 loaf</span></div>
          <div className="preview-footer"><span>Shared with your family</span><span className="avatar-stack"><i>R</i><i>M</i><i>+</i></span></div>
        </div>
      </section>
      <section className="feature-row" aria-label="Application features">
        <article className="feature"><span className="feature-number">01</span><h3>Shared lists</h3><p>One list that everyone in the family can keep up to date.</p></article>
        <article className="feature"><span className="feature-number">02</span><h3>Price history</h3><p>Build a clearer picture of how product prices change.</p></article>
        <article className="feature"><span className="feature-number">03</span><h3>Compare stores</h3><p>Find the best value across your favourite supermarkets.</p></article>
      </section>
      <footer className="footer"><span>ShoppingMarket</span><span>Built for better everyday shopping.</span></footer>
    </main>
  );
}
export default App;
