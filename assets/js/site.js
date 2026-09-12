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
    // The reply card has its date drawn into the artwork, so the whole
    // drawing swaps rather than a string inside it.
    $$('[data-' + l + '-src], [data-' + other + '-src]').forEach(function (el) {
      var v = el.getAttribute('data-' + l + '-src');
      if (v !== null && el.getAttribute('src') !== v) el.setAttribute('src', v);
    });
    // Alt text is read aloud, so it is one of the two languages like anything
    // else on the page. Only the wardrobe illustration needs it so far.
    $$('[data-' + l + '-alt], [data-' + other + '-alt]').forEach(function (el) {
      var v = el.getAttribute('data-' + l + '-alt');
      if (v !== null) el.setAttribute('alt', v);
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
  var revealIO = null;
  var revealTimer = null;

  function mountReveal() {
    // A soft navigation replaces <main>, so the previous observer is watching
    // elements that no longer exist. Disconnect before building another, or
    // one accumulates per page visited.
    if (revealIO) { revealIO.disconnect(); revealIO = null; }
    if (revealTimer) { clearTimeout(revealTimer); revealTimer = null; }

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
    revealIO = io;

    // Anything still hidden after four seconds is shown regardless. A guest
    // whose scroll never trips the observer must not end up with a blank page.
    revealTimer = setTimeout(function () {
      items.forEach(function (el) { el.classList.add('in'); });
    }, 4000);
  }

  // =========================================================================
  // countdown
  // =========================================================================

  var cd = null;
  var cdTimer = null;

  function mountCountdown() {
    if (cdTimer) { clearInterval(cdTimer); cdTimer = null; }
    cd = $('#cd');
    if (!cd) return;
    renderCountdown();
    // One interval, replaced on each mount. Without the clear above, every
    // page a guest visits would leave another ticking.
    cdTimer = setInterval(renderCountdown, 1000);
  }

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
   *
   * The playhead is remembered too, so moving between pages continues the
   * piece rather than restarting it. See `savePos` below.
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
    var POS_KEY = 'vidh-music-at';

    var audio = $('#mu-audio');
    if (!audio) return;
    audio.volume = 0.22;

    /**
     * Carry the playhead across pages.
     *
     * This is a site of separate documents, so every link is a real
     * navigation and the <audio> element is destroyed and built again. Left
     * alone the track restarts from the top on each page, which is worse than
     * silence: a guest who opens the invitation, then the programme, then the
     * travel notes hears the same eight bars three times.
     *
     * So the position is written to sessionStorage as it plays and read back
     * on the next page. What a guest hears is one continuous piece with a
     * short gap where the page loads, rather than a piece that starts over.
     * Truly gapless would need the audio element to survive the navigation,
     * which means intercepting every link and swapping the page's contents by
     * hand — a much larger change, and one that would put the RSVP form's
     * wiring at risk for the sake of a few hundred milliseconds.
     *
     * sessionStorage and not localStorage: this should follow a visit, not
     * outlive it. Coming back tomorrow should start at the beginning.
     */
    function savePos() {
      if (!audio.duration || !isFinite(audio.duration)) return;
      try { sessionStorage.setItem(POS_KEY, String(audio.currentTime)); } catch (e) {}
    }
    function restorePos() {
      var at;
      try { at = parseFloat(sessionStorage.getItem(POS_KEY)); } catch (e) {}
      if (!at || !isFinite(at) || !audio.duration || !isFinite(audio.duration)) return;
      // The track loops, so any stored position is valid once wrapped. A
      // second off the end also avoids landing on the very last frame and
      // firing `ended` before anything is audible.
      var t = at % audio.duration;
      if (t > audio.duration - 1) t = 0;
      try { audio.currentTime = t; } catch (e) {}
    }
    if (audio.readyState >= 1) restorePos();
    audio.addEventListener('loadedmetadata', restorePos, { once: true });

    // Written about once a second while playing rather than on every
    // `timeupdate`, which fires four times as often for no benefit.
    var lastSave = 0;
    audio.addEventListener('timeupdate', function () {
      var now = Date.now();
      if (now - lastSave < 1000) return;
      lastSave = now;
      savePos();
    });
    // `pagehide` is the one that fires on a real navigation, including into
    // the back/forward cache, where `unload` is unreliable.
    window.addEventListener('pagehide', savePos);
    /**
     * Stop when the phone does.
     *
     * A phone that locks, or switches to WhatsApp, does not stop the audio on
     * its own — that is deliberate browser behaviour, and right for a music
     * app. It is wrong here: a guest who glances at the invitation and puts
     * the phone in a pocket should not be carrying a sitar loop around with
     * them, and the only control is back on a page they have left.
     *
     * This is NOT the same as pressing pause, so it must not touch STOP_KEY.
     * That key means "the guest chose silence" and outlives the tab; this is
     * a duck, and it undoes itself. A guest who did press pause stays paused
     * on return, because `ducked` was never set for them.
     */
    var ducked = false;
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        savePos();
        if (!audio.paused) { ducked = true; audio.pause(); }
      } else if (ducked) {
        ducked = false;
        // Resuming after a visibility change is not a fresh autoplay: the
        // page already has user activation from whatever started the track.
        start().catch(function () {});
      }
    });

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
        //
        // The listeners come off when a `play()` actually SUCCEEDS, not when
        // one is attempted. That distinction is the whole thing: a scroll is a
        // sign of life but it is not "user activation" as the autoplay policy
        // defines it, so `play()` refuses. The first version removed every
        // listener and then attempted, swallowing the rejection — so a guest
        // who scrolled before touching anything got silence for the rest of
        // the visit, with nothing left listening to try again.
        var events = ['pointerdown', 'pointerup', 'click', 'keydown',
                      'touchstart', 'touchend', 'scroll'];
        function off() {
          events.forEach(function (ev) {
            window.removeEventListener(ev, go, true);
          });
        }
        function go(e) {
          // Not the record itself. The same gesture fires pointerdown and then
          // click, so arming on the button meant the first press started the
          // track and its own handler immediately paused it again: one tap,
          // nothing playing, and no way to tell why.
          if (e && e.target && e.target.closest && e.target.closest('#mu-btn')) return;
          // And not if the guest has since pressed pause.
          try {
            if (sessionStorage.getItem(STOP_KEY) === '1') { off(); return; }
          } catch (err) {}
          start().then(off, function () { /* keep listening */ });
        }
        events.forEach(function (e) {
          window.addEventListener(e, go, { capture: true, passive: true });
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

  /**
   * Everything the reply page needs, as one mountable unit.
   *
   * It used to run straight through the outer IIFE and bail with `return` when
   * `#rsvp-box` was absent. Wrapped in a function, the same `return` becomes a
   * guard and the whole thing can be set up again after a soft navigation,
   * with its closures fresh over the new DOM.
   */
  function mountRsvp() {
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
  }

  $$('input[name="attending"]', form).forEach(function (r) {
    r.addEventListener('change', function () {
      syncSteps();
      clearMiss('attending');
    });
  });
  [['#f-phone', 'phone'], ['#f-name', 'name']].forEach(function (pair) {
    var el = $(pair[0]);
    if (el) el.addEventListener('input', function () { clearMiss(pair[1]); });
  });

  /**
   * Put the list away entirely.
   *
   * It only ever appears in answer to a submit, so any path that refills the
   * form behind the guest's back has to clear it: loading a previous reply
   * fills the phone and the yes/no from the sheet without either firing the
   * events that drop those lines one at a time, so the list would sit there
   * naming two things that are now filled in.
   */
  function resetMiss() {
    var box = $('#f-miss');
    if (!box) return;
    $$('[data-miss]', box).forEach(function (el) { el.hidden = true; });
    box.hidden = true;
    showErr('e-name', false);
    showErr('e-contact', false);
    var pair = $('.contact');
    if (pair) pair.classList.remove('has-error');
    var yn = $('#step-yes');
    if (yn) yn.classList.remove('needs');
  }

  /** Drop one line from the list once that one thing is answered. */
  function clearMiss(key) {
    var box = $('#f-miss');
    if (!box || box.hidden) return;
    var el = box.querySelector('[data-miss="' + key + '"]');
    if (el) el.hidden = true;
    if (key === 'phone') {
      showErr('e-contact', false);
      var pair = $('.contact');
      if (pair) pair.classList.remove('has-error');
    }
    if (key === 'name') showErr('e-name', false);
    if (key === 'attending') {
      var yn = $('#step-yes');
      if (yn) yn.classList.remove('needs');
    }
    box.hidden = !$$('[data-miss]', box).some(function (e) { return !e.hidden; });
  }
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

  /**
   * Three things are required and nothing else is.
   *
   * A name, because a reply nobody can put a name to is a row in a sheet and
   * nothing more; a phone number, because it is how anyone reaches a guest on
   * the day and it is the key that finds their reply again; and yes or no,
   * because that is the entire question. Which side, which functions, the
   * travel dates — all welcome, none worth turning a guest away over.
   *
   * When something IS missing, say which. Marking the field red and scrolling
   * to it tells a guest where to look but not what is wrong, and on a form
   * where fourteen of sixteen boxes are optional there is no way to guess.
   */
  function validate() {
    var name = $('#f-name').value.trim();
    var phone = $('#f-phone').value.trim();
    var email = $('#f-email').value.trim();
    var going = attending();

    var miss = { name: !name, phone: !phone, attending: !going };
    var any = miss.name || miss.phone || miss.attending;

    showErr('e-name', miss.name);
    showErr('e-contact', miss.phone);
    var pair = $('.contact');
    if (pair) pair.classList.toggle('has-error', miss.phone);
    var yn = $('#step-yes');
    if (yn) yn.classList.toggle('needs', miss.attending);

    var box = $('#f-miss');
    if (box) {
      $$('[data-miss]', box).forEach(function (el) {
        el.hidden = !miss[el.getAttribute('data-miss')];
      });
      box.hidden = !any;
    }
    showErr('e-form', false);

    // A malformed one is a different complaint from a missing one, and it is
    // worth making even about the optional address.
    var emailBad = email && !validEmail(email);
    var phoneBad = phone && !validPhone(phone);
    $('#f-email').setAttribute('aria-invalid', emailBad ? 'true' : 'false');
    $('#f-phone').setAttribute('aria-invalid', phoneBad ? 'true' : 'false');

    return !any && !emailBad && !phoneBad;
  }

  // --- fill the form from a saved record ----------------------------------

  /**
   * Hold the two date fields inside the days there is anybody to arrive for.
   *
   * `min` and `max` grey out the rest of the calendar in a native picker, but
   * the form carries `novalidate` so a date typed directly into the field
   * still submits. This snaps an out-of-range one to the nearest end.
   */
  $$('#f-arr, #f-dep', form).forEach(function (el) {
    el.addEventListener('change', function () {
      if (!el.value) return;
      if (el.min && el.value < el.min) el.value = el.min;
      if (el.max && el.value > el.max) el.value = el.max;
    });
  });

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
    resetMiss();
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
  //
  // A dialog, opened from a line under the heading. As a panel above the form
  // it was the first and largest thing on the page, which put a box that most
  // guests do not need in front of the thing they came to do.
  //
  // The verdict is written on the PAGE, not in the dialog: by the time there
  // is one the dialog has closed and the guest is looking at the form.

  var lkOpen = $('#lk-open'), lkDlg = $('#lk-dlg'), lkCancel = $('#lk-cancel');
  var lkGo = $('#lk-go'), lkKey = $('#lk-key'), lkMsg = $('#lk-msg');
  var lkErr = $('#lk-err');

  /** Show exactly one of the page's lookup states, or none at all. */
  function lkSay(which) {
    if (!lkMsg) return;
    $$('span[data-m]', lkMsg).forEach(function (s) {
      s.hidden = s.getAttribute('data-m') !== which;
    });
    lkMsg.classList.toggle('on', !!which);
  }

  /** Show exactly one of the dialog's own errors, or none. */
  function lkFault(which) {
    if (!lkErr) return;
    $$('span[data-e]', lkErr).forEach(function (s) {
      s.hidden = s.getAttribute('data-e') !== which;
    });
    lkErr.hidden = !which;
  }

  function lkShut() {
    if (!lkDlg) return;
    // `open` is the fallback path for a browser without showModal; closing has
    // to undo whichever one opened it.
    if (lkDlg.close) { try { lkDlg.close(); } catch (e) {} }
    lkDlg.open = false;
    lkDlg.removeAttribute('open');
  }

  if (lkOpen && lkDlg) {
    lkOpen.addEventListener('click', function () {
      lkFault(null);
      lkSay(null);
      if (lkDlg.showModal) { try { lkDlg.showModal(); } catch (e) { lkDlg.open = true; } }
      else lkDlg.open = true;
      if (lkKey) { lkKey.value = ''; lkKey.focus(); }
    });

    if (lkCancel) lkCancel.addEventListener('click', lkShut);
    // Clicking the backdrop is the dialog itself; anything inside it is not.
    lkDlg.addEventListener('click', function (e) {
      if (e.target === lkDlg) lkShut();
    });
  }

  if (lkGo) {
    lkGo.addEventListener('click', function () {
      var key = lkKey.value.trim();
      if (!key) { lkFault('empty'); lkKey.focus(); return; }
      lkFault(null);

      if (!ENDPOINT) { lkShut(); lkSay('new'); return; }

      // The call takes several seconds. The dialog stays open and busy for it,
      // so the guest is not left looking at a form that has not changed yet.
      lkGo.disabled = true;
      lkGo.classList.add('is-busy');
      lkSay('busy');

      call({ action: 'lookup', key: key })
        .then(function (res) {
          lkShut();
          if (res && res.found && res.rsvp) {
            fill(res.rsvp);
            var who = $('#lk-who');
            if (who) who.textContent = res.rsvp.name ? '\u2014 ' + res.rsvp.name : '';
            lkSay('found');
            // Focus the form so a keyboard user carries straight on, and so
            // the loaded answers are what they land in.
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
        .catch(function () {
          // This one stays in the dialog: it is about the attempt, not the
          // answer, and the guest may simply want to press it again.
          lkSay(null);
          lkFault('error');
        })
        .then(function () {
          lkGo.disabled = false;
          lkGo.classList.remove('is-busy');
        });
    });

    lkKey.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); lkGo.click(); }
    });
    lkKey.addEventListener('input', function () { lkFault(null); });
  }

  // --- submit -------------------------------------------------------------

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!ENDPOINT) { showErr('e-form', true); return; }
    if (!validate()) {
      // The summary first: it is the thing that says what is wrong. Only if
      // there isn't one — a malformed address rather than a missing answer —
      // fall back to the field itself.
      var miss = $('#f-miss');
      var bad = (miss && !miss.hidden) ? miss
              : (form.querySelector('.err.on') || form.querySelector('.needs')
                 || form.querySelector('[aria-invalid="true"]'));
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

      // The calendar, at the one moment it is worth offering: they have just
      // said which side they are on, so there is exactly one right file. A
      // guest who said no is not asked to diarise a wedding they are missing.
      var cal = $('#done-cal');
      if (cal) {
        var side = going ? chosenSide() : '';
        $$('[data-cal]', cal).forEach(function (a) {
          a.hidden = a.getAttribute('data-cal') !== side;
        });
        cal.hidden = !side;
      }
      form.hidden = true;
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
      lkSay(null);
      resetMiss();
      setBtn(editingId ? 'edit' : 'idle');
      form.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }

  syncSteps();
  }

  // =========================================================================
  // mounting a page
  // =========================================================================

  /**
   * Everything that depends on the contents of <main>.
   *
   * Called once on load, and again by the navigation layer each time it swaps
   * a page in. Everything bound to the shell — the language button, the
   * burger, the header measurement, the record — is set up outside this and
   * is never touched again, which is the whole point: the <audio> element
   * survives, so the music does not stop.
   */
  function mountPage() {
    mountReveal();
    mountCountdown();
    mountRsvp();
    applyLangAttrs(lang());
  }

  mountPage();

  // =========================================================================
  // analytics
  // =========================================================================

  /**
   * Set by analytics(); called by the navigation layer on every page swap.
   * Stays a no-op when there is no endpoint to talk to.
   */
  var trackPage = function () {};

  /**
   * Two pings a visit: one when it starts, one when the tab goes away.
   *
   * Enough to know that a link landed , how many opened it, when, from what
   * timezone, in which language, where they went and roughly how long they
   * stayed. Deliberately not product analytics: no per-click events, no
   * heartbeats, no third-party tag, and nothing that can delay a guest's RSVP.
   *
   * Lives outside mountPage() so a soft navigation does not start a second
   * visit; the whole session is one runtime, which is why the path can just
   * accumulate in an array.
   */
  (function analytics() {
    try { setupAnalytics(); } catch (e) {}
  })();

  function setupAnalytics() {
    var body = document.body;
    var ENDPOINT = body.getAttribute('data-endpoint') || '';
    var TOKEN = body.getAttribute('data-token') || '';
    if (!ENDPOINT) return;                      // same silence as a dead form

    var SES_KEY = 'vidh-ses', VIS_KEY = 'vidh-vis', START_KEY = 'vidh-start';
    var started = Date.now();
    var hops = [];
    var ended = false;

    function uuid() {
      try {
        if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
      } catch (e) {}
      // randomUUID is missing before iOS 15.4, and this is an opaque id rather
      // than anything that needs to be unguessable.
      return 'x' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }

    /** A stored id, or a throwaway one: private mode throws on both stores. */
    function id(storeName, key) {
      try {
        var store = window[storeName];
        var v = store.getItem(key);
        if (!v) { v = uuid(); store.setItem(key, v); }
        return v;
      } catch (e) { return uuid(); }
    }

    var session = id('sessionStorage', SES_KEY);   // one tab
    var visitor = id('localStorage', VIS_KEY);     // one browser

    /** Claim the one start ping for this session before sending it. */
    function firstStart() {
      try {
        var store = window.sessionStorage;
        if (store.getItem(START_KEY) === session) return false;
        store.setItem(START_KEY, session);
        return true;
      } catch (e) { return true; }
    }

    function page() {
      return (body.className.match(/p-([\w-]+)/) || [])[1] || '';
    }

    function tz() {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; }
      catch (e) { return ''; }
    }

    /** Where the link was opened from, coarsely. Never the full URL. */
    function ref() {
      var r = document.referrer || '';
      if (!r) return 'direct';                  // typed, or an in-app browser
      if (/whatsapp/i.test(r)) return 'whatsapp';
      try { return new URL(r).hostname; } catch (e) { return ''; }
    }

    function payload(type) {
      return {
        action: 'event', token: TOKEN, type: type,
        session: session, visitor: visitor,
        page: page(),
        lang: document.documentElement.lang === 'hi' ? 'hi' : 'en',
        w: window.innerWidth || 0,
        tz: tz(),
        ref: ref()
      };
    }

    /**
     * Fire and forget, with exactly one retry.
     *
     * Not the RSVP call() helper: that one retries twice, quickly, because a
     * guest is watching. Here nothing is waiting, so the retry is slow and
     * jittered on purpose , it keeps analytics out of the burst where guests'
     * saves are competing for the same Apps Script slots.
     *
     * Apps Script sometimes appends the row and *then* answers with an HTML
     * error page, so a retry can write a duplicate. That is why the Summary
     * tab counts unique session and visitor ids rather than rows. The two go
     * together: dropping COUNTUNIQUE would silently inflate every figure.
     *
     * No Content-Type header. The browser then sends text/plain, which is a
     * simple request with no CORS preflight, and Apps Script cannot answer a
     * preflight at all.
     */
    function send(data, retry) {
      fetch(ENDPOINT, { method: 'POST', body: JSON.stringify(data) })
        .then(function (r) { return r.text(); })
        .then(function (b) { if (b.charAt(0) !== '{') throw new Error('non-json'); })
        .catch(function () {
          if (retry) {
            setTimeout(function () { send(data, false); },
                       3000 + Math.random() * 2000);
          }
        });
    }

    /** One hop of the journey: page id, and seconds in when it was reached. */
    function hop(name) {
      if (hops.length >= 20) return;            // no 5KB cells
      hops.push((name || '?') + ':' + Math.round((Date.now() - started) / 1000));
    }

    function end() {
      if (ended) return;
      ended = true;
      var data = payload('end');
      data.dur_ms = Date.now() - started;
      data.path = hops.join(',').slice(0, 400);
      try {
        // A string, so the beacon goes out as text/plain. A Blob typed
        // application/json would preflight and fail with nothing in the
        // console to say so.
        if (navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, JSON.stringify(data));
      } catch (e) {}
    }

    hop(page());
    trackPage = hop;
    if (firstStart()) send(payload('start'), true);

    // `pagehide` and not `visibilitychange`: the latter also fires when a
    // guest flips to WhatsApp mid-read, which would record time-to-first-
    // distraction rather than how long they stayed. Ends are lossy either way
    // , a missing one never means "still reading".
    window.addEventListener('pagehide', end);
  }

  // =========================================================================
  // soft navigation
  // =========================================================================

  /**
   * Move between pages without loading a new document.
   *
   * This exists for one reason: the music. An <audio> element cannot survive a
   * navigation, so on a site of separate documents the track stops at every
   * link and starts again on the other side. Remembering the playhead got the
   * position back but not the second of silence, and Vibhakar could hear it.
   *
   * So links are intercepted, the target is fetched, and only <main> is
   * replaced. The shell — header, footer, the record, the script itself — is
   * never touched, so the audio element plays straight through. Then
   * mountPage() sets up whatever the new <main> needs.
   *
   * It degrades honestly. Anything that is not a plain left-click on a
   * same-origin page — a new tab, a modifier held, an external link, a
   * download, an anchor on this page — falls through to the browser, and if
   * the fetch fails for any reason at all the click becomes an ordinary
   * navigation. Nothing here is load-bearing for getting around the site.
   */
  (function softNav() {
    if (!window.history || !window.history.pushState || !window.fetch) return;

    var main = $('#main');
    if (!main) return;
    var busy = false;

    /**
     * Is this link pointing at the document we are already looking at?
     *
     * Comparing the two hrefs as strings is not enough, and that is the bug
     * behind "Scroll for more does nothing". GitHub Pages serves the landing
     * page at BOTH `/` and `/index.html`; a guest arriving at the bare domain
     * has `location.pathname === '/'` while the cue's href resolves to
     * `/index.html#gallery`. The strings differ, so the link was treated as a
     * navigation to another page: <main> was replaced with an identical copy
     * and the window scrolled back to the top, which looks exactly like a
     * button that does nothing.
     */
    function samePage(path) {
      var norm = function (p) { return p.replace(/(^|\/)index\.html$/, '$1'); };
      return norm(path) === norm(location.pathname);
    }

    function swap(html, url, push) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var fresh = doc.querySelector('#main');
      if (!fresh) return false;                 // not one of ours; let it load

      main.innerHTML = fresh.innerHTML;
      document.title = doc.title;
      document.body.className = doc.body.className;

      // the header's current-page marker lives outside <main>
      var here = (doc.querySelector('body').className.match(/p-([\w-]+)/) || [])[1];
      trackPage(here);
      $$('.nav-a').forEach(function (a) {
        var on = a.getAttribute('href') === url.split('/').pop();
        a.classList.toggle('on', on);
        if (on) { a.setAttribute('aria-current', 'page'); }
        else { a.removeAttribute('aria-current'); }
      });

      if (push) history.pushState({ soft: 1 }, '', url);
      // <html> carries `scroll-behavior: smooth` for the in-page anchors, and
      // that would animate this jump too: arriving on a new page by watching
      // the old one scroll past. Off for the jump, back on straight after.
      var root = document.documentElement;
      var was = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      window.scrollTo(0, 0);
      root.style.scrollBehavior = was;
      if (nav) nav.classList.remove('open');
      if (burger) burger.setAttribute('aria-expanded', 'false');
      mountPage();
      // Move focus to the top of the new page, or a keyboard user stays where
      // the old document left them and a screen reader announces nothing.
      main.setAttribute('tabindex', '-1');
      main.focus({ preventScroll: true });
      return true;
    }

    function go(url, push) {
      if (busy) return;
      busy = true;
      document.documentElement.classList.add('is-navigating');
      fetch(url, { credentials: 'same-origin' })
        .then(function (r) {
          if (!r.ok) throw new Error(r.status);
          return r.text();
        })
        .then(function (html) {
          if (!swap(html, url, push)) location.href = url;
        })
        .catch(function () { location.href = url; })
        .then(function () {
          busy = false;
          document.documentElement.classList.remove('is-navigating');
        });
    }

    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest('a');
      if (!a || !a.href) return;
      if (a.target && a.target !== '_self') return;
      if (a.hasAttribute('download')) return;
      if (a.origin !== location.origin) return;
      if (!/\.html$/.test(a.pathname) && a.pathname !== '/'
          && !/\/$/.test(a.pathname)) return;
      // An anchor on this page. Scrolled here rather than left to the browser,
      // because the browser only treats it as an anchor when the path matches
      // its own idea of the current URL, and `/` and `/index.html` are the
      // same page but not the same string.
      if (a.hash && samePage(a.pathname)) {
        var target = document.getElementById(a.hash.slice(1));
        if (!target) return;                      // let the browser try
        e.preventDefault();
        target.scrollIntoView({
          block: 'start', behavior: REDUCED ? 'auto' : 'smooth' });
        history.replaceState(history.state, '', a.hash);
        return;
      }
      e.preventDefault();
      go(a.href, true);
    });

    window.addEventListener('popstate', function () {
      go(location.href, false);
    });
  })();

  window.__vidhMount = mountPage;
})();
