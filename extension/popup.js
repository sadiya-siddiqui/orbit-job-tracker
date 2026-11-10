const $ = (id) => document.getElementById(id);
let tabUrl = '';
(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabUrl = (tab && tab.url) || '';
  try {
    const j = await chrome.tabs.sendMessage(tab.id, { type: 'extract' });
    $('company').value = j.company || ''; $('role').value = j.role || ''; $('location').value = j.location || '';
  } catch (e) {}
  if (!$('company').value || !$('role').value) {
    const { lastJob } = await chrome.storage.local.get('lastJob');
    if (lastJob && Date.now() - lastJob.at < 6 * 3600 * 1000) {
      $('company').value = lastJob.company; $('role').value = lastJob.role; $('location').value = lastJob.location || ''; tabUrl = lastJob.link || tabUrl;
      $('msg').textContent = 'Filled from the last job you viewed. Check it, then save.';
    } else $('msg').textContent = 'Could not read this page. Fill in the fields.';
  }
})();
$('save').onclick = () => {
  const job = { company: $('company').value.trim(), role: $('role').value.trim(), location: $('location').value.trim(), status: $('status').value, link: tabUrl };
  if (!job.company || !job.role) { $('msg').textContent = 'Add a company and a role.'; return; }
  chrome.runtime.sendMessage({ type: 'capture', job }, (r) => {
    $('msg').textContent = r && r.ok ? (r.created ? 'Saved to Orbit.' : 'Already in Orbit.') : 'Orbit server is off. Saved for later, it syncs when the server runs.';
  });
};
