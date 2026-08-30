import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Search, ShoppingCart, ChevronRight, Check, Lock, Trash2, Plus, Minus, MessageCircle, Star, Upload, X as XIcon, AlertCircle } from "lucide-react";

/* ================= DATA / CONSTANTS ================= */

const CATEGORIES = {
  Samsung: ["Samsung Galaxy"],
  iPhone: ["iPhone"],
  Motorola: ["Motorola"],
};

/* MANNI-approved catalog — 25 products. Deposit and Weekly figures are exact,
   admin-entered figures and must never be recalculated by the financing calculator. */
const DURATION = "12 weeks / 3 months";
function mp(id, brand, category, name, storage, deposit, weekly, opts = {}) {
  return {
    id, brand, category, name, storage,
    ram: "", display: "", camera: "", frontCamera: "", battery: "", network: "",
    condition: "Used — Grade A", color: "",
    cash: null, deposit, weekly, duration: DURATION,
    stock: opts.stock ?? 5, images: [], desc: opts.desc || "",
    featured: !!opts.featured, bestSeller: !!opts.bestSeller, newArrival: !!opts.newArrival,
    limitedStock: !!opts.limitedStock, onSale: false, active: true,
  };
}
const seedProducts = [
  // SAMSUNG — category "Samsung Galaxy"
  mp("p1", "Samsung", "Samsung Galaxy", "Galaxy S25 Ultra", "256GB", 40299, 3270, { featured: true }),
  mp("p2", "Samsung", "Samsung Galaxy", "Galaxy S24 Ultra", "256GB", 33199, 2700, { featured: true }),
  mp("p3", "Samsung", "Samsung Galaxy", "Galaxy S23 Ultra", "256GB", 26199, 2130, { featured: true, bestSeller: true }),
  mp("p4", "Samsung", "Samsung Galaxy", "Galaxy S22 Ultra", "256GB", 22699, 1850, { featured: true }),
  mp("p5", "Samsung", "Samsung Galaxy", "Galaxy Note 20 Ultra 5G", "128GB", 11699, 1520),
  mp("p6", "Samsung", "Samsung Galaxy", "Galaxy S21 Ultra 5G", "128GB", 11499, 1490),
  mp("p7", "Samsung", "Samsung Galaxy", "Galaxy S22+", "128GB", 10499, 1360),
  mp("p8", "Samsung", "Samsung Galaxy", "Galaxy S21+ 5G", "256GB", 10199, 1320),
  mp("p9", "Samsung", "Samsung Galaxy", "Galaxy S20 Ultra 5G", "128GB", 8999, 1160),
  mp("p10", "Samsung", "Samsung Galaxy", "Galaxy S21+ 5G", "128GB", 8499, 1110),
  mp("p11", "Samsung", "Samsung Galaxy", "Galaxy Note 20 5G", "128GB", 8499, 1100),
  mp("p12", "Samsung", "Samsung Galaxy", "Galaxy S20+ 5G", "128GB", 7199, 940),
  mp("p13", "Samsung", "Samsung Galaxy", "Galaxy A42 5G", "128GB", 5599, 730),
  // MOTOROLA
  mp("p14", "Motorola", "Motorola", "Moto G Stylus", "128GB", 6599, 850),
  mp("p15", "Motorola", "Motorola", "Moto G Power", "128GB", 4299, 560),
  // APPLE — category "iPhone"
  mp("p16", "iPhone", "iPhone", "iPhone 15 Pro Max", "256GB", 36699, 2990, { featured: true, bestSeller: true }),
  mp("p17", "iPhone", "iPhone", "iPhone 14 Pro Max", "512GB", 29699, 2420, { featured: true }),
  mp("p18", "iPhone", "iPhone", "iPhone 14 Pro Max", "256GB", 28999, 2360, { featured: true }),
  mp("p19", "iPhone", "iPhone", "iPhone 13 Pro Max", "256GB", 25199, 2050, { featured: true, bestSeller: true }),
  mp("p20", "iPhone", "iPhone", "iPhone 12", "128GB", 11899, 1540),
  mp("p21", "iPhone", "iPhone", "iPhone 12", "256GB", 18199, 1480),
  mp("p22", "iPhone", "iPhone", "iPhone 12 Mini", "128GB", 11399, 1470),
  mp("p23", "iPhone", "iPhone", "iPhone 11", "128GB", 8999, 1160),
  mp("p24", "iPhone", "iPhone", "iPhone 12 Pro Max", "256GB", 24099, 1960),
  mp("p25", "iPhone", "iPhone", "iPhone 16 Pro Max", "256GB", 47199, 3840, { newArrival: true, featured: true }),
];
const MANNI_SIGNATURE_NAMES = [
  "Galaxy S25 Ultra|256GB", "Galaxy S24 Ultra|256GB", "Galaxy S23 Ultra|256GB",
  "iPhone 15 Pro Max|256GB", "iPhone 14 Pro Max|512GB", "iPhone 14 Pro Max|256GB", "iPhone 13 Pro Max|256GB",
];

const seedTestimonials = [
  { name: "Wanjiru K.", review: "Got my S23 Ultra through Lipa Polepole — the deposit and weekly figures matched exactly what the site showed, no surprises.", rating: 5, product: "Galaxy S23 Ultra" },
  { name: "Brian O.", review: "Compared a few iPhone 12 options before deciding. Staff were patient and didn't push me toward the pricier one.", rating: 5, product: "iPhone 12" },
  { name: "Amina H.", review: "Weekly payments landed on the day agreed, every time. Made budgeting for the phone easy.", rating: 4, product: "iPhone 13 Pro Max" },
];

const seedSettings = { businessName: "MANNI Luxury Phones", whatsapp: "254114467792", email: "hello@manniluxuryphones.co.ke", location: "Nairobi, Kenya", adminPassword: "manni-admin" };

const fmt = (n) => `KES ${Number(n || 0).toLocaleString()}`;
function calcFinancing(cash) {
  const deposit = Math.round(cash * 0.4);
  const financeAmount = cash - deposit;
  const weekly3 = Math.round((financeAmount * 1.5) / 12);
  const weekly6 = Math.round((financeAmount * 1.8) / 24);
  return { deposit, financeAmount, weekly3, weekly6 };
}
function waLink(number, text) { return `https://wa.me/${number}?text=${encodeURIComponent(text)}`; }

// When a cash price hasn't been entered yet, the deposit is the amount due today —
// used consistently for cart totals, sorting and filtering so nothing breaks on null cash.
function priceMetric(p) { return p.cash != null ? p.cash : (p.deposit != null ? p.deposit : 0); }
function priceLabel(p) { return p.cash != null ? "Cash Price" : "Deposit"; }
function na(v) { return v === null || v === undefined || v === "" ? "Not specified" : v; }

/* ================= STORAGE LAYER =================
   IMPORTANT: this uses browser localStorage, which is PER-DEVICE, not shared.
   Editing products in Admin only updates the catalog on the browser/device you're
   using — it does NOT change what other visitors see. To update the catalog for
   everyone, edit the `seedProducts` array above and redeploy (push to GitHub). */
const STORAGE_PREFIX = "manni_";
async function storageLoad(key, fallback) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
async function storageSave(key, value) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/* ================= REVEAL ON SCROLL ================= */
function Reveal({ children, delay = 0 }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { setShown(true); io.disconnect(); }
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{
      opacity: shown ? 1 : 0,
      transform: shown ? "translateY(0)" : "translateY(22px)",
      transition: `opacity .7s ease ${delay}ms, transform .7s ease ${delay}ms`,
    }}>{children}</div>
  );
}

/* ================= PHONE GLYPH (dramatic, layered) ================= */
function PhoneGlyph({ size = 44, glow = false }) {
  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      {glow && <div style={{ position: "absolute", inset: -30, background: "radial-gradient(circle, rgba(212,175,55,0.22), transparent 70%)", filter: "blur(6px)", zIndex: 0 }} />}
      <svg width={size} height={size * 1.9} viewBox="0 0 60 114" fill="none" style={{ position: "relative", zIndex: 1 }}>
        <defs>
          <linearGradient id={`body-${size}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1c1c1c" />
            <stop offset="55%" stopColor="#0c0c0c" />
            <stop offset="100%" stopColor="#000" />
          </linearGradient>
          <linearGradient id={`edge-${size}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F0DFA0" />
            <stop offset="30%" stopColor="#D4AF37" />
            <stop offset="60%" stopColor="#8a6d1f" />
            <stop offset="100%" stopColor="#D4AF37" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="56" height="110" rx="13" fill={`url(#body-${size})`} stroke={`url(#edge-${size})`} strokeWidth="1.6" />
        <rect x="10" y="12" width="40" height="72" rx="3" fill="#050505" stroke="rgba(212,175,55,0.25)" strokeWidth="0.6" />
        <rect x="24" y="6" width="12" height="2.4" rx="1.2" fill="#D4AF37" opacity="0.5" />
        <circle cx="30" cy="100" r="3.2" fill="none" stroke="#D4AF37" strokeWidth="1.4" opacity="0.7" />
        <rect x="14" y="18" width="12" height="12" rx="3" fill="#111" stroke="rgba(212,175,55,0.3)" strokeWidth="0.5" />
      </svg>
    </div>
  );
}

function ProductThumb({ p, size = 70 }) {
  if (p.images && p.images.length > 0) {
    return <img src={p.images[0]} alt={p.name} loading="lazy" className="thumb-img" style={{ width: "100%", height: size * 1.4, objectFit: "cover" }} />;
  }
  return <div style={{ display: "flex", justifyContent: "center" }}><PhoneGlyph size={size} /></div>;
}

/* ================= GLOBAL STYLE ================= */
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');

    .manni {
      background:#000; color:#F5F5F5; font-family:'Inter', -apple-system, sans-serif; min-height:100vh;
      background-image:
        radial-gradient(ellipse 900px 500px at 15% -5%, rgba(212,175,55,0.05), transparent 60%),
        radial-gradient(ellipse 700px 500px at 100% 20%, rgba(212,175,55,0.035), transparent 55%);
      background-attachment: fixed;
    }
    .manni .display { font-family:'Poppins', sans-serif; letter-spacing:-0.005em; }
    .manni .gold { color:#D4AF37; }
    .manni .gold-metal {
      background: linear-gradient(120deg, #efd98e 0%, #D4AF37 28%, #8a6d1f 48%, #D4AF37 70%, #f3e3a8 100%);
      -webkit-background-clip: text; background-clip: text; color: transparent;
    }
    .manni .eyebrow { font-size:11.5px; letter-spacing:0.24em; color:#D4AF37; text-transform:uppercase; }
    .manni .btn-gold {
      position:relative; background:linear-gradient(135deg,#efd98e,#D4AF37 45%,#b8933f);
      color:#000; font-weight:600; border:none; padding:15px 30px; cursor:pointer;
      letter-spacing:0.05em; font-size:13.5px; transition: transform .25s ease, box-shadow .25s ease;
      box-shadow: 0 0 0 rgba(212,175,55,0);
    }
    .manni .btn-gold:hover { transform:translateY(-2px); box-shadow: 0 10px 30px -8px rgba(212,175,55,0.55); }
    .manni .btn-gold:disabled { opacity:0.4; cursor:not-allowed; transform:none; box-shadow:none; }
    .manni .btn-outline {
      background:rgba(255,255,255,0.02); color:#F5F5F5; border:1px solid rgba(212,175,55,0.4);
      padding:15px 30px; cursor:pointer; letter-spacing:0.05em; font-size:13.5px;
      transition: border-color .25s, background .25s, transform .25s;
    }
    .manni .btn-outline:hover { border-color:#D4AF37; background:rgba(212,175,55,0.08); transform:translateY(-2px); }
    .manni .card {
      background: linear-gradient(160deg, #131313, #0b0b0b);
      border:1px solid #1e1e1e; transition: border-color .3s ease, transform .3s ease, box-shadow .3s ease;
    }
    .manni .card:hover { border-color: rgba(212,175,55,0.55); transform:translateY(-3px); box-shadow: 0 20px 40px -22px rgba(0,0,0,0.8); }
    .manni .card:hover .thumb-img { transform: scale(1.06); }
    .manni .thumb-img { transition: transform .5s ease; }
    .manni input, .manni select, .manni textarea { background:#161616; border:1px solid #262626; color:#F5F5F5; padding:11px 13px; font-family:inherit; }
    .manni input:focus, .manni select:focus, .manni textarea:focus, .manni button:focus-visible, .manni a:focus-visible { outline:2px solid #D4AF37; outline-offset:2px; }
    .manni .badge { font-size:9.5px; letter-spacing:0.1em; padding:4px 10px; font-weight:700; }
    .manni .scrollbar-none::-webkit-scrollbar{ display:none; }
    .manni .nav-item { position:relative; }
    .manni .nav-item::after {
      content:''; position:absolute; left:0; bottom:-4px; width:0; height:1.5px; background:#D4AF37;
      transition: width .25s ease;
    }
    .manni .nav-item:hover::after, .manni .nav-item.active::after { width:100%; }
    .manni .gold-divider { height:1px; background:linear-gradient(90deg, transparent, rgba(212,175,55,0.6), transparent); }
    .manni .brand-tile { position:relative; overflow:hidden; cursor:pointer; background:radial-gradient(circle at 30% 20%, #161616, #050505 70%); border:1px solid #1e1e1e; transition: border-color .3s, transform .3s; }
    .manni .brand-tile:hover { border-color:#D4AF37; transform:translateY(-4px); }
    .manni .brand-tile:hover .explore { opacity:1; transform:translateY(0); }
    .manni .explore { opacity:0; transform:translateY(6px); transition: opacity .3s, transform .3s; }
    @media (prefers-reduced-motion: reduce){ .manni * { transition-duration: 0.01ms !important; } .manni { background-attachment:scroll; } }
  `}</style>
);

function LoadingScreen() {
  return (
    <div className="manni" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <GlobalStyle />
      <div style={{ textAlign: "center" }}>
        <div className="display gold-metal" style={{ fontSize: 30, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 14 }}>MANNI</div>
        <div style={{ color: "#8a8a8a", fontSize: 13 }}>Loading store data…</div>
      </div>
    </div>
  );
}

function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div style={{ background: "#161616", border: "1px solid #B8860B", color: "#F5F5F5", padding: "10px 16px", fontSize: 12.5, display: "flex", alignItems: "center", gap: 10 }}>
      <AlertCircle size={15} color="#D4AF37" />
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onDismiss} style={{ background: "none", border: "none", color: "#8a8a8a", cursor: "pointer" }}><XIcon size={14} /></button>
    </div>
  );
}

/* ================= HEADER ================= */
function Header({ page, setPage, cartCount, query, setQuery, isAdmin }) {
  const nav = [
    ["Home", "home"], ["Shop", "shop"], ["iPhone", "shop-iphone"], ["Samsung", "shop-samsung"],
    ["Motorola", "shop-motorola"], ["Lipa Polepole", "lipa"], ["About", "about"], ["Contact", "contact"],
  ];
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(212,175,55,0.12)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <button onClick={() => setPage("home")} style={{ background: "none", border: "none", cursor: "pointer" }}>
          <span className="display gold-metal" style={{ fontSize: 23, fontWeight: 700, letterSpacing: "0.08em" }}>MANNI</span>
        </button>
        <nav style={{ display: "flex", gap: 24, fontSize: 13, flex: 1, justifyContent: "center", overflowX: "auto" }} className="scrollbar-none">
          {nav.map(([label, key]) => (
            <button key={key} onClick={() => setPage(key)} className={`nav-item ${page === key ? "active" : ""}`}
              style={{ background: "none", border: "none", cursor: "pointer", color: page === key ? "#D4AF37" : "#F5F5F5", padding: "6px 0", whiteSpace: "nowrap" }}>{label}</button>
          ))}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", background: "#111", border: "1px solid #262626", padding: "7px 11px" }}>
            <Search size={14} color="#888" />
            <input value={query} onChange={(e) => { setQuery(e.target.value); setPage("shop"); }}
              placeholder="Search phones" style={{ background: "none", border: "none", marginLeft: 8, width: 110, fontSize: 13, padding: 0 }} />
          </div>
          <button onClick={() => setPage(isAdmin ? "admin" : "admin-login")} title="Admin" style={{ background: "none", border: "none", color: "#F5F5F5", cursor: "pointer" }}>
            <Lock size={18} />
          </button>
          <button onClick={() => setPage("cart")} style={{ position: "relative", background: "none", border: "none", color: "#F5F5F5", cursor: "pointer" }}>
            <ShoppingCart size={20} />
            {cartCount > 0 && <span style={{ position: "absolute", top: -8, right: -10, background: "#D4AF37", color: "#000", borderRadius: 999, fontSize: 10, fontWeight: 700, padding: "1px 5px" }}>{cartCount}</span>}
          </button>
        </div>
      </div>
    </header>
  );
}

function Badges({ p }) {
  const items = [];
  if (p.newArrival) items.push(["NEW ARRIVAL", "#D4AF37", "#000"]);
  if (p.bestSeller) items.push(["BEST SELLER", "#F5F5F5", "#000"]);
  if (p.featured) items.push(["FEATURED", "transparent", "#D4AF37", true]);
  if (p.limitedStock) items.push(["LIMITED STOCK", "#8a6d1f", "#000"]);
  if (p.onSale) items.push(["SALE", "#161616", "#D4AF37", true]);
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
      {items.map(([label, bg, color, outline], i) => (
        <span key={i} className="badge" style={{ background: bg, color, border: outline ? "1px solid #D4AF37" : "none" }}>{label}</span>
      ))}
    </div>
  );
}

function ProductCard({ p, onView, onAdd }) {
  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ background: "#050505", marginBottom: 16, padding: p.images?.length ? 0 : "22px 0 28px", overflow: "hidden" }}>
        <ProductThumb p={p} size={72} />
      </div>
      <Badges p={p} />
      <div style={{ fontSize: 10.5, color: "#888", letterSpacing: "0.08em", marginBottom: 4 }}>{p.brand.toUpperCase()} · {p.storage}</div>
      <h3 className="display" style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>{p.name}</h3>
      <div style={{ fontSize: 12, color: "#999", marginBottom: 14 }}>{p.condition || "Not specified"}</div>
      {p.cash != null && <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 3 }}>{fmt(p.cash)}</div>}
      {p.deposit != null && <div style={{ fontSize: p.cash != null ? 13 : 20, fontWeight: p.cash != null ? 500 : 700, marginBottom: 3 }}>Deposit {fmt(p.deposit)}</div>}
      {p.weekly != null && <div className="gold" style={{ fontSize: 11.5, marginBottom: 16 }}>or {fmt(p.weekly)}/week</div>}
      <div style={{ fontSize: 11, color: p.stock > 0 ? "#8a8a8a" : "#8a6d1f", marginBottom: 16 }}>{p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
        <button className="btn-outline" onClick={() => onView(p)} style={{ fontSize: 12, padding: "11px 16px" }}>VIEW PHONE</button>
        <button className="btn-gold" disabled={p.stock === 0} onClick={() => onAdd(p)} style={{ fontSize: 12, padding: "11px 16px" }}>ADD TO CART</button>
      </div>
    </div>
  );
}

/* ================= HOME ================= */
function Home({ products, testimonials, setPage, onView, onAdd }) {
  const featured = products.filter((p) => p.featured);
  const bestSellers = products.filter((p) => p.bestSeller);
  const newArrivals = products.filter((p) => p.newArrival);
  const signatureIds = ["p1", "p2", "p3", "p16", "p17", "p18", "p19"];
  const signature = signatureIds.map((id) => products.find((p) => p.id === id)).filter(Boolean);
  const edit = signature.length >= 3 ? signature.slice(0, 3) : (featured.slice(0, 3).length === 3 ? featured.slice(0, 3) : products.slice(0, 3));

  const Row = ({ title, items }) => items.length === 0 ? null : (
    <section style={{ maxWidth: 1200, margin: "0 auto", padding: "70px 24px" }}>
      <Reveal>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 28 }}>
          <h2 className="display" style={{ fontSize: 28 }}>{title}</h2>
          <button onClick={() => setPage("shop")} style={{ background: "none", border: "none", color: "#D4AF37", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>View All <ChevronRight size={14} /></button>
        </div>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 22 }}>
        {items.slice(0, 4).map((p, i) => <Reveal key={p.id} delay={i * 60}><ProductCard p={p} onView={onView} onAdd={onAdd} /></Reveal>)}
      </div>
    </section>
  );

  const brandTiles = [
    ["iPhone", "shop-iphone"], ["Samsung", "shop-samsung"], ["Motorola", "shop-motorola"],
  ];

  const why = [
    ["PREMIUM DEVICES", "Every phone checked and warrantied before it reaches you."],
    ["FLEXIBLE PAYMENTS", "Lipa Polepole means you don't need the full price upfront."],
    ["TRANSPARENT PRICING", "The price on the tag is the price you pay. No surprises."],
    ["DELIVERY ACROSS KENYA", "Nairobi, Kiambu, Nyeri, Mombasa and beyond."],
  ];

  return (
    <>
      {/* HERO */}
      <section style={{ position: "relative", padding: "130px 24px 100px", textAlign: "center", overflow: "hidden", borderBottom: "1px solid #161616" }}>
        <div style={{ position: "absolute", top: "-10%", left: "50%", transform: "translateX(-50%)", width: 700, height: 700, background: "radial-gradient(circle, rgba(212,175,55,0.10), transparent 65%)", filter: "blur(20px)", zIndex: 0 }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 760, margin: "0 auto" }}>
          <div className="eyebrow" style={{ marginBottom: 26 }}>Genuine Devices · Kenya-Wide Delivery</div>
          <h1 className="display" style={{ fontSize: "clamp(42px,6.4vw,76px)", fontWeight: 700, lineHeight: 1.03, marginBottom: 24 }}>
            LUXURY IN<br /><span className="gold-metal">YOUR HANDS.</span>
          </h1>
          <p style={{ color: "#a8a8a8", fontSize: 18, marginBottom: 20 }}>Premium smartphones. Flexible payments. Delivered with confidence.</p>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 34 }}><div className="gold-divider" style={{ width: 80 }} /></div>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 60 }}>
            <button className="btn-gold" onClick={() => setPage("shop")}>SHOP PHONES</button>
            <button className="btn-outline" onClick={() => setPage("lipa")}>LIPA POLEPOLE</button>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 26, alignItems: "flex-end" }}>
            {[
              { id: "p14", size: 66, elevated: false },   // Motorola Moto G Stylus
              { id: "p25", size: 100, elevated: true },   // iPhone 16 Pro Max — real newest flagship
              { id: "p1", size: 66, elevated: false },    // Samsung Galaxy S25 Ultra — real newest flagship
            ].map((item, i) => {
              const product = products.find((p) => p.id === item.id);
              const photo = product?.images?.[0];
              const label = product ? product.name : "";
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, transform: item.elevated ? "translateY(-14px) scale(1.1)" : "translateY(6px)", opacity: item.elevated ? 1 : 0.7 }}>
                  {photo ? (
                    <div style={{ position: "relative" }}>
                      {item.elevated && <div style={{ position: "absolute", inset: -24, background: "radial-gradient(circle, rgba(212,175,55,0.22), transparent 70%)", filter: "blur(6px)", zIndex: 0 }} />}
                      <img src={photo} alt={label} style={{ position: "relative", zIndex: 1, width: item.size, height: item.size * 1.9, objectFit: "cover", borderRadius: 14, border: "1px solid rgba(212,175,55,0.4)" }} />
                    </div>
                  ) : (
                    <PhoneGlyph size={item.size} glow={item.elevated} />
                  )}
                  <div className="eyebrow" style={{ fontSize: 9.5, letterSpacing: "0.12em", whiteSpace: "nowrap", opacity: item.elevated ? 1 : 0.8 }}>{label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* THE MANNI EDIT */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 24px", borderBottom: "1px solid #161616" }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 50 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Curated Flagships</div>
            <h2 className="display" style={{ fontSize: 34 }}>THE <span className="gold-metal">LUXURY LINEUP</span></h2>
          </div>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 20, alignItems: "center" }}>
          {edit.map((p, i) => (
            <Reveal key={p.id} delay={i * 100}>
              <div className="card" onClick={() => onView(p)} style={{ cursor: "pointer", padding: i === 1 ? 34 : 22, textAlign: "center", transform: i === 1 ? "scale(1.05)" : "none", position: "relative" }}>
                <div style={{ background: "#050505", marginBottom: 18, padding: p.images?.length ? 0 : "20px 0", display: "flex", justifyContent: "center", overflow: "hidden" }}>
                  {p.images?.length ? <img src={p.images[0]} alt={p.name} loading="lazy" style={{ width: "100%", height: i === 1 ? 220 : 160, objectFit: "cover" }} /> : <PhoneGlyph size={i === 1 ? 100 : 70} glow={i === 1} />}
                </div>
                <div className="eyebrow" style={{ marginBottom: 8, fontSize: 10 }}>{p.brand}</div>
                <div className="display" style={{ fontSize: i === 1 ? 20 : 16, fontWeight: 600, marginBottom: 8 }}>{p.name}</div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.cash != null ? fmt(p.cash) : `Deposit ${fmt(p.deposit)}`}</div>
                {p.weekly != null && <div className="gold" style={{ fontSize: 12, marginTop: 2 }}>{fmt(p.weekly)}/week</div>}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* SHOP BY BRAND */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 24px", borderBottom: "1px solid #161616" }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Browse</div>
            <h2 className="display" style={{ fontSize: 30 }}>SHOP BY BRAND</h2>
          </div>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 18 }}>
          {brandTiles.map(([name, key], i) => (
            <Reveal key={name} delay={i * 60}>
              <div className="brand-tile" onClick={() => setPage(key)} style={{ padding: "34px 20px", textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}><PhoneGlyph size={44} /></div>
                <div className="display" style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>{name}</div>
                <div className="explore gold" style={{ fontSize: 11, letterSpacing: "0.14em" }}>EXPLORE →</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <Row title="Best Sellers" items={bestSellers} />
      <Row title="New Arrivals" items={newArrivals} />

      {/* WHY MANNI */}
      <section style={{ background: "linear-gradient(180deg, #050505, #000)", borderTop: "1px solid #161616", borderBottom: "1px solid #161616" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "90px 24px" }}>
          {why.map(([t, d], i) => (
            <Reveal key={t} delay={i * 90}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 24, padding: "26px 0", borderBottom: i < why.length - 1 ? "1px solid #161616" : "none", flexWrap: "wrap" }}>
                <div className="display gold-metal" style={{ fontSize: "clamp(24px,3.4vw,40px)", fontWeight: 700, width: 60, flexShrink: 0 }}>0{i + 1}</div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div className="display" style={{ fontSize: "clamp(18px,2.4vw,26px)", fontWeight: 600, marginBottom: 6 }}>{t}</div>
                  <div style={{ color: "#8a8a8a", fontSize: 14 }}>{d}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* BRAND MOMENT */}
      <section style={{ padding: "110px 24px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 500, height: 500, background: "radial-gradient(circle, rgba(212,175,55,0.08), transparent 70%)", filter: "blur(10px)" }} />
        <Reveal>
          <div style={{ position: "relative", zIndex: 1 }}>
            <div className="display gold-metal" style={{ fontSize: "clamp(48px,9vw,110px)", fontWeight: 700, letterSpacing: "0.05em", lineHeight: 1 }}>MANNI</div>
            <div style={{ fontSize: 15, letterSpacing: "0.3em", color: "#F5F5F5", marginTop: 14 }}>LUXURY PHONES</div>
            <div style={{ display: "flex", justifyContent: "center", margin: "26px 0" }}><div className="gold-divider" style={{ width: 60 }} /></div>
            <div style={{ fontSize: 14, color: "#8a8a8a", letterSpacing: "0.08em" }}>Technology. Elevated.</div>
          </div>
        </Reveal>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 24px 90px" }}>
        <Reveal><h2 className="display" style={{ fontSize: 26, marginBottom: 30 }}>What customers say</h2></Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 20 }}>
          {testimonials.map((t, i) => (
            <Reveal key={i} delay={i * 80}>
              <div className="card" style={{ padding: 26 }}>
                <div style={{ display: "flex", gap: 3, marginBottom: 12 }}>
                  {Array.from({ length: 5 }).map((_, j) => <Star key={j} size={13} fill={j < t.rating ? "#D4AF37" : "none"} color="#D4AF37" />)}
                </div>
                <p style={{ fontSize: 13.5, color: "#ccc", lineHeight: 1.6, marginBottom: 14 }}>"{t.review}"</p>
                <div style={{ fontSize: 12.5, color: "#8a8a8a" }}>{t.name} · bought {t.product}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}

/* ================= SHOP ================= */
function Shop({ products, query, brandFilter, onView, onAdd }) {
  const [brand, setBrand] = useState(brandFilter || "All");
  const [sort, setSort] = useState("featured");
  const [condition, setCondition] = useState("All");
  const priceCeiling = useMemo(() => {
    const vals = products.map(priceMetric).filter((v) => v > 0);
    const highest = vals.length ? Math.max(...vals) : 45000;
    return Math.ceil(highest / 1000) * 1000; // round up to nearest 1,000
  }, [products]);
  const [maxPrice, setMaxPrice] = useState(priceCeiling);
  const [showAll, setShowAll] = useState(true); // default: nothing hidden

  useEffect(() => { setBrand(brandFilter || "All"); }, [brandFilter]);
  useEffect(() => { setMaxPrice(priceCeiling); }, [priceCeiling]);

  const conditions = useMemo(() => ["All", ...Array.from(new Set(products.map((p) => p.condition).filter(Boolean)))], [products]);

  const filtered = useMemo(() => {
    let list = products.filter((p) =>
      (brand === "All" || p.brand === brand) &&
      (condition === "All" || p.condition === condition) &&
      (showAll || priceMetric(p) <= maxPrice) &&
      (query === "" || (p.name + " " + (p.model || "") + " " + p.storage + " " + p.brand).toLowerCase().includes(query.toLowerCase()))
    );
    if (sort === "low") list = [...list].sort((a, b) => priceMetric(a) - priceMetric(b));
    if (sort === "high") list = [...list].sort((a, b) => priceMetric(b) - priceMetric(a));
    if (sort === "newest") list = [...list].sort((a, b) => (b.newArrival ? 1 : 0) - (a.newArrival ? 1 : 0));
    if (sort === "bestselling") list = [...list].sort((a, b) => (b.bestSeller ? 1 : 0) - (a.bestSeller ? 1 : 0));
    if (sort === "featured") list = [...list].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    return list;
  }, [products, brand, condition, maxPrice, showAll, sort, query]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "60px 24px 90px" }}>
      <h1 className="display" style={{ fontSize: 34, marginBottom: 34 }}>Shop <span className="gold-metal">Phones</span></h1>
      <div style={{ display: "flex", gap: 34, flexWrap: "wrap" }}>
        <aside style={{ width: 210, flexShrink: 0 }}>
          <div style={{ marginBottom: 28 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Brand</div>
            {["All", "Samsung", "iPhone", "Motorola"].map((b) => (
              <div key={b} onClick={() => setBrand(b)} style={{ cursor: "pointer", padding: "7px 0", fontSize: 13.5, color: brand === b ? "#D4AF37" : "#ccc" }}>{b}</div>
            ))}
          </div>
          <div style={{ marginBottom: 28 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Condition</div>
            {conditions.map((c) => (
              <div key={c} onClick={() => setCondition(c)} style={{ cursor: "pointer", padding: "7px 0", fontSize: 13.5, color: condition === c ? "#D4AF37" : "#ccc" }}>{c}</div>
            ))}
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <span className="eyebrow" style={{ marginBottom: 0 }}>Show All Products</span>
              <span onClick={() => setShowAll((v) => !v)} style={{ position: "relative", width: 38, height: 20, background: showAll ? "#D4AF37" : "#333", borderRadius: 999, transition: "background .2s", flexShrink: 0 }}>
                <span style={{ position: "absolute", top: 2, left: showAll ? 20 : 2, width: 16, height: 16, borderRadius: "50%", background: "#000", transition: "left .2s" }} />
              </span>
            </label>
            <div style={{ fontSize: 10.5, color: "#555", marginTop: 6, lineHeight: 1.5 }}>On by default so nothing is hidden. Turn off to filter by price below.</div>
          </div>
          <div style={{ opacity: showAll ? 0.4 : 1, pointerEvents: showAll ? "none" : "auto" }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Max Deposit: {fmt(maxPrice)}</div>
            <input type="range" min="1000" max={priceCeiling} step="500" value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} style={{ width: "100%" }} />
            <div style={{ fontSize: 10.5, color: "#555", marginTop: 6, lineHeight: 1.5 }}>Filters by cash price where set, otherwise by Lipa Polepole deposit.</div>
          </div>
        </aside>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontSize: 13, color: "#8a8a8a" }}>{filtered.length} phones</div>
            <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ fontSize: 13 }}>
              <option value="featured">Featured</option>
              <option value="low">Price: Low to High</option>
              <option value="high">Price: High to Low</option>
              <option value="newest">Newest</option>
              <option value="bestselling">Best Selling</option>
            </select>
          </div>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: "#8a8a8a" }}>
              <div style={{ fontSize: 18, color: "#F5F5F5", marginBottom: 8 }}>No phones found.</div>
              <div style={{ fontSize: 13.5 }}>Try another model or brand.</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px,1fr))", gap: 22 }}>
              {filtered.map((p) => <ProductCard key={p.id} p={p} onView={onView} onAdd={onAdd} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= PRODUCT PAGE ================= */
function ProductPage({ p, onAdd, setPage, settings, onApply }) {
  const [activeImg, setActiveImg] = useState(0);
  const specs = [["Brand", p.brand], ["Model", p.model || p.name], ["Condition", p.condition], ["Storage", p.storage], ["RAM", p.ram], ["Network", p.network], ["Display", p.display], ["Main Camera", p.camera], ["Front Camera", p.frontCamera], ["Battery", p.battery], ["Color", p.color]];
  const images = p.images || [];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 24px 90px" }}>
      <button onClick={() => setPage("shop")} style={{ background: "none", border: "none", color: "#8a8a8a", fontSize: 13, marginBottom: 34, cursor: "pointer" }}>← Back to Shop</button>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 64 }}>
        <div>
          <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: images.length ? 0 : "70px 0", overflow: "hidden", marginBottom: 12, minHeight: 320 }}>
            {images.length ? <img src={images[activeImg]} alt={p.name} style={{ width: "100%", maxHeight: 440, objectFit: "cover" }} /> : <PhoneGlyph size={170} glow />}
          </div>
          {images.length > 1 && (
            <div style={{ display: "flex", gap: 8 }}>
              {images.map((img, i) => (
                <button key={i} onClick={() => setActiveImg(i)} style={{ padding: 0, border: i === activeImg ? "2px solid #D4AF37" : "1px solid #262626", background: "none", cursor: "pointer", width: 58, height: 58, overflow: "hidden" }}>
                  <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <Badges p={p} />
          <div className="eyebrow" style={{ marginBottom: 8 }}>{p.brand} · {p.category || p.model}</div>
          <h1 className="display" style={{ fontSize: 32, marginBottom: 14 }}>{p.name}</h1>
          {p.desc && <p style={{ color: "#a8a8a8", fontSize: 14.5, lineHeight: 1.65, marginBottom: 28 }}>{p.desc}</p>}

          {p.cash != null && <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 4 }}>{fmt(p.cash)}</div>}
          {p.deposit != null && (
            <div style={{ fontSize: p.cash != null ? 15 : 32, fontWeight: p.cash != null ? 500 : 700, marginBottom: 4 }}>
              Deposit {fmt(p.deposit)}
            </div>
          )}
          {p.weekly != null && (
            <div className="gold" style={{ fontSize: 13.5, marginBottom: 22 }}>
              {fmt(p.weekly)}/week{p.duration ? ` over ${p.duration}` : ""}
            </div>
          )}
          <div style={{ fontSize: 12.5, color: p.stock > 0 ? "#8a8a8a" : "#8a6d1f", marginBottom: 28 }}>{p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}</div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 36 }}>
            <button className="btn-gold" disabled={p.stock === 0} onClick={() => onAdd(p)}>ADD TO CART</button>
            <button className="btn-outline" onClick={() => onApply(p)}>LIPA POLEPOLE</button>
            <a href={waLink(settings.whatsapp, `Hi MANNI Luxury Phones, I'm interested in the ${p.name}. Please give me more details.`)} target="_blank" rel="noopener noreferrer" className="btn-outline" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              <MessageCircle size={15} /> ASK ON WHATSAPP
            </a>
          </div>

          <div style={{ borderTop: "1px solid #1e1e1e" }}>
            {specs.map(([label, val]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "13px 0", borderBottom: "1px solid #1e1e1e", fontSize: 13.5 }}>
                <span style={{ color: "#8a8a8a" }}>{label}</span><span style={!val ? { color: "#666" } : undefined}>{na(val)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= CART ================= */
function CartPage({ cart, products, updateQty, removeItem, setPage }) {
  const items = cart.map((c) => ({ ...c, product: products.find((p) => p.id === c.id) })).filter((c) => c.product);
  const subtotal = items.reduce((s, c) => s + priceMetric(c.product) * c.qty, 0);
  const hasDepositOnly = items.some((c) => c.product.cash == null);

  if (items.length === 0) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "120px 24px", textAlign: "center" }}>
        <h2 className="display" style={{ fontSize: 26, marginBottom: 10 }}>Your cart is waiting.</h2>
        <p style={{ color: "#8a8a8a", marginBottom: 30 }}>Add a phone to get started.</p>
        <button className="btn-gold" onClick={() => setPage("shop")}>SHOP PHONES</button>
      </div>
    );
  }
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 24px 90px" }}>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 34 }}>Your Cart</h1>
      {items.map((c) => (
        <div key={c.id} className="card" style={{ display: "flex", alignItems: "center", gap: 20, padding: 18, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ background: "#050505", padding: c.product.images?.length ? 0 : "10px 16px", width: 50, overflow: "hidden" }}><ProductThumb p={c.product} size={22} /></div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ fontWeight: 600, fontSize: 14.5 }}>{c.product.name}</div>
            <div style={{ fontSize: 12.5, color: "#8a8a8a" }}>{c.product.storage} · {c.product.condition}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => updateQty(c.id, Math.max(1, c.qty - 1))} style={{ background: "#181818", border: "none", color: "#fff", width: 26, height: 26, cursor: "pointer" }}><Minus size={12} /></button>
            <span style={{ width: 20, textAlign: "center", fontSize: 13.5 }}>{c.qty}</span>
            <button onClick={() => updateQty(c.id, c.qty + 1)} style={{ background: "#181818", border: "none", color: "#fff", width: 26, height: 26, cursor: "pointer" }}><Plus size={12} /></button>
          </div>
          <div style={{ width: 130, textAlign: "right" }}>
            <div className="gold" style={{ fontWeight: 600, fontSize: 14 }}>{fmt(priceMetric(c.product) * c.qty)}</div>
            <div style={{ fontSize: 10.5, color: "#666" }}>{priceLabel(c.product)}{c.qty > 1 ? ` ×${c.qty}` : ""}</div>
          </div>
          <button onClick={() => removeItem(c.id)} style={{ background: "none", border: "none", color: "#8a8a8a", cursor: "pointer" }}><Trash2 size={16} /></button>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 30, gap: 30, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, textAlign: "right" }}>
          {hasDepositOnly ? "Total due today (deposit): " : "Subtotal: "}<span className="gold" style={{ fontWeight: 700 }}>{fmt(subtotal)}</span>
        </div>
        <button className="btn-gold" onClick={() => setPage("checkout")}>PROCEED TO CHECKOUT</button>
      </div>
    </div>
  );
}

/* ================= CHECKOUT ================= */
function Checkout({ cart, products, setPage, placeOrder, placing }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", location: "Nairobi", payment: "M-Pesa", plan: "Cash", notes: "" });
  const items = cart.map((c) => ({ ...c, product: products.find((p) => p.id === c.id) })).filter((c) => c.product);
  const subtotal = items.reduce((s, c) => s + priceMetric(c.product) * c.qty, 0);
  const hasDepositOnly = items.some((c) => c.product.cash == null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) return;
    placeOrder(form, items, subtotal);
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 24px 90px" }}>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 34 }}>Checkout</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 40, flexWrap: "wrap" }}>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 260 }}>
          <input required placeholder="Full Name" value={form.name} onChange={set("name")} />
          <input required placeholder="Phone Number" value={form.phone} onChange={set("phone")} />
          <input type="email" placeholder="Email" value={form.email} onChange={set("email")} />
          <select value={form.location} onChange={set("location")}>
            {["Nairobi", "Kiambu", "Nyeri", "Mombasa", "Other"].map((l) => <option key={l}>{l}</option>)}
          </select>
          <select value={form.payment} onChange={set("payment")}>
            <option>M-Pesa</option><option>Card</option><option>Pay on Delivery</option>
          </select>
          <select value={form.plan} onChange={set("plan")}>
            <option>Cash</option><option>Lipa Polepole — 3 Month Plan</option><option>Lipa Polepole — 6 Month Plan</option>
          </select>
          <textarea placeholder="Additional notes" rows={3} value={form.notes} onChange={set("notes")} />
          <button className="btn-gold" type="submit" disabled={placing} style={{ marginTop: 6 }}>{placing ? "PLACING ORDER…" : "PLACE ORDER"}</button>
        </form>
        <div className="card" style={{ padding: 24, height: "fit-content", minWidth: 240 }}>
          <div className="eyebrow" style={{ marginBottom: 18 }}>Order Summary</div>
          {items.map((c) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 10, color: "#ccc" }}>
              <span>{c.product.name} × {c.qty}</span><span>{fmt(priceMetric(c.product) * c.qty)}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid #262626", marginTop: 12, paddingTop: 12, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <span>{hasDepositOnly ? "Due Today" : "Total"}</span><span className="gold">{fmt(subtotal)}</span>
          </div>
          {hasDepositOnly && <div style={{ fontSize: 10.5, color: "#666", marginTop: 8, lineHeight: 1.5 }}>Weekly Lipa Polepole payments continue after this deposit, per each product's terms.</div>}
        </div>
      </div>
    </div>
  );
}

function OrderConfirmation({ order, setPage, settings }) {
  if (!order) return null;
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "110px 24px", textAlign: "center" }}>
      <div className="gold" style={{ marginBottom: 18 }}><Check size={40} /></div>
      <h1 className="display" style={{ fontSize: 28, marginBottom: 10 }}>Order confirmed</h1>
      <p style={{ color: "#8a8a8a", marginBottom: 6 }}>Order number</p>
      <p className="gold-metal display" style={{ fontSize: 22, fontWeight: 700, marginBottom: 28 }}>{order.number}</p>
      <p style={{ color: "#a8a8a8", fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>Your order details just opened in WhatsApp — send that message to complete your order. We'll confirm payment and delivery to {order.form.location} on {order.form.phone}.</p>
      <p style={{ color: "#666", fontSize: 12, lineHeight: 1.5, marginBottom: 32 }}>If WhatsApp didn't open, tap "Message Us" below and send us your order number.</p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <button className="btn-gold" onClick={() => setPage("shop")}>CONTINUE SHOPPING</button>
        <a className="btn-outline" style={{ textDecoration: "none" }} href={waLink(settings.whatsapp, `Hi MANNI, following up on order ${order.number}.`)} target="_blank" rel="noopener noreferrer">MESSAGE US</a>
      </div>
    </div>
  );
}

/* ================= LIPA POLEPOLE APPLICATION ================= */
function LipaApplyModal({ product, settings, onClose }) {
  const [form, setForm] = useState({ name: "", idNumber: "", phone: "", location: "Nairobi", nokName: "", nokId: "", nokPhone: "" });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const valid = form.name && form.idNumber && form.phone && form.nokName && form.nokPhone;

  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    const lines = [
      "*Lipa Polepole Application*",
      product ? `Phone: ${product.name} (${product.storage})` : "",
      "",
      `Full Name: ${form.name}`,
      `National ID Number: ${form.idNumber}`,
      `Phone Number: ${form.phone}`,
      `Current Location: ${form.location}`,
      "",
      "Next of Kin:",
      `Name: ${form.nokName}`,
      `ID Number: ${form.nokId || "Not provided"}`,
      `Phone: ${form.nokPhone}`,
    ].filter(Boolean).join("\n");
    window.open(waLink(settings.whatsapp, lines), "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "40px 16px" }} onClick={onClose}>
      <div className="card" style={{ maxWidth: 480, width: "100%", padding: 30, position: "relative" }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "#8a8a8a", cursor: "pointer" }}><XIcon size={18} /></button>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Lipa Polepole Application</div>
        <h2 className="display" style={{ fontSize: 22, marginBottom: 6 }}>{product ? product.name : "Apply Now"}</h2>
        {product && <div style={{ fontSize: 12.5, color: "#8a8a8a", marginBottom: 20 }}>Deposit {fmt(product.deposit)} · {fmt(product.weekly)}/week</div>}

        <p style={{ fontSize: 12, color: "#8a8a8a", lineHeight: 1.6, marginBottom: 22 }}>
          This sends straight to our WhatsApp — nothing here is saved on this site. We'll confirm your application and next steps directly in the chat.
        </p>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="eyebrow" style={{ fontSize: 10, marginTop: 4 }}>Your Details</div>
          <input required placeholder="Full Name" value={form.name} onChange={set("name")} />
          <input required placeholder="National ID Number" value={form.idNumber} onChange={set("idNumber")} />
          <input required placeholder="Phone Number" value={form.phone} onChange={set("phone")} />
          <select value={form.location} onChange={set("location")}>
            {["Nairobi", "Kiambu", "Nyeri", "Mombasa", "Other"].map((l) => <option key={l}>{l}</option>)}
          </select>

          <div className="eyebrow" style={{ fontSize: 10, marginTop: 10 }}>Next of Kin</div>
          <input required placeholder="Next of Kin Full Name" value={form.nokName} onChange={set("nokName")} />
          <input placeholder="Next of Kin ID Number (optional)" value={form.nokId} onChange={set("nokId")} />
          <input required placeholder="Next of Kin Phone Number" value={form.nokPhone} onChange={set("nokPhone")} />

          <button className="btn-gold" type="submit" disabled={!valid} style={{ marginTop: 10 }}>SEND APPLICATION ON WHATSAPP</button>
        </form>
      </div>
    </div>
  );
}

/* ================= LIPA POLEPOLE ================= */
function LipaPolepole({ products, onApply }) {
  const signatureIds = ["p1", "p16", "p19"];
  const picked = signatureIds.map((id) => products.find((p) => p.id === id)).filter(Boolean);
  const sample = picked.length >= 3 ? picked : products.slice(0, 3);
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "70px 24px 90px" }}>
      <Reveal>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>MANNI Lipa Polepole</div>
          <h1 className="display" style={{ fontSize: "clamp(30px,4.6vw,44px)", marginBottom: 18, lineHeight: 1.1 }}>GET THE PHONE.<br /><span className="gold-metal">PAY YOUR WAY.</span></h1>
          <p style={{ color: "#a8a8a8", maxWidth: 560, margin: "0 auto", lineHeight: 1.6 }}>Premium smartphones with flexible payment options. Pay a deposit today, take your phone home, and clear the balance weekly.</p>
        </div>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 20 }}>
        {sample.map((p, i) => {
          const rows = [];
          if (p.cash != null) rows.push(["Cash Price", fmt(p.cash)]);
          if (p.deposit != null) rows.push(["Deposit", fmt(p.deposit)]);
          if (p.weekly != null) rows.push([`Weekly (${p.duration || "12 weeks / 3 months"})`, fmt(p.weekly)]);
          return (
            <Reveal key={p.id} delay={i * 90}>
              <div className="card" style={{ padding: 26 }}>
                <div style={{ fontSize: 12, color: "#8a8a8a", marginBottom: 4 }}>{p.brand} · {p.storage}</div>
                <div className="display" style={{ fontWeight: 600, fontSize: 17, marginBottom: 18 }}>{p.name}</div>
                {rows.map(([l, v]) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "9px 0", borderTop: "1px solid #1e1e1e" }}>
                    <span style={{ color: "#8a8a8a" }}>{l}</span><span className={l === "Cash Price" ? "" : "gold"}>{v}</span>
                  </div>
                ))}
                <button className="btn-gold" style={{ width: "100%", marginTop: 18, fontSize: 12.5 }} onClick={() => onApply(p)}>EXPLORE LIPA POLEPOLE</button>
              </div>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}

/* ================= ABOUT / CONTACT ================= */
function About() {
  const items = [
    ["Premium Selection", "Carefully selected smartphones."],
    ["Flexible Payments", "Convenient purchasing options."],
    ["Transparent Pricing", "Clear prices and payment information."],
    ["Customer Support", "Help before and after purchase."],
    ["Delivery Across Kenya", "Convenient delivery options."],
  ];
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "70px 24px 90px" }}>
      <h1 className="display" style={{ fontSize: 34, marginBottom: 24 }}>About <span className="gold-metal">MANNI</span></h1>
      <p style={{ color: "#a8a8a8", lineHeight: 1.7, marginBottom: 44, fontSize: 15 }}>MANNI Luxury Phones is a Kenyan smartphone retailer built around quality, trust, and a straightforward buying experience. We carry genuine iPhone, Samsung, and other leading devices, and offer Lipa Polepole for customers who'd rather pay in steps than all at once. Every device that reaches our shelf is checked before sale, and every price is shown upfront.</p>
      <h2 className="display" style={{ fontSize: 24, marginBottom: 22 }}>Why MANNI?</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 20 }}>
        {items.map(([t, d]) => (
          <div key={t} className="card" style={{ padding: 22 }}>
            <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 14 }}>{t}</div>
            <div style={{ color: "#8a8a8a", fontSize: 13, lineHeight: 1.5 }}>{d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Contact({ settings }) {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "70px 24px 90px" }}>
      <h1 className="display" style={{ fontSize: 34, marginBottom: 34 }}>Contact <span className="gold-metal">Us</span></h1>
      <div className="card" style={{ padding: 32, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26 }}>
        {[["WhatsApp", "+" + settings.whatsapp], ["Phone", "+" + settings.whatsapp], ["Email", settings.email], ["Location", settings.location], ["Hours", "Mon–Sat 9:00–19:00, Sun 11:00–16:00"], ["Social", "Instagram · TikTok · Facebook"]].map(([l, v]) => (
          <div key={l}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>{l}</div>
            <div style={{ fontSize: 14 }}>{v}</div>
          </div>
        ))}
      </div>
      <a href={waLink(settings.whatsapp, "Hi MANNI Luxury Phones, I have a question.")} target="_blank" rel="noopener noreferrer" className="btn-gold" style={{ display: "inline-flex", marginTop: 28, textDecoration: "none", alignItems: "center", gap: 8 }}>
        <MessageCircle size={16} /> MESSAGE US ON WHATSAPP
      </a>
    </div>
  );
}

/* ================= ADMIN AUTH ================= */
function AdminLogin({ settings, onLogin }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  return (
    <div style={{ maxWidth: 380, margin: "0 auto", padding: "130px 24px" }}>
      <h1 className="display" style={{ fontSize: 26, marginBottom: 22 }}>Admin <span className="gold-metal">Login</span></h1>
      <form onSubmit={(e) => { e.preventDefault(); (pw === settings.adminPassword) ? onLogin() : setErr(true); }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input type="password" placeholder="Password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(false); }} autoFocus />
        {err && <div style={{ color: "#8a6d1f", fontSize: 12.5 }}>Incorrect password.</div>}
        <button className="btn-gold" type="submit">SIGN IN</button>
      </form>
      <p style={{ fontSize: 11.5, color: "#666", marginTop: 20, lineHeight: 1.6 }}>
        This is a client-side password check, not real server authentication — the code that checks the password is readable by anyone who inspects the page. It keeps casual visitors out of the dashboard, but treat it as a lock, not a vault. Change the password anytime in Admin → Settings.
        <br /><br />
        Locked out? Since this password lives only in this browser's local storage, clearing this site's storage/local data for this device (or opening in a different browser/device that hasn't been signed in before) will reset it back to the default set in code.
      </p>
    </div>
  );
}

/* ================= IMAGE UPLOAD ================= */
function ImageUploader({ images, onChange }) {
  const handleFiles = (files) => {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      if (file.size > 1_500_000) { alert(`${file.name} is too large (max ~1.5MB per image).`); return; }
      const reader = new FileReader();
      reader.onload = () => onChange([...images, reader.result]);
      reader.readAsDataURL(file);
    });
  };
  const removeAt = (i) => onChange(images.filter((_, idx) => idx !== i));
  const makePrimary = (i) => { const arr = [...images]; const [chosen] = arr.splice(i, 1); onChange([chosen, ...arr]); };

  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>Product Images</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        {images.map((img, i) => (
          <div key={i} style={{ position: "relative", width: 76, height: 76, border: i === 0 ? "2px solid #D4AF37" : "1px solid #262626" }}>
            <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {i === 0 && <span style={{ position: "absolute", bottom: 2, left: 2, fontSize: 8.5, background: "#D4AF37", color: "#000", padding: "1px 4px" }}>PRIMARY</span>}
            <button type="button" onClick={() => removeAt(i)} style={{ position: "absolute", top: 2, right: 2, background: "#000", border: "none", color: "#fff", cursor: "pointer", width: 18, height: 18, borderRadius: "50%" }}><XIcon size={11} /></button>
            {i !== 0 && <button type="button" onClick={() => makePrimary(i)} style={{ position: "absolute", bottom: 2, left: 2, fontSize: 8.5, background: "#161616", border: "1px solid #D4AF37", color: "#D4AF37", cursor: "pointer", padding: "1px 4px" }}>Set primary</button>}
          </div>
        ))}
        <label style={{ width: 76, height: 76, border: "1px dashed #333", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#8a8a8a", fontSize: 10, gap: 4 }}>
          <Upload size={16} /> Upload
          <input type="file" accept="image/*" multiple onChange={(e) => handleFiles(e.target.files)} style={{ display: "none" }} />
        </label>
      </div>
      <div style={{ fontSize: 10.5, color: "#555" }}>Images are stored with the product record. Keep files under ~1.5MB each for fast loading.</div>
    </div>
  );
}

/* ================= ADMIN DASHBOARD ================= */
function AdminDashboard({ products, saveProducts, orders, settings, saveSettings, onLogout }) {
  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState(null);
  const [calcInput, setCalcInput] = useState(50000);
  const fin = calcFinancing(Number(calcInput) || 0);

  const blankProduct = { id: "", name: "", brand: "iPhone", category: "", model: "", storage: "", ram: "", display: "", camera: "", frontCamera: "", battery: "", network: "", condition: "", color: "", cash: null, deposit: null, weekly: null, duration: "12 weeks / 3 months", stock: 5, active: true, images: [], desc: "", featured: false, bestSeller: false, newArrival: false, limitedStock: false, onSale: false };

  const saveProduct = (p) => {
    if (!p.id) p.id = "p" + Date.now();
    const exists = products.some((x) => x.id === p.id);
    const next = exists ? products.map((x) => (x.id === p.id ? p : x)) : [...products, p];
    saveProducts(next);
    setEditing(null);
  };
  const deleteProduct = (id) => saveProducts(products.filter((p) => p.id !== id));
  // Deliberately manual — never auto-applied, so approved MANNI figures are never silently overwritten.
  const applyCalcToEditing = () => editing && setEditing({ ...editing, cash: Number(calcInput) || 0 });
  const applyDepositWeeklyToEditing = () => editing && setEditing({ ...editing, deposit: fin.deposit, weekly: fin.weekly3, duration: "12 weeks / 3 months" });

  const totalSales = orders.reduce((s, o) => s + o.subtotal, 0);
  const lowStock = products.filter((p) => p.stock <= 3);
  const tabs = ["overview", "products", "orders", "financing", "settings"];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "50px 24px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 34, flexWrap: "wrap", gap: 12 }}>
        <h1 className="display" style={{ fontSize: 28 }}>Admin <span className="gold-metal">Dashboard</span></h1>
        <button onClick={onLogout} className="btn-outline" style={{ fontSize: 12.5, padding: "9px 18px" }}>SIGN OUT</button>
      </div>
      <div style={{ background: "#161616", border: "1px solid #8a6d1f", padding: "12px 16px", fontSize: 12, color: "#ccc", marginBottom: 26, lineHeight: 1.6 }}>
        Changes here save only on <strong>this device/browser</strong> — they don't update the live catalog for other visitors. To change what customers actually see, edit the product list in the code and redeploy.
      </div>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #262626", marginBottom: 32, overflowX: "auto" }}>
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ background: "none", border: "none", cursor: "pointer", padding: "10px 16px", color: tab === t ? "#D4AF37" : "#8a8a8a", borderBottom: tab === t ? "2px solid #D4AF37" : "2px solid transparent", fontSize: 13, textTransform: "capitalize", whiteSpace: "nowrap" }}>{t}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 18 }}>
          {[["Total Sales", fmt(totalSales)], ["Orders", orders.length], ["Products", products.length], ["Low Stock", lowStock.length], ["Customers", new Set(orders.map((o) => o.form.phone)).size]].map(([l, v]) => (
            <div key={l} className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 12, color: "#8a8a8a", marginBottom: 8 }}>{l}</div>
              <div className="gold-metal display" style={{ fontSize: 24, fontWeight: 700 }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "products" && (
        <div>
          <button className="btn-gold" style={{ marginBottom: 22, fontSize: 12.5 }} onClick={() => setEditing({ ...blankProduct })}>+ ADD PRODUCT</button>
          {editing && (
            <div className="card" style={{ padding: 26, marginBottom: 26, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <input placeholder="Product Name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <select value={editing.brand} onChange={(e) => setEditing({ ...editing, brand: e.target.value })}>
                {Object.keys(CATEGORIES).map((b) => <option key={b}>{b}</option>)}
              </select>
              <input placeholder="Category (e.g. Samsung Galaxy)" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
              <input placeholder="Model" value={editing.model} onChange={(e) => setEditing({ ...editing, model: e.target.value })} />
              <input placeholder="Storage" value={editing.storage} onChange={(e) => setEditing({ ...editing, storage: e.target.value })} />
              <input placeholder="RAM" value={editing.ram} onChange={(e) => setEditing({ ...editing, ram: e.target.value })} />
              <input placeholder="Display" value={editing.display} onChange={(e) => setEditing({ ...editing, display: e.target.value })} />
              <input placeholder="Main Camera" value={editing.camera} onChange={(e) => setEditing({ ...editing, camera: e.target.value })} />
              <input placeholder="Front Camera" value={editing.frontCamera} onChange={(e) => setEditing({ ...editing, frontCamera: e.target.value })} />
              <input placeholder="Battery" value={editing.battery} onChange={(e) => setEditing({ ...editing, battery: e.target.value })} />
              <input placeholder="Network" value={editing.network} onChange={(e) => setEditing({ ...editing, network: e.target.value })} />
              <input placeholder="Condition" value={editing.condition} onChange={(e) => setEditing({ ...editing, condition: e.target.value })} />
              <input placeholder="Color" value={editing.color} onChange={(e) => setEditing({ ...editing, color: e.target.value })} />
              <input type="number" placeholder="Cash Price (optional)" value={editing.cash ?? ""} onChange={(e) => setEditing({ ...editing, cash: e.target.value === "" ? null : Number(e.target.value) })} />
              <input type="number" placeholder="Deposit (KES)" value={editing.deposit ?? ""} onChange={(e) => setEditing({ ...editing, deposit: e.target.value === "" ? null : Number(e.target.value) })} />
              <input type="number" placeholder="Weekly Payment (KES)" value={editing.weekly ?? ""} onChange={(e) => setEditing({ ...editing, weekly: e.target.value === "" ? null : Number(e.target.value) })} />
              <input placeholder="Payment Duration" value={editing.duration} onChange={(e) => setEditing({ ...editing, duration: e.target.value })} />
              <input type="number" placeholder="Stock" value={editing.stock} onChange={(e) => setEditing({ ...editing, stock: Number(e.target.value) })} />
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Active (visible in shop)
              </label>
              <textarea placeholder="Description" style={{ gridColumn: "1 / -1" }} value={editing.desc} onChange={(e) => setEditing({ ...editing, desc: e.target.value })} />
              <ImageUploader images={editing.images || []} onChange={(imgs) => setEditing({ ...editing, images: imgs })} />
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12.5 }}>
                {["featured", "bestSeller", "newArrival", "limitedStock", "onSale"].map((f) => (
                  <label key={f} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="checkbox" checked={editing[f]} onChange={(e) => setEditing({ ...editing, [f]: e.target.checked })} /> {f}
                  </label>
                ))}
              </div>
              <div style={{ gridColumn: "1 / -1", fontSize: 11, color: "#555" }}>Deposit and Weekly are stored exactly as entered — the Financing tab can suggest figures, but only "Apply" (a manual click) writes them here. Nothing here is auto-recalculated.</div>
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10 }}>
                <button className="btn-gold" onClick={() => saveProduct(editing)}>SAVE</button>
                <button className="btn-outline" onClick={() => setEditing(null)}>CANCEL</button>
              </div>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {products.map((p) => (
              <div key={p.id} className="card" style={{ display: "flex", alignItems: "center", gap: 16, padding: 14, flexWrap: "wrap" }}>
                <div style={{ width: 40, height: 40, overflow: "hidden", background: "#050505" }}>
                  {p.images?.length ? <img src={p.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <PhoneGlyph size={20} />}
                </div>
                <div style={{ flex: 1, fontSize: 13.5, minWidth: 160 }}>{p.name} <span style={{ color: "#8a8a8a" }}>· {p.brand} · {p.cash != null ? fmt(p.cash) : `Deposit ${fmt(p.deposit)}`} · stock {p.stock}{p.active === false ? " · inactive" : ""}</span></div>
                <button onClick={() => setEditing(p)} className="btn-outline" style={{ fontSize: 11.5, padding: "7px 14px" }}>EDIT</button>
                <button onClick={() => deleteProduct(p.id)} style={{ background: "none", border: "none", color: "#8a6d1f", cursor: "pointer" }}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "orders" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {orders.length === 0 && <div style={{ color: "#8a8a8a" }}>No orders yet.</div>}
          {orders.map((o) => (
            <div key={o.number} className="card" style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span className="gold" style={{ fontWeight: 700, fontSize: 13.5 }}>{o.number}</span>
                <span style={{ fontSize: 12.5, color: "#8a8a8a" }}>{o.status}</span>
              </div>
              <div style={{ fontSize: 13 }}>{o.form.name} · {o.form.phone} · {o.form.location}</div>
              <div style={{ fontSize: 13, color: "#8a8a8a" }}>{o.items.map((i) => `${i.product.name} ×${i.qty}`).join(", ")} — {fmt(o.subtotal)}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "financing" && (
        <div className="card" style={{ padding: 28, maxWidth: 480 }}>
          <div className="eyebrow" style={{ marginBottom: 18 }}>Private Financing Calculator</div>
          <label style={{ fontSize: 12.5, color: "#8a8a8a" }}>Cash Price</label>
          <input type="number" value={calcInput} onChange={(e) => setCalcInput(e.target.value)} style={{ width: "100%", marginTop: 6, marginBottom: 20 }} />
          {[["Deposit (40%)", fin.deposit], ["Finance Amount", fin.financeAmount], ["3-Month Weekly", fin.weekly3], ["6-Month Weekly", fin.weekly6]].map(([l, v]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "10px 0", borderTop: "1px solid #262626" }}>
              <span style={{ color: "#8a8a8a" }}>{l}</span><span className="gold">{fmt(v)}</span>
            </div>
          ))}
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button className="btn-gold" style={{ fontSize: 12.5 }}
              onClick={() => navigator.clipboard?.writeText(`Cash: ${fmt(Number(calcInput))}\nDeposit: ${fmt(fin.deposit)}\n3mo weekly: ${fmt(fin.weekly3)}\n6mo weekly: ${fmt(fin.weekly6)}`)}>
              COPY RESULTS
            </button>
            {editing && <button className="btn-outline" style={{ fontSize: 12.5 }} onClick={applyDepositWeeklyToEditing}>APPLY DEPOSIT/WEEKLY TO OPEN PRODUCT</button>}
          </div>
          <p style={{ fontSize: 11, color: "#555", marginTop: 16, lineHeight: 1.6 }}>This calculator, and the 40% deposit / weekly-installment formula, exist only here — customers only ever see the final Cash Price, Deposit, and Weekly figures on the storefront. Existing MANNI-approved figures are never recalculated automatically; "Apply" only writes to a product you have open for editing, and only when you click it.</p>
        </div>
      )}

      {tab === "settings" && (
        <div className="card" style={{ padding: 28, maxWidth: 480, display: "flex", flexDirection: "column", gap: 14 }}>
          {Object.entries(settings).map(([k, v]) => (
            <div key={k}>
              <label style={{ fontSize: 12, color: "#8a8a8a", textTransform: "capitalize" }}>{k === "adminPassword" ? "Admin Password" : k.replace(/([A-Z])/g, " $1")}</label>
              <input type={k === "adminPassword" ? "password" : "text"} value={v} onChange={(e) => saveSettings({ ...settings, [k]: e.target.value })} style={{ width: "100%", marginTop: 4 }} />
            </div>
          ))}
          <div style={{ fontSize: 10.5, color: "#555", lineHeight: 1.6 }}>Settings save automatically and are shared storefront-wide.</div>
        </div>
      )}
    </div>
  );
}

/* ================= FOOTER ================= */
function Footer({ setPage }) {
  return (
    <footer style={{ borderTop: "1px solid rgba(212,175,55,0.15)", padding: "56px 24px 40px", background: "linear-gradient(180deg, #000, #050505)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 30, marginBottom: 36 }}>
          <div>
            <div className="display gold-metal" style={{ fontSize: 26, fontWeight: 700, letterSpacing: "0.06em", marginBottom: 10 }}>MANNI</div>
            <div style={{ fontSize: 12, color: "#666", maxWidth: 260, lineHeight: 1.6 }}>Premium smartphones. Flexible payments. Delivered with confidence, across Kenya.</div>
          </div>
          <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 12, fontSize: 10.5 }}>Shop</div>
              {["shop", "lipa", "about", "contact"].map((k) => (
                <button key={k} onClick={() => setPage(k)} style={{ display: "block", background: "none", border: "none", color: "#8a8a8a", cursor: "pointer", fontSize: 13, padding: "4px 0" }}>{k === "lipa" ? "Lipa Polepole" : k[0].toUpperCase() + k.slice(1)}</button>
              ))}
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 12, fontSize: 10.5 }}>Connect</div>
              {["WhatsApp", "Instagram", "TikTok", "Facebook"].map((s) => (
                <div key={s} style={{ fontSize: 13, color: "#8a8a8a", padding: "4px 0" }}>{s}</div>
              ))}
            </div>
          </div>
        </div>
        <div className="gold-divider" style={{ marginBottom: 20 }} />
        <div style={{ fontSize: 11.5, color: "#555" }}>© 2026 MANNI Luxury Phones. All rights reserved.</div>
      </div>
    </footer>
  );
}

/* ================= APP ================= */
export default function App() {
  const [ready, setReady] = useState(false);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [settings, setSettings] = useState(seedSettings);
  const [error, setError] = useState("");

  const [page, setPage] = useState("home");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState([]);
  const [selected, setSelected] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [applyProduct, setApplyProduct] = useState(null);
  const openApply = (p) => setApplyProduct(p);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    (async () => {
      const [p, o, t, s] = await Promise.all([
        storageLoad("products", null),
        storageLoad("orders", []),
        storageLoad("testimonials", null),
        storageLoad("settings", null),
      ]);
      if (p === null) {
        setProducts(seedProducts);
        storageSave("products", seedProducts);
      } else {
        // Merge in any new seed products (like newly added catalog items) that
        // aren't in the saved list yet, without touching existing saved products.
        const existingIds = new Set(p.map((x) => x.id));
        const missing = seedProducts.filter((sp) => !existingIds.has(sp.id));
        const merged = missing.length > 0 ? [...p, ...missing] : p;
        setProducts(merged);
        if (missing.length > 0) storageSave("products", merged);
      }
      if (t === null) { setTestimonials(seedTestimonials); storageSave("testimonials", seedTestimonials); } else setTestimonials(t);
      if (s === null) { setSettings(seedSettings); storageSave("settings", seedSettings); } else setSettings(s);
      setOrders(o);
      setReady(true);
    })();
  }, []);

  const saveProducts = useCallback(async (next) => {
    setProducts(next);
    const ok = await storageSave("products", next);
    if (!ok) setError("Couldn't save to storage — your change may not persist. Try again.");
  }, []);
  const saveOrders = useCallback(async (next) => {
    setOrders(next);
    const ok = await storageSave("orders", next);
    if (!ok) setError("Couldn't save the order to storage. Try again.");
  }, []);
  const saveSettings = useCallback(async (next) => {
    setSettings(next);
    const ok = await storageSave("settings", next);
    if (!ok) setError("Couldn't save settings to storage.");
  }, []);

  const addToCart = (p) => setCart((prev) => {
    const found = prev.find((c) => c.id === p.id);
    return found ? prev.map((c) => (c.id === p.id ? { ...c, qty: c.qty + 1 } : c)) : [...prev, { id: p.id, qty: 1 }];
  });
  const updateQty = (id, qty) => setCart((prev) => prev.map((c) => (c.id === id ? { ...c, qty } : c)));
  const removeItem = (id) => setCart((prev) => prev.filter((c) => c.id !== id));
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const viewProduct = (p) => { setSelected(p); setPage("product"); };

  const placeOrder = async (form, items, subtotal) => {
    setPlacing(true);
    const number = "MN" + Math.floor(100000 + Math.random() * 900000);
    const order = { number, form, items, subtotal, status: "Pending" };

    const nextProducts = products.map((p) => {
      const line = items.find((i) => i.id === p.id);
      return line ? { ...p, stock: Math.max(0, p.stock - line.qty) } : p;
    });
    await saveProducts(nextProducts);
    await saveOrders([order, ...orders]);

    // Every order forwards to WhatsApp automatically — this is the reliable channel,
    // since storage here is per-device and won't reach you from another visitor's browser.
    const lines = [
      "*New MANNI Order*",
      `Order #: ${number}`,
      "",
      ...items.map((i) => `${i.product.name} (${i.product.storage}) × ${i.qty} — ${fmt(priceMetric(i.product) * i.qty)}`),
      "",
      `Total: ${fmt(subtotal)}`,
      `Payment Method: ${form.payment}`,
      `Plan: ${form.plan}`,
      "",
      `Name: ${form.name}`,
      `Phone: ${form.phone}`,
      form.email ? `Email: ${form.email}` : "",
      `Delivery Location: ${form.location}`,
      form.notes ? `Notes: ${form.notes}` : "",
    ].filter(Boolean).join("\n");
    window.open(waLink(settings.whatsapp, lines), "_blank", "noopener,noreferrer");

    setLastOrder(order);
    setCart([]);
    setPlacing(false);
    setPage("confirmation");
  };

  let brandFilter = null;
  if (page === "shop-iphone") brandFilter = "iPhone";
  if (page === "shop-samsung") brandFilter = "Samsung";
  if (page === "shop-motorola") brandFilter = "Motorola";
  const shopPage = page.startsWith("shop");

  if (!ready) return <LoadingScreen />;

  return (
    <div className="manni">
      <GlobalStyle />
      <ErrorBanner message={error} onDismiss={() => setError("")} />
      <Header page={page} setPage={setPage} cartCount={cartCount} query={query} setQuery={setQuery} isAdmin={isAdmin} />

      {page === "home" && <Home products={products} testimonials={testimonials} setPage={setPage} onView={viewProduct} onAdd={addToCart} />}
      {shopPage && <Shop products={products} query={query} brandFilter={brandFilter} onView={viewProduct} onAdd={addToCart} />}
      {page === "product" && selected && <ProductPage p={products.find((p) => p.id === selected.id) || selected} onAdd={addToCart} setPage={setPage} settings={settings} onApply={openApply} />}
      {page === "cart" && <CartPage cart={cart} products={products} updateQty={updateQty} removeItem={removeItem} setPage={setPage} />}
      {page === "checkout" && <Checkout cart={cart} products={products} setPage={setPage} placeOrder={placeOrder} placing={placing} />}
      {page === "confirmation" && <OrderConfirmation order={lastOrder} setPage={setPage} settings={settings} />}
      {page === "lipa" && <LipaPolepole products={products} onApply={openApply} />}
      {page === "about" && <About />}
      {page === "contact" && <Contact settings={settings} />}
      {page === "admin-login" && <AdminLogin settings={settings} onLogin={() => { setIsAdmin(true); setPage("admin"); }} />}
      {page === "admin" && (isAdmin
        ? <AdminDashboard products={products} saveProducts={saveProducts} orders={orders} settings={settings} saveSettings={saveSettings} onLogout={() => { setIsAdmin(false); setPage("home"); }} />
        : <AdminLogin settings={settings} onLogin={() => setIsAdmin(true)} />)}

      <a href={waLink(settings.whatsapp, "Hi MANNI Luxury Phones, I have a question.")} target="_blank" rel="noopener noreferrer"
        style={{ position: "fixed", bottom: 22, right: 22, background: "linear-gradient(135deg,#efd98e,#D4AF37 60%,#b8933f)", color: "#000", borderRadius: "50%", width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 30px -6px rgba(212,175,55,0.5)", zIndex: 50 }}>
        <MessageCircle size={24} />
      </a>

      <Footer setPage={setPage} />

      {applyProduct !== undefined && applyProduct !== null && (
        <LipaApplyModal product={applyProduct} settings={settings} onClose={() => setApplyProduct(null)} />
      )}
    </div>
  );
}
