const apiBase = 'https://mixerno.space/api/youtube-channel-counter/user/';
let compareMode = true;

// Store history of subs to calculate growth over 10 minutes
const subHistory = {
  user1: [],
  user2: [],
};
const HISTORY_MAX_AGE = 10 * 60 * 1000; // 10 minutes in ms

// Helper: parse URL query params
function getQueryParams() {
  const params = {};
  const query = window.location.search.substring(1);
  if (!query) return params;
  const pairs = query.split('&');
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key && value) {
      params[key] = decodeURIComponent(value);
    }
  }
  return params;
}

// Update URL in address bar without reload
function updateURLParams(id1, id2) {
  const url = new URL(window.location);
  if (id1 && id2) {
    url.searchParams.set('id1', id1);
    url.searchParams.set('id2', id2);
    url.searchParams.delete('id');
  } else if (id1) {
    url.searchParams.set('id', id1);
    url.searchParams.delete('id1');
    url.searchParams.delete('id2');
  } else {
    url.searchParams.delete('id');
    url.searchParams.delete('id1');
    url.searchParams.delete('id2');
  }
  window.history.replaceState({}, '', url.toString());
}

async function fetchChannelData(id) {
  const res = await fetch(apiBase + encodeURIComponent(id));
  if (!res.ok) throw new Error('Invalid response for: ' + id);
  const data = await res.json();
  const subs = data.counts.find(c => c.value === 'subscribers');
  const views = data.counts.find(c => c.value === 'views');
  const videos = data.counts.find(c => c.value === 'videos');
  const name = data.user.find(u => u.value === 'name');
  const pfp = data.user.find(u => u.value === 'pfp');

  return {
    name: name?.count || 'Unknown',
    pfp: pfp?.count || 'https://via.placeholder.com/120?text=No+Image',
    subscribers: subs?.count || 0,
    views: views?.count || 0,
    videos: videos?.count || 0,
  };
}

function formatNumber(num) {
  return num.toLocaleString();
}

// Calculate growth based on history (last 10 minutes)
function calculateGrowth(history) {
  const now = Date.now();

  // Remove old entries beyond 10 minutes
  while (history.length > 1 && now - history[0].time > HISTORY_MAX_AGE) {
    history.shift();
  }

  if (history.length < 2) return { day: 0, hour: 0, min: 0 };

  const first = history[0];
  const last = history[history.length - 1];
  const diffSubs = last.subs - first.subs;
  const diffMs = last.time - first.time;
  if (diffMs <= 0) return { day: 0, hour: 0, min: 0 };

  const subsPerMs = diffSubs / diffMs;
  return {
    day: Math.max(0, Math.round(subsPerMs * 86400000)),
    hour: Math.max(0, Math.round(subsPerMs * 3600000)),
    min: Math.max(0, Math.round(subsPerMs * 60000)),
  };
}

async function fetchSubs() {
  document.getElementById('error-msg').textContent = '';
  const id1 = document.getElementById('channel1').value.trim();
  const id2 = document.getElementById('channel2').value.trim();

  if (!id1 || (compareMode && !id2)) {
    document.getElementById('error-msg').textContent = 'Please enter channel ID(s).';
    return;
  }

  updateURLParams(id1, compareMode ? id2 : null);

  try {
    const data1 = await fetchChannelData(id1);
    // Add current subs + time to history for user1
    subHistory.user1.push({ subs: data1.subscribers, time: Date.now() });

    // Calculate growth for user1
    const growth1 = calculateGrowth(subHistory.user1);
    updateUserDisplay('user1', data1, growth1);

    if (compareMode) {
      const data2 = await fetchChannelData(id2);
      subHistory.user2.push({ subs: data2.subscribers, time: Date.now() });
      const growth2 = calculateGrowth(subHistory.user2);
      updateUserDisplay('user2', data2, growth2);

      const diff = Math.abs(data1.subscribers - data2.subscribers);
      document.getElementById('sub-diff').innerHTML = diff.toLocaleString();
    } else {
      document.getElementById('sub-diff').innerHTML = '';
      // Clear user2 displays when in single mode
      resetUser2Display();
    }
  } catch (err) {
    document.getElementById('error-msg').textContent = err.message;
  }
}

function updateUserDisplay(userId, data, growth = { day: 0, hour: 0, min: 0 }) {
  document.getElementById(`${userId}-name`).textContent = data.name;
  document.getElementById(`${userId}-pfp`).src = data.pfp;
  odometerUpdate(`${userId}-subs`, data.subscribers);
  odometerUpdate(`${userId}-views`, data.views);
  odometerUpdate(`${userId}-videos`, data.videos);
  odometerUpdate(`${userId}-subs-day`, growth.day);
  odometerUpdate(`${userId}-subs-hour`, growth.hour);
  odometerUpdate(`${userId}-subs-min`, growth.min);
}

function resetUser2Display() {
  odometerUpdate('user2-subs', 0);
  odometerUpdate('user2-views', 0);
  odometerUpdate('user2-videos', 0);
  odometerUpdate('user2-subs-day', 0);
  odometerUpdate('user2-subs-hour', 0);
  odometerUpdate('user2-subs-min', 0);
}

function odometerUpdate(id, value) {
  const el = document.getElementById(id);
  if (el.innerHTML != value.toString()) {
    el.innerHTML = value;
  }
}

function toggleTheme() {
  document.body.classList.toggle('dark');
}

function toggleMode() {
  compareMode = !compareMode;

  document.getElementById('channel2').style.display = compareMode ? 'inline-block' : 'none';
  document.getElementById('user2').style.display = compareMode ? 'block' : 'none';
  document.getElementById('stats2').style.display = compareMode ? 'block' : 'none';
  document.getElementById('sub-diff').style.display = compareMode ? 'block' : 'none';

  document.getElementById('main-title').textContent = compareMode
    ? 'Statcounts - Compare YouTube Subscribers'
    : 'Statcounts - YouTube Sub Count';

  if (!compareMode) {
    document.getElementById('channel2').value = '';
    resetUser2Display();
  }
}

// Auto-refresh every 2 seconds if input exists
setInterval(() => {
  const id1 = document.getElementById('channel1').value.trim();
  const id2 = document.getElementById('channel2').value.trim();
  if (id1 && (!compareMode || id2)) fetchSubs();
}, 2000);

// Initialize on load: read URL params, set mode and fetch
window.onload = () => {
  const params = getQueryParams();

  if (params.id1 && params.id2) {
    if (!compareMode) toggleMode(); // ensure compare mode ON
    document.getElementById('channel1').value = params.id1;
    document.getElementById('channel2').value = params.id2;
    fetchSubs();
  } else if (params.id) {
    if (compareMode) toggleMode(); // switch to single mode
    document.getElementById('channel1').value = params.id;
    fetchSubs();
  } else {
    // Default start single mode
    if (compareMode) toggleMode();
  }
};
