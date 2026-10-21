/* FERRAND booking API: guest calls to Supabase RPC (PRD.md §6).
   Only the publishable key lives here; every rule is enforced in the database. */
(function(){
  var URL = 'https://zrtrxibpuhtfwahdbkyx.supabase.co';
  var KEY = 'sb_publishable_w2mJOZ2-RNUXkigjK-nDDg_7LnW-7bP';
  var TZ = 'Europe/Paris';

  // POST /rpc/<fn>; rejects with err.code = the database message (slot_taken, invalid_email…) or 'network'
  function rpc(fn, body){
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function(){ ctrl.abort(); }, 12000) : 0;
    return fetch(URL + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { 'apikey': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function(r){
      return r.json().catch(function(){ return null; }).then(function(d){
        if(!r.ok){ var e = new Error((d && d.message) || 'http_' + r.status); e.code = (d && d.message) || 'http_' + r.status; throw e; }
        return d;
      });
    }, function(){ var e = new Error('network'); e.code = 'network'; throw e; })
      .finally(function(){ clearTimeout(timer); });
  }

  function fmt(opts){ return new Intl.DateTimeFormat('en-GB', Object.assign({ timeZone: TZ }, opts)); }
  var fKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  var fWd = fmt({ weekday: 'short' }), fWdLong = fmt({ weekday: 'long' }), fDay = fmt({ day: 'numeric' }),
      fMon = fmt({ month: 'short' }), fMonLong = fmt({ month: 'long' }), fTime = fmt({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

  window.FerrandAPI = {
    rpc: rpc,
    dayKey: function(d){ return fKey.format(d); },              // 2026-10-22, Paris calendar day
    time: function(d){ return fTime.format(d); },                // 10:30
    dayShort: function(d){ return fWd.format(d) + ' ' + fDay.format(d) + ' ' + fMon.format(d); },        // Thu 22 Oct
    dayLong: function(d){ return fWdLong.format(d) + ' ' + fDay.format(d) + ' ' + fMonLong.format(d); }, // Thursday 22 October
    weekday: function(d){ return fWd.format(d); },
    dayNum: function(d){ return fDay.format(d); },
    month: function(d){ return fMon.format(d); }
  };
})();
