import { useCallback, useEffect, useState, type FormEvent } from "react";

const API_URL = "http://localhost:5005/api";

type User = { id: string; email: string; firstName: string; lastName: string };
type Family = { id: string; name: string; role: string } | null;
type Profile = { user: User; family: Family };
type ProductSummary = { id: string; name: string; brand: string | null } | null;
type CatalogProduct = { id: string; name: string; brand: string | null; barcode: string | null; description: string | null; categoryId: string | null; quantity: string | null; unit: string | null; category: { id: string; name: string } | null; priceObservations: { id: string; productId: string; price: string; currency: string; observedAt: string; source: string | null; supermarket: { id: string; name: string; chain: string | null } }[] };
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
type EditableEntity = { type: "category" | "supermarket" | "product" | "price" | "list"; id: string };

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
  const [status, setStatus] = useState<Item["status"]>(item.status);
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
        body: JSON.stringify({ name, quantity: Number(quantity), notes, status })
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
          <select aria-label={`Status of ${displayName}`} value={status} onChange={(event) => { setStatus(event.target.value as Item["status"]); setDirty(true); }}><option value="TO_BUY">To buy</option><option value="IN_CART">In cart</option><option value="PURCHASED">Purchased</option><option value="UNAVAILABLE">Unavailable</option></select>
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
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [expandedPriceProductId, setExpandedPriceProductId] = useState<string | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [supermarkets, setSupermarkets] = useState<Supermarket[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [editingEntity, setEditingEntity] = useState<EditableEntity | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [productName, setProductName] = useState("");
  const [productBrand, setProductBrand] = useState("");
  const [productBarcode, setProductBarcode] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productQuantity, setProductQuantity] = useState("");
  const [productCategoryId, setProductCategoryId] = useState("");
  const [productUnit, setProductUnit] = useState("");
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [supermarketName, setSupermarketName] = useState("");
  const [supermarketChain, setSupermarketChain] = useState("");
  const [supermarketWebsite, setSupermarketWebsite] = useState("");
  const [creatingSupermarket, setCreatingSupermarket] = useState(false);
  const [priceProductId, setPriceProductId] = useState<string | null>(null);
  const [priceValue, setPriceValue] = useState("");
  const [priceSupermarketId, setPriceSupermarketId] = useState("");
  const [priceCurrency, setPriceCurrency] = useState("COP");
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

  function editSelectedList() {
    if (!selectedList) return;
    beginEdit("list", selectedList.id, { name: selectedList.name, status: selectedList.status, dueAt: selectedList.dueAt ? new Date(selectedList.dueAt).toISOString().slice(0, 16) : "" });
  }

  async function deleteSelectedList() {
    if (!token || !selectedList) return;
    if (!window.confirm(`Delete "${selectedList.name}" and all its items? This cannot be undone.`)) return;
    setError("");
    try {
      await apiRequest(`/shopping-lists/${selectedList.id}`, token, { method: "DELETE" });
      await refreshLists(token);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to delete this list.");
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

  async function saveCatalogProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!token) return; setCreatingProduct(true); setCatalogError("");
    try { const body=JSON.stringify({name:productName,brand:productBrand||null,barcode:productBarcode||null,description:productDescription||null,categoryId:productCategoryId||null,unit:productUnit||null,quantity:productQuantity===""?null:Number(productQuantity)});
      if(editingEntity?.type==="product") await apiRequest(`/catalog/products/${editingEntity.id}`,token,{method:"PATCH",body}); else await apiRequest("/catalog/products",token,{method:"POST",body});
      setProductName("");setProductBrand("");setProductBarcode("");setProductDescription("");setProductCategoryId("");setProductUnit("");setProductQuantity("");setEditingEntity(null);
      const data=await apiRequest<{products:CatalogProduct[]}>(`/catalog/products?q=${encodeURIComponent(catalogQuery)}`,token);setCatalogProducts(data.products);
    } catch(e){setCatalogError(e instanceof Error?e.message:"Unable to save the product.");}finally{setCreatingProduct(false);}
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();if(!token)return;setCreatingCategory(true);setCatalogError("");
    try { if(editingEntity?.type==="category") await apiRequest(`/catalog/categories/${editingEntity.id}`,token,{method:"PATCH",body:JSON.stringify({name:categoryName})});
      else {const result=await apiRequest<{category:CatalogCategory}>("/catalog/categories",token,{method:"POST",body:JSON.stringify({name:categoryName})});setProductCategoryId(result.category.id);}
      const data=await apiRequest<{categories:CatalogCategory[]}>("/catalog/categories",token);setCatalogCategories(data.categories);setCategoryName("");setEditingEntity(null);
    }catch(e){setCatalogError(e instanceof Error?e.message:"Unable to save the category.");}finally{setCreatingCategory(false);}
  }

  async function saveSupermarket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();if(!token)return;setCreatingSupermarket(true);setCatalogError("");
    try {const body=JSON.stringify({name:supermarketName,chain:supermarketChain||null,website:supermarketWebsite||null});
      if(editingEntity?.type==="supermarket") await apiRequest(`/catalog/supermarkets/${editingEntity.id}`,token,{method:"PATCH",body});
      else {const result=await apiRequest<{supermarket:Supermarket}>("/catalog/supermarkets",token,{method:"POST",body});setPriceSupermarketId(result.supermarket.id);}
      const data=await apiRequest<{supermarkets:Supermarket[]}>("/catalog/supermarkets",token);setSupermarkets(data.supermarkets);setSupermarketName("");setSupermarketChain("");setSupermarketWebsite("");setEditingEntity(null);
    }catch(e){setCatalogError(e instanceof Error?e.message:"Unable to save the supermarket.");}finally{setCreatingSupermarket(false);}
  }


  function beginEdit(type: EditableEntity["type"], id: string, values: Record<string, string>) {
    setEditingEntity({ type, id });
    setEditValues(values);
    setCatalogError("");
    setError("");
  }

  function updateEditField(field: string, value: string) {
    setEditValues((current) => ({ ...current, [field]: value }));
  }

  function cancelEdit() {
    setEditingEntity(null);
    setEditValues({});
  }

  async function saveInlineEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || editingEntity?.type !== "list") return;
    setSavingEdit(true); setError("");
    try {
      await apiRequest(`/shopping-lists/${editingEntity.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          name: editValues.name,
          status: editValues.status,
          dueAt: editValues.dueAt ? new Date(editValues.dueAt).toISOString() : null
        })
      });
      cancelEdit();
      await refreshLists(token);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to save this list.");
    } finally { setSavingEdit(false); }
  }


  function clearCatalogueFormValues() {
    setCategoryName("");
    setProductName(""); setProductBrand(""); setProductBarcode(""); setProductDescription(""); setProductCategoryId(""); setProductUnit(""); setProductQuantity("");
    setSupermarketName(""); setSupermarketChain(""); setSupermarketWebsite("");
    setPriceProductId(null); setPriceValue(""); setPriceCurrency("COP");
  }

  async function manageCategory(category: CatalogCategory, action: "edit" | "delete") {
    if (!token) return;
    if (action === "edit") {
      clearCatalogueFormValues();setEditingEntity({type:"category",id:category.id});setCategoryName(category.name);setCatalogError("");
      return;
    }
    if (!window.confirm(`Delete category "${category.name}"?`)) return;
    try {
      await apiRequest(`/catalog/categories/${category.id}`, token, { method: "DELETE" });
      if (productCategoryId === category.id) setProductCategoryId("");
      const data = await apiRequest<{ categories: CatalogCategory[] }>("/catalog/categories", token);
      setCatalogCategories(data.categories);
    } catch (requestError) {
      setCatalogError(requestError instanceof Error ? requestError.message : "Unable to delete this category.");
    }
  }

  async function manageSupermarket(supermarket: Supermarket, action: "edit" | "delete") {
    if (!token) return;
    if (action === "edit") {
      clearCatalogueFormValues();setEditingEntity({type:"supermarket",id:supermarket.id});setSupermarketName(supermarket.name);setSupermarketChain(supermarket.chain??"");setSupermarketWebsite(supermarket.website??"");setCatalogError("");
      return;
    }
    if (!window.confirm(`Delete supermarket "${supermarket.name}"? This is only possible when it has no offers or price history.`)) return;
    try {
      await apiRequest(`/catalog/supermarkets/${supermarket.id}`, token, { method: "DELETE" });
      const data = await apiRequest<{ supermarkets: Supermarket[] }>("/catalog/supermarkets", token);
      setSupermarkets(data.supermarkets);
      if (priceSupermarketId === supermarket.id) setPriceSupermarketId(data.supermarkets[0]?.id ?? "");
    } catch (requestError) {
      setCatalogError(requestError instanceof Error ? requestError.message : "Unable to delete this supermarket.");
    }
  }

  async function manageProduct(product: CatalogProduct, action: "edit" | "delete") {
    if (!token) return;
    if (action === "edit") {
      clearCatalogueFormValues();setEditingEntity({type:"product",id:product.id});setProductName(product.name);setProductBrand(product.brand??"");setProductBarcode(product.barcode??"");setProductDescription(product.description??"");setProductCategoryId(product.categoryId??product.category?.id??"");setProductUnit(product.unit??"");setProductQuantity(product.quantity??"");setCatalogError("");
      return;
    }
    if (!window.confirm(`Delete product "${product.name}"? Products used in lists or price history cannot be deleted.`)) return;
    try {
      await apiRequest(`/catalog/products/${product.id}`, token, { method: "DELETE" });
      const data = await apiRequest<{ products: CatalogProduct[] }>(`/catalog/products?q=${encodeURIComponent(catalogQuery)}`, token);
      setCatalogProducts(data.products);
    } catch (requestError) {
      setCatalogError(requestError instanceof Error ? requestError.message : "Unable to delete this product.");
    }
  }

  async function managePrice(observation: CatalogProduct["priceObservations"][number], action: "edit" | "delete") {
    if (!token) return;
    if (action === "edit") {
      clearCatalogueFormValues();setEditingEntity({type:"price",id:observation.id});setPriceProductId(observation.productId);setPriceValue(observation.price);setPriceCurrency(observation.currency);setPriceSupermarketId(observation.supermarket.id);setCatalogError("");
      return;
    }
    if (!window.confirm(`Delete the ${observation.price} ${observation.currency} price at ${observation.supermarket.name}?`)) return;
    try {
      await apiRequest(`/catalog/prices/${observation.id}`, token, { method: "DELETE" });
      const data = await apiRequest<{ products: CatalogProduct[] }>(`/catalog/products?q=${encodeURIComponent(catalogQuery)}`, token);
      setCatalogProducts(data.products);
    } catch (requestError) {
      setCatalogError(requestError instanceof Error ? requestError.message : "Unable to delete this price.");
    }
  }

  async function savePrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();if(!token||!priceProductId||!priceSupermarketId)return;setSavingPrice(true);setCatalogError("");
    try {if(editingEntity?.type==="price") await apiRequest(`/catalog/prices/${editingEntity.id}`,token,{method:"PATCH",body:JSON.stringify({price:Number(priceValue),currency:priceCurrency,supermarketId:priceSupermarketId})});
      else await apiRequest(`/catalog/products/${priceProductId}/prices`,token,{method:"POST",body:JSON.stringify({supermarketId:priceSupermarketId,price:Number(priceValue),currency:priceCurrency,source:"manual-entry"})});
      setPriceProductId(null);setPriceValue("");setPriceCurrency("COP");setEditingEntity(null);
      const data=await apiRequest<{products:CatalogProduct[]}>(`/catalog/products?q=${encodeURIComponent(catalogQuery)}`,token);setCatalogProducts(data.products);
    }catch(e){setCatalogError(e instanceof Error?e.message:"Unable to save this price.");}finally{setSavingPrice(false);}
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
  const visibleCatalogProducts = catalogProducts.filter((product) => categoryFilter === "ALL" || product.category?.id === categoryFilter);

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
                {editingEntity?.type === "list" && editingEntity.id === selectedList.id ? <form className="inline-edit-form list-inline-edit" onSubmit={saveInlineEdit}>
                  <label>List name<input value={editValues.name ?? ""} onChange={(event) => updateEditField("name", event.target.value)} maxLength={100} required /></label>
                  <label>Status<select value={editValues.status ?? "ACTIVE"} onChange={(event) => updateEditField("status", event.target.value)}><option value="ACTIVE">Active</option><option value="COMPLETED">Completed</option><option value="ARCHIVED">Archived</option></select></label>
                  <label>Due date<input type="datetime-local" value={editValues.dueAt ?? ""} onChange={(event) => updateEditField("dueAt", event.target.value)} /></label>
                  <div className="inline-edit-actions"><button className="primary-action" type="submit" disabled={savingEdit}>{savingEdit ? "Saving…" : "Save changes"}</button><button className="secondary-action" type="button" onClick={cancelEdit}>Cancel</button></div>
                </form> : <div><span className="preview-kicker">{selectedList.family.name.toUpperCase()}</span><h2>{selectedList.name}</h2><p>{selectedList.items.length} {selectedList.items.length === 1 ? "item" : "items"} · {selectedList.items.filter((item) => item.status === "PURCHASED").length} purchased</p></div>}
                <div className="list-management-actions">
                  {!(editingEntity?.type === "list" && editingEntity.id === selectedList.id) && <button className="secondary-action" type="button" onClick={editSelectedList}>Edit list</button>}
                  <button className="secondary-action" type="button" onClick={deleteSelectedList}>Delete list</button>
                  {selectedList.status !== "ARCHIVED" && <button className={selectedList.status === "COMPLETED" ? "secondary-action" : "primary-action"} onClick={() => updateListStatus(selectedList.status === "COMPLETED" ? "ACTIVE" : "COMPLETED")}>{selectedList.status === "COMPLETED" ? "Reopen list" : "Complete list"}</button>}
                </div>
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
            <form className="category-create-form" onSubmit={saveCategory}>
              <label className="sr-only" htmlFor="new-category-name">New category name</label>
              <input id="new-category-name" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Enter a category name, e.g. Dairy" maxLength={80} required />
              
              <button className="primary-action" type="submit" disabled={creatingCategory || !categoryName.trim()}>{creatingCategory ? "Saving…" : editingEntity?.type === "category" ? "Save changes" : "＋ Add category"}</button>
              {editingEntity?.type === "category" && <button type="button" className="secondary-action" onClick={() => {setEditingEntity(null);setCategoryName("");}}>Cancel</button>}
            </form>
            <div className="category-list" aria-live="polite">
              {catalogCategories.length ? catalogCategories.map((category) => <div className="category-edit-card" key={category.id}><span className={productCategoryId===category.id?"category-chip selected":"category-chip"}>{category.name}{productCategoryId===category.id?" ✓":""}</span><button type="button" onClick={()=>manageCategory(category,"edit")}>Edit</button><button type="button" onClick={()=>manageCategory(category,"delete")}>Delete</button></div>) : <p className="category-empty">No categories yet. Add your first category above to get started.</p>}
            </div>
          </section>
          <div className="catalog-tools">
            <form className="catalog-search" onSubmit={(event) => event.preventDefault()}><input value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder="Search by product, brand or barcode…" /><span>⌕</span></form>
            <form className="catalog-create-form" onSubmit={saveCatalogProduct}>
              <div className="catalog-form-title"><span className="preview-kicker">ADD TO CATALOGUE</span><strong>{editingEntity?.type === "product" ? "Edit product" : "New product"}</strong></div>
              <input value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="Product name" maxLength={150} required />
              <input value={productBrand} onChange={(event) => setProductBrand(event.target.value)} placeholder="Brand (optional)" maxLength={100} />
              <input value={productBarcode} onChange={(event) => setProductBarcode(event.target.value)} placeholder="Barcode (optional)" maxLength={64} />
              <textarea value={productDescription} onChange={(event) => setProductDescription(event.target.value)} placeholder="Description (optional)" maxLength={1000} rows={2} />
              <select value={productCategoryId} onChange={(event) => setProductCategoryId(event.target.value)} required disabled={catalogCategories.length === 0}><option value="">Choose a category *</option>{catalogCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
              <div className="catalog-form-row"><input value={productUnit} onChange={(event) => setProductUnit(event.target.value)} placeholder="Unit (e.g. bottle, pack)" maxLength={30} /><input type="number" min="0.001" max="9999999.999" step="0.001" value={productQuantity} onChange={(event) => setProductQuantity(event.target.value)} placeholder="Pack quantity" /><button className="primary-action" type="submit" disabled={creatingProduct || !productName.trim() || !productCategoryId}>{creatingProduct ? "Saving…" : editingEntity?.type === "product" ? "Save changes" : "Add product"}</button></div>
              {editingEntity?.type === "product" && <button type="button" className="secondary-action" onClick={() => {setEditingEntity(null);setProductName("");setProductBrand("");setProductBarcode("");setProductDescription("");setProductCategoryId("");setProductUnit("");setProductQuantity("");}}>Cancel</button>}
              {catalogCategories.length === 0 && <p className="catalog-form-hint">Create your first category above before adding products.</p>}
            </form>
            <section className="catalog-create-form supermarket-form">
              <div className="catalog-form-title"><span className="preview-kicker">PRICE SOURCES</span><strong>{editingEntity?.type === "supermarket" ? "Edit supermarket" : "Supermarkets"}</strong></div>
              <form className="supermarket-create-fields" onSubmit={saveSupermarket}>
              <div className="catalog-form-row"><input value={supermarketName} onChange={(event) => setSupermarketName(event.target.value)} placeholder="Supermarket name" maxLength={100} required /><input value={supermarketChain} onChange={(event) => setSupermarketChain(event.target.value)} placeholder="Chain (optional)" maxLength={100} /></div>
              <input type="url" value={supermarketWebsite} onChange={(event) => setSupermarketWebsite(event.target.value)} placeholder="Website URL (optional, https://…)" maxLength={300} />
              <button className="secondary-action" type="submit" disabled={creatingSupermarket || !supermarketName.trim()}>{creatingSupermarket ? "Saving…" : editingEntity?.type === "supermarket" ? "Save changes" : "Add supermarket"}</button>
                {editingEntity?.type === "supermarket" && <button type="button" className="secondary-action" onClick={() => {setEditingEntity(null);setSupermarketName("");setSupermarketChain("");setSupermarketWebsite("");}}>Cancel</button>}
              </form>
              <p>{supermarkets.length} supermarket{supermarkets.length === 1 ? "" : "s"} in your directory</p><div className="directory-list">{supermarkets.map((market) => <div className="directory-entry" key={market.id}>
<span><strong>{market.name}</strong>{market.chain?` · ${market.chain}`:""}{market.website?<a href={market.website} target="_blank" rel="noreferrer"> · Website</a>:""}</span><span><button type="button" onClick={()=>manageSupermarket(market,"edit")}>Edit</button><button type="button" onClick={()=>manageSupermarket(market,"delete")}>Delete</button></span>
              </div>)}</div>
            </section>
          </div>
          <div className="catalog-results-toolbar">
            <div className="catalog-results-heading"><h3>Products</h3><span>{visibleCatalogProducts.length} shown · {catalogProducts.length} total</span></div>
            <label className="category-filter"><span>Filter by category</span><select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setExpandedPriceProductId(null); }}><option value="ALL">All categories</option>{catalogCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          </div>
          {catalogLoading ? <div className="empty-dashboard">Loading catalogue…</div> : visibleCatalogProducts.length ? <div className="product-directory">{visibleCatalogProducts.map((product) => <article className={expandedPriceProductId === product.id ? "product-row expanded" : "product-row"} key={product.id}>
            <div className="product-row-main">
              <div className="product-row-identity"><span className="product-category">{product.category?.name??"Uncategorised"}</span><h3>{product.name}</h3><p>{product.brand??"No brand"}{product.unit?` · ${product.unit}`:""}{product.quantity?` · ${product.quantity} ${product.unit??"units"}`:""}</p></div><div className="product-row-summary"><span>{product.priceObservations.length} {product.priceObservations.length===1?"supermarket price":"supermarket prices"}</span><strong>{product.priceObservations.length?`${product.priceObservations.length} recorded`:"No prices yet"}</strong></div><div className="product-row-actions"><button className="primary-action" type="button" onClick={()=>setExpandedPriceProductId(expandedPriceProductId===product.id?null:product.id)}>{expandedPriceProductId===product.id?"Hide prices":"Manage prices"}</button><button className="secondary-action" type="button" onClick={()=>manageProduct(product,"edit")}>Edit</button><button className="secondary-action" type="button" onClick={()=>manageProduct(product,"delete")}>Delete</button>{selectedListId&&<button className="secondary-action" type="button" onClick={()=>addCatalogueProductToList(product)}>Add to list</button>}</div>
            </div>
            {expandedPriceProductId === product.id && <div className="product-price-management">
              <div className="product-price-heading"><div><strong>Supermarket prices</strong><span>Latest recorded price at each supermarket</span></div><button className="secondary-action" type="button" onClick={() => { clearCatalogueFormValues(); setEditingEntity(null); setPriceProductId(product.id); setPriceSupermarketId(supermarkets[0]?.id ?? ""); }}>＋ Record a price</button></div>
              <div className="product-prices">{product.priceObservations.length ? [...product.priceObservations].sort((a, b) => a.currency === b.currency ? Number(a.price) - Number(b.price) : a.currency.localeCompare(b.currency)).map((observation) => <div className="price-entry" key={observation.id}>
<span>{observation.supermarket.name}</span><strong>{Number(observation.price).toFixed(2)} {observation.currency}</strong><span className="price-management-actions"><button type="button" onClick={()=>managePrice({...observation,productId:product.id},"edit")}>Edit</button><button type="button" onClick={()=>managePrice(observation,"delete")}>Delete</button></span>
              </div>) : <p>No prices recorded yet. Add the first supermarket price.</p>}</div>
              {priceProductId === product.id && <form className="record-price-form" onSubmit={savePrice}><strong>{editingEntity?.type === "price" ? "Edit price" : "Record price at " + product.name}</strong><select value={priceSupermarketId} onChange={(event) => setPriceSupermarketId(event.target.value)} required><option value="">Choose supermarket</option>{supermarkets.map((supermarket) => <option key={supermarket.id} value={supermarket.id}>{supermarket.name}{supermarket.chain ? ` · ${supermarket.chain}` : ""}</option>)}</select><div><input type="number" min="0" max="99999999.99" step="0.01" value={priceValue} onChange={(event) => setPriceValue(event.target.value)} placeholder="Price amount" required /><select aria-label="Price currency" value={priceCurrency} onChange={(event) => setPriceCurrency(event.target.value)}><option value="COP">COP $</option><option value="EUR">EUR €</option><option value="USD">USD $</option><option value="GBP">GBP £</option><option value="CHF">CHF</option><option value="CAD">CAD $</option><option value="AUD">AUD $</option></select><button className="primary-action" type="submit" disabled={savingPrice || !priceSupermarketId || priceValue === ""}>{savingPrice ? "Saving…" : editingEntity?.type === "price" ? "Save changes" : "Save price"}</button>{editingEntity?.type === "price" && <button type="button" className="secondary-action" onClick={() => {setEditingEntity(null);setPriceProductId(null);setPriceValue("");setPriceCurrency("COP");}}>Cancel</button>}</div></form>}
            </div>}
          </article>)}</div> : <div className="empty-dashboard"><div className="empty-illustration">⌕</div><h2>{catalogProducts.length ? "No products in this category" : "No products found"}</h2><p>{catalogProducts.length ? "Choose another category or select All categories." : "Add your first product using the form above, or try another search."}</p></div>}
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
