// Runs on job pages. Saves the job when you click a final "apply" button.
(() => {
  const txt = (el) => ((el && el.textContent) || '').replace(/\s+/g, ' ').trim();
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  const q = (sels) => { for (const s of sels) { const t = txt(document.querySelector(s)); if (t) return t; } return ''; };
  const host = location.hostname;
  // "Easy Apply" is NOT matched: it only opens the form. "Submit application" is the real apply.
  const APPLY = /^(submit (your )?application|send application|apply( now| here| for this (job|internship))?|quick apply|apply on company (website|site))$/i;
  const SUBMIT = /^submit$/i; // a bare "Submit" only counts on known job sites
  const SITES = /linkedin|indeed|naukri|glassdoor|wellfound|foundit|internshala|shine\.com|monster|instahyre|cutshort|unstop/i;

  function fromSite() {
    if (host.includes('linkedin.com')) return {
      role: q(['.job-details-jobs-unified-top-card__job-title', '.jobs-unified-top-card__job-title', '.top-card-layout__title', 'h1']),
      company: q(['.job-details-jobs-unified-top-card__company-name', '.jobs-unified-top-card__company-name', '.topcard__org-name-link']),
      location: q(['.job-details-jobs-unified-top-card__primary-description-container .tvm__text', '.topcard__flavor--bullet'])
    };
    if (host.includes('naukri.com')) return {
      role: q(['h1[class*="jd-header-title"]', 'h1']),
      company: q(['[class*="jd-header-comp-name"] a', 'a[class*="comp-name"]']),
      location: q(['[class*="location"] a', '[class*="loc"] span'])
    };
    if (host.includes('indeed.')) return {
      role: q(['[data-testid="jobsearch-JobInfoHeader-title"]', 'h1.jobsearch-JobInfoHeader-title', 'h1']),
      company: q(['[data-testid="inlineHeader-companyName"]', '[data-testid="company-name"]']),
      location: q(['[data-testid="inlineHeader-companyLocation"]', '[data-testid="job-location"]'])
    };
    if (host.includes('internshala.com')) return {
      role: q(['.heading_4_5.profile', '.profile_on_detail_page', '.profile', 'h1.heading_2_4', 'h1']),
      company: q(['.company_name a', '.company-name a', '.company_name', 'a.link_display_like_text']),
      location: q(['#location_names a', '.location_link', '.location_names'])
    };
    return {};
  }

  function fromJsonLd() {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const d = JSON.parse(s.textContent);
        const list = Array.isArray(d) ? d : (d['@graph'] || [d]);
        const p = list.find((x) => x && x['@type'] === 'JobPosting');
        if (p) {
          const a = ([].concat(p.jobLocation || [])[0] || {}).address || {};
          return { role: p.title, company: (p.hiringOrganization || {}).name, location: [a.addressLocality, a.addressRegion].filter(Boolean).join(', ') };
        }
      } catch (e) {}
    }
    return {};
  }

  function fromTitle() {
    const parts = document.title.replace(/^\(\d+\)\s*/, '').split(/\s+[|\-–]\s+/).map((s) => s.trim()).filter((s) => s && !SITES.test(s));
    return { role: parts[0] || '', company: parts[1] || '' };
  }

  // On list pages the job lives in the card around the clicked button, not in the page header.
  function fromCard(btn) {
    let el = btn && btn.parentElement;
    for (let i = 0; i < 8 && el && el !== document.body; i++, el = el.parentElement) {
      const role = txt(el.querySelector('h1,h2,h3,h4,[class*="title"],[class*="designation"],[class*="job-name"],[class*="jobname"]'));
      const company = txt(el.querySelector('[class*="company"],[class*="employer"],[class*="organi"],a[href*="/company"]'));
      if (role && company && role.length < 120 && company.length < 100 && role !== company)
        return { role, company, location: txt(el.querySelector('[class*="location"]')) };
    }
    return {};
  }

  function collect(btn) {
    const a = fromSite(), b = fromJsonLd(), card = fromCard(btn), c = fromTitle();
    const pick = (k) => clean(a[k] || b[k] || card[k] || c[k]);
    return { role: pick('role'), company: pick('company'), location: clean(a.location || b.location || card.location), sure: !!((a.company || b.company || card.company) && (a.role || b.role || card.role)) };
  }

  function toast(msg, warn) {
    const d = document.createElement('div');
    d.textContent = msg;
    d.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;padding:12px 16px;border-radius:12px;font:500 14px system-ui,sans-serif;color:#0a0e1f;box-shadow:0 8px 30px rgba(0,0,0,.35);background:' + (warn ? '#ffb454' : '#5ef2c2');
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 4000);
  }

  // Remember the job you are looking at, because the final Apply step often happens on another page.
  const siteKey = host.split('.').slice(-2).join('.');
  let remKey = '', remAt = 0;
  function remember() {
    const j = collect();
    if (!j.sure || !j.company || !j.role) return;
    const key = j.company + '|' + j.role + '|' + location.href;
    if (key === remKey && Date.now() - remAt < 60000) return;
    remKey = key; remAt = Date.now();
    chrome.storage.local.set({ lastJob: { site: siteKey, company: j.company, role: j.role, location: j.location, link: location.href.split('#')[0], at: Date.now() } });
  }
  remember();
  if (SITES.test(host)) setInterval(remember, 3000);

  let last = '', lastAt = 0;
  async function capture(btn) {
    let j = collect(btn), link = location.href.split('#')[0];
    if (!j.company || !j.role) {
      const { lastJob } = await chrome.storage.local.get('lastJob');
      if (lastJob && lastJob.site === siteKey && Date.now() - lastJob.at < 30 * 60 * 1000) { j = lastJob; link = lastJob.link; }
    }
    if (!j.company || !j.role) { toast('Orbit could not read this job. Open the Orbit popup to save it.', true); return; }
    const key = j.company + j.role;
    if (key === last && Date.now() - lastAt < 10000) return;
    last = key; lastAt = Date.now();
    const job = { company: j.company, role: j.role, location: j.location || '', link, status: 'applied' };
    chrome.runtime.sendMessage({ type: 'capture', job }, (r) => {
      if (!r) { toast('Orbit could not reach its background service.', true); return; }
      if (!r.ok) toast('Orbit server is off. Saved for later, it will sync when the server runs.', true);
      else toast(r.created ? 'Saved to Orbit: ' + job.company : 'Already in Orbit: ' + job.company);
    });
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('button, a, [role="button"], input[type="submit"], [class*="btn"]');
    if (!b) return;
    const label = clean(b.value || txt(b));
    if (APPLY.test(label) || (SITES.test(host) && SUBMIT.test(label))) capture(b);
  }, true);

  chrome.runtime.onMessage.addListener((m, _s, send) => { if (m && m.type === 'extract') send(collect()); });
})();