/* Rose City Roll Call — hash-routed static app over window.PDX */
(function () {
  'use strict';
  var D = window.PDX;
  var app = document.getElementById('app');

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    var m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return m[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0];
  }
  // minimal markdown: paragraphs, links, bold, italics
  function md(s) {
    var html = esc(s)
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    return html.split(/\n\s*\n/).map(function (p) { return '<p>' + p.replace(/\n/g, '<br>') + '</p>'; }).join('');
  }

  var bySlug = {};
  D.councilors.forEach(function (c) { bySlug[c.slug] = c; });
  function initials(c) {
    var parts = c.slug.split('-');
    return (parts.length > 1 ? parts.map(function (p) { return p[0]; }).join('') : c.slug.slice(0, 2)).toUpperCase();
  }
  // councilors only (mayor votes only to break ties), district order
  var voters = D.councilors.filter(function (c) { return c.district > 0; })
    .sort(function (a, b) { return a.district - b.district || a.name.split(' ').pop().localeCompare(b.name.split(' ').pop()); });

  var annos = D.annotations || {};
  var COMMITTEE = D.committee_votes || {};
  function itemActions(it) {
    var acts = (it.actions || []).concat(COMMITTEE[it.id] || []);
    return acts.slice().sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); });
  }
  var TAGS = D.tags || {};
  var STATEMENTS = D.statements || [];
  var POLICIES = D.policies || [];
  var STORYLINES = D.storylines || [];
  var DOSSIERS = D.dossiers || [];

  function itemTags(id) { return TAGS[id] || []; }
  var storyByItem = {};
  STORYLINES.forEach(function (s) {
    (s.episodes || []).forEach(function (ep) { if (ep.item_id && !storyByItem[ep.item_id]) storyByItem[ep.item_id] = s; });
  });
  function storyLatest(s) {
    var d = '';
    (s.episodes || []).forEach(function (ep) { if (ep.date > d) d = ep.date; });
    return d;
  }
  function allTagCounts() {
    var counts = {};
    D.items.forEach(function (it) { itemTags(it.id).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; }); });
    return counts;
  }
  function resolvePolicyVote(pv) {
    var it = null;
    D.items.forEach(function (x) { if (x.id === pv.item_id) it = x; });
    if (!it) return null;
    var vs = itemVotes(it);
    if (!pv.motion_match) {
      for (var i = vs.length - 1; i >= 0; i--) if (vs[i].kind === 'passage') return { item: it, vote: vs[i] };
      return null;
    }
    for (var j = 0; j < vs.length; j++) if (vs[j].motion.toLowerCase().indexOf(pv.motion_match.toLowerCase()) >= 0) return { item: it, vote: vs[j] };
    return null;
  }

  // flatten all roll-call votes: [{item, action, vote}]
  var allVotes = [];
  D.items.forEach(function (it) {
    itemActions(it).forEach(function (ac) {
      (ac.votes || []).forEach(function (v) { allVotes.push({ item: it, action: ac, vote: v }); });
    });
  });
  function isContested(v) { return (v.ayes || []).length > 0 && (v.nays || []).length > 0; }
  function position(v, slug) {
    if ((v.ayes || []).indexOf(slug) >= 0) return 'aye';
    if ((v.nays || []).indexOf(slug) >= 0) return 'nay';
    if ((v.absent || []).indexOf(slug) >= 0) return 'absent';
    return null;
  }

  // ---------- components ----------
  function splitBar(v) {
    var a = (v.ayes || []).length, n = (v.nays || []).length, tot = Math.max(a + n, 1);
    var aw = Math.round(96 * a / tot), nw = 96 - aw - (a && n ? 2 : 0);
    return '<span class="split" data-tip="' + a + ' aye — ' + n + ' nay">' +
      '<span class="bar" role="img" aria-label="' + a + ' ayes, ' + n + ' nays">' +
      (a ? '<span class="a" style="width:' + aw + 'px"></span>' : '') +
      (a && n ? '<span class="gap"></span>' : '') +
      (n ? '<span class="n" style="width:' + nw + 'px"></span>' : '') +
      '</span><span class="lbl">' + a + '–' + n + '</span></span>';
  }

  function voteStrip(v) {
    var out = ['<div class="strip" role="img" aria-label="Vote breakdown by councilor">'];
    var lastD = 0;
    var pool = voters;
    if (v.scope === 'committee') {
      // committee roll calls involve only that committee's members
      var present = {};
      ['ayes', 'nays', 'absent'].forEach(function (k) { (v[k] || []).forEach(function (s) { present[s] = 1; }); });
      pool = voters.filter(function (c) { return present[c.slug]; });
    }
    pool.forEach(function (c) {
      if (c.district !== lastD && lastD !== 0) out.push('<span class="dgap"></span>');
      lastD = c.district;
      var pos = position(v, c.slug) || 'absent';
      var glyph = pos === 'aye' ? '✓' : pos === 'nay' ? '✕' : '–';
      var word = pos === 'aye' ? 'Aye' : pos === 'nay' ? 'Nay' : 'Absent / not voting';
      out.push('<span class="cell"><a href="#/councilor/' + c.slug + '">' +
        '<span class="box ' + pos + '" data-tip="' + esc(c.name) + ' (D' + c.district + ') — ' + word + '">' + glyph + '</span>' +
        '<div class="who">' + initials(c) + '</div></a></span>');
    });
    // The mayor votes only to break ties — show a 13th cell when he did.
    var mw = position(v, 'wilson');
    if (v.scope !== 'committee' && (mw === 'aye' || mw === 'nay')) {
      out.push('<span class="dgap"></span><span class="cell"><a href="#/councilor/wilson">' +
        '<span class="box ' + mw + '" data-tip="Mayor Keith Wilson — tie-breaking ' + (mw === 'aye' ? 'Aye' : 'Nay') + '">' +
        (mw === 'aye' ? '✓' : '✕') + '</span><div class="who">MAYOR</div></a></span>');
    }
    out.push('</div>');
    return out.join('');
  }
  var stripLegend = '<div class="legend">' +
    '<span><span class="k" style="background:var(--aye)"></span>Aye</span>' +
    '<span><span class="k" style="background:var(--nay)"></span>Nay</span>' +
    '<span><span class="k" style="background:var(--absent-bg);border:1px dashed var(--baseline)"></span>Absent / not voting</span>' +
    '<span style="color:var(--muted)">Grouped by district 1–4</span></div>';

  function itemRow(it) {
    var last = lastAction(it);
    var contested = itemVotes(it).filter(isContested).length;
    var badge = it.status === 'pending' ? ' <span class="badge pending">On the docket</span>' : '';
    var ctx = annos[it.id] ? ' <span class="badge ctx">Context</span>' : '';
    var lastVote = null;
    itemVotes(it).forEach(function (v) { lastVote = v; });
    return '<div class="item-row">' +
      '<span class="date">' + (last ? fmtDate(last.date) : '') + '</span>' +
      '<span class="t"><span class="title"><a href="#/item/' + esc(it.id) + '">' + esc(it.short_title || it.title) + '</a></span>' + badge + ctx +
      '<div class="meta">' + esc(cap(it.type)) + ' ' + esc(it.id) + (last ? ' · ' + esc(last.disposition) : '') +
      (contested ? ' · ' + contested + ' contested vote' + (contested > 1 ? 's' : '') : '') + '</div></span>' +
      (lastVote ? splitBar(lastVote) : '') + '</div>';
  }
  function itemVotes(it) {
    var vs = [];
    itemActions(it).forEach(function (ac) { (ac.votes || []).forEach(function (v) { vs.push(v); }); });
    return vs;
  }
  function lastAction(it) { var a = itemActions(it); return a.length ? a[a.length - 1] : null; }
  function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }

  // ---------- alignment math ----------
  function agreement(contestedOnly, tag) {
    var votes = allVotes
      .filter(function (r) { return !tag || itemTags(r.item.id).indexOf(tag) >= 0; })
      .map(function (r) { return r.vote; })
      .filter(function (v) { return !contestedOnly || isContested(v); });
    var m = {};
    voters.forEach(function (a) {
      m[a.slug] = {};
      voters.forEach(function (b) {
        if (a.slug === b.slug) { m[a.slug][b.slug] = null; return; }
        var same = 0, tot = 0;
        votes.forEach(function (v) {
          var pa = position(v, a.slug), pb = position(v, b.slug);
          if ((pa === 'aye' || pa === 'nay') && (pb === 'aye' || pb === 'nay')) { tot++; if (pa === pb) same++; }
        });
        m[a.slug][b.slug] = tot ? { pct: same / tot, n: tot } : null;
      });
    });
    return m;
  }
  function seqColor(pct) {
    var steps = ['--seq-100', '--seq-200', '--seq-300', '--seq-400', '--seq-500', '--seq-600', '--seq-700'];
    var i = Math.min(steps.length - 1, Math.floor(pct * steps.length));
    return { bg: 'var(' + steps[i] + ')', dark: i >= 3 };
  }

  // ---------- views ----------
  function viewHome() {
    var byDate = function (a, b) {
      var da = (lastAction(a) || {}).date || '', db = (lastAction(b) || {}).date || '';
      return db.localeCompare(da);
    };
    var decided = D.items.filter(function (it) { return it.status !== 'pending'; }).sort(byDate);
    var pending = D.items.filter(function (it) { return it.status === 'pending'; }).sort(byDate);
    var contested = allVotes.filter(function (r) { return isContested(r.vote); });
    var dates = {};
    allVotes.forEach(function (r) { if (r.action.date) dates[r.action.date] = 1; });
    var html = '<h1>Portland City Council, on the record</h1>' +
      '<p class="sub">Every roll-call vote of the 12-member council, scraped from the official record and linked back to it — with context on what happened on the dais that the tally alone doesn’t show.</p>' +
      '<div class="kpis">' +
      kpi(D.items.length, 'items tracked') +
      kpi(allVotes.length, 'roll-call votes') +
      kpi(contested.length, 'contested votes') +
      kpi(Object.keys(dates).length, 'meeting days covered') +
      '</div>';
    // latest storyline developments
    var devs = [];
    STORYLINES.forEach(function (s) {
      (s.episodes || []).forEach(function (ep) { devs.push({ s: s, ep: ep }); });
    });
    devs.sort(function (a, b) { return b.ep.date.localeCompare(a.ep.date); });
    if (devs.length) {
      html += '<h2>Latest developments</h2><div class="card">' + devs.slice(0, 3).map(function (d) {
        return '<div class="item-row"><span class="date">' + fmtDate(d.ep.date) + '</span>' +
          '<span class="t"><span class="title"><a href="#/story/' + esc(d.s.id) + '">' + esc(d.ep.title) + '</a></span>' +
          '<div class="meta">' + esc(d.s.title) + '</div></span></div>';
      }).join('') + '</div>';
    }
    // featured context
    var featured = D.items.filter(function (it) { return annos[it.id]; });
    if (featured.length) {
      var it = featured[0], an = annos[it.id];
      html += '<div class="context"><div class="ctx-label">Context</div>' +
        '<h3><a href="#/item/' + esc(it.id) + '">' + esc(an.headline) + '</a></h3>' +
        md(an.teaser || (an.body || '').split(/\n\s*\n/)[0]) +
        '<p><a href="#/item/' + esc(it.id) + '">Full breakdown →</a></p></div>';
    }
    if (pending.length) {
      html += '<h2>On the docket</h2><div class="card">' + pending.map(itemRow).join('') + '</div>';
    }
    html += '<h2>Recent items</h2><div class="card">' +
      decided.slice(0, 12).map(itemRow).join('') + '</div>' +
      '<p><a href="#/votes">All tracked votes →</a></p>';
    return html;
  }
  function kpi(v, l) { return '<div class="kpi"><div class="v">' + v + '</div><div class="l">' + l + '</div></div>'; }

  function viewVotes() {
    var items = D.items.slice().sort(function (a, b) {
      var da = (lastAction(a) || {}).date || '', db = (lastAction(b) || {}).date || '';
      return db.localeCompare(da);
    });
    var counts = allTagCounts();
    var topTags = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 14);
    if (state.voteTag) items = items.filter(function (it) { return itemTags(it.id).indexOf(state.voteTag) >= 0; });
    var chips = '<div class="chips"><span class="chip' + (state.voteTag ? '' : ' on') + '" data-tagchip="">All</span>' +
      topTags.map(function (t) {
        return '<span class="chip' + (state.voteTag === t ? ' on' : '') + '" data-tagchip="' + esc(t) + '">' + esc(t) + ' · ' + counts[t] + '</span>';
      }).join('') + '</div>';
    var html = '<h1>Tracked items</h1>' +
      '<p class="sub">Council actions with recorded outcomes. Contested votes — where the council split — are where the story usually is.</p>' +
      chips +
      '<div class="card">' + (items.length ? items.map(itemRow).join('') : '<p class="m-sub">No items carry this tag yet.</p>') + '</div>';

    // Contested-vote index: enumerated from the city's votes table but not yet fully
    // extracted (the automated scraper backfills these with complete breakdowns).
    var trackedUrls = {};
    D.items.forEach(function (it) { trackedUrls[it.url] = 1; });
    var byUrl = {};
    (D.contested_rows || []).forEach(function (r) {
      if (!r.date || r.date < '2025-01-01' || !r.doc_url || !bySlug[r.member] || trackedUrls[r.doc_url]) return;
      var g = byUrl[r.doc_url] = byUrl[r.doc_url] || { url: r.doc_url, date: r.date, nays: {} };
      if (r.date > g.date) g.date = r.date;
      g.nays[r.member] = 1;
    });
    var rest = Object.keys(byUrl).map(function (k) { return byUrl[k]; })
      .sort(function (a, b) { return b.date.localeCompare(a.date); });
    if (rest.length) {
      html += '<h2>More contested votes, awaiting full extraction</h2>' +
        '<p class="sub">Found via the city’s <a href="https://www.portland.gov/council/votes" target="_blank" rel="noopener">votes table</a> (Nay filter). ' +
        'Recorded Nay votes are shown; full breakdowns land with the next automated scrape.</p>' +
        '<div class="card matrix-scroll"><table class="plain"><thead><tr><th>Date</th><th>Document</th><th>Nays recorded</th></tr></thead><tbody>' +
        rest.map(function (g) {
          var m = g.url.match(/\/council\/documents\/(\w[\w-]*)\/(?:[\w-]+\/)?([\w-]+)$/) || [];
          var label = (m[1] ? cap(m[1]) + ' ' : 'Document ') + (m[2] || '');
          var nays = Object.keys(g.nays).map(function (s) { return bySlug[s] ? bySlug[s].name.split(' ').pop() : s; }).join(', ');
          return '<tr><td class="num">' + fmtDate(g.date) + '</td>' +
            '<td><a href="' + esc(g.url) + '" target="_blank" rel="noopener">' + esc(label) + '</a></td>' +
            '<td>' + esc(nays) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    return html;
  }

  function viewItem(id) {
    var it = null;
    D.items.forEach(function (x) { if (x.id === id) it = x; });
    if (!it) return '<h1>Not found</h1><p class="sub">No item ' + esc(id) + ' in the dataset.</p>';
    var an = annos[it.id];
    var story = storyByItem[it.id];
    var html = (story ? '<p class="crumb">Part of the storyline: <a href="#/story/' + esc(story.id) + '">' + esc(story.title) + '</a></p>' : '') +
      '<h1>' + esc(it.short_title || it.title) + '</h1>' +
      '<p class="sub">' + esc(cap(it.type)) + ' ' + esc(it.id) +
      (it.sponsors && it.sponsors.length ? ' · Introduced by ' + esc(it.sponsors.join(', ')) : '') +
      ' · <a href="' + esc(it.url) + '" target="_blank" rel="noopener">official record ↗</a></p>';
    var tg = itemTags(it.id);
    if (tg.length) {
      html += '<p class="tagline">' + tg.map(function (t) {
        return '<span class="chip" data-tagchip-nav="' + esc(t) + '" style="cursor:pointer">' + esc(t) + '</span>';
      }).join('') + '</p>';
    }
    if (it.short_title && it.title !== it.short_title) html += '<p class="sub" style="font-size:14px">Official title: ' + esc(it.title) + '</p>';
    if (it.summary) html += '<div class="card">' + md(it.summary) + '</div>';

    if (an) {
      html += '<div class="context"><div class="ctx-label">Context — curated, with sources</div>' +
        '<h3>' + esc(an.headline) + '</h3>' + md(an.body || '');
      (an.quotes || []).forEach(function (q) {
        var who = q.speaker && bySlug[q.speaker] ? bySlug[q.speaker].name : (q.speaker_name || '');
        var srcLabel = q.t ? 'video ' + esc(q.t) : (q.as_reported_by ? 'as reported by ' + esc(q.as_reported_by) : 'source');
        html += '<blockquote>“' + esc(q.text) + '”<span class="attr">— ' + esc(who) +
          (q.source ? ', <a href="' + esc(q.source) + '" target="_blank" rel="noopener">' + srcLabel + '</a>' : '') +
          '</span></blockquote>';
      });
      if ((an.sources || []).length) {
        html += '<p class="srcs"><strong>Sources:</strong> ' + an.sources.map(function (s) {
          return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + '</a>';
        }).join(' · ') + '</p>';
      }
      html += '</div>';
    }

    itemActions(it).forEach(function (ac) {
      html += '<h2>' + fmtDate(ac.date) + (ac.scope_note ? ' <span class="badge">' + esc(ac.scope_note) + '</span>' : '') + '</h2>' +
        '<div class="card"><p class="m-sub" style="margin-top:0">Disposition: ' + esc(ac.disposition || '—') + '</p>';
      (ac.votes || []).forEach(function (v) {
        var desc = v.description, src = null;
        if (!desc) {
          var mns = (D.motion_notes || {})[it.id] || [];
          for (var i = 0; i < mns.length; i++) {
            if (v.motion.toLowerCase().indexOf(mns[i].match.toLowerCase()) >= 0) {
              desc = mns[i].description; src = mns[i].source; break;
            }
          }
        }
        html += '<div class="motion"><div class="m-title">' + esc(v.motion) +
          ' <span class="result-chip ' + esc(v.result) + '">' + esc(v.result) + '</span></div>' +
          (desc ? '<div class="m-sub">' + esc(desc) +
            (src ? ' <a href="' + esc(src) + '" target="_blank" rel="noopener">amendment text ↗</a>' : '') + '</div>' : '') +
          voteStrip(v) + '</div>';
      });
      if (!(ac.votes || []).length) html += '<p class="m-sub">No roll-call vote recorded for this session.</p>';
      html += '</div>';
    });
    if (itemVotes(it).length) html += stripLegend;
    return html;
  }

  function viewCouncilors() {
    var html = '<h1>The council</h1><p class="sub">Twelve councilors, three per district, seated January 2025. Click through for full voting records.</p>';
    [1, 2, 3, 4].forEach(function (d) {
      html += '<h2>District ' + d + '</h2><div class="ppl">' +
        voters.filter(function (c) { return c.district === d; }).map(function (c) {
          var st = record(c.slug);
          return '<div class="person"><div class="nm"><a href="#/councilor/' + c.slug + '">' + esc(c.name) + '</a>' +
            (c.term_ends === 2026 ? ' <span class="badge pending">On the ballot 2026</span>' : '') + '</div>' +
            '<div class="d">' + esc(c.role) + (c.title ? ' · ' + esc(c.title) : '') + '</div>' +
            '<div class="st">' + st.total + ' votes · ' + st.contested + ' contested · in majority ' + st.majPct + '%</div></div>';
        }).join('') + '</div>';
    });
    return html;
  }

  function record(slug) {
    var total = 0, contested = 0, maj = 0, majTot = 0;
    allVotes.forEach(function (r) {
      var p = position(r.vote, slug);
      if (p === 'aye' || p === 'nay') {
        total++;
        if (isContested(r.vote)) {
          contested++;
          var winners = r.vote.result === 'passed' ? 'aye' : 'nay';
          majTot++; if (p === winners) maj++;
        }
      }
    });
    return { total: total, contested: contested, majPct: majTot ? Math.round(100 * maj / majTot) : '—' };
  }

  function viewCouncilor(slug) {
    var c = bySlug[slug];
    if (!c) return '<h1>Not found</h1>';
    var st = record(slug);
    var m = agreement(true)[slug] || {};
    var pairs = voters.filter(function (o) { return o.slug !== slug && m[o.slug]; })
      .map(function (o) { return { c: o, pct: m[o.slug].pct, n: m[o.slug].n }; })
      .sort(function (a, b) { return b.pct - a.pct; });
    var html = '<h1>' + esc(c.name) + '</h1>' +
      '<p class="sub">' + esc(c.role) + (c.district ? ', District ' + c.district : '') +
      (c.title ? ' · ' + esc(c.title) : '') +
      (c.term_ends === 2026 ? ' · <strong>seat on the ballot Nov 3, 2026</strong>' : '') +
      (c.links && c.links.official ? ' · <a href="' + esc(c.links.official) + '" target="_blank" rel="noopener">official page ↗</a>' : '') + '</p>' +
      (c.notes ? '<p class="sub" style="font-size:14px">' + esc(c.notes) + '</p>' : '') +
      '<div class="kpis">' + kpi(st.total, 'votes cast') + kpi(st.contested, 'contested votes') +
      kpi(st.majPct + (st.majPct === '—' ? '' : '%'), 'on winning side (contested)') + '</div>';
    if (pairs.length) {
      var top = pairs[0], bot = pairs[pairs.length - 1];
      html += '<p class="sub">On contested votes, agrees most with <strong><a href="#/councilor/' + top.c.slug + '">' + esc(top.c.name) +
        '</a></strong> (' + Math.round(top.pct * 100) + '%) and least with <strong><a href="#/councilor/' + bot.c.slug + '">' + esc(bot.c.name) +
        '</a></strong> (' + Math.round(bot.pct * 100) + '%). <a href="#/alignment">Full matrix →</a></p>';
    }
    if ((c.endorsements || []).length) {
      html += '<h2>2024 campaign endorsements</h2><div class="card"><p class="m-sub" style="margin-top:0">For the messaging-vs-record comparison — endorsements as reported at the time.</p><ul>' +
        c.endorsements.map(function (e) {
          return '<li>' + esc(e.org) + (e.year ? ' (' + e.year + ')' : '') +
            (e.source ? ' — <a href="' + esc(e.source) + '" target="_blank" rel="noopener">source</a>' : '') + '</li>';
        }).join('') + '</ul></div>';
    }
    // On the issues: policy alignment computed from grouped votes
    var polHtml = '';
    POLICIES.forEach(function (p) {
      var f = 0, ag = 0;
      (p.votes || []).forEach(function (pv) {
        var rv = resolvePolicyVote(pv);
        if (!rv) return;
        var pos = position(rv.vote, slug);
        if (pos !== 'aye' && pos !== 'nay') return;
        var supports = (pos === 'aye') === (pv.direction === 'for');
        if (supports) f++; else ag++;
      });
      if (f + ag === 0) return;
      polHtml += '<div class="policy"><div class="p-title">' + esc(p.title) + '</div>' +
        '<div class="p-desc">' + esc(p.description) + '</div>' +
        '<div class="p-stat"><span class="for">For ' + f + '</span> · <span class="against">Against ' + ag + '</span> <span style="color:var(--muted)">(' + (f + ag) + ' votes)</span></div></div>';
    });
    if (polHtml) html += '<h2>On the issues</h2><div class="card">' + polHtml + '</div>';

    // In their words: the statements ledger
    var quotes = STATEMENTS.filter(function (s) { return s.councilor === slug; })
      .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    if (quotes.length) {
      html += '<h2>In their words</h2><div class="card">' + quotes.map(function (q) {
        return '<div class="quote-card"><div class="q">“' + esc(q.quote) + '”</div>' +
          '<div class="q-attr">' + fmtDate(q.date) + (q.context ? ' — ' + esc(q.context) : '') +
          (q.source ? ' · <a href="' + esc(q.source) + '" target="_blank" rel="noopener">' + (q.t ? 'video ' + esc(q.t) : 'source') + '</a>' : '') +
          (q.as_reported_by ? ' <span style="color:var(--muted)">(' + esc(q.as_reported_by) + ')</span>' : '') +
          '</div></div>';
      }).join('') + '</div>';
    }

    html += '<h2>Contested-vote record</h2><div class="card"><table class="plain"><thead><tr><th>Date</th><th>Item / motion</th><th>Vote</th><th>Result</th></tr></thead><tbody>';
    var rows = allVotes.filter(function (r) { return isContested(r.vote) && position(r.vote, slug); });
    if (!rows.length) html += '<tr><td colspan="4" class="m-sub">No contested votes recorded yet.</td></tr>';
    rows.forEach(function (r) {
      var p = position(r.vote, slug);
      html += '<tr><td class="num">' + fmtDate(r.action.date) + '</td>' +
        '<td><a href="#/item/' + esc(r.item.id) + '">' + esc(r.item.short_title || r.item.title) + '</a><div class="m-sub">' + esc(r.vote.motion) + '</div></td>' +
        '<td style="color:var(--' + (p === 'aye' ? 'aye' : p === 'nay' ? 'nay' : 'muted') + ');font-weight:700">' + cap(p) + '</td>' +
        '<td>' + esc(r.vote.result) + '</td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function viewAlignment() {
    var contestedOnly = state.alignAll !== true;
    var m = agreement(contestedOnly, state.alignTag);
    var counts = allTagCounts();
    var tagChoices = Object.keys(counts).filter(function (t) { return counts[t] >= 3; })
      .sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 12);
    var html = '<h1>Who votes with whom</h1>' +
      '<p class="sub">Pairwise agreement on roll-call votes where both councilors voted aye or nay. ' +
      'Contested votes only by default — unanimous votes tell you little about blocs.</p>' +
      '<div class="chips"><span class="chip' + (state.alignTag ? '' : ' on') + '" data-aligntag="">All topics</span>' +
      tagChoices.map(function (t) {
        return '<span class="chip' + (state.alignTag === t ? ' on' : '') + '" data-aligntag="' + esc(t) + '">' + esc(t) + '</span>';
      }).join('') + '</div>' +
      '<p><button class="badge" id="align-toggle" style="cursor:pointer">' +
      (contestedOnly ? 'Showing contested only — include unanimous' : 'Showing all votes — contested only') + '</button></p>' +
      '<div class="card matrix-scroll"><table class="matrix"><thead><tr><th></th>';
    voters.forEach(function (c) { html += '<th title="' + esc(c.name) + '">' + initials(c) + '</th>'; });
    html += '</tr></thead><tbody>';
    voters.forEach(function (a) {
      html += '<tr><th class="rowh">' + esc(a.name) + '</th>';
      voters.forEach(function (b) {
        if (a.slug === b.slug) { html += '<td class="self">—</td>'; return; }
        var cell = m[a.slug][b.slug];
        if (!cell) { html += '<td class="self">·</td>'; return; }
        var col = seqColor(cell.pct);
        html += '<td style="background:' + col.bg + ';color:' + (col.dark ? '#fff' : '#0b0b0b') + '" data-tip="' +
          esc(a.name) + ' & ' + esc(b.name) + ': agreed ' + Math.round(cell.pct * 100) + '% of ' + cell.n + ' votes">' +
          Math.round(cell.pct * 100) + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>' +
      '<div class="legend"><span>Agreement:</span>' +
      '<span><span class="k" style="background:var(--seq-100)"></span>0–14%</span>' +
      '<span><span class="k" style="background:var(--seq-300)"></span>~40%</span>' +
      '<span><span class="k" style="background:var(--seq-500)"></span>~70%</span>' +
      '<span><span class="k" style="background:var(--seq-700)"></span>85–100%</span></div>';
    return html;
  }

  function viewStorylines() {
    var html = '<h1>Storylines</h1>' +
      '<p class="sub">The ongoing fights, followed over time. Every episode links to the record it came from — votes, video, documents, coverage.</p>';
    if (!STORYLINES.length) return html + '<div class="card"><p class="m-sub">No storylines yet.</p></div>';
    var sorted = STORYLINES.slice().sort(function (a, b) { return storyLatest(b).localeCompare(storyLatest(a)); });
    html += '<div class="story-cards">' + sorted.map(function (s) {
      var eps = (s.episodes || []).slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
      var last = eps[eps.length - 1];
      return '<div class="story-card"><h3><a href="#/story/' + esc(s.id) + '">' + esc(s.title) + '</a> ' +
        '<span class="status-pill ' + esc(s.status || 'ongoing') + '">' + esc(s.status || 'ongoing') + '</span></h3>' +
        '<div style="font-size:14px;color:var(--ink-2)">' + esc(s.stakes || '') + '</div>' +
        (last ? '<div class="latest">Latest: ' + fmtDate(last.date) + ' — ' + esc(last.title) + ' · ' + eps.length + ' episodes</div>' : '') +
        '</div>';
    }).join('') + '</div>';
    return html;
  }

  function viewStory(id) {
    var s = null;
    STORYLINES.forEach(function (x) { if (x.id === id) s = x; });
    if (!s) return '<h1>Not found</h1><p class="sub">No storyline “' + esc(id) + '”.</p>';
    var eps = (s.episodes || []).slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    var html = '<p class="crumb"><a href="#/storylines">← All storylines</a></p>' +
      '<h1>' + esc(s.title) + ' <span class="status-pill ' + esc(s.status || 'ongoing') + '">' + esc(s.status || 'ongoing') + '</span></h1>' +
      '<div class="stakes"><strong>What’s at stake:</strong> ' + esc(s.stakes || '') + '</div>' +
      '<div class="timeline">' +
      eps.map(function (ep) {
        var typeLabel = { vote: 'Roll call', meeting: 'Meeting', document: 'Document', news: 'News', statement: 'Statement' }[ep.type] || 'Event';
        var links = (ep.links || []).slice();
        var epItem = null;
        if (ep.item_id) D.items.forEach(function (x) { if (x.id === ep.item_id) epItem = x; });
        if (epItem && !links.some(function (l) { return l.url.charAt(0) === '#'; })) {
          links.unshift({ label: 'Vote record', url: '#/item/' + ep.item_id });
        }
        var strip = '';
        if (epItem) {
          var vs = itemVotes(epItem);
          if (vs.length) strip = '<div style="margin:4px 0 6px">' + splitBar(vs[vs.length - 1]) + '</div>';
        }
        return '<div class="ep"><div class="ep-meta">' + typeLabel + ' · ' + fmtDate(ep.date) + '</div>' +
          '<h3>' + esc(ep.title) + '</h3>' +
          '<p class="ep-sum">' + esc(ep.summary || '') + '</p>' + strip +
          (links.length ? '<div class="ep-links">' + links.map(function (l) {
            var ext = l.url.charAt(0) !== '#';
            return '<a href="' + esc(l.url) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(l.label) + (ext ? ' ↗' : ' →') + '</a>';
          }).join('') + '</div>' : '') +
          '</div>';
      }).join('') + '</div>';
    if (s.watching_for) {
      html += '<div class="watching"><span class="w-label">Watching for</span>' + esc(s.watching_for) + '</div>';
    }
    return html;
  }

  function viewAnalysis(id) {
    if (id) {
      var d = null;
      DOSSIERS.forEach(function (x) { if (x.id === id) d = x; });
      if (!d) return '<h1>Not found</h1>';
      return '<p class="crumb"><a href="#/analysis">← All analysis</a></p><h1>' + esc(d.title) + '</h1>' +
        '<p class="sub">' + fmtDate(d.date) + ' · Analysis — argued, signed, and built from linked records</p>' +
        '<div class="card">' + md(d.body || '') + '</div>';
    }
    var html = '<h1>Analysis</h1>' +
      '<p class="sub">Argued pieces, clearly labeled as such. Everything load-bearing links to the record; the data pages stay verdict-free.</p>';
    if (!DOSSIERS.length) {
      html += '<div class="card"><p class="m-sub" style="margin:0">Nothing published yet — the record comes first. ' +
        'Analysis pieces appear here once a pattern has accumulated enough receipts in the <a href="#/storylines">storylines</a>.</p></div>';
    } else {
      html += '<div class="card">' + DOSSIERS.map(function (d) {
        return '<div class="item-row"><span class="date">' + fmtDate(d.date) + '</span>' +
          '<span class="t"><span class="title"><a href="#/analysis/' + esc(d.id) + '">' + esc(d.title) + '</a></span>' +
          '<div class="meta">' + esc(d.teaser || '') + '</div></span></div>';
      }).join('') + '</div>';
    }
    return html;
  }

  function viewAbout() {
    return '<h1>Methodology</h1>' +
      '<div class="card">' +
      '<p><strong>Where the data comes from.</strong> Vote records are scraped from the ' +
      '<a href="https://www.portland.gov/council/agenda" target="_blank" rel="noopener">Portland City Council agenda</a> and the linked ' +
      'council document pages on portland.gov, which publish the City Clerk’s official dispositions and per-councilor vote breakdowns. ' +
      'Every item links back to its official page; nothing here replaces the record.</p>' +
      '<p><strong>What counts as contested.</strong> A roll-call vote with at least one aye and one nay. Unanimous votes are tracked but excluded ' +
      'from alignment statistics by default, because they say little about how the council actually divides.</p>' +
      '<p><strong>Context panels.</strong> Vote tallies don’t capture everything — who moved amendments, who debated them, who sat silent. ' +
      'Context panels are hand-written, clearly labeled, and cite their sources (meeting video, official documents, news coverage). ' +
      'They are editorial; the vote data is not.</p>' +
      '<p><strong>The mayor.</strong> Under Portland’s 2025 charter, the mayor is not a council member and votes only to break ties, ' +
      'so vote grids show the twelve councilors; mayoral tie-breaks appear when they occur.</p>' +
      '<p><strong>Corrections.</strong> If you spot an error, the underlying record is one click away — and corrections are welcome.</p>' +
      '</div>';
  }

  // ---------- router ----------
  var state = {};
  function route() {
    var h = location.hash || '#/';
    var parts = h.slice(2).split('/');
    var name = parts[0] || 'home';
    var html;
    if (name === '' || name === 'home') html = viewHome();
    else if (name === 'votes') html = viewVotes();
    else if (name === 'item') html = viewItem(decodeURIComponent(parts[1] || ''));
    else if (name === 'councilors') html = viewCouncilors();
    else if (name === 'councilor') html = viewCouncilor(decodeURIComponent(parts[1] || ''));
    else if (name === 'alignment') html = viewAlignment();
    else if (name === 'storylines') html = viewStorylines();
    else if (name === 'story') html = viewStory(decodeURIComponent(parts[1] || ''));
    else if (name === 'analysis') html = viewAnalysis(parts[1] ? decodeURIComponent(parts[1]) : null);
    else if (name === 'about') html = viewAbout();
    else html = viewHome();
    app.innerHTML = html;
    document.querySelectorAll('#nav a').forEach(function (a) {
      var r = a.getAttribute('data-r');
      var active = (name === 'home' && r === 'home') || name === r ||
        (name === 'item' && r === 'votes') || (name === 'councilor' && r === 'councilors') ||
        (name === 'story' && r === 'storylines');
      a.className = active ? 'active' : '';
    });
    var t = document.getElementById('align-toggle');
    if (t) t.onclick = function () { state.alignAll = !state.alignAll; route(); };
    document.querySelectorAll('[data-tagchip]').forEach(function (el) {
      el.onclick = function () { state.voteTag = el.getAttribute('data-tagchip') || null; route(); };
    });
    document.querySelectorAll('[data-tagchip-nav]').forEach(function (el) {
      el.onclick = function () { state.voteTag = el.getAttribute('data-tagchip-nav'); location.hash = '#/votes'; };
    });
    document.querySelectorAll('[data-aligntag]').forEach(function (el) {
      el.onclick = function () { state.alignTag = el.getAttribute('data-aligntag') || null; route(); };
    });
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  // ---------- tooltip ----------
  var tip = document.getElementById('tip');
  document.addEventListener('mouseover', function (e) {
    var el = e.target.closest('[data-tip]');
    if (!el) { tip.style.display = 'none'; return; }
    tip.textContent = el.getAttribute('data-tip');
    tip.style.display = 'block';
  });
  document.addEventListener('mousemove', function (e) {
    if (tip.style.display !== 'block') return;
    var x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
    var y = Math.min(e.clientY + 16, window.innerHeight - tip.offsetHeight - 8);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  });

  // ---------- theme ----------
  document.getElementById('theme-toggle').onclick = function () {
    var cur = document.documentElement.dataset.theme ||
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
  };

  document.getElementById('data-stamp').textContent = 'Data generated ' + (D.generated || '') + '.';
  route();
})();
