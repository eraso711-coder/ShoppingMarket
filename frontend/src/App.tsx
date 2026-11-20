import { useEffect, useState, type FormEvent } from "react";

const API_URL = "http://localhost:5005/api";

type User = { id: string; email: string; firstName: string; lastName: string };
type Family = { id: string; name: string; role: string } | null;
type Session = { token: string; user: User; family: Family };
type Profile = { user: User; family: Family };

function App() {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedToken = window.localStorage.getItem("shoppingmarket_token");
    if (!savedToken) {
      setCheckingSession(false);
      return;
    }
    fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${savedToken}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Your session has expired. Please sign in again.");
        return response.json() as Promise<Profile>;
      })
      .then((data) => {
        setToken(savedToken);
        setProfile(data);
      })
      .catch(() => window.localStorage.removeItem("shoppingmarket_token"))
      .finally(() => setCheckingSession(false));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const endpoint = mode === "register" ? "register" : "login";
    const body = mode === "register"
      ? { firstName, lastName, familyName, email, password }
      : { email, password };

    try {
      const response = await fetch(`${API_URL}/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json() as Session & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      window.localStorage.setItem("shoppingmarket_token", data.token);
      setToken(data.token);
      setProfile({ user: data.user, family: data.family });
      setPassword("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to connect to ShoppingMarket.");
    } finally {
      setLoading(false);
    }
  }

  function signOut() {
    window.localStorage.removeItem("shoppingmarket_token");
    setToken(null);
    setProfile(null);
    setMode("login");
    setError("");
  }

  if (checkingSession) {
    return <main className="auth-page"><div className="loading-card">Loading your shopping space…</div></main>;
  }

  if (token && profile) {
    return (
      <main className="page-shell">
        <header className="topbar">
          <a className="brand" href="/"><span className="brand-mark">S</span><span>ShoppingMarket</span></a>
          <button className="text-button" onClick={signOut}>Sign out</button>
        </header>
        <section className="welcome-panel">
          <span className="eyebrow">YOUR FAMILY SHOPPING SPACE</span>
          <h1>Welcome, <span>{profile.user.firstName}.</span></h1>
          <p>Your ShoppingMarket account is ready. This is the starting point for your shared household shopping space.</p>
          <div className="family-card">
            <div className="family-icon">⌂</div>
            <div><span className="preview-kicker">YOUR FAMILY</span><h2>{profile.family?.name ?? "No family yet"}</h2><p>{profile.family ? `You are the ${profile.family.role.toLowerCase()} of this family.` : "Family setup will be available soon."}</p></div>
          </div>
          <div className="next-step"><span className="status-dot" />Account created successfully. Shopping lists are the next step.</div>
        </section>
        <footer className="footer"><span>ShoppingMarket</span><span>Built for better everyday shopping.</span></footer>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <header className="auth-topbar">
        <a className="brand" href="/"><span className="brand-mark">S</span><span>ShoppingMarket</span></a>
        <span className="topbar-note">A smarter way to shop together</span>
      </header>
      <section className="auth-layout">
        <div className="auth-intro">
          <span className="eyebrow">YOUR FAMILY SHOPPING SPACE</span>
          <h1>Good shopping starts <span>together.</span></h1>
          <p>One shared space for your household shopping. Start with your account, create your family, and build better shopping habits together.</p>
          <div className="auth-benefits">
            <div><span>01</span><p>Keep everyone's shopping in one place.</p></div>
            <div><span>02</span><p>Organise products and household essentials.</p></div>
            <div><span>03</span><p>Compare supermarket prices as you go.</p></div>
          </div>
        </div>
        <div className="auth-card">
          <div className="auth-card-heading">
            <span className="preview-kicker">{mode === "register" ? "GET STARTED" : "WELCOME BACK"}</span>
            <h2>{mode === "register" ? "Create your account" : "Sign in"}</h2>
            <p>{mode === "register" ? "Set up your profile and your family space." : "Sign in to continue to your family shopping space."}</p>
          </div>
          <div className="auth-tabs">
            <button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Create account</button>
            <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Sign in</button>
          </div>
          <form onSubmit={handleSubmit}>
            {mode === "register" && (
              <>
                <div className="form-row">
                  <label>First name<input autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Your first name" required /></label>
                  <label>Last name<input autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Your last name" required /></label>
                </div>
                <label>Family name<input autoComplete="organization" value={familyName} onChange={(event) => setFamilyName(event.target.value)} placeholder="e.g. The Smiths" required /></label>
              </>
            )}
            <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
            <label>Password<input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" ? 8 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "register" ? "At least 8 characters" : "Your password"} required /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="submit-button" type="submit" disabled={loading}>{loading ? "Please wait…" : mode === "register" ? "Create my account" : "Sign in"}</button>
          </form>
          <p className="auth-terms">{mode === "register" ? "By creating an account, you can start building your shared family shopping space." : "Your shopping space is waiting for you."}</p>
        </div>
      </section>
      <footer className="auth-footer"><span>ShoppingMarket</span><span>Built for better everyday shopping.</span></footer>
    </main>
  );
}

export default App;
