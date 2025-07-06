
const apiBase = 'https://mixerno.space/api/youtube-channel-counter/user/';
let compareMode = false;
const historyData = { user1: [] };

function getQueryParams() {
  const params = {};
  const query = window.location.search.substring(1);
  const pairs = query.split('&');
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key && value) {
      params[key] = decodeURIComponent(value);
    }
  }
  return params;
}

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

async function fetchChannelData(id, userKey) {
  const res = await fetch(apiBase + encodeURIComponent(id));
  if (!res.ok) throw new Error('Invalid response for: ' + id);
  const data = await res.json();
  const subs = data.counts.find(c => c.value === 'subscribers');
  const views = data.counts.find(c => c.value === 'views');
  const videos = data.counts.find(c => c.value === 'videos');
  const name = data.user.find(u => u.value === 'name');
  const pfp = data.user.find(u => u.value === 'pfp');
  const subsCount = subs?.count || 0;

  updateHistory(userKey, subsCount);

  const growth = calculateGrowth(userKey);

  return {
    name: name?.count || 'Unknown',
    pfp: pfp?.count || 'https://via.placeholder.com/120?text=No+Image',
    subscribers: subsCount,
    views: views?.count || 0,
    videos: videos?.count || 0,
    subsPerDay: growth.day,
    subsPerHour: growth.hour,
    subsPerMin: growth.min
  };
}

function updateHistory(userKey, subs) {
  const now = Date.now();
  historyData[userKey].push({ time: now, subs });
  const tenMinAgo = now - 10 * 60 * 1000;
  historyData[userKey] = historyData[userKey].filter(entry => entry.time >= tenMinAgo);
}

function calculateGrowth(userKey) {
  const data = historyData[userKey];
  if (data.length < 2) return { day: 0, hour: 0, min: 0 };
  const oldest = data[0];
  const latest = data[data.length - 1];
  const subDiff = latest.subs - oldest.subs;
  const timeDiff = (latest.time - oldest.time) / 1000;
  if (timeDiff <= 0) return { day: 0, hour: 0, min: 0 };
  return {
    day: Math.round((subDiff / timeDiff) * 86400),
    hour: Math.round((subDiff / timeDiff) * 3600),
    min: Math.round((subDiff / timeDiff) * 60)
  };
}

function odometerUpdate(id, value) {
  const el = document.getElementById(id);
  if (el && el.innerHTML != value.toString()) {
    el.innerHTML = value;
  }
}

function updateUserDisplay(userId, data) {
  document.getElementById(`${userId}-name`).textContent = data.name;
  document.getElementById(`${userId}-pfp`).src = data.pfp;
  odometerUpdate(`${userId}-subs`, data.subscribers);
  odometerUpdate(`${userId}-views`, data.views);
  odometerUpdate(`${userId}-videos`, data.videos);
  odometerUpdate(`${userId}-subs-day`, data.subsPerDay);
  odometerUpdate(`${userId}-subs-hour`, data.subsPerHour);
  odometerUpdate(`${userId}-subs-min`, data.subsPerMin);
}

async function fetchSubs() {
  document.getElementById('error-msg').textContent = '';
  const id1 = document.getElementById('channel1').value.trim();

  if (!id1) {
    document.getElementById('error-msg').textContent = 'Please enter a channel ID.';
    return;
  }

  updateURLParams(id1);

  try {
    const data1 = await fetchChannelData(id1, 'user1');
    updateUserDisplay('user1', data1);
  } catch (err) {
    document.getElementById('error-msg').textContent = err.message;
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
    odometerUpdate('user2-subs', 0);
    odometerUpdate('user2-views', 0);
    odometerUpdate('user2-videos', 0);
    odometerUpdate('user2-subs-day', 0);
    odometerUpdate('user2-subs-hour', 0);
    odometerUpdate('user2-subs-min', 0);
  }
}

window.onload = () => {
  const params = getQueryParams();
  if (params.id) {
    if (compareMode) toggleMode();
    document.getElementById('channel1').value = params.id;
    fetchSubs();
  } else if (compareMode) {
    toggleMode();
  }
};

setInterval(() => {
  const id1 = document.getElementById('channel1').value.trim();
  if (id1) fetchSubs();
}, 2000);
