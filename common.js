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

  function snow(el, n) {
    if (!el) return;
    for (let i = 0; i < n; i++) {
      const f = document.createElement("i"), s = 2 + (i % 4);
      f.style.cssText = "left:" + ((i * 37 + 11) % 100) + "%;top:" + (((i * 53 + 7) % 100) - 10) + "%;width:" + s + "px;height:" + s + "px;opacity:" + (0.25 + (i % 5) * 0.12) + ";animation-duration:" + (9 + (i % 7) * 2) + "s;animation-delay:-" + (i % 9) + "s";
      el.appendChild(f);
    }
  }

  const fmtDate = t => new Date(t).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

  window.XQ = { C, db, configured, ROUNDS, rpc, getEvent, run, renderBoardHead, renderBoard, loadBoard, snow, fmtDate };
})();
