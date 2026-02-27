import { useState, useEffect } from "react";

const CATEGORIES = ["Sleep", "Shelter", "Cooking", "Clothing", "Navigation", "Safety", "Hygiene", "Tools", "Other"];

// weights stored in ounces
const DEFAULT_GEAR = [
  { id: 1, name: "Sleeping Bag", category: "Sleep", weight: 32, needsReplacement: false, notes: "-15°C rated" },
  { id: 2, name: "Sleeping Pad", category: "Sleep", weight: 14, needsReplacement: false, notes: "" },
  { id: 3, name: "Tent (2-person)", category: "Shelter", weight: 63, needsReplacement: false, notes: "" },
  { id: 4, name: "Camp Stove", category: "Cooking", weight: 9, needsReplacement: true, notes: "Igniter broken" },
  { id: 5, name: "Fuel Canister", category: "Cooking", weight: 8, needsReplacement: false, notes: "" },
  { id: 6, name: "Headlamp", category: "Tools", weight: 3, needsReplacement: false, notes: "Extra batteries packed" },
  { id: 7, name: "First Aid Kit", category: "Safety", weight: 6, needsReplacement: false, notes: "" },
  { id: 8, name: "Rain Jacket", category: "Clothing", weight: 11, needsReplacement: false, notes: "" },
];

// Format ounces as "X lb Y oz" or just "Y oz"
const formatWeight = (oz) => {
  if (!oz) return null;
  const lbs = Math.floor(oz / 16);
  const rem = Math.round(oz % 16);
  if (lbs === 0) return `${rem} oz`;
  if (rem === 0) return `${lbs} lb`;
  return `${lbs} lb ${rem} oz`;
};

const CATEGORY_ICONS = {
  Sleep: "🌙", Shelter: "⛺", Cooking: "🔥", Clothing: "🧥",
  Navigation: "🧭", Safety: "🩺", Hygiene: "🧼", Tools: "🔧", Other: "📦"
};

let nextId = 100;

export default function CampingOrganizer() {
  const [gear, setGear] = useState(() => {
    try {
      const saved = localStorage.getItem("camping-gear");
      const parsed = saved ? JSON.parse(saved) : DEFAULT_GEAR;
      // deduplicate by id — keep last occurrence
      const seen = new Map();
      parsed.forEach(g => seen.set(g.id, g));
      const deduped = Array.from(seen.values());
      const maxId = deduped.reduce((m, g) => Math.max(m, g.id ?? 0), 0);
      if (maxId >= nextId) nextId = maxId + 1;
      return deduped;
    } catch { return DEFAULT_GEAR; }
  });

  const [trips, setTrips] = useState(() => {
    try {
      const saved = localStorage.getItem("camping-trips");
      const parsed = saved ? JSON.parse(saved) : [];
      const maxId = parsed.reduce((m, t) => Math.max(m, t.id ?? 0), 0);
      if (maxId >= nextId) nextId = maxId + 1;
      return parsed;
    } catch { return []; }
  });

  const [view, setView] = useState("inventory"); // inventory | trips | tripDetail
  const [activeTrip, setActiveTrip] = useState(null);
  const [filterCategory, setFilterCategory] = useState("All");
  const [showAddGear, setShowAddGear] = useState(false);
  const [showAddTrip, setShowAddTrip] = useState(false);
  const [newGear, setNewGear] = useState({ name: "", category: "Sleep", weight: "", notes: "" });
  const [newTrip, setNewTrip] = useState({ name: "", date: "", destination: "", notes: "" });
  const [editingGear, setEditingGear] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false); // 'export' | 'import' | false
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");

  useEffect(() => {
    try { localStorage.setItem("camping-gear", JSON.stringify(gear)); } catch {}
  }, [gear]);

  useEffect(() => {
    try { localStorage.setItem("camping-trips", JSON.stringify(trips)); } catch {}
  }, [trips]);

  const addGear = () => {
    if (!newGear.name.trim()) return;
    setGear(g => [...g, { ...newGear, id: Date.now(), needsReplacement: false, weight: Number(newGear.weight) || 0 }]);
    setNewGear({ name: "", category: "Sleep", weight: "", notes: "" });
    setShowAddGear(false);
  };

  const toggleReplacement = (id) => {
    setGear(g => g.map(item => item.id === id ? { ...item, needsReplacement: !item.needsReplacement } : item));
  };

  const saveEdit = () => {
    if (!editingGear.name.trim()) return;
    setGear(g => g.map(item => item.id === editingGear.id
      ? { ...editingGear, weight: Number(editingGear.weight) || 0 }
      : item
    ));
    setEditingGear(null);
  };

  const deleteGear = (id) => {
    setGear(g => g.filter(item => item.id !== id));
    setTrips(ts => ts.map(t => ({ ...t, packedGearIds: t.packedGearIds.filter(gid => gid !== id) })));
  };

  const addTrip = () => {
    if (!newTrip.name.trim()) return;
    const trip = { ...newTrip, id: Date.now(), packedGearIds: [] };
    setTrips(ts => [...ts, trip]);
    setNewTrip({ name: "", date: "", destination: "", notes: "" });
    setShowAddTrip(false);
    setActiveTrip(trip.id);
    setView("tripDetail");
  };

  const deleteTrip = (id) => {
    setTrips(ts => ts.filter(t => t.id !== id));
    if (activeTrip === id) { setActiveTrip(null); setView("trips"); }
  };

  const updateTripNotes = (tripId, notes) => {
    setTrips(ts => ts.map(t => t.id === tripId ? { ...t, notes } : t));
  };

  const exportPackingList = (trip) => {
    const lines = [];
    lines.push(`🏕 ${trip.name}`);
    if (trip.destination) lines.push(`📍 ${trip.destination}`);
    if (trip.date) lines.push(`📅 ${trip.date}`);
    if (trip.notes?.trim()) lines.push(`\n📝 Notes:\n${trip.notes.trim()}`);
    lines.push("");

    const packedGear = gear.filter(g => trip.packedGearIds.includes(g.id));
    const totalW = packedGear.reduce((s, g) => s + (g.weight || 0), 0);
    lines.push(`Packing List (${packedGear.length} items${totalW ? ` · ${formatWeight(totalW)}` : ""})`);
    lines.push("─".repeat(36));

    CATEGORIES.forEach(cat => {
      const items = packedGear.filter(g => g.category === cat);
      if (!items.length) return;
      lines.push(`\n${CATEGORY_ICONS[cat]} ${cat.toUpperCase()}`);
      items.forEach(item => {
        const parts = [`  ☐ ${item.name}`];
        if (item.weight) parts.push(`(${formatWeight(item.weight)})`);
        if (item.notes) parts.push(`— ${item.notes}`);
        if (item.needsReplacement) parts.push(`⚠ needs replacement`);
        lines.push(parts.join(" "));
      });
    });

    const unpacked = gear.filter(g => !trip.packedGearIds.includes(g.id));
    if (unpacked.length) {
      lines.push(`\n── Not packing (${unpacked.length} items) ──`);
      unpacked.forEach(item => lines.push(`  ${item.name}`));
    }

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  const exportData = () => {
    const payload = JSON.stringify({ gear, trips }, null, 2);
    navigator.clipboard.writeText(payload).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  const importData = () => {
    setImportError("");
    try {
      const parsed = JSON.parse(importText.trim());
      if (!Array.isArray(parsed.gear) || !Array.isArray(parsed.trips)) {
        setImportError("Invalid format — make sure you pasted the full exported text.");
        return;
      }
      // deduplicate gear by id
      const seen = new Map();
      parsed.gear.forEach(g => seen.set(g.id, g));
      const deduped = Array.from(seen.values());
      const maxId = [...deduped, ...parsed.trips].reduce((m, x) => Math.max(m, x.id ?? 0), 0);
      if (maxId >= nextId) nextId = maxId + 1;
      setGear(deduped);
      setTrips(parsed.trips);
      setImportText("");
      setShowDataModal(false);
    } catch {
      setImportError("Couldn't parse that — make sure you copied the full export text without changes.");
    }
  };

  const toggleGearInTrip = (tripId, gearId) => {
    setTrips(ts => ts.map(t => {
      if (t.id !== tripId) return t;
      const has = t.packedGearIds.includes(gearId);
      return { ...t, packedGearIds: has ? t.packedGearIds.filter(id => id !== gearId) : [...t.packedGearIds, gearId] };
    }));
  };

  const currentTrip = trips.find(t => t.id === activeTrip);

  const filteredGear = gear.filter(item => {
    const matchCat = filterCategory === "All" || item.category === filterCategory;
    const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const groupedGear = CATEGORIES.reduce((acc, cat) => {
    const items = filteredGear.filter(g => g.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  const needsReplacementCount = gear.filter(g => g.needsReplacement).length;
  const totalWeight = gear.reduce((s, g) => s + (g.weight || 0), 0);

  const tripWeight = currentTrip
    ? gear.filter(g => currentTrip.packedGearIds.includes(g.id)).reduce((s, g) => s + (g.weight || 0), 0)
    : 0;

  return (
    <div className="topo-root" style={{
      fontFamily: "'Nunito', 'Helvetica Neue', sans-serif",
      minHeight: "100vh",
      color: "#ddebc8",
      position: "relative",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Playfair+Display:wght@700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #1c2e1a; }
        ::-webkit-scrollbar-thumb { background: #4a7a30; border-radius: 3px; }

        .topo-bg {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background: #1c2e1a;
        }

        /* Tiling topo pattern applied to the root element so it scrolls with content */
        .topo-root {
          background-color: #1c2e1a;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1440' height='600'%3E%3C!-- filled terrain bands --%3E%3Cpath d='M-100%2C480 C150%2C450 350%2C490 600%2C460 C800%2C435 1000%2C468 1250%2C448 C1360%2C438 1430%2C452 1540%2C444 L1540%2C600 L-100%2C600 Z' fill='%23213520' opacity='0.9'/%3E%3Cpath d='M-100%2C380 C200%2C345 400%2C385 650%2C355 C850%2C330 1050%2C365 1300%2C342 C1400%2C332 1460%2C346 1540%2C338 L1540%2C600 L-100%2C600 Z' fill='%23263d22' opacity='0.55'/%3E%3Cpath d='M-100%2C280 C150%2C245 380%2C285 620%2C255 C820%2C230 1020%2C265 1260%2C242 C1370%2C232 1440%2C246 1540%2C238 L1540%2C600 L-100%2C600 Z' fill='%232b4525' opacity='0.4'/%3E%3C!-- contour lines group 1 - lower valley --%3E%3Cpath d='M-100%2C510 C0%2C492 140%2C518 320%2C498 C500%2C478 620%2C505 800%2C485 C980%2C465 1100%2C492 1300%2C474 C1400%2C465 1460%2C472 1540%2C466' fill='none' stroke='%233a6030' stroke-width='1.5' opacity='0.6'/%3E%3Cpath d='M-100%2C532 C20%2C512 160%2C540 340%2C518 C520%2C496 640%2C525 820%2C504 C1000%2C483 1120%2C512 1320%2C492 C1415%2C482 1465%2C490 1540%2C484' fill='none' stroke='%233a6030' stroke-width='1' opacity='0.42'/%3E%3Cpath d='M-100%2C552 C40%2C530 180%2C560 360%2C537 C540%2C514 660%2C544 840%2C522 C1020%2C500 1140%2C530 1340%2C510 C1428%2C500 1470%2C508 1540%2C502' fill='none' stroke='%233a6030' stroke-width='0.7' opacity='0.3'/%3E%3C!-- contour lines group 2 - mid slope --%3E%3Cpath d='M-100%2C405 C80%2C372 260%2C408 500%2C378 C700%2C352 880%2C386 1120%2C360 C1270%2C344 1400%2C368 1540%2C352' fill='none' stroke='%234a7835' stroke-width='2' opacity='0.62'/%3E%3Cpath d='M-100%2C428 C100%2C392 285%2C430 525%2C398 C725%2C370 905%2C408 1145%2C380 C1295%2C362 1420%2C388 1540%2C372' fill='none' stroke='%234a7835' stroke-width='1.4' opacity='0.46'/%3E%3Cpath d='M-100%2C450 C120%2C412 305%2C452 548%2C418 C748%2C388 928%2C428 1168%2C398 C1318%2C378 1438%2C406 1540%2C390' fill='none' stroke='%234a7835' stroke-width='0.9' opacity='0.32'/%3E%3C!-- contour lines group 3 - upper ridge --%3E%3Cpath d='M-100%2C295 C80%2C258 280%2C298 520%2C265 C720%2C238 920%2C272 1160%2C248 C1300%2C234 1430%2C256 1540%2C242' fill='none' stroke='%235a9040' stroke-width='2.2' opacity='0.58'/%3E%3Cpath d='M-100%2C318 C100%2C278 300%2C320 542%2C285 C742%2C256 942%2C292 1182%2C266 C1322%2C250 1448%2C275 1540%2C260' fill='none' stroke='%235a9040' stroke-width='1.6' opacity='0.42'/%3E%3Cpath d='M-100%2C340 C118%2C298 318%2C342 562%2C305 C762%2C274 962%2C312 1202%2C284 C1342%2C266 1460%2C293 1540%2C278' fill='none' stroke='%235a9040' stroke-width='1' opacity='0.3'/%3E%3Cpath d='M-100%2C360 C135%2C316 335%2C362 580%2C323 C780%2C290 980%2C330 1220%2C300 C1358%2C280 1468%2C310 1540%2C294' fill='none' stroke='%235a9040' stroke-width='0.6' opacity='0.22'/%3E%3C!-- contour lines group 4 - near summit --%3E%3Cpath d='M-100%2C175 C100%2C138 320%2C178 580%2C145 C780%2C118 980%2C152 1220%2C128 C1358%2C112 1460%2C135 1540%2C120' fill='none' stroke='%236aaa45' stroke-width='2.4' opacity='0.5'/%3E%3Cpath d='M-100%2C200 C120%2C160 340%2C202 602%2C167 C802%2C138 1002%2C175 1242%2C149 C1380%2C131 1468%2C157 1540%2C142' fill='none' stroke='%236aaa45' stroke-width='1.7' opacity='0.36'/%3E%3Cpath d='M-100%2C222 C138%2C180 358%2C224 622%2C187 C822%2C156 1022%2C196 1262%2C168 C1398%2C148 1472%2C178 1540%2C162' fill='none' stroke='%236aaa45' stroke-width='1.1' opacity='0.26'/%3E%3Cpath d='M-100%2C242 C155%2C198 375%2C244 640%2C205 C840%2C172 1040%2C215 1280%2C185 C1414%2C164 1475%2C196 1540%2C180' fill='none' stroke='%236aaa45' stroke-width='0.6' opacity='0.18'/%3E%3C!-- subtle fill bands --%3E%3Cpath d='M-100%2C258 C80%2C218 280%2C258 520%2C225 C720%2C198 920%2C232 1160%2C208 C1300%2C194 1430%2C216 1540%2C202 L1540%2C318 C1420%2C332 1285%2C308 1140%2C324 C900%2C348 700%2C312 460%2C340 C230%2C368 65%2C335 -100%2C358 Z' fill='%232d4d22' opacity='0.15'/%3E%3Cpath d='M-100%2C80 C120%2C44 340%2C84 600%2C52 C800%2C26 1000%2C58 1240%2C36 C1370%2C22 1460%2C42 1540%2C28 L1540%2C175 C1450%2C188 1340%2C165 1200%2C180 C960%2C200 760%2C168 520%2C194 C290%2C218 110%2C188 -100%2C210 Z' fill='%23365828' opacity='0.12'/%3E%3C/svg%3E");
          background-repeat: repeat-y;
          background-size: 100% auto;
        }

        .content-layer { position: relative; z-index: 1; }

        .gear-card {
          transition: all 0.2s ease;
          border: 1.5px solid #2e4a24;
          background: rgba(28, 42, 22, 0.85);
          backdrop-filter: blur(6px);
          border-radius: 14px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.25);
        }
        .gear-card:hover { border-color: #6aaa3a; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.35); }

        .btn { cursor: pointer; border: none; font-family: inherit; font-size: 13px; font-weight: 700; transition: all 0.15s; }
        .btn-primary { background: #4a9a28; color: #f0f8e8; padding: 9px 18px; border-radius: 50px; letter-spacing: 0.02em; box-shadow: 0 3px 12px rgba(60,140,30,0.35); }
        .btn-primary:hover { background: #5ab030; transform: translateY(-1px); box-shadow: 0 5px 16px rgba(60,140,30,0.45); }
        .btn-ghost { background: transparent; color: #7aaa50; padding: 6px 10px; border-radius: 8px; font-weight: 600; }
        .btn-ghost:hover { background: rgba(80,130,40,0.2); color: #a0d070; }
        .btn-danger { background: transparent; color: #e07060; border: 1.5px solid rgba(200,80,60,0.4); padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; }
        .btn-danger:hover { background: rgba(200,80,60,0.15); border-color: #e07060; }

        .nav-tab { cursor: pointer; padding: 10px 22px; border-bottom: 3px solid transparent; color: #5a7a42; font-size: 13px; font-weight: 700; transition: all 0.15s; letter-spacing: 0.06em; text-transform: uppercase; }
        .nav-tab.active { border-color: #6aaa3a; color: #c8e8a0; }
        .nav-tab:hover:not(.active) { color: #8ac860; }

        input, select, textarea {
          background: rgba(20, 34, 16, 0.8); border: 1.5px solid #2e4a24; color: #ddebc8;
          padding: 9px 14px; border-radius: 10px; font-family: inherit; font-size: 13px; font-weight: 600;
          width: 100%; outline: none; transition: border-color 0.15s;
        }
        input:focus, select:focus, textarea:focus { border-color: #4a9a28; box-shadow: 0 0 0 3px rgba(74,154,40,0.18); }
        select option { background: #1c2e1a; color: #ddebc8; }
        ::placeholder { color: #4a6a38; font-weight: 500; }

        .badge { display: inline-block; padding: 3px 10px; border-radius: 50px; font-size: 11px; font-weight: 800; letter-spacing: 0.03em; }
        .badge-warn { background: rgba(180,90,20,0.25); color: #f0a850; border: 1.5px solid rgba(200,120,30,0.5); }
        .badge-ok { background: rgba(60,140,30,0.2); color: #90d860; border: 1.5px solid rgba(80,160,40,0.45); }
        .badge-cat { background: rgba(60,110,30,0.2); color: #80b850; border: 1.5px solid rgba(80,130,40,0.4); }

        .trip-card { cursor: pointer; border: 1.5px solid #2e4a24; background: rgba(28,42,22,0.85); backdrop-filter: blur(6px); border-radius: 16px; padding: 18px; transition: all 0.2s; box-shadow: 0 2px 12px rgba(0,0,0,0.25); }
        .trip-card:hover { border-color: #6aaa3a; box-shadow: 0 6px 20px rgba(0,0,0,0.35); transform: translateY(-2px); }

        .checkbox-row { cursor: pointer; display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 10px; transition: background 0.1s; }
        .checkbox-row:hover { background: rgba(80,130,40,0.15); }

        .modal-bg { position: fixed; inset: 0; background: rgba(10,20,8,0.75); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #1e3018; border: 1.5px solid #3a5a28; border-radius: 20px; padding: 28px; width: 100%; max-width: 420px; box-shadow: 0 24px 64px rgba(0,0,0,0.5); }

        .stat-box { background: rgba(28,42,22,0.85); backdrop-filter: blur(6px); border: 1.5px solid #2e4a24; border-radius: 16px; padding: 16px 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); }
      `}</style>


      {/* Header */}
      <div className="content-layer" style={{ borderBottom: "1px solid #2e4a24", padding: "0 24px", background: "rgba(20,32,16,0.85)", backdropFilter: "blur(10px)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ padding: "20px 0 0", display: "flex", alignItems: "baseline", gap: 12 }}>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, color: "#a8d870", letterSpacing: "-0.02em" }}>
              ⛺ TRAILPACK
            </h1>
            <span style={{ color: "#4a7a32", fontSize: 12, letterSpacing: "0.12em", fontWeight: 700 }}>GEAR ORGANIZER</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
            <div style={{ display: "flex", gap: 4 }}>
              {["inventory", "trips"].map(v => (
                <div key={v} className={`nav-tab ${view === v || (view === "tripDetail" && v === "trips") ? "active" : ""}`}
                  onClick={() => { setView(v); if (v === "inventory") setSearchQuery(""); }}>
                  {v === "inventory" ? "My Gear" : "Trips"}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, paddingRight: 4 }}>
              <button className="btn btn-ghost" style={{ fontSize: 11, letterSpacing: "0.05em", padding: "5px 10px", border: "1px solid #2e4a24", borderRadius: 8 }}
                onClick={() => { setShowDataModal("export"); setCopied(false); }}>
                ⬆ Export
              </button>
              <button className="btn btn-ghost" style={{ fontSize: 11, letterSpacing: "0.05em", padding: "5px 10px", border: "1px solid #2e4a24", borderRadius: 8 }}
                onClick={() => { setShowDataModal("import"); setImportText(""); setImportError(""); }}>
                ⬇ Import
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="content-layer" style={{ maxWidth: 900, margin: "0 auto", padding: "24px" }}>

        {/* INVENTORY VIEW */}
        {view === "inventory" && (
          <div>
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
              <div className="stat-box">
                <div style={{ color: "#4a7a32", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Total Items</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#a8d870", marginTop: 4 }}>{gear.length}</div>
              </div>
              <div className="stat-box">
                <div style={{ color: "#4a7a32", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Total Weight</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#a8d870", marginTop: 4 }}>{formatWeight(totalWeight) || "—"}</div>
              </div>
              <div className="stat-box" style={{ borderColor: needsReplacementCount ? "rgba(200,120,30,0.5)" : "#2e4a24" }}>
                <div style={{ color: "#4a7a32", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Needs Replacement</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: needsReplacementCount ? "#f0a850" : "#a8d870", marginTop: 4 }}>{needsReplacementCount}</div>
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              <input placeholder="Search gear..." value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ width: "auto" }}>
                <option>All</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <button className="btn btn-primary" onClick={() => setShowAddGear(true)}>+ Add Gear</button>
            </div>

            {/* Gear grouped by category */}
            {Object.keys(groupedGear).length === 0 && (
              <div style={{ textAlign: "center", color: "#4a7a32", padding: 60, fontWeight: 600 }}>No gear found. Add some!</div>
            )}
            {Object.entries(groupedGear).map(([cat, items]) => (
              <div key={cat} style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 18 }}>{CATEGORY_ICONS[cat]}</span>
                  <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: "#7ac848", fontWeight: 800 }}>{cat}</span>
                  <span style={{ color: "#3a5a28", fontSize: 11, fontWeight: 600 }}>({items.length})</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {items.map(item => (
                    <div key={item.id} className="gear-card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, color: item.needsReplacement ? "#f0a850" : "#ddebc8" }}>{item.name}</span>
                          {item.needsReplacement && <span className="badge badge-warn">⚠ Replace</span>}
                        </div>
                        {item.notes && <div style={{ color: "#5a8a42", fontSize: 12, marginTop: 2, fontWeight: 500 }}>{item.notes}</div>}
                      </div>
                      {item.weight > 0 && <span style={{ color: "#5a8a42", fontSize: 12, whiteSpace: "nowrap", fontWeight: 600 }}>{formatWeight(item.weight)}</span>}
                      <button className="btn btn-ghost" onClick={() => setEditingGear({ ...item, weight: item.weight || "" })}
                        title="Edit" style={{ fontSize: 14, padding: "4px 8px" }}>✏</button>
                      <button className="btn btn-ghost" onClick={() => toggleReplacement(item.id)}
                        title={item.needsReplacement ? "Mark as OK" : "Flag for replacement"}
                        style={{ fontSize: 16, padding: "4px 8px" }}>
                        {item.needsReplacement ? "✓" : "⚠"}
                      </button>
                      <button className="btn btn-danger" onClick={() => deleteGear(item.id)}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TRIPS VIEW */}
        {view === "trips" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#a8d870" }}>Your Trips</h2>
              <button className="btn btn-primary" onClick={() => setShowAddTrip(true)}>+ New Trip</button>
            </div>
            {trips.length === 0 && (
              <div style={{ textAlign: "center", color: "#4a7a32", padding: 60, fontWeight: 600 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🗺</div>
                <div>No trips yet. Plan your first adventure!</div>
              </div>
            )}
            <div style={{ display: "grid", gap: 12 }}>
              {trips.map(trip => {
                const packed = trip.packedGearIds.length;
                const tripW = gear.filter(g => trip.packedGearIds.includes(g.id)).reduce((s, g) => s + (g.weight || 0), 0);
                return (
                  <div key={trip.id} className="trip-card" onClick={() => { setActiveTrip(trip.id); setView("tripDetail"); }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#a8d870" }}>{trip.name}</div>
                        {trip.destination && <div style={{ color: "#6aaa48", fontSize: 13, marginTop: 2, fontWeight: 600 }}>📍 {trip.destination}</div>}
                        {trip.date && <div style={{ color: "#6aaa48", fontSize: 13, marginTop: 2, fontWeight: 600 }}>📅 {trip.date}</div>}
                        {trip.notes?.trim() && <div style={{ color: "#4a7a32", fontSize: 12, marginTop: 4, fontWeight: 500, fontStyle: "italic", maxWidth: 280, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>📝 {trip.notes.trim()}</div>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: "#7ac848", fontSize: 13, fontWeight: 700 }}>{packed} items</div>
                        {tripW > 0 && <div style={{ color: "#5a8a42", fontSize: 12, fontWeight: 600 }}>{formatWeight(tripW)}</div>}
                      </div>
                    </div>
                    <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span className="badge badge-ok">{packed} packed</span>
                      {gear.filter(g => trip.packedGearIds.includes(g.id) && g.needsReplacement).length > 0 &&
                        <span className="badge badge-warn">has items to replace</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TRIP DETAIL VIEW */}
        {view === "tripDetail" && currentTrip && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <button className="btn btn-ghost" onClick={() => setView("trips")} style={{ fontSize: 18 }}>←</button>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#a8d870" }}>{currentTrip.name}</h2>
            </div>
            {(currentTrip.destination || currentTrip.date) && (
              <div style={{ color: "#6aaa48", fontSize: 13, marginLeft: 44, marginBottom: 16, display: "flex", gap: 16, fontWeight: 600 }}>
                {currentTrip.destination && <span>📍 {currentTrip.destination}</span>}
                {currentTrip.date && <span>📅 {currentTrip.date}</span>}
              </div>
            )}

            {/* Trip stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
              <div className="stat-box">
                <div style={{ color: "#4a7a32", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Packed</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#a8d870", marginTop: 4 }}>{currentTrip.packedGearIds.length}<span style={{ fontSize: 12, color: "#4a7a32", fontWeight: 600 }}>/{gear.length}</span></div>
              </div>
              <div className="stat-box">
                <div style={{ color: "#4a7a32", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Pack Weight</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#a8d870", marginTop: 4 }}>{formatWeight(tripWeight) || "—"}</div>
              </div>
              <div className="stat-box">
                <div style={{ color: "#4a7a32", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Not Packed</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#a8d870", marginTop: 4 }}>{gear.length - currentTrip.packedGearIds.length}</div>
              </div>
            </div>

            {/* Trip Notes */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "#7ac848", fontWeight: 800, marginBottom: 8 }}>📝 Trip Notes</div>
              <textarea
                placeholder="Campsite details, weather forecast, driving directions, gear reminders..."
                value={currentTrip.notes || ""}
                onChange={e => updateTripNotes(activeTrip, e.target.value)}
                style={{ minHeight: 90, resize: "vertical", lineHeight: 1.6, fontSize: 13 }}
              />
            </div>

            {/* Gear checklist grouped by category */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.1em", color: "#7ac848", fontWeight: 800 }}>Packing List</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" style={{ fontSize: 12 }}
                  onClick={() => setTrips(ts => ts.map(t => t.id === activeTrip ? { ...t, packedGearIds: gear.map(g => g.id) } : t))}>
                  Pack All
                </button>
                <button className="btn btn-ghost" style={{ fontSize: 12 }}
                  onClick={() => setTrips(ts => ts.map(t => t.id === activeTrip ? { ...t, packedGearIds: [] } : t))}>
                  Clear All
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 12, color: copied ? "#a8d870" : "#7aaa50", border: "1.5px solid", borderColor: copied ? "#4a9a28" : "#2e4a24", borderRadius: 8, padding: "5px 12px", transition: "all 0.2s" }}
                  onClick={() => exportPackingList(currentTrip)}>
                  {copied ? "✓ Copied!" : "⬆ Export"}
                </button>
                <button className="btn btn-danger" onClick={() => deleteTrip(activeTrip)}>Delete Trip</button>
              </div>
            </div>

            {CATEGORIES.map(cat => {
              const items = gear.filter(g => g.category === cat);
              if (!items.length) return null;
              const packedInCat = items.filter(g => currentTrip.packedGearIds.includes(g.id)).length;
              return (
                <div key={cat} style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>{CATEGORY_ICONS[cat]}</span>
                    <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "#7ac848", fontWeight: 800 }}>{cat}</span>
                    <span style={{ color: packedInCat === items.length ? "#6aaa3a" : "#3a5a28", fontSize: 11, fontWeight: 700 }}>{packedInCat}/{items.length}</span>
                  </div>
                  <div style={{ background: "rgba(28,42,22,0.85)", border: "1.5px solid #2e4a24", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.2)" }}>
                    {items.map((item, i) => {
                      const isPacked = (trips.find(t => t.id === activeTrip)?.packedGearIds ?? []).includes(item.id);
                      return (
                        <div key={item.id} className="checkbox-row"
                          style={{ borderTop: i > 0 ? "1px solid #243820" : "none" }}
                          onClick={(e) => { e.stopPropagation(); toggleGearInTrip(activeTrip, item.id); }}>
                          <div style={{
                            width: 20, height: 20, borderRadius: 6, border: `2.5px solid ${isPacked ? "#4a9a28" : "#2e4a24"}`,
                            background: isPacked ? "#4a9a28" : "transparent", display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0, transition: "all 0.15s", boxShadow: isPacked ? "0 2px 8px rgba(74,154,40,0.4)" : "none"
                          }}>
                            {isPacked && <span style={{ color: "white", fontSize: 12, lineHeight: 1, fontWeight: 900 }}>✓</span>}
                          </div>
                          <span style={{ flex: 1, color: isPacked ? "#4a7a32" : "#ddebc8", textDecoration: isPacked ? "line-through" : "none", fontSize: 14, fontWeight: isPacked ? 500 : 600 }}>
                            {item.name}
                          </span>
                          {item.needsReplacement && <span className="badge badge-warn" style={{ fontSize: 10 }}>Replace</span>}
                          {item.weight > 0 && <span style={{ color: "#4a7a32", fontSize: 12, fontWeight: 600 }}>{formatWeight(item.weight)}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Gear Modal */}
      {showAddGear && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowAddGear(false)}>
          <div className="modal">
            <h3 style={{ fontFamily: "'Playfair Display', serif", color: "#a8d870", marginBottom: 20 }}>Add Gear</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input placeholder="Gear name *" value={newGear.name} onChange={e => setNewGear(g => ({ ...g, name: e.target.value }))} autoFocus />
              <select value={newGear.category} onChange={e => setNewGear(g => ({ ...g, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <input placeholder="Weight (oz)" type="number" value={newGear.weight} onChange={e => setNewGear(g => ({ ...g, weight: e.target.value }))} />
              <input placeholder="Notes (optional)" value={newGear.notes} onChange={e => setNewGear(g => ({ ...g, notes: e.target.value }))} />
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={addGear}>Add Item</button>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowAddGear(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Trip Modal */}
      {showAddTrip && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowAddTrip(false)}>
          <div className="modal">
            <h3 style={{ fontFamily: "'Playfair Display', serif", color: "#a8d870", marginBottom: 20 }}>New Trip</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input placeholder="Trip name *" value={newTrip.name} onChange={e => setNewTrip(t => ({ ...t, name: e.target.value }))} autoFocus />
              <input placeholder="Destination (optional)" value={newTrip.destination} onChange={e => setNewTrip(t => ({ ...t, destination: e.target.value }))} />
              <input placeholder="Date (optional)" value={newTrip.date} onChange={e => setNewTrip(t => ({ ...t, date: e.target.value }))} />
              <textarea placeholder="Notes (optional)" value={newTrip.notes} onChange={e => setNewTrip(t => ({ ...t, notes: e.target.value }))} style={{ minHeight: 70, resize: "vertical", lineHeight: 1.6 }} />
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={addTrip}>Create Trip</button>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowAddTrip(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Edit Gear Modal */}
      {editingGear && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setEditingGear(null)}>
          <div className="modal">
            <h3 style={{ fontFamily: "'Playfair Display', serif", color: "#a8d870", marginBottom: 20 }}>Edit Gear</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input placeholder="Gear name *" value={editingGear.name}
                onChange={e => setEditingGear(g => ({ ...g, name: e.target.value }))} autoFocus />
              <select value={editingGear.category}
                onChange={e => setEditingGear(g => ({ ...g, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <input placeholder="Weight (oz)" type="number" value={editingGear.weight}
                onChange={e => setEditingGear(g => ({ ...g, weight: e.target.value }))} />
              <input placeholder="Notes (optional)" value={editingGear.notes}
                onChange={e => setEditingGear(g => ({ ...g, notes: e.target.value }))} />
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", color: "#f0a850", fontSize: 13, fontWeight: 700 }}>
                <input type="checkbox" checked={editingGear.needsReplacement}
                  onChange={e => setEditingGear(g => ({ ...g, needsReplacement: e.target.checked }))}
                  style={{ width: "auto", accentColor: "#f0a850" }} />
                Needs replacement
              </label>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveEdit}>Save Changes</button>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditingGear(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Data Modal */}
      {showDataModal === "export" && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowDataModal(false)}>
          <div className="modal">
            <h3 style={{ fontFamily: "'Playfair Display', serif", color: "#a8d870", marginBottom: 8 }}>Export Data</h3>
            <p style={{ color: "#6aaa48", fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
              This copies all your gear and trips as text. On your other device, open this app and use <strong style={{ color: "#a8d870" }}>Import</strong> to paste it in.
            </p>
            <div style={{ background: "rgba(20,34,16,0.8)", border: "1.5px solid #2e4a24", borderRadius: 10, padding: "12px 14px", marginBottom: 16, maxHeight: 160, overflowY: "auto" }}>
              <pre style={{ fontSize: 11, color: "#4a7a32", whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0, fontFamily: "monospace" }}>
                {JSON.stringify({ gear, trips }, null, 2)}
              </pre>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1, transition: "all 0.2s" }} onClick={exportData}>
                {copied ? "✓ Copied to clipboard!" : "Copy to Clipboard"}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowDataModal(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Data Modal */}
      {showDataModal === "import" && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowDataModal(false)}>
          <div className="modal">
            <h3 style={{ fontFamily: "'Playfair Display', serif", color: "#a8d870", marginBottom: 8 }}>Import Data</h3>
            <p style={{ color: "#6aaa48", fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
              Paste the text you copied from Export on your other device. <strong style={{ color: "#f0a850" }}>This will replace your current data.</strong>
            </p>
            <textarea
              placeholder="Paste exported data here..."
              value={importText}
              onChange={e => { setImportText(e.target.value); setImportError(""); }}
              style={{ minHeight: 160, resize: "vertical", lineHeight: 1.5, fontSize: 12, fontFamily: "monospace", marginBottom: importError ? 8 : 16 }}
              autoFocus
            />
            {importError && (
              <div style={{ color: "#f0a850", fontSize: 12, marginBottom: 12, padding: "8px 12px", background: "rgba(180,90,20,0.15)", borderRadius: 8, border: "1px solid rgba(200,120,30,0.3)" }}>
                ⚠ {importError}
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={importData} disabled={!importText.trim()}>
                Import & Replace
              </button>
              <button className="btn btn-ghost" onClick={() => setShowDataModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
