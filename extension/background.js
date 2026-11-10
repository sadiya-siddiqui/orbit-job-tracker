const BASE = 'http://127.0.0.1:8000';
const DAY = 864e5;
const LABEL = { wishlist: 'Wishlist', applied: 'Applied', interview: 'Interview', offer: 'Offer', rejected: 'Rejected' };

async function post(job) {
  const r = await fetch(BASE + '/api/capture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(job) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
const notify = (id, title, message) => chrome.notifications.create(id, { type: 'basic', iconUrl: 'icon.png', title, message });

chrome.runtime.onMessage.addListener((m, _s, send) => {
  if (m.type !== 'capture') return;
  post(m.job)
    .then((r) => send({ ok: true, created: r.created, job: r.job }))
    .catch(async () => {
      const { pending = [] } = await chrome.storage.local.get('pending');
      pending.push(m.job);
      await chrome.storage.local.set({ pending });
      send({ ok: false, queued: true });
    });
  return true; // keep the channel open for the async reply
});

async function poll() {
  try {
    const { pending = [] } = await chrome.storage.local.get('pending');
    const left = [];
    for (const j of pending) { try { await post(j); } catch (e) { left.push(j); } }
    await chrome.storage.local.set({ pending: left });

    const jobs = await (await fetch(BASE + '/api/jobs')).json();
    const { seen } = await chrome.storage.local.get('seen');
    const { reminded = [] } = await chrome.storage.local.get('reminded');
    const now = {};
    for (const j of jobs) {
      now[j.id] = j.status;
      if (seen && seen[j.id] && seen[j.id] !== j.status)
        notify('s' + j.id + j.status, j.company + ': ' + LABEL[j.status], j.role + ' moved from ' + LABEL[seen[j.id]] + ' to ' + LABEL[j.status] + '.');
      if (j.status === 'applied' && j.applied_on && Date.now() - Date.parse(j.applied_on) > 7 * DAY && !reminded.includes(j.id)) {
        notify('r' + j.id, 'No reply from ' + j.company, "It has been over 7 days since you applied for " + j.role + '. Consider a follow-up.');
        reminded.push(j.id);
      }
    }
    await chrome.storage.local.set({ seen: now, reminded });
  } catch (e) { /* server is off; try again next time */ }
}

chrome.alarms.create('poll', { periodInMinutes: 30, delayInMinutes: 1 });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'poll') poll(); });
chrome.runtime.onStartup.addListener(poll);
chrome.runtime.onInstalled.addListener(poll);
chrome.notifications.onClicked.addListener(() => chrome.tabs.create({ url: BASE }));
