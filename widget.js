// JARVIS 状态小组件（Scriptable，中号 Medium）
// 数据：status.json（Mike 开工、收工时更新）。这个文件由手机上的短加载器下载后执行。
const DATA_URL = "https://raw.githubusercontent.com/aarontohsheezhen-bot/jarvis-status/main/status.json";
const C = {
  bg: new Color("#1c1c1e"),
  track: new Color("#3a3a3c"),
  green: new Color("#30d158"),
  orange: new Color("#ff9f0a"),
  red: new Color("#ff453a"),
  text: new Color("#ffffff"),
  dim: new Color("#98989f"),
};
const STATE = {
  idle: { word: "空闲", color: C.green },
  busy: { word: "在做", color: C.orange },
  blocked: { word: "等你", color: C.red },
};

async function loadData() {
  const fm = FileManager.local();
  const cache = fm.joinPath(fm.cacheDirectory(), "jarvis-status.json");
  try {
    const r = new Request(DATA_URL + "?t=" + Date.now());
    r.timeoutInterval = 10;
    const j = await r.loadJSON();
    fm.writeString(cache, JSON.stringify(j));
    return j;
  } catch (e) {
    if (fm.fileExists(cache)) return JSON.parse(fm.readString(cache));
    return null;
  }
}

function ringImage(frac, color, center) {
  const s = 120, lw = 13;
  const d = new DrawContext();
  d.size = new Size(s, s);
  d.opaque = false;
  d.respectScreenScale = true;
  const cx = s / 2, cy = s / 2, r = (s - lw) / 2;
  function arc(to, col) {
    const p = new Path();
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const a = (to * i / steps) * 2 * Math.PI - Math.PI / 2;
      const pt = new Point(cx + r * Math.cos(a), cy + r * Math.sin(a));
      if (i === 0) p.move(pt); else p.addLine(pt);
    }
    d.addPath(p);
    d.setStrokeColor(col);
    d.setLineWidth(lw);
    d.strokePath();
  }
  arc(1, C.track);
  if (frac > 0.005) arc(Math.min(frac, 1), color);
  d.setFont(Font.boldSystemFont(34));
  d.setTextColor(C.text);
  d.setTextAlignedCenter();
  d.drawTextInRect(center, new Rect(0, cy - 22, s, 44));
  return d.getImage();
}

function centered(col, build) {
  const row = col.addStack();
  row.layoutHorizontally();
  row.addSpacer();
  build(row);
  row.addSpacer();
}

function addRing(parent, img, big, bigColor, small) {
  const col = parent.addStack();
  col.layoutVertically();
  col.size = new Size(74, 82);
  centered(col, (r) => { const im = r.addImage(img); im.imageSize = new Size(48, 48); });
  col.addSpacer(3);
  centered(col, (r) => { const t = r.addText(big); t.font = Font.semiboldSystemFont(14); t.textColor = bigColor; t.lineLimit = 1; });
  centered(col, (r) => { const t = r.addText(small); t.font = Font.systemFont(9); t.textColor = C.dim; t.lineLimit = 1; t.minimumScaleFactor = 0.6; });
}

function pctColor(p) { return p >= 85 ? C.red : (p >= 60 ? C.orange : C.green); }

const data = await loadData();
const w = new ListWidget();
w.backgroundColor = C.bg;
w.setPadding(10, 10, 8, 10);

if (!data) {
  const t = w.addText("读不到 JARVIS 状态");
  t.textColor = C.red;
  t.font = Font.systemFont(13);
} else {
  const u = data.usage || {};
  const agents = data.agents || [];
  const top = w.addStack();
  top.layoutHorizontally();
  top.addSpacer();
  const h5 = Number(u.h5 || 0), wk = Number(u.week || 0);
  addRing(top, ringImage(h5 / 100, pctColor(h5), "5h"), h5 + "%", C.text, u.h5_reset ? u.h5_reset + " 重置" : "5 小时额度");
  top.addSpacer();
  addRing(top, ringImage(wk / 100, pctColor(wk), "周"), wk + "%", C.text, u.week_reset ? u.week_reset + " 重置" : "本周额度");
  for (const a of agents.slice(0, 2)) {
    const st = STATE[a.state] || STATE.idle;
    top.addSpacer();
    addRing(top, ringImage(1, st.color, String(a.name).slice(0, 1)), st.word, st.color, a.name);
  }
  top.addSpacer();

  w.addSpacer(5);
  for (const a of agents.slice(0, 3)) {
    const st = STATE[a.state] || STATE.idle;
    const row = w.addStack();
    row.layoutHorizontally();
    row.centerAlignContent();
    const dot = row.addText("● ");
    dot.font = Font.systemFont(8);
    dot.textColor = st.color;
    const t = row.addText(a.name + "：" + (a.note || st.word));
    t.font = Font.systemFont(11);
    t.textColor = C.text;
    t.lineLimit = 1;
    t.minimumScaleFactor = 0.7;
  }

  w.addSpacer();
  const upd = data.updated ? new Date(data.updated) : null;
  const ageH = upd ? (Date.now() - upd.getTime()) / 3600000 : 999;
  const df = new DateFormatter();
  df.dateFormat = "M/d HH:mm";
  const stale = ageH > 3;
  let foot = upd ? "更新 " + df.string(upd) : "没有更新时间";
  if (u.fable != null) foot += " · Fable 本周 " + u.fable + "%";
  if (stale) foot = "⚠ 超过 3 小时没更新 · " + foot;
  const ft = w.addText(foot);
  ft.font = Font.systemFont(9);
  ft.textColor = stale ? C.red : C.dim;
  ft.lineLimit = 1;
  ft.minimumScaleFactor = 0.7;
}

w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
if (config.runsInWidget) {
  Script.setWidget(w);
} else {
  await w.presentMedium();
}
Script.complete();
