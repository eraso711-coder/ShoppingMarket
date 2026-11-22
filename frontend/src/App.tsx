import { useCallback, useEffect, useState, type FormEvent } from "react";

const API_URL = "http://localhost:5005/api";

type User = { id: string; email: string; firstName: string; lastName: string };
type Family = { id: string; name: string; role: string } | null;
type Profile = { user: User; family: Family };
type ProductSummary = { id: string; name: string; brand: string | null } | null;
type CatalogProduct = { id: string; name: string; brand: string | null; barcode: string | null; unit: string | null; category: { id: string; name: string } | null; priceObservations: { id: string; price: string; currency: string; observedAt: string; supermarket: { id: string; name: string; chain: string | null } }[] };
type CatalogCategory = { id: string; name: string; _count?: { products: number } };
type Supermarket = { id: string; name: string; chain: string | null; website: string | null; _count?: { offers: number; prices: number } };
type Item = {
  id: string;
  customName: string | null;
  quantity: string;
  notes: string | null;
  status: "TO_BUY" | "IN_CART" | "PURCHASED" | "UNAVAILABLE";
  product: ProductSummary;
};
type ShoppingList = {
  id: string;
  name: string;
  status: "ACTIVE" | "COMPLETED" | "ARCHIVED";
  dueAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  family: { id: string; name: string };
  items: Item[];
  _count?: { items: number };
};
type ApiError = { error?: string };

async function apiRequest<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers
    }
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as ApiError;
    throw new Error(data.error ?? "Something went wrong. Please try again.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function ShoppingItemRow({
  item,
  token,
  listId,
  onChanged,
  onError
}: {
  item: Item;
  token: string;
  listId: string;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState(item.customName ?? item.product?.name ?? "");
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [notes, setNotes] = useState(item.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const displayName = item.product?.name ?? item.customName ?? "Unnamed item";
  const purchased = item.status === "PURCHASED";

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    onError("");
    try {
      await apiRequest(`/shopping-lists/${listId}/items/${item.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ name, quantity: Number(quantity), notes })
      });
      setDirty(false);
      onChanged();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to update this item.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePurchased() {
    onError("");
    try {
      await apiRequest(`/shopping-lists/${listId}/items/${item.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ status: purchased ? "TO_BUY" : "PURCHASED" })
      });
      onChanged();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to update this item.");
    }
  }

  async function remove() {
    setRemoving(true);
    onError("");
    try {
      await apiRequest(`/shopping-lists/${listId}/items/${item.id}`, token, { method: "DELETE" });
      onChanged();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to remove this item.");
      setRemoving(false);
    }
  }

  return (
    <article className={`item-row ${purchased ? "is-purchased" : ""}`}>
      <button className={`purchase-toggle ${purchased ? "checked" : ""}`} onClick={togglePurchased} aria-label={purchased ? "Mark as not purchased" : "Mark as purchased"}>
        {purchased ? "✓" : ""}
      </button>
      <form className="item-edit-form" onSubmit={save}>
        <div className="item-main-fields">
          <label className="item-name-field"><span className="sr-only">Item name</span><input value={name} onChange={(event) => { setName(event.target.value); setDirty(true); }} aria-label={`Name of ${displayName}`} /></label>
          <label className="quantity-field"><span className="sr-only">Quantity</span><input type="number" min="0.001" max="9999999.999" step="0.001" value={quantity} onChange={(event) => { setQuantity(event.target.value); setDirty(true); }} aria-label={`Quantity of ${displayName}`} /></label>
        </div>
        <div className="item-secondary-fields">
          <input value={notes} onChange={(event) => { setNotes(event.target.value); setDirty(true); }} placeholder="Add a note (optional)" aria-label={`Notes for ${displayName}`} />
          {dirty && <button className="save-item-button" type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</button>}
          <button className="remove-item-button" type="button" onClick={remove} disabled={removing}>{removing ? "…" : "Remove"}</button>
        </div>
      </form>
    </article>
  );
}

function App() {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"lists" | "catalog">("lists");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [supermarkets, setSupermarkets] = useState<Supermarket[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [productName, setProductName] = useState("");
  const [productBrand, setProductBrand] = useState("");
  const [productCategoryId, setProductCategoryId] = useState("");
  const [productUnit, setProductUnit] = useState("");
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [supermarketName, setSupermarketName] = useState("");
  const [supermarketChain, setSupermarketChain] = useState("");
  const [creatingSupermarket, setCreatingSupermarket] = useState(false);
  const [priceProductId, setPriceProductId] = useState<string | null>(null);
  const [priceValue, setPriceValue] = useState("");
  const [priceSupermarketId, setPriceSupermarketId] = useState("");
  const [priceCurrency, setPriceCurrency] = useState("EUR");
  const [savingPrice, setSavingPrice] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState("1");
  const [newItemNotes, setNewItemNotes] = useState("");
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "COMPLETED">("ALL");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [creatingList, setCreatingList] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [error, setError] = useState("");

  const refreshLists = useCallback(async (sessionToken: string) => {
    const data = await apiRequest<{ lists: ShoppingList[] }>("/shopping-lists", sessionToken);
    setLists(data.lists);
    setSelectedListId((current) => current && data.lists.some((list) => list.id === current)
      ? current
      : data.lists.find((list) => list.status === "ACTIVE")?.id ?? data.lists[0]?.id ?? null);
  }, []);

  useEffect(() => {
    const savedToken = window.localStorage.getItem("shoppingmarket_token");
    if (!savedToken) {
      setCheckingSession(false);
      return;
    }
    apiRequest<Profile>("/auth/me", savedToken)
      .then(async (data) => {
        setToken(savedToken);
        setProfile(data);
        await refreshLists(savedToken);
      })
      .catch(() => {
        window.localStorage.removeItem("shoppingmarket_token");
        setToken(null);
        setProfile(null);
      })
      .finally(() => setCheckingSession(false));
  }, [refreshLists]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const endpoint = mode === "register" ? "register" : "login";
    const body = mode === "register" ? { firstName, lastName, familyName, email, password } : { email, password };
    try {
      const response = await fetch(`${API_URL}/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json() as { token: string; user: User; family: Family; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      window.localStorage.setItem("shoppingmarket_token", data.token);
      setToken(data.token);
      setProfile({ user: data.user, family: data.family });
      setPassword("");
      await refreshLists(data.token);
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
    setLists([]);
    setSelectedListId(null);
    setMode("login");
    setError("");
  }

  async function createList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !profile?.family) return;
    setCreatingList(true);
    setError("");
    try {
      const data = await apiRequest<{ list: ShoppingList }>("/shopping-lists", token, {
        method: "POST",
        body: JSON.stringify({ name: newListName, familyId: profile.family.id })
      });
      setNewListName("");
      await refreshLists(token);
      setSelectedListId(data.list.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create this list.");
    } finally {
      setCreatingList(false);
    }
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedListId) return;
    setAddingItem(true);
    setError("");
    try {
      await apiRequest(`/shopping-lists/${selectedListId}/items`, token, {
        method: "POST",
        body: JSON.stringify({ name: newItemName, quantity: Number(newItemQuantity), notes: newItemNotes })
      });
      setNewItemName("");
      setNewItemQuantity("1");
      setNewItemNotes("");
      await refreshLists(token);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to add this item.");
    } finally {
      setAddingItem(false);
    }
  }

  async function updateListStatus(status: "ACTIVE" | "COMPLETED") {
    if (!token || !selectedList) return;
    setError("");
    try {
      await apiRequest(`/shopping-lists/${selectedList.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      await refreshLists(token);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update this list.");
    }
  }

  useEffect(() => {
    if (!token || activeView !== "catalog") return;
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError("");
    Promise.all([
      apiRequest<{ products: CatalogProduct[] }>(`/catalog/products?q=${encodeURIComponent(catalogQuery)}`, token),
      apiRequest<{ categories: CatalogCategory[] }>("/catalog/categories", token),
      apiRequest<{ supermarkets: Supermarket[] }>("/catalog/supermarkets", token)
    ]).then(([productData, categoryData, supermarketData]) => {
      if (cancelled) return;
      setCatalogProducts(productData.products);
      setCatalogCategories(categoryData.categories);
      setSupermarkets(supermarketData.supermarkets);
      setPriceSupermarketId((current) => current || supermarketData.supermarkets[0]?.id || "");
    }).catch((requestError) => {
      if (!cancelled) setCatalogError(requestError instanceof Error ? requestError.message : "Unable to load the catalogue.");
    }).finally(() => {
      if (!cancelled) setCatalogLoading(false);
    });
    return () => { cancelled = true; };
  }, [token, activeView, catalogQuery]);

  async function createCatalogProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setCreatingProduct(true);
    setCatalogError("");
    try {
      await apiRequest("/catalog/products", token, {
        method: "POST",
        body: JSON.stringify({ name: productName, brand: productBrand || null, categoryId: productCategoryId || null, unit: productUnit || null })
      });
      setProductName(""); setProductBrand(""); setProductCategoryId(""); setProductUnit("");
      const refreshed = await apiRequest<{ products: CatalogProduct[] }>(`/catalog/products?q=${encodeURIComponent(catalogQuery)}`, token);
      setCatalogProducts(refreshed.products);
    } catch (requestError) {
      setCatalogError(requestError instanceof Error ? requestError.message : "Unable to create the product.");
    } finally { setCreatingProduct(false); }
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setCreatingCategory(true);
    setCatalogError("");
    try {
      const data = await apiRequest<{ category: CatalogCategory }>("/catalog/categories", token, {
        method: "POST",
        body: JSON.stringify({ name: categoryName })
      });
      setCatalogCategories((current) => [...current, data.category].sort((a, b) => a.name.localeCompare(b.name)));
      setProductCategoryId(data.category.id);
      setCategoryName("");
    } catch (requestError) {
      setCatalogError(requestError instanceof Error ? requestError.message : "Unable to create the category.");
    } finally { setCreatingCategory(false); }
  }

  async function createSupermarket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setCreatingSupermarket(true);
    setCatalogError("");
    try {
      const data = await apiRequest<{ supermarket: Supermarket }>("/catalog/supermarkets", token, {
        method: "POST",
        body: JSON.stringify({ name: supermarketName, chain: supermarketChain || null })
      });
      setSupermarkets((current) => [...current, data.supermarket].sort((a, b) => a.name.localeCompare(b.name)));
      setPriceSupermarketId(data.supermarket.id);
      setSupermarketName(""); setSupermarketChain("");
    } catch (requestError) {
      setCatalogError(requestError instanceof Error ? requestError.message : "Unable to create the supermarket.");
    } finally { setCreatingSupermarket(false); }
  }


  async function manageCategory(category: CatalogCategory, action: "edit" | "delete") {
    if (!token) return;
    if (action === "edit") {
      const name = window.prompt("Category name", category.name);
      if (!name?.trim()) return;
      await apiRequest(`/catalog/categories/${category.id}`, token, { method: "PATCH", body: JSON.stringify({ name }) });
    } else {
      if (!window.confirm(`Delete category "${category.name}"?`)) return;
      await apiRequest(`/catalog/categories/${category.id}`, token, { method: "DELETE" });
      if (productCategoryId === category.id) setProductCategoryId("");
    }
    const data = await apiRequest<{ categories: CatalogCategory[] }>("/catalog/categories", token);
    setCatalogCategories(data.categories);
  }

  async function manageSupermarket(supermarket: Supermarket, action: "edit" | "delete") {
    if (!token) return;
    if (action === "edit") {
      const name = window.prompt("Supermarket name", supermarket.name);
      if (!name?.trim()) return;
      const chain = window.prompt("Chain (optional)", supermarket.chain ?? "");
      const website = window.prompt("Website URL (optional)", supermarket.website ?? "");
      await apiRequest(`/catalog/supermarkets/${supermarket.id}`, token, { method: "PATCH", body: JSON.stringify({ name, chain, website }) });
    } else {
      if (!window.confirm(`Delete supermarket "${supermarket.name}"? This is only possible when it has no offers or price history.`)) return;
      await apiRequest(`/catalog/supermarkets/${supermarket.id}`, token, { method: "DELETE" });
    }
    const data = await apiRequest<{ supermarkets: Supermarket[] }>("/catalog/supermarkets", token);
    setSupermarkets(data.supermarkets);
    if (priceSupermarketId === supermarket.id && action === "delete") setPriceSupermarketId(data.supermarkets[0]?.id ?? "");
  }

  async function manageProduct(product: CatalogProduct, action: "edit" | "delete") {
    if (!token) return;
    if (action === "edit") {
      const name = window.prompt("Product name", product.name);
      if (!name?.trim()) return;
      const brand = window.prompt("Brand (optional)", product.brand ?? "");
      const unit = window.prompt("Unit (optional)", product.unit ?? "");
      const categoryName = window.prompt(`Category name (available: ${catalogCategories.map((category) => category.name).join(", ")})`, product.category?.name ?? "");
      if (!categoryName?.trim()) return;
      const categoryId = catalogCategories.find((category) => category.name.toLowerCase() === categoryName.trim().toLowerCase())?.id;
      if (!categoryId) { setCatalogError("That category was not found. Please enter one of the listed category names."); return; }
      await apiRequest(`/catalog/products/${product.id}`, token, { method: "PATCH", body: JSON.stringify({ name, brand, unit, categoryId }) });
    } else {
      if (!window.confirm(`Delete product "${product.name}"? Products used in lists or price history cannot be deleted.`)) return;
      await apiRequest(`/catalog/products/${product.id}`, token, { method: "DELETE" });
    }
    const data = await apiRequest<{ products: CatalogProduct[] }>(`/catalog/products?q=${encodeURIComponent(catalogQuery)}`, token);
    setCatalogProducts(data.products);
  }


  async function managePrice(productId: string, observation: CatalogProduct["priceObservations"][number], action: "edit" | "delete") {
    if (!token) return;
    try {
      if (action === "edit") {
        const rawPrice = window.prompt("Price amount", observation.price);
        if (rawPrice === null || rawPrice.trim() === "") return;
        const price = Number(rawPrice);
        if (!Number.isFinite(price) || price < 0) { setCatalogError("Enter a valid non-negative price."); return; }
        const currency = window.prompt("Currency (3-letter code, e.g. EUR, USD, GBP)", observation.currency);
        if (!currency?.trim()) return;
        await apiRequest(`/catalog/prices/${observation.id}`, token, { method: "PATCH", body: JSON.stringify({ price, currency: currency.trim().toUpperCase() }) });
      } else {
        if (!window.confirm(`Delete the ${observation.price} ${observation.currency} price at ${observation.supermarket.name}?`)) return;
        await apiRequest(`/catalog/prices/${observation.id}`, token, { method: "DELETE" });
      }
      const data = await apiRequest<{ products: CatalogProduct[] }>(`/catalog/products?q=${encodeURIComponent(catalogQuery)}`, token);
      setCatalogProducts(data.products);
    } catch (requestError) {
      setCatalogError(requestError instanceof Error ? requestError.message : "Unable to update this price.");
    }
  }

  async function savePrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !priceProductId || !priceSupermarketId) return;
    setSavingPrice(true);
    setCatalogError("");
    try {
      await apiRequest(`/catalog/products/${priceProductId}/prices`, token, {
        method: "POST",
        body: JSON.stringify({ supermarketId: priceSupermarketId, price: Number(priceValue), currency: priceCurrency, source: "manual-entry" })
      });
      setPriceProductId(null); setPriceValue(""); setPriceCurrency("EUR");
      const data = await apiRequest<{ products: CatalogProduct[] }>(`/catalog/products?q=${encodeURIComponent(catalogQuery)}`, token);
      setCatalogProducts(data.products);
    } catch (requestError) {
      setCatalogError(requestError instanceof Error ? requestError.message : "Unable to save this price.");
    } finally { setSavingPrice(false); }
  }

  async function addCatalogueProductToList(product: CatalogProduct) {
    if (!token || !selectedListId) return;
    setCatalogError("");
    try {
      await apiRequest(`/shopping-lists/${selectedListId}/items`, token, {
        method: "POST",
        body: JSON.stringify({ productId: product.id, quantity: 1 })
      });
      await refreshLists(token);
    } catch (requestError) {
      setCatalogError(requestError instanceof Error ? requestError.message : "Unable to add this product to the list.");
    }
  }

  const visibleLists = lists.filter((list) => filter === "ALL" || list.status === filter);
  const selectedList = lists.find((list) => list.id === selectedListId) ?? null;

  if (checkingSession) {
    return <main className="auth-page"><div className="loading-card">Loading your shopping space…</div></main>;
  }

  if (token && profile) {
    return (
      <main className="app-shell">
        <header className="topbar">
          <a className="brand" href="/"><span className="brand-mark">S</span><span>ShoppingMarket</span></a>
          <nav className="main-nav"><button className={activeView === "lists" ? "active" : ""} onClick={() => setActiveView("lists")}>Shopping lists</button><button className={activeView === "catalog" ? "active" : ""} onClick={() => setActiveView("catalog")}>Product catalogue</button></nav>
          <div className="account-menu"><span>{profile.user.firstName} {profile.user.lastName}</span><button className="text-button" onClick={signOut}>Sign out</button></div>
        </header>
        <section className="dashboard-heading">
          <div><span className="eyebrow">YOUR FAMILY SHOPPING SPACE</span><h1>Let's get <span>shopping.</span></h1><p>{profile.family?.name ?? "Your family"} · shared household lists</p></div>
          <div className="dashboard-stats"><div><strong>{lists.length}</strong><span>Lists</span></div><div><strong>{lists.reduce((sum, list) => sum + list.items.filter((item) => item.status !== "PURCHASED").length, 0)}</strong><span>Items to get</span></div></div>
        </section>
        {error && <div className="global-error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
        <section className={`shopping-layout ${activeView === "catalog" ? "hidden-view" : ""}`}>
          <aside className="lists-panel">
            <div className="panel-heading"><div><span className="preview-kicker">HOUSEHOLD</span><h2>Shopping lists</h2></div><span className="list-count">{lists.length}</span></div>
            <div className="list-filters">
              {(["ALL", "ACTIVE", "COMPLETED"] as const).map((value) => <button key={value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{value === "ALL" ? "All" : value === "ACTIVE" ? "Active" : "Completed"}</button>)}
            </div>
            <div className="list-stack">
              {visibleLists.map((list) => {
                const remaining = list.items.filter((item) => item.status !== "PURCHASED").length;
                return <button key={list.id} className={`list-card ${selectedListId === list.id ? "active" : ""}`} onClick={() => setSelectedListId(list.id)}>
                  <span className="list-card-top"><strong>{list.name}</strong><span className={`list-status ${list.status.toLowerCase()}`}>{list.status === "ACTIVE" ? "Active" : list.status === "COMPLETED" ? "Done" : "Archived"}</span></span>
                  <span className="list-card-bottom"><span>{list.items.length} {list.items.length === 1 ? "item" : "items"}</span><span>{remaining} left</span></span>
                </button>;
              })}
              {visibleLists.length === 0 && <p className="empty-small">{lists.length === 0 ? "Your first list starts here." : "No lists in this view."}</p>}
            </div>
            <form className="create-list-form" onSubmit={createList}>
              <label htmlFor="new-list-name">Create a list</label>
              <div><input id="new-list-name" value={newListName} onChange={(event) => setNewListName(event.target.value)} placeholder="e.g. Weekly groceries" maxLength={100} required /><button type="submit" disabled={creatingList || !newListName.trim()} aria-label="Create shopping list">+</button></div>
            </form>
          </aside>
          <section className="list-detail-panel">
            {selectedList ? <>
              <div className="detail-heading">
                <div><span className="preview-kicker">{selectedList.family.name.toUpperCase()}</span><h2>{selectedList.name}</h2><p>{selectedList.items.length} {selectedList.items.length === 1 ? "item" : "items"} · {selectedList.items.filter((item) => item.status === "PURCHASED").length} purchased</p></div>
                {selectedList.status !== "ARCHIVED" && <button className={selectedList.status === "COMPLETED" ? "secondary-action" : "primary-action"} onClick={() => updateListStatus(selectedList.status === "COMPLETED" ? "ACTIVE" : "COMPLETED")}>{selectedList.status === "COMPLETED" ? "Reopen list" : "Complete list"}</button>}
              </div>
              <div className="progress-track"><span style={{ width: `${selectedList.items.length ? selectedList.items.filter((item) => item.status === "PURCHASED").length / selectedList.items.length * 100 : 0}%` }} /></div>
              {selectedList.items.length > 0 ? <div className="items-list">
                {selectedList.items.map((item) => {
                  return <ShoppingItemRow key={item.id} item={item} token={token} listId={selectedList.id} onChanged={() => refreshLists(token)} onError={setError} />;
                })}
              </div> : <div className="empty-items"><div className="empty-illustration">＋</div><h3>Your list is ready</h3><p>Add your first item below and it will appear here.</p></div>}
              {selectedList.status !== "ARCHIVED" && <form className="add-item-form" onSubmit={addItem}>
                <div className="add-item-title"><span className="preview-kicker">ADD TO YOUR LIST</span><strong>What do you need?</strong></div>
                <div className="add-item-fields"><input value={newItemName} onChange={(event) => setNewItemName(event.target.value)} placeholder="e.g. Whole milk" maxLength={150} required /><input className="add-quantity" type="number" min="0.001" max="9999999.999" step="0.001" value={newItemQuantity} onChange={(event) => setNewItemQuantity(event.target.value)} aria-label="Quantity" required /><button className="primary-action" type="submit" disabled={addingItem || !newItemName.trim()}>{addingItem ? "Adding…" : "Add item"}</button></div>
                <input className="add-notes" value={newItemNotes} onChange={(event) => setNewItemNotes(event.target.value)} placeholder="Optional note, e.g. semi-skimmed" maxLength={500} />
              </form>}
            </> : <div className="empty-dashboard"><div className="empty-illustration">☷</div><h2>Your shopping lists live here</h2><p>Create a list for your household, then add the things you need to buy.</p></div>}
          </section>
        </section>
        {activeView === "catalog" && <section className="catalog-workspace">
          <div className="catalog-heading"><div><span className="eyebrow">PRODUCTS & PRICES</span><h2>Product catalogue</h2><p>Build a shared catalogue and record prices from the supermarkets you use.</p></div><span className="catalog-total">{catalogProducts.length} products</span></div>
          {catalogError && <div className="global-error" role="alert">{catalogError}<button onClick={() => setCatalogError("")}>×</button></div>}
          <section className="category-manager" aria-labelledby="category-manager-title">
            <div className="category-manager-heading"><div><span className="preview-kicker">STEP 1 · ORGANISE YOUR CATALOGUE</span><h3 id="category-manager-title">Product categories</h3><p>Create your categories first. Every catalogue product must belong to one.</p></div><span className="category-count">{catalogCategories.length} {catalogCategories.length === 1 ? "category" : "categories"}</span></div>
            <form className="category-create-form" onSubmit={createCategory}>
              <label className="sr-only" htmlFor="new-category-name">New category name</label>
              <input id="new-category-name" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Enter a category name, e.g. Dairy" maxLength={80} required />
              <button className="primary-action" type="submit" disabled={creatingCategory || !categoryName.trim()}>{creatingCategory ? "Creating…" : "＋ Add category"}</button>
            </form>
            <div className="category-list" aria-live="polite">
              {catalogCategories.length ? catalogCategories.map((category) => <span className={productCategoryId === category.id ? "category-chip selected" : "category-chip"} key={category.id}>{category.name}{productCategoryId === category.id ? " ✓" : ""} <button type="button" onClick={() => manageCategory(category, "edit")}>Edit</button> <button type="button" onClick={() => manageCategory(category, "delete")}>Delete</button></span>) : <p className="category-empty">No categories yet. Add your first category above to get started.</p>}
            </div>
          </section>
          <div className="catalog-tools">
            <form className="catalog-search" onSubmit={(event) => event.preventDefault()}><input value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder="Search by product, brand or barcode…" /><span>⌕</span></form>
            <form className="catalog-create-form" onSubmit={createCatalogProduct}>
              <div className="catalog-form-title"><span className="preview-kicker">ADD TO CATALOGUE</span><strong>New product</strong></div>
              <input value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="Product name" maxLength={150} required />
              <input value={productBrand} onChange={(event) => setProductBrand(event.target.value)} placeholder="Brand (optional)" maxLength={100} />
              <select value={productCategoryId} onChange={(event) => setProductCategoryId(event.target.value)} required disabled={catalogCategories.length === 0}><option value="">Choose a category *</option>{catalogCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
              <div className="catalog-form-row"><input value={productUnit} onChange={(event) => setProductUnit(event.target.value)} placeholder="Unit, e.g. 1 L or 500 g" maxLength={30} /><button className="primary-action" type="submit" disabled={creatingProduct || !productName.trim() || !productCategoryId}>{creatingProduct ? "Saving…" : "Add product"}</button></div>
              {catalogCategories.length === 0 && <p className="catalog-form-hint">Create your first category above before adding products.</p>}
            </form>
            <form className="catalog-create-form supermarket-form" onSubmit={createSupermarket}>
              <div className="catalog-form-title"><span className="preview-kicker">PRICE SOURCES</span><strong>Supermarkets</strong></div>
              <div className="catalog-form-row"><input value={supermarketName} onChange={(event) => setSupermarketName(event.target.value)} placeholder="Supermarket name" maxLength={100} required /><input value={supermarketChain} onChange={(event) => setSupermarketChain(event.target.value)} placeholder="Chain (optional)" maxLength={100} /></div>
              <button className="secondary-action" type="submit" disabled={creatingSupermarket || !supermarketName.trim()}>{creatingSupermarket ? "Saving…" : "Add supermarket"}</button>
              <p>{supermarkets.length} supermarket{supermarkets.length === 1 ? "" : "s"} in your directory</p><div className="directory-list">{supermarkets.map((market) => <div key={market.id}><span><strong>{market.name}</strong>{market.chain ? ` · ${market.chain}` : ""}</span><span><button type="button" onClick={() => manageSupermarket(market, "edit")}>Edit</button><button type="button" onClick={() => manageSupermarket(market, "delete")}>Delete</button></span></div>)}</div>
            </form>
          </div>
          <div className="catalog-results-heading"><h3>Products</h3><span>Latest recorded prices appear under each product.</span></div>
          {catalogLoading ? <div className="empty-dashboard">Loading catalogue…</div> : catalogProducts.length ? <div className="product-grid">{catalogProducts.map((product) => <article className="product-card" key={product.id}>
            <div className="product-card-top"><span className="product-category">{product.category?.name ?? "Uncategorised"}</span><span className="product-unit">{product.unit ?? "Product"}</span></div>
            <h3>{product.name}</h3><p className="product-brand">{product.brand ?? "No brand specified"}</p>
            <div className="product-prices">{product.priceObservations.length ? [...product.priceObservations].sort((a, b) => a.currency === b.currency ? Number(a.price) - Number(b.price) : a.currency.localeCompare(b.currency)).map((observation) => <div key={observation.id}><span>{observation.supermarket.name}</span><strong>{Number(observation.price).toFixed(2)} {observation.currency}</strong><span className="price-management-actions"><button type="button" onClick={() => managePrice(product.id, observation, "edit")}>Edit</button><button type="button" onClick={() => managePrice(product.id, observation, "delete")}>Delete</button></span></div>) : <p>No prices recorded yet.</p>}</div>
            <div className="product-card-actions">{selectedListId && <button className="primary-action" onClick={() => addCatalogueProductToList(product)}>Add to selected list</button>}<button className="secondary-action" onClick={() => manageProduct(product, "edit")}>Edit product</button><button className="secondary-action" onClick={() => manageProduct(product, "delete")}>Delete</button><button className="secondary-action" onClick={() => { setPriceProductId(priceProductId === product.id ? null : product.id); setPriceValue(""); }}>Record a price</button></div>
            {priceProductId === product.id && <form className="record-price-form" onSubmit={savePrice}><strong>Record price at {product.name}</strong><select value={priceSupermarketId} onChange={(event) => setPriceSupermarketId(event.target.value)} required><option value="">Choose supermarket</option>{supermarkets.map((supermarket) => <option key={supermarket.id} value={supermarket.id}>{supermarket.name}{supermarket.chain ? ` · ${supermarket.chain}` : ""}</option>)}</select><div><input type="number" min="0" max="99999999.99" step="0.01" value={priceValue} onChange={(event) => setPriceValue(event.target.value)} placeholder="Price amount" required /><select aria-label="Price currency" value={priceCurrency} onChange={(event) => setPriceCurrency(event.target.value)}><option value="COP">COP $</option><option value="EUR">EUR €</option><option value="USD">USD $</option><option value="GBP">GBP £</option><option value="CHF">CHF</option><option value="CAD">CAD $</option><option value="AUD">AUD $</option></select><button className="primary-action" type="submit" disabled={savingPrice || !priceSupermarketId || priceValue === ""}>{savingPrice ? "Saving…" : "Save price"}</button></div></form>}
          </article>)}</div> : <div className="empty-dashboard"><div className="empty-illustration">⌕</div><h2>No products found</h2><p>Add your first product using the form above, or try another search.</p></div>}
        </section>}
        <footer className="app-footer"><span>ShoppingMarket</span><span>Shared lists for better everyday shopping.</span></footer>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <header className="auth-topbar"><a className="brand" href="/"><span className="brand-mark">S</span><span>ShoppingMarket</span></a><span className="topbar-note">A smarter way to shop together</span></header>
      <section className="auth-layout">
        <div className="auth-intro"><span className="eyebrow">YOUR FAMILY SHOPPING SPACE</span><h1>Good shopping starts <span>together.</span></h1><p>One shared space for your household shopping. Start with your account, create your family, and build better shopping habits together.</p><div className="auth-benefits"><div><span>01</span><p>Keep everyone's shopping in one place.</p></div><div><span>02</span><p>Organise products and household essentials.</p></div><div><span>03</span><p>Compare supermarket prices as you go.</p></div></div></div>
        <div className="auth-card">
          <div className="auth-card-heading"><span className="preview-kicker">{mode === "register" ? "GET STARTED" : "WELCOME BACK"}</span><h2>{mode === "register" ? "Create your account" : "Sign in"}</h2><p>{mode === "register" ? "Set up your profile and your family space." : "Sign in to continue to your family shopping space."}</p></div>
          <div className="auth-tabs"><button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Create account</button><button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Sign in</button></div>
          <form onSubmit={handleSubmit}>
            {mode === "register" && <><div className="form-row"><label>First name<input autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Your first name" required /></label><label>Last name<input autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Your last name" required /></label></div><label>Family name<input autoComplete="organization" value={familyName} onChange={(event) => setFamilyName(event.target.value)} placeholder="e.g. The Smiths" required /></label></>}
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
