/* ==========================================================================
   Vibhakar & Dhwani, site behaviour.

   No framework, no build step, no dependencies. Everything degrades: with
   JavaScript off the page still reads, every piece on the table is still a
   working link, the schedule is there, and the RSVP form tells the guest to
   phone rather than silently failing.
   ========================================================================== */

(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var REDUCED = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // =========================================================================
  // language
  // =========================================================================

  var LANG_KEY = 'vidh-lang';

  /**
   * Attributes cannot hold two spans the way text can, so anything that lives
   * in an attribute is carried as data-en-* / data-hi-* and swapped here.
   */
  function applyLangAttrs(l) {
    var other = l === 'hi' ? 'en' : 'hi';
    $$('[data-' + l + '-placeholder], [data-' + other + '-placeholder]').forEach(function (el) {
      var v = el.getAttribute('data-' + l + '-placeholder');
      if (v !== null) el.setAttribute('placeholder', v);
    });
    $$('[data-' + l + '-aria-label], [data-' + other + '-aria-label]').forEach(function (el) {
      var v = el.getAttribute('data-' + l + '-aria-label');
      if (v !== null) el.setAttribute('aria-label', v);
    });
  }

  function setLang(l) {
    document.documentElement.lang = l;
    try { localStorage.setItem(LANG_KEY, l); } catch (e) {}
    applyLangAttrs(l);
    renderCountdown();
    document.dispatchEvent(new CustomEvent('vidh:lang'));
  }

  var langBtn = $('#lang');
  if (langBtn) {
    langBtn.addEventListener('click', function () {
      setLang(document.documentElement.lang === 'hi' ? 'en' : 'hi');
    });
  }
  applyLangAttrs(document.documentElement.lang || 'en');

  function lang() { return document.documentElement.lang === 'hi' ? 'hi' : 'en'; }

  /** Devanagari digits, because every other number on the page is set in them. */
  function digits(n) {
    var s = String(n);
    return lang() === 'hi'
      ? s.replace(/[0-9]/g, function (d) { return '०१२३४५६७८९'[+d]; })
      : s;
  }

  // =========================================================================
  // header
  // =========================================================================

  var head = $('#head'), nav = $('#nav'), burger = $('#burger');

  function measureHead() {
    if (head) {
      document.documentElement.style.setProperty('--head-h', head.offsetHeight + 'px');
    }
  }
  measureHead();
  window.addEventListener('resize', measureHead);

  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // a tap on any link closes the drawer, otherwise it covers the target
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        nav.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /**
   * Only the header's hairline. There is deliberately no scrollspy: the pages
   * are real pages now and build.py marks the current one at render time, so a
   * scroll handler tracking sections would only strip that `.on` back off.
   */
  window.addEventListener('scroll', function () {
    if (head) head.classList.toggle('stuck', window.scrollY > 8);
  }, { passive: true });

  // =========================================================================
  // reveal on scroll
  // =========================================================================

  /**
   * Fade and lift elements in as they arrive.
   *
   * `.js-reveal` is added to <html> **here**, and the CSS that hides anything
   * keys off it. So with JavaScript off, or if this file fails to parse, not
   * one element is ever hidden. A decorative animation must never be able to
   * blank the page.
   */
  (function reveal() {
    var items = $$('[data-reveal]');
    if (!items.length) return;
    if (!('IntersectionObserver' in window) || REDUCED) return;

    document.documentElement.classList.add('js-reveal');

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, {
      // -30px, not a percentage. A percentage is measured against the
      // viewport, so on a 950px screen -6% shrinks the trigger area by 57px,
      // and the last element on the page then sits permanently inside that
      // dead band: once the document is fully scrolled it can never rise any
      // further, so it never intersects and never reveals. The footer's
      // closing line stayed invisible until the failsafe fired.
      rootMargin: '0px 0px -30px 0px',
      threshold: 0.08
    });
    items.forEach(function (el) { io.observe(el); });

    // Anything still hidden after four seconds is shown regardless. A guest
    // whose scroll never trips the observer must not end up with a blank page.
    setTimeout(function () {
      items.forEach(function (el) { el.classList.add('in'); });
    }, 4000);
  })();

  // =========================================================================
  // countdown
  // =========================================================================

  var cd = $('#cd');

  function renderCountdown() {
    if (!cd) return;

    // The target carries its own +05:30, so a guest opening this in Pittsburgh
    // sees the time left until the pheras in Goa, not until 7pm where they are.
    var target = Date.parse(cd.dataset.target);
    if (!target) return;

    var left = (target - Date.now()) / 1000;
    var doneEl = $('.cd-done', cd);
    var row = $('.cd-row', cd);

    if (left <= 0) {
      if (doneEl) doneEl.hidden = false;
      if (row) row.hidden = true;
      return;
    }
    if (doneEl) doneEl.hidden = true;
    if (row) row.hidden = false;

    var parts = {
      d: Math.floor(left / 86400),
      h: Math.floor(left / 3600) % 24,
      m: Math.floor(left / 60) % 60,
      s: Math.floor(left) % 60
    };
    Object.keys(parts).forEach(function (k) {
      var el = $('[data-cd="' + k + '"]', cd);
      if (el) {
        el.textContent = digits(k === 'd' ? parts[k] : ('0' + parts[k]).slice(-2));
      }
    });
  }

  if (cd) {
    renderCountdown();
    setInterval(renderCountdown, 1000);
  }

  // =========================================================================
  // the record
  // =========================================================================

  /**
   * A turning record with an instrumental behind it, starting by itself, quiet.
   *
   * **It cannot simply autoplay and no amount of code changes that.** Chrome,
   * Safari and Firefox all refuse `play()` on a page the visitor has never
   * interacted with, and they refuse it silently by rejecting the promise. So
   * this tries, and when the browser says no it arms a one-shot listener on
   * the first pointer, key, touch or scroll and starts then. In practice that
   * means the music begins the moment a guest does anything at all, which is
   * as close to "on open" as the web allows.
   *
   * Volume starts at 0.22. A wedding invitation that opens at full volume at
   * somebody in an office is a bad invitation.
   *
   * A guest who presses pause is remembered for the session, so it does not
   * start itself again on the next page. Being able to stop it and have it
   * stay stopped matters more than the music does.
   */
  (function music() {
    var btn = $('#mu-btn');
    if (!btn) return;

    var label = $('#mu-state');
    function say() {
      var attr = lang() === 'hi' ? 'data-say-hi' : 'data-say';
      try { return JSON.parse(btn.getAttribute(attr) || '{}'); } catch (e) { return {}; }
    }
    var STOP_KEY = 'vidh-music-off';

    var audio = $('#mu-audio');
    if (!audio) return;
    audio.volume = 0.22;

    var missing = false;
    function noFile() {
      if (missing) return;
      // No file yet. That is a normal state while the couple pick a track, not
      // an error worth shouting about: the disc simply stops being a control.
      missing = true;
      btn.classList.remove('spinning');
      btn.disabled = true;
      btn.setAttribute('aria-pressed', 'false');
      if (label) label.textContent = say().missing || '';
    }
    // A <source> that 404s fires its own error, and with three candidates two
    // of them are *expected* to fail. Only the media element giving up counts,
    // so anything whose target is a <source> is ignored. Capture phase,
    // because source errors do not bubble.
    audio.addEventListener('error', function (e) {
      if (e.target === audio) noFile();
    }, true);
    // If every <source> failed, readyState never leaves 0 and networkState
    // settles on NO_SOURCE. Checked once, late, because a slow connection
    // should not be mistaken for a missing file.
    setTimeout(function () {
      if (audio.networkState === 3 /* NETWORK_NO_SOURCE */) noFile();
    }, 2500);

    function paint() {
      // `missing` wins: paint() runs last on load and would otherwise write
      // "Paused" over the line explaining that there is no record yet.
      if (missing) {
        if (label) label.textContent = say().missing || '';
        return;
      }
      var on = !audio.paused;
      btn.classList.toggle('spinning', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      var t = say();
      if (label) label.textContent = (on ? t.on : t.off) || t.tap || '';
    }
    audio.addEventListener('play', paint);
    audio.addEventListener('pause', paint);
    document.addEventListener('vidh:lang', paint);

    function start() {
      if (missing) return Promise.reject();
      var p = audio.play();
      return (p && p.catch) ? p : Promise.resolve();
    }

    // No <source> at all means build.py found no track on disk. With no
    // children the element sits in NETWORK_EMPTY rather than NO_SOURCE, so the
    // check below never fires and the disc would sit there claiming to be
    // paused with nothing behind it.
    if (!audio.querySelector('source')) noFile();

    var stopped = false;
    try { stopped = sessionStorage.getItem(STOP_KEY) === '1'; } catch (e) {}

    if (!stopped && !REDUCED && !missing) {
      start().catch(function () {
        // Blocked, which is the normal answer. Wait for any sign of life.
        var events = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
        function go() {
          events.forEach(function (e) {
            window.removeEventListener(e, go, true);
          });
          start().catch(function () {});
        }
        events.forEach(function (e) {
          window.addEventListener(e, go, { once: true, capture: true, passive: true });
        });
      });
    }

    btn.addEventListener('click', function () {
      if (audio.paused) {
        try { sessionStorage.removeItem(STOP_KEY); } catch (e) {}
        start().catch(function () {});
      } else {
        audio.pause();
        try { sessionStorage.setItem(STOP_KEY, '1'); } catch (e) {}
      }
    });

    paint();
  })();

  // =========================================================================
  // RSVP
  // =========================================================================

  var box = $('#rsvp-box');
  if (!box) return;

  var ENDPOINT = box.dataset.endpoint || '';
  var TOKEN = box.dataset.token || '';
  var form = $('#rf'), done = $('#done'), sendBtn = $('#f-send');
  var editingId = null;

  /**
   * Talk to the Apps Script Web App.
   *
   * Two things here are deliberate and easy to get wrong:
   *
   * 1. No Content-Type header. The browser then sends text/plain, which makes
   *    this a "simple" request with no CORS preflight, and Apps Script cannot
   *    answer an OPTIONS preflight, so setting application/json breaks it.
   *
   * 2. Retries. Apps Script intermittently answers a perfectly good POST with
   *    an HTML error page instead of JSON, with no pattern to it. Roughly one
   *    in six during testing. A guest must not be told their RSVP failed
   *    because Google hiccuped, so a non-JSON body is retried rather than
   *    reported.
   */
  function sleep(ms) {
    return new Promise(function (res) { setTimeout(res, ms); });
  }

  function call(payload, tries, delay) {
    tries = tries == null ? 2 : tries;
    delay = delay == null ? 900 : delay;
    payload.token = TOKEN;

    return fetch(ENDPOINT, { method: 'POST', body: JSON.stringify(payload) })
      .then(function (r) { return r.text(); })
      .then(function (body) {
        var res;
        try {
          res = JSON.parse(body);
        } catch (e) {
          // Apps Script answers with a Drive HTML error page rather than JSON
          // often enough that this is the normal failure, not the exception.
          throw new Error('non-json');
        }
        // The sheet was locked by another writer. That is transient by
        // definition, so retry rather than surfacing it to the guest.
        if (res && res.error === 'busy') throw new Error('busy');
        return res;
      })
      .catch(function (err) {
        if (tries > 1) {
          return sleep(delay).then(function () {
            return call(payload, tries - 1, Math.round(delay * 1.8));
          });
        }
        throw err;
      });
  }

  /**
   * Did a save that *looked* like it failed actually land?
   *
   * This is the important one. Apps Script regularly answers a POST with an
   * HTML error page and a 404 **after having run the script and written the
   * row**. Telling someone their RSVP failed when it is sitting in the sheet
   * is the worst outcome available: they either give up, or they submit again
   * and worry.
   *
   * So before showing an error, ask the sheet. If a record for this guest
   * exists and was written in the last few minutes, the save worked and the
   * only thing that broke was the reply.
   */
  function landed(payload) {
    var key = payload.email || payload.phone;
    if (!key) return Promise.resolve(null);

    return call({ action: 'lookup', key: key }, 2)
      .then(function (res) {
        if (!res || !res.found || !res.rsvp) return null;
        var when = Date.parse(res.rsvp.updated_at);
        if (!when || Date.now() - when > 5 * 60 * 1000) return null;
        return res.rsvp;
      })
      .catch(function () { return null; });
  }

  // --- validation ---------------------------------------------------------

  function showErr(id, on) {
    var el = document.getElementById(id);
    if (el) el.classList.toggle('on', !!on);
    return !on;
  }

  function validEmail(v) { return !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }
  function validPhone(v) { return !v || (v.replace(/\D/g, '').length >= 7); }

  // --- the staircase ------------------------------------------------------

  var yesOnly = $('#yes-only');
  var sideOnly = $('#side-only');

  function attending() {
    var r = form.querySelector('input[name="attending"]:checked');
    return r ? r.value : '';
  }

  function chosenSide() {
    var r = form.querySelector('input[name="side"]:checked');
    return r ? r.value : '';
  }

  function chosenEvents() {
    // Only what is visible counts. A guest who ticked four of Dhwani's
    // functions and then switched to Vibhakar's side must not submit both
    // sets, so the hidden panel's checkboxes are ignored on the way out.
    return $$('input[name="events"]:checked', form)
      .filter(function (c) {
        var panel = c.closest('.evpick');
        return panel && !panel.hidden;
      })
      .map(function (c) { return c.value; });
  }

  /**
   * Show the next question only once the previous one is answered.
   *
   * Nothing is destroyed on the way: switching sides hides one list of
   * functions and shows the other, and switching back finds the first list
   * exactly as it was left. That matters because a guest coming for both sides
   * will flip between them to see what is on.
   */
  function syncSteps() {
    var going = attending() === 'yes';
    if (yesOnly) yesOnly.hidden = !going;

    var side = chosenSide();
    if (sideOnly) sideOnly.hidden = !going || !side;

    $$('.evpick', form).forEach(function (p) {
      p.hidden = p.dataset.side !== side;
    });
    if (going && side) showErr('e-side', false);
  }

  $$('input[name="attending"]', form).forEach(function (r) {
    r.addEventListener('change', syncSteps);
  });
  $$('input[name="side"]', form).forEach(function (r) {
    r.addEventListener('change', function () {
      syncSteps();
      // Bring the newly revealed list into view, rather than leaving it below
      // the fold with no sign that anything happened.
      if (sideOnly && !sideOnly.hidden && !REDUCED) {
        sideOnly.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  });
  $$('input[name="events"]', form).forEach(function (c) {
    c.addEventListener('change', function () {
      if (chosenEvents().length) showErr('e-events', false);
    });
  });

  function validate() {
    var name = $('#f-name').value.trim();
    var email = $('#f-email').value.trim();
    var phone = $('#f-phone').value.trim();

    var ok = true;
    ok = showErr('e-name', !name) && ok;
    ok = showErr('e-contact', !email && !phone) && ok;
    var pair = $('.contact');
    if (pair) pair.classList.toggle('has-error', !email && !phone);
    ok = showErr('e-form', false) && ok;

    var emailBad = email && !validEmail(email);
    var phoneBad = phone && !validPhone(phone);
    $('#f-email').setAttribute('aria-invalid', emailBad ? 'true' : 'false');
    $('#f-phone').setAttribute('aria-invalid', phoneBad ? 'true' : 'false');
    if (emailBad || phoneBad) ok = false;

    if (attending() === 'yes') {
      ok = showErr('e-side', !chosenSide()) && ok;
      ok = showErr('e-events', !!chosenSide() && chosenEvents().length === 0) && ok;
    } else if (!attending()) {
      // Neither yes nor no has been answered yet.
      ok = false;
      var yn = $('#step-yes');
      if (yn) yn.classList.add('needs');
    } else {
      showErr('e-side', false);
      showErr('e-events', false);
    }
    return ok;
  }

  // --- fill the form from a saved record ----------------------------------

  /**
   * Coerce whatever the sheet gives back into the yyyy-MM-dd that a date input
   * will accept.
   *
   * Google Sheets silently turns "2026-12-04" into a date cell, so a lookup can
   * return "2026-12-04T08:00:00.000Z". `<input type="date">` rejects anything
   * that is not a bare date and fails *silently*, which is why arrival and
   * departure came back empty. The backend now formats these properly, but a
   * sheet may still hold rows written before that fix, so accept both here.
   */
  function asDate(v) {
    if (!v) return '';
    var m = String(v).match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  }

  /**
   * Split a stored phone back into its dial code and its number.
   *
   * Saved as "+91-9876543210". Rows written before the country field existed
   * hold bare digits, so anything without a hyphen goes into the number box
   * and the code is left at its default.
   */
  function splitPhone(v) {
    var s = String(v == null ? '' : v).trim();
    var i = s.indexOf('-');
    if (s.charAt(0) === '+' && i > 0) {
      return { code: s.slice(0, i), number: s.slice(i + 1) };
    }
    return { code: '', number: s };
  }

  /**
   * Lock a contact field that already holds a value.
   *
   * Email and phone are the lookup keys. If a guest could edit one, they would
   * strand their own row: the address they remember would no longer find it,
   * and a typo could collide with somebody else's. So a stored value is
   * write-once. A blank one stays editable, and filling it in gives them a
   * second way to find their reply next time.
   *
   * `readonly`, not `disabled`: a disabled input is not submitted, and the
   * value still needs to travel with the form.
   */
  function lockContacts(rec) {
    [['email', $('#f-email')], ['phone', $('#f-phone')]].forEach(function (pair) {
      var key = pair[0], input = pair[1];
      if (!input) return;
      var stored = rec && rec[key] ? String(rec[key]).trim() : '';
      var wrap = input.closest('.locked-wrap');
      var note = $('.note-locked[data-note="' + key + '"]');
      var tpl = document.getElementById(stored ? 'tpl-locked' : 'tpl-addable');
      var mark = wrap ? $('.lockmark', wrap) : null;

      input.readOnly = !!stored;
      if (key === 'phone' && $('#f-country')) $('#f-country').disabled = !!stored;
      if (wrap) wrap.classList.toggle('is-locked', !!stored);
      if (mark) mark.hidden = !stored;
      if (note && tpl) {
        note.innerHTML = tpl.innerHTML;
        note.hidden = false;
        note.classList.toggle('is-locked-note', !!stored);
      }
    });
  }

  /** Back to a blank, fully editable form. */
  function unlockContacts() {
    ['#f-email', '#f-phone'].forEach(function (sel) {
      var el = $(sel);
      if (!el) return;
      el.readOnly = false;
      var w = el.closest('.locked-wrap');
      if (w) w.classList.remove('is-locked');
    });
    if ($('#f-country')) $('#f-country').disabled = false;
    $$('.lockmark').forEach(function (mk) { mk.hidden = true; });
    $$('.note-locked').forEach(function (n) { n.hidden = true; });
  }

  function fill(r) {
    editingId = r.id || null;
    $('#f-name').value = r.name || '';
    $('#f-email').value = r.email || '';

    var ph = splitPhone(r.phone);
    $('#f-phone').value = ph.number;
    var cc = $('#f-country');
    if (cc && ph.code) {
      // only switch the selector if we actually offer that code
      var known = Array.prototype.some.call(cc.options, function (o) {
        return o.value === ph.code;
      });
      if (known) cc.value = ph.code;
    }
    $('#f-head').value = r.headcount || 1;
    $('#f-party').value = r.party || '';
    $('#f-note').value = r.note || '';
    $('#f-arr').value = asDate(r.arrival);
    $('#f-dep').value = asDate(r.departure);
    $('#f-arrdet').value = r.arrival_detail || '';
    var ap = $('#f-arrpt');
    if (ap && r.arrival_point != null) ap.value = String(r.arrival_point);

    var going = String(r.attending || 'yes') === 'yes';
    var radio = form.querySelector('input[name="attending"][value="' + (going ? 'yes' : 'no') + '"]');
    if (radio) radio.checked = true;

    var evs = String(r.events || '').split(',').map(function (x) { return x.trim(); });

    // A row written before sides existed carries no `side`, so infer it from
    // the functions the guest picked: every stored key is prefixed with a side.
    var side = String(r.side || '').trim();
    if (!side) {
      for (var i = 0; i < evs.length; i++) {
        var cut = evs[i].indexOf('-');
        if (cut > 0) { side = evs[i].slice(0, cut); break; }
      }
    }
    if (side) {
      var sr = form.querySelector('input[name="side"][value="' + side + '"]');
      if (sr) sr.checked = true;
    }

    $$('input[name="events"]', form).forEach(function (c) {
      c.checked = evs.indexOf(c.value) !== -1;
    });

    syncSteps();
    lockContacts(r);
    setBtn('edit');
  }

  function setBtn(state) {
    $$('[data-s]', sendBtn).forEach(function (s) {
      s.hidden = s.getAttribute('data-s') !== state;
    });
  }

  // --- lookup -------------------------------------------------------------

  var lkGo = $('#lk-go'), lkKey = $('#lk-key'), lkMsg = $('#lk-msg');

  /** Show exactly one of the lookup's states, or none at all. */
  function lkSay(which) {
    $$('span[data-m]', lkMsg).forEach(function (s) {
      s.hidden = s.getAttribute('data-m') !== which;
    });
    lkMsg.classList.toggle('on', !!which);
  }

  if (lkGo) {
    lkGo.addEventListener('click', function () {
      var key = lkKey.value.trim();
      if (!key) { lkSay('empty'); lkKey.focus(); return; }
      if (!ENDPOINT) { lkSay('new'); return; }

      // The call takes several seconds. Say so, rather than leaving a dead
      // button: without this the only feedback was the button greying out.
      lkGo.disabled = true;
      lkGo.classList.add('is-busy');
      lkSay('busy');

      call({ action: 'lookup', key: key })
        .then(function (res) {
          if (res && res.found && res.rsvp) {
            fill(res.rsvp);
            var who = $('#lk-who');
            if (who) who.textContent = res.rsvp.name || '';
            lkSay('found');
            // Move focus to the form so a keyboard user carries straight on,
            // and so the loaded answers are what they land in.
            $('#f-name').focus({ preventScroll: true });
            form.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          } else {
            // Carry what they typed into the right field, so they do not have
            // to type it a second time.
            if (key.indexOf('@') > 0) $('#f-email').value = key;
            else $('#f-phone').value = key;
            unlockContacts();
            lkSay('new');
            $('#f-name').focus({ preventScroll: true });
          }
        })
        .catch(function () { lkSay('error'); })
        .then(function () {
          lkGo.disabled = false;
          lkGo.classList.remove('is-busy');
        });
    });

    lkKey.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); lkGo.click(); }
    });
    // typing again clears the previous verdict, which would otherwise sit there
    // contradicting what is now in the box
    lkKey.addEventListener('input', function () { lkSay(null); });
  }

  // --- submit -------------------------------------------------------------

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!ENDPOINT) { showErr('e-form', true); return; }
    if (!validate()) {
      var bad = form.querySelector('.err.on') || form.querySelector('.needs');
      if (bad) bad.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    var going = attending() === 'yes';

    var payload = {
      action: 'save',
      name: $('#f-name').value.trim(),
      email: $('#f-email').value.trim(),
      phone: $('#f-phone').value.trim(),
      country: ($('#f-country') && $('#f-country').value) || '',
      attending: going ? 'yes' : 'no',
      side: going ? chosenSide() : '',
      events: going ? chosenEvents() : [],
      headcount: going ? $('#f-head').value : 0,
      party: going ? $('#f-party').value.trim() : '',
      arrival: going ? $('#f-arr').value : '',
      departure: going ? $('#f-dep').value : '',
      arrival_point: going ? $('#f-arrpt').value : '',
      arrival_detail: going ? $('#f-arrdet').value.trim() : '',
      note: $('#f-note').value.trim(),
      lang: lang(),
      hp: $('#hp').value
    };

    sendBtn.disabled = true;
    setBtn('busy');

    // Apps Script is slow enough that a silent button reads as a broken one.
    var slow = $('#f-slow');
    var slowTimer = setTimeout(function () { if (slow) slow.hidden = false; }, 6000);
    function stopSlow() {
      clearTimeout(slowTimer);
      if (slow) slow.hidden = true;
    }

    function showDone(updated, rec) {
      stopSlow();
      if (rec) lockContacts(rec);
      $$('[data-d]', done).forEach(function (s) {
        s.hidden = s.getAttribute('data-d') !== (going ? 'yes' : 'no');
      });
      $('#done-upd').hidden = !updated;
      form.hidden = true;
      $('#lookup').hidden = true;
      done.hidden = false;
      done.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    call(payload)
      .then(function (res) {
        if (!res || !res.ok) throw new Error((res && res.error) || 'failed');
        showDone(res.updated, res.rsvp);
      })
      .catch(function () {
        // The reply did not arrive, which does not mean the row did not.
        return landed(payload).then(function (rec) {
          if (!rec) throw new Error('failed');
          showDone(rec.created_at !== rec.updated_at, rec);
        });
      })
      .catch(function () {
        stopSlow();
        showErr('e-form', true);
        setBtn(editingId ? 'edit' : 'idle');
      })
      .then(function () { sendBtn.disabled = false; });
  });

  var again = $('#again');
  if (again) {
    again.addEventListener('click', function () {
      done.hidden = true;
      form.hidden = false;
      $('#lookup').hidden = false;
      setBtn(editingId ? 'edit' : 'idle');
      form.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }

  syncSteps();
})();
