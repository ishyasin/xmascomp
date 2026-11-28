/* Shared helpers: Supabase client, event settings, run storage, leaderboard. */
(function () {
  "use strict";
  const C = window.XMAS_CONFIG || {};
  const configured = !!(C.SUPABASE_URL && !/YOUR-/.test(C.SUPABASE_URL) && C.SUPABASE_ANON_KEY && !/YOUR-/.test(C.SUPABASE_ANON_KEY));
  const db = configured && window.supabase ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: false } }) : null;

  const ROUNDS = {
    flight: { name: "Reindeer Flight", col: "flight_score" },
    grotto: { name: "Grotto Dash", col: "grotto_score" },
    quiz:   { name: "The Christmas Quiz", short: "Quiz", col: "quiz_score" }
  };

  async function rpc(name, args) {
    if (!db) throw new Error("The site is not connected to Supabase yet (see config.js).");
    const offline = "Can't reach the competition server. Check your connection and refresh the page.";
    let res;
    try { res = await db.rpc(name, args || {}); } catch (e) { throw new Error(offline); }
    const { data, error } = res;
    if (error) throw new Error(/failed to fetch|networkerror|load failed/i.test(error.message || "") ? offline : (error.message || "Something went wrong. Please try again."));
    return data;
  }

  // Event settings plus the offset between this device's clock and the server's.
  async function getEvent() {
    const rows = await rpc("get_event");
    const e = Array.isArray(rows) ? rows[0] : rows;
    const skew = new Date(e.server_now).getTime() - Date.now();
    return {
      name: e.event_name, rounds: (e.rounds || []).filter(r => ROUNDS[r]), roundSeconds: e.round_seconds,
      startsAt: new Date(e.starts_at).getTime(), endsAt: new Date(e.ends_at).getTime(),
      prizes: [e.prize_1 || "", e.prize_2 || "", e.prize_3 || ""], resultsPublic: !!e.results_public,
      now: () => Date.now() + skew
    };
  }

  const KEY = "xmasQuizRun";
  const run = {
    get() { try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) { return null; } },
    set(v) { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} },
    clear() { try { sessionStorage.removeItem(KEY); } catch (e) {} }
  };

  // Header row for the enabled rounds.
  function renderBoardHead(tr, rounds) {
    tr.textContent = "";
    const cells = [["Rank", ""], ["Name", ""]].concat(rounds.map(r => [ROUNDS[r].short || ROUNDS[r].name, "num"]), [["Total", "num"]]);
    cells.forEach(([t, cls]) => { const th = document.createElement("th"); th.scope = "col"; th.textContent = t; if (cls) th.className = cls; tr.appendChild(th); });
  }

  // Leaderboard rows built with DOM methods (names are user input: never innerHTML).
  function renderBoard(tbody, rows, rounds, highlight) {
    tbody.textContent = "";
    const span = rounds.length + 3;
    if (!rows || !rows.length) {
      const tr = document.createElement("tr"), td = document.createElement("td");
      td.colSpan = span; td.className = "empty";
      const s = document.createElement("strong"); s.textContent = "No scores yet";
      const p = document.createElement("span"); p.textContent = "Be the first on the board.";
      td.append(s, p); tr.appendChild(td); tbody.appendChild(tr); return;
    }
    rows.forEach(r => {
      const tr = document.createElement("tr");
      if (highlight && r.player_name === highlight) tr.className = "me";
      const cells = [[r.place, "pos"], [r.player_name, ""]].concat(rounds.map(k => [r[ROUNDS[k].col], "num"]), [[r.total, "num tot"]]);
      cells.forEach(([v, cls]) => {
        const td = document.createElement("td"); if (cls) td.className = cls;
        td.textContent = typeof v === "number" ? v.toLocaleString("en-GB") : String(v == null ? "" : v);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  async function loadBoard(table, status, rounds, highlight) {
    renderBoardHead(table.tHead.rows[0], rounds);
    try { renderBoard(table.tBodies[0], await rpc("get_leaderboard", { p_limit: 20 }), rounds, highlight); if (status) status.textContent = ""; }
    catch (e) { renderBoard(table.tBodies[0], [], rounds); if (status) status.textContent = e.message; }
  }

  // Snowfall drawn on a canvas: flakes of different sizes drift down and sway; a few big ones are six-armed crystals.
  // n = flakes for an area of 1000 x 600 px. Colour from the CSS variable --snow on el (default white).
  // Pauses when the tab is hidden or the snow is off screen; a still scene for reduced motion.
  function snow(el, n) {
    if (!el || el.dataset.snow) return; el.dataset.snow = "1";
    const c = document.createElement("canvas"); c.className = "snowfall"; c.setAttribute("aria-hidden", "true"); el.appendChild(c);
    const ctx = c.getContext("2d"), still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, flakes = [], raf = 0, last = 0, onScreen = true, colour = "#fff";
    const flake = top => { const r = .7 + Math.pow(Math.random(), 2.2) * 3.6;
      return { x: Math.random() * W, y: top ? -10 - Math.random() * 40 : Math.random() * H, r, vy: 16 + r * 13 + Math.random() * 10, a: 6 + r * 5, f: .4 + Math.random() * .9, p: Math.random() * 6.3,
        o: Math.min(.95, .35 + r * .17), star: r > 3.2 && Math.random() < .6, spin: Math.random() * 6.3 }; };
    function size() {
      const dpr = Math.min(2, window.devicePixelRatio || 1); W = el.clientWidth; H = el.clientHeight;
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); c.style.width = W + "px"; c.style.height = H + "px"; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const want = Math.max(20, Math.min(400, Math.round(n * W * H / 600000)));
      while (flakes.length < want) flakes.push(flake(false)); flakes.length = want;
      colour = getComputedStyle(el).getPropertyValue("--snow").trim() || "#fff";
    }
    function draw(t) {
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = colour; ctx.strokeStyle = colour;
      for (const f of flakes) {
        const x = f.x + Math.sin(t * f.f + f.p) * f.a; ctx.globalAlpha = f.o;
        if (f.star) { ctx.lineWidth = .9; ctx.save(); ctx.translate(x, f.y); ctx.rotate(f.spin + t * .3); ctx.beginPath();
          for (let k = 0; k < 3; k++) { ctx.rotate(Math.PI / 3); ctx.moveTo(-f.r * 1.6, 0); ctx.lineTo(f.r * 1.6, 0); } ctx.stroke(); ctx.restore(); }
        else { ctx.beginPath(); ctx.arc(x, f.y, f.r, 0, 6.2832); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
    }
    function tick(now) {
      raf = 0; if (document.hidden || !onScreen) return;
      const dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
      for (const f of flakes) { f.y += f.vy * dt; if (f.y > H + 12) Object.assign(f, flake(true)); }
      draw(now / 1000); raf = requestAnimationFrame(tick);
    }
    const go = () => { if (!still && !raf && !document.hidden && onScreen) { last = 0; raf = requestAnimationFrame(tick); } };
    size(); draw(0); go();
    window.addEventListener("resize", () => { size(); draw(performance.now() / 1000); });
    document.addEventListener("visibilitychange", go);
    if ("IntersectionObserver" in window) new IntersectionObserver(es => { onScreen = es[0].isIntersecting; go(); }).observe(el);
    el.addEventListener("snow:refresh", () => { size(); draw(performance.now() / 1000); });
  }

  const fmtDate = t => new Date(t).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

  window.XQ = { C, db, configured, ROUNDS, rpc, getEvent, run, renderBoardHead, renderBoard, loadBoard, snow, fmtDate };
})();
