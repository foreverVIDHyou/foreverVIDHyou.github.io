/* ==========================================================================
   Vibhakar & Dhwani, site behaviour.

   No framework, no build step, no dependencies. Everything degrades: with
   JavaScript off the page still reads, the schedule is there, and the RSVP
   form tells the guest to phone instead of silently failing.
   ========================================================================== */

(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // =========================================================================
  // language
  // =========================================================================

  var LANG_KEY = 'vidh-lang';

  /**
   * Attributes cannot hold two spans the way text can, so anything that lives
   * in an attribute is carried as data-en-* / data-hi-* and swapped here.
   */
  function applyLangAttrs(lang) {
    var other = lang === 'hi' ? 'en' : 'hi';
    $$('[data-' + lang + '-placeholder], [data-' + other + '-placeholder]').forEach(function (el) {
      var v = el.getAttribute('data-' + lang + '-placeholder');
      if (v !== null) el.setAttribute('placeholder', v);
    });
    $$('[data-' + lang + '-aria-label], [data-' + other + '-aria-label]').forEach(function (el) {
      var v = el.getAttribute('data-' + lang + '-aria-label');
      if (v !== null) el.setAttribute('aria-label', v);
    });
  }

  function setLang(lang) {
    document.documentElement.lang = lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    applyLangAttrs(lang);
    renderCountdown();
    renderLightboxCaption();
  }

  var langBtn = $('#lang');
  if (langBtn) {
    langBtn.addEventListener('click', function () {
      setLang(document.documentElement.lang === 'hi' ? 'en' : 'hi');
    });
  }
  applyLangAttrs(document.documentElement.lang || 'en');

  function lang() { return document.documentElement.lang === 'hi' ? 'hi' : 'en'; }

  // =========================================================================
  // header: stuck state, mobile drawer, scrollspy
  // =========================================================================

  var head = $('#head');
  var nav = $('#nav');
  var burger = $('#burger');

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
   * Only the header's hairline. There is deliberately no scrollspy here.
   *
   * The previous version was a one-pager whose nav pointed at #story, #travel
   * and so on, and a scroll handler toggled `.on` to track the section in
   * view. Now that those are real pages, build.py marks the current one at
   * render time, and the leftover scrollspy was matching nothing and quietly
   * *stripping* that server-rendered `.on` off every link, so no page ever
   * showed as current. Deleted rather than repaired: the active page is a fact
   * the server already knows.
   */
  function onScroll() {
    if (head) head.classList.toggle('stuck', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // =========================================================================
  // reveal on scroll
  // =========================================================================

  /**
   * Fade and lift elements in as they arrive.
   *
   * The `data-reveal` attribute is added **here, in JavaScript**, and the CSS
   * that hides an element keys off that attribute. So with JavaScript off, or
   * if this file fails to load, nothing is ever hidden and the page simply
   * renders. An animation that can leave the invitation blank is not worth
   * having.
   *
   * Each group is staggered by its position among its siblings, so a row of
   * schedule cards arrives one after another rather than all at once.
   */
  var REVEAL_GROUPS = [
    '.garland, .sprig',
    '.hero-mono, .hero-in > .eyebrow, .names, .hero-in > .divider, .when, .where, .tag, .cta, .count',
    '.hero-art',
    '.page-head .wrap > *',
    '.sec > .wrap > .eyebrow, .sec > .wrap > h2, .sec > .wrap > .lede, .draft-note',
    '.day-h',
    '.ev-i',
    '.card',
    '.chapter',
    '.duet',
    '.sw',
    '.qa',
    '.venue',
    '.band .wrap > *',
    '.rsvp-box',
    '.sec > .wrap > .divider, .sec-more',
    '.foot .wrap > *'
  ];

  (function setupReveal() {
    var reduce = window.matchMedia &&
                 window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) return;

    var all = [];
    REVEAL_GROUPS.forEach(function (sel) {
      var byParent = {};
      $$(sel).forEach(function (el) {
        if (el.hasAttribute('data-reveal')) return;
        // stagger within the element's own parent, so two columns of schedule
        // cards each count from one rather than continuing the other's tally
        var key = sel + '|' + (el.parentNode ? el.parentNode.className : '');
        byParent[key] = (byParent[key] || 0) + 1;
        var i = Math.min(byParent[key] - 1, 7);      // cap the wait at 7 steps
        el.setAttribute('data-reveal', '');
        el.style.setProperty('--i', i);
        all.push(el);
      });
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);           // reveal once; do not re-hide on scroll up
      });
      // -30px, not -6%. A percentage is measured against the viewport, so on a
      // 950px screen it shrinks the trigger area by 57px, and the last element
      // on the page then sits permanently inside that dead band: once the
      // document is fully scrolled it can never move any higher, so it never
      // intersects and never reveals. The footer's closing line was stuck
      // invisible until the four-second failsafe fired. A small fixed inset is
      // smaller than the footer's own bottom padding, so the last line still
      // lands inside the root.
    }, { rootMargin: '0px 0px -30px 0px', threshold: 0.08 });

    all.forEach(function (el) { io.observe(el); });

    // Anything still hidden after 4 seconds gets shown regardless. A guest
    // whose scroll never triggers the observer must not end up with a blank
    // page.
    setTimeout(function () {
      all.forEach(function (el) { el.classList.add('in'); });
    }, 4000);
  })();

  // =========================================================================
  // countdown
  // =========================================================================

  var count = $('#count');

  function renderCountdown() {
    if (!count) return;

    // IST explicitly: a guest opening this in Pittsburgh should see the time
    // remaining until the wedding starts in Goa, not until 9am wherever they are.
    var start = Date.parse(count.dataset.start + 'T09:00:00+05:30');
    var end   = Date.parse(count.dataset.end + 'T23:59:59+05:30');
    var now   = Date.now();

    var phase = now < start ? 'before' : (now <= end ? 'during' : 'after');
    $$('[data-c]', count).forEach(function (el) {
      el.hidden = el.getAttribute('data-c') !== phase;
    });
    count.classList.toggle('over', phase !== 'before');
    if (phase !== 'before') return;

    var d = Math.max(0, start - now) / 1000;
    var parts = {
      days: Math.floor(d / 86400),
      hours: Math.floor(d / 3600) % 24,
      minutes: Math.floor(d / 60) % 60,
      seconds: Math.floor(d) % 60
    };
    // Dates, times and the schedule are all set in Devanagari numerals in
    // Hindi, so a counter ticking away in 93 / 05 / 40 reads as a bit of the
    // page nobody translated.
    var hi = lang() === 'hi';
    function digits(n) {
      var s = String(n);
      return hi ? s.replace(/[0-9]/g, function (d) {
        return '०१२३४५६७८९'[+d];
      }) : s;
    }

    Object.keys(parts).forEach(function (k) {
      var el = document.getElementById('c-' + k);
      if (el) el.textContent = digits(k === 'days' ? parts[k] : ('0' + parts[k]).slice(-2));
    });
  }

  renderCountdown();
  setInterval(renderCountdown, 1000);

  // =========================================================================
  // gallery lightbox
  // =========================================================================

  var lb = $('#lb'), lbImg = $('#lb-img'), lbCap = $('#lb-cap');
  var shots = $$('.gi-b');
  var at = 0, lastFocus = null;

  function renderLightboxCaption() {
    if (!lb || lb.hidden || !shots.length) return;
    lbCap.textContent = shots[at].getAttribute('data-cap-' + lang()) || '';
  }

  function openLb(i) {
    if (!shots.length) return;
    at = (i + shots.length) % shots.length;
    lastFocus = document.activeElement;
    lbImg.src = shots[at].dataset.full;
    lbImg.alt = shots[at].getAttribute('data-cap-en') || '';
    // Unhide first: renderLightboxCaption() bails out while the lightbox is
    // hidden (so the language toggle does not poke a closed one), so calling
    // it before this line left the first photo with no caption.
    lb.hidden = false;
    renderLightboxCaption();
    document.body.style.overflow = 'hidden';
    $('#lb-x').focus();
  }

  function closeLb() {
    if (!lb) return;
    lb.hidden = true;
    lbImg.src = '';
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }

  shots.forEach(function (b, i) {
    b.addEventListener('click', function () { openLb(i); });
  });

  if (lb) {
    $('#lb-x').addEventListener('click', closeLb);
    $('#lb-p').addEventListener('click', function () { openLb(at - 1); });
    $('#lb-n').addEventListener('click', function () { openLb(at + 1); });
    // clicking the backdrop closes; clicking the photo itself does not
    lb.addEventListener('click', function (e) {
      if (e.target === lb || e.target.classList.contains('lb-f')) closeLb();
    });
    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') closeLb();
      if (e.key === 'ArrowLeft') openLb(at - 1);
      if (e.key === 'ArrowRight') openLb(at + 1);
    });
  }

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
   * row**. Measured here at roughly 16 seconds per call with a failure rate
   * high enough to hit real guests. Telling someone their RSVP failed when it
   * is sitting in the sheet is the worst outcome available: they either give
   * up, or they submit again and worry.
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

  function attending() {
    var r = form.querySelector('input[name="attending"]:checked');
    return r ? r.value : 'yes';
  }

  function chosenEvents() {
    return $$('input[name="events"]:checked', form).map(function (c) { return c.value; });
  }

  function validate() {
    var name = $('#f-name').value.trim();
    var email = $('#f-email').value.trim();
    var phone = $('#f-phone').value.trim();

    var ok = true;
    ok = showErr('e-name', !name) && ok;
    ok = showErr('e-contact', !email && !phone) && ok;
    ok = showErr('e-form', false) && ok;

    var emailBad = email && !validEmail(email);
    var phoneBad = phone && !validPhone(phone);
    $('#f-email').setAttribute('aria-invalid', emailBad ? 'true' : 'false');
    $('#f-phone').setAttribute('aria-invalid', phoneBad ? 'true' : 'false');
    if (emailBad || phoneBad) ok = false;

    if (attending() === 'yes') {
      ok = showErr('e-events', chosenEvents().length === 0) && ok;
    } else {
      showErr('e-events', false);
    }
    return ok;
  }

  // --- "not coming" hides the logistics -----------------------------------

  var yesOnly = $('#yes-only');
  function syncAttending() {
    if (yesOnly) yesOnly.hidden = attending() !== 'yes';
  }
  $$('input[name="attending"]', form).forEach(function (r) {
    r.addEventListener('change', syncAttending);
  });
  syncAttending();

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
    var s = String(v);
    var m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  }

  function fill(r) {
    editingId = r.id || null;
    $('#f-name').value = r.name || '';
    $('#f-email').value = r.email || '';
    $('#f-phone').value = r.phone == null ? '' : String(r.phone);
    $('#f-head').value = r.headcount || 1;
    $('#f-party').value = r.party || '';
    $('#f-note').value = r.note || '';
    $('#f-arr').value = asDate(r.arrival);
    $('#f-dep').value = asDate(r.departure);
    if (r.food) $('#f-food').value = r.food;

    var going = String(r.attending || 'yes') === 'yes';
    var radio = form.querySelector('input[name="attending"][value="' + (going ? 'yes' : 'no') + '"]');
    if (radio) radio.checked = true;

    if (r.stay) {
      var s = form.querySelector('input[name="stay"][value="' + r.stay + '"]');
      if (s) s.checked = true;
    }

    var evs = String(r.events || '').split(',').map(function (x) { return x.trim(); });
    $$('input[name="events"]', form).forEach(function (c) {
      c.checked = evs.indexOf(c.value) !== -1;
    });

    syncAttending();
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
      lkGo.classList.add('busy');
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
            $('#rf').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          } else {
            // Carry what they typed into the right field, so they do not have
            // to type it a second time.
            if (key.indexOf('@') > 0) $('#f-email').value = key;
            else $('#f-phone').value = key;
            lkSay('new');
            $('#f-name').focus({ preventScroll: true });
          }
        })
        .catch(function () { lkSay('error'); })
        .then(function () {
          lkGo.disabled = false;
          lkGo.classList.remove('busy');
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
      var bad = form.querySelector('.err.on');
      if (bad) bad.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    var going = attending() === 'yes';
    var stayEl = form.querySelector('input[name="stay"]:checked');

    var payload = {
      action: 'save',
      name: $('#f-name').value.trim(),
      email: $('#f-email').value.trim(),
      phone: $('#f-phone').value.trim(),
      attending: going ? 'yes' : 'no',
      events: going ? chosenEvents() : [],
      headcount: going ? $('#f-head').value : 0,
      party: going ? $('#f-party').value.trim() : '',
      food: going ? $('#f-food').value : '',
      arrival: going ? $('#f-arr').value : '',
      departure: going ? $('#f-dep').value : '',
      stay: going && stayEl ? stayEl.value : '',
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

    function showDone(updated) {
      stopSlow();
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
        showDone(res.updated);
      })
      .catch(function () {
        // The reply did not arrive, which does not mean the row did not.
        return landed(payload).then(function (rec) {
          if (!rec) throw new Error('failed');
          showDone(rec.created_at !== rec.updated_at);
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
})();
