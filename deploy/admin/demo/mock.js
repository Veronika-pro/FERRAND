/* clinic desk demo: a stand-in for supabase-js with sample bookings kept in memory; nothing reaches the real database */
(function(){
  var H = 36e5, now = Date.now();
  function iso(h){ return new Date(Math.round((now + h * H) / (30 * 6e4)) * 30 * 6e4).toISOString(); }
  var tr = { veneers: 'Veneers', implants: 'Implants', whitening: 'Whitening', aligners: 'Aligners', general: 'General consultation' };
  var slots = [], id = 1;
  for(var d = -2; d < 22; d++) [9, 10.5, 14, 16, 17.5].forEach(function(t){
    var x = new Date(now); x.setUTCHours(0, 0, 0, 0); var s = new Date(x.getTime() + d * 24 * H + (t - 2) * H);
    if(s.getUTCDay() !== 0) slots.push({ id: id++, starts_at: s.toISOString(), is_open: !(d === 3 && t === 14) });
  });
  var CODES = ['', 'FR-7K2QXM', 'FR-H4N8PW', 'FR-3TQ9ZE', 'FR-M2R6KD', 'FR-9BV4XC', 'FR-W5J8NT'];
  function mail(name){ return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ /g, '.') + '@mail.fr'; }
  function bk(i, name, slug, st, slotIdx, reason){ return { id: '00000000-0000-4000-8000-00000000000' + i, code: CODES[i], name: name, phone: '+33 6 12 34 56 7' + i, email: mail(name), status: st, decline_reason: reason || null, created_at: iso(-i), treatment: slug, slot_id: slots[slotIdx].id }; }
  var bookings = [
    bk(1, 'Camille Laurent', 'veneers', 'requested', 14),
    bk(2, 'Thomas Girard', 'implants', 'requested', 16),
    bk(3, 'Sofia Marchetti', 'whitening', 'confirmed', 12),
    bk(4, 'Jules Bernard', 'aligners', 'confirmed', 3),
    bk(5, 'Anaïs Dubois', 'general', 'declined', 20, 'Dr Ferrand is at a congress that week.'),
    bk(6, 'Marc Petit', 'veneers', 'cancelled', 22)
  ];
  var events = bookings.map(function(b, i){ return { id: i + 1, booking_id: b.id, actor_id: null, from_status: null, to_status: 'requested', note: null, created_at: b.created_at }; });
  var ME = '9509c322-0000-4000-8000-000000000000';
  function slotOf(b){ return slots.filter(function(s){ return s.id === b.slot_id; })[0]; }
  function view(b){ return { id: b.id, code: b.code, name: b.name, phone: b.phone, email: b.email, status: b.status, decline_reason: b.decline_reason, created_at: b.created_at, treatments: { name: tr[b.treatment], slug: b.treatment }, slots: { starts_at: slotOf(b).starts_at } }; }
  function ok(d){ return Promise.resolve({ data: d, error: null }); }
  function fail(m){ return Promise.resolve({ data: null, error: { message: m } }); }

  function from(table){
    var f = [], ord = null, lim = null, single = false;
    var api = {
      select: function(){ return api; }, order: function(c, o){ ord = [c, !o || o.ascending !== false]; return api; }, limit: function(n){ lim = n; return api; },
      eq: function(c, v){ f.push(function(r){ return r[c] === v; }); return api; },
      gte: function(c, v){ f.push(function(r){ return r[c] >= v; }); return api; }, lt: function(c, v){ f.push(function(r){ return r[c] < v; }); return api; },
      maybeSingle: function(){ single = true; return api; },
      then: function(res, rej){
        var rows = table === 'bookings' ? bookings.map(function(b){ return Object.assign(view(b), { slot_id: b.slot_id }); })
          : table === 'booking_events' ? events.slice()
          : table === 'treatments' ? Object.keys(tr).map(function(k){ return { slug: k, name: tr[k] }; })
          : slots.map(function(s){ return Object.assign({}, s, { bookings: bookings.filter(function(b){ return b.slot_id === s.id; }).map(function(b){ return { id: b.id, status: b.status, name: b.name }; }) }); });
        rows = rows.filter(function(r){ return f.every(function(fn){ return fn(r); }); });
        if(ord) rows.sort(function(a, b){ return (a[ord[0]] < b[ord[0]] ? -1 : a[ord[0]] > b[ord[0]] ? 1 : 0) * (ord[1] ? 1 : -1); });
        if(lim) rows = rows.slice(0, lim);
        return new Promise(function(r){ setTimeout(r, 120); }).then(function(){ return { data: single ? rows[0] || null : rows, error: null }; }).then(res, rej);
      }
    };
    return api;
  }
  function rpc(fn, a){
    if(fn === 'is_admin') return ok(true);
    if(fn === 'admin_set_status'){
      var b = bookings.filter(function(x){ return x.id === a.p_booking_id; })[0]; if(!b) return fail('not_found');
      var okT = (b.status === 'requested' && /confirmed|declined/.test(a.p_to)) || (b.status === 'confirmed' && /declined|completed/.test(a.p_to));
      if(!okT) return fail('invalid_transition');
      if(a.p_to === 'declined' && !(a.p_note && a.p_note.trim().length >= 3)) return fail('reason_required');
      if(a.p_to === 'completed' && new Date(slotOf(b).starts_at) > new Date()) return fail('visit_not_started');
      events.push({ id: events.length + 1, booking_id: b.id, actor_id: ME, from_status: b.status, to_status: a.p_to, note: a.p_note, created_at: new Date().toISOString() });
      b.status = a.p_to; if(a.p_to === 'declined') b.decline_reason = a.p_note;
      return ok({ id: b.id, status: b.status });
    }
    if(fn === 'admin_set_slot'){
      var s = slots.filter(function(x){ return x.id === a.p_slot_id; })[0];
      if(!a.p_open && bookings.some(function(b){ return b.slot_id === s.id && /requested|confirmed/.test(b.status); })) return fail('slot_has_booking');
      s.is_open = a.p_open; return ok({ id: s.id, is_open: s.is_open });
    }
    if(fn === 'admin_generate_slots') return ok(0);
    return fail('unknown');
  }
  var session = { user: { id: ME, email: 'desk@demo.ferrand' } }; // demo: already signed in
  window.supabase = { createClient: function(){ return {
    from: from, rpc: rpc,
    auth: {
      getSession: function(){ return ok({ session: session }); },
      signInWithPassword: function(c){ if(!c.password){ return Promise.resolve({ data: {}, error: { status: 400, message: 'Invalid login credentials' } }); } session = { user: { id: ME, email: c.email } }; return ok({ session: session }); },
      signOut: function(){ session = null; return Promise.resolve({ error: null }); },
      resetPasswordForEmail: function(){ return ok({}); }, updateUser: function(u){ return u.password && u.password.length >= 12 ? ok({ user: {} }) : fail('Password should be at least 12 characters'); },
      onAuthStateChange: function(){ return { data: { subscription: { unsubscribe: function(){} } } }; }
    }
  }; } };
})();
