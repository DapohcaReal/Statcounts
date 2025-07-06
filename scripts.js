const apiBase = 'https://mixerno.space/api/youtube-channel-counter/user/';
let compareMode = false;
const subHistory = {};

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

async function fetchChannelData(id) {
  const res = await fetch(apiBase + encodeURIComponent(id));
  if (!res.ok) throw new Error('Invalid response for: ' + id);
  const data = await res.json();
  const subs = data.counts.find(c => c.value === 'subscribers');
  const views = data.counts.find(c => c.value === 'views');
  const videos = data.counts.find(c => c.value === 'videos');
  const name = data.user.find(u => u.value === 'name');
  const pfp = data.user.find(u => u.value === 'pfp');

  const currentTime = Date.now();
  const currentSubs = subs?.count || 0;
  if (!subHistory[id]) {
    subHistory[id] = [];
  }

  subHistory[id].push({ time: currentTime, subs: currentSubs });
  subHistory[id] = subHistory[id].filter(point => currentTime - point.time <= 600000); // keep 10 min

  let subsPerMin = 0, subsPerHour = 0, subsPerDay = 0;
  const history = subHistory[id];
  if (history.length >= 2) {
    const first = history[0];
    const last = history[history.length - 1];
    const diff = last.subs - first.subs;
    const seconds = (last.time - first.time) / 1000;
    if (seconds > 0) {
      subsPerMin = diff / seconds * 60;
      subsPerHour = diff / seconds * 3600;
      subsPerDay = diff / seconds * 86400;
    }
  }

  return {
    name: name?.count || 'Unknown',
    pfp: pfp?.count || 'https://via.placeholder.com/120?text=No+Image',
    subscribers: currentSubs,
    views: views?.count || 0,
    videos: videos?.count || 0,
    subsPerDay: Math.round(subsPerDay),
    subsPerHour: Math.round(subsPerHour),
    subsPerMin: Math.round(subsPerMin),
  };
}

function odometerUpdate(id, value) {
  const el = document.getElementById(id);
  if (el && el.innerHTML !== value.toString()) {
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
  const id2 = document.getElementById('channel2').value.trim();

  if (!id1 || (compareMode && !id2)) {
    document.getElementById('error-msg').textContent = 'Please enter channel ID(s).';
    return;
  }

  updateURLParams(id1, compareMode ? id2 : null);

  try {
    const data1 = await fetchChannelData(id1);
    updateUserDisplay('user1', data1);

    if (compareMode) {
      const data2 = await fetchChannelData(id2);
      updateUserDisplay('user2', data2);
      const diff = Math.abs(data1.subscribers - data2.subscribers);
      document.getElementById('sub-diff').innerHTML = diff.toLocaleString();
    } else {
      document.getElementById('sub-diff').innerHTML = '';
    }
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

  if (params.id1 && params.id2) {
    if (!compareMode) toggleMode();
    document.getElementById('channel1').value = params.id1;
    document.getElementById('channel2').value = params.id2;
    fetchSubs();
  } else if (params.id) {
    if (compareMode) toggleMode(); // ensure single mode
    document.getElementById('channel1').value = params.id;
    fetchSubs();
  } else {
    if (compareMode) toggleMode(); // default to single
  }
};

setInterval(() => {
  const id1 = document.getElementById('channel1').value.trim();
  const id2 = document.getElementById('channel2').value.trim();
  if (id1 && (!compareMode || id2)) fetchSubs();
}, 2000);
