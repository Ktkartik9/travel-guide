
const UNSPLASH_KEY  = 'YOUR_API_KEY';
const OWM_KEY       = 'YOUR_API_KEY';
const GEOAPIFY_KEY  = 'YOUR_API_KEY';

const UNSPLASH_BASE = 'https://api.unsplash.com/search/photos';
const OWM_BASE      = 'https://api.openweathermap.org/data/2.5/weather';
const GEOAPIFY_BASE = 'https://api.geoapify.com/v2/places';


const GEO_PLACES_CATS = 'tourism.attraction,tourism.sights,tourism.attraction.artwork,heritage,national_park';
const GEO_HOTELS_CATS = 'accommodation.hotel,accommodation.hostel,accommodation.guest_house,accommodation.motel,accommodation.hut';
const GEO_RADIUS      = 15000;   
const GEO_LIMIT_PLACES = 15;
const GEO_LIMIT_HOTELS = 9;



const WEATHER_EMOJI = {
  clear        : '☀️',
  clouds       : '☁️',
  rain         : '🌧',
  drizzle      : '🌦',
  thunderstorm : '⛈',
  snow         : '❄️',
  mist         : '🌫',
  haze         : '🌫',
  fog          : '🌫',
  smoke        : '🌫',
  dust         : '🌪',
  sand         : '🌪',
  ash          : '🌋',
  squall       : '🌬',
  tornado      : '🌪'
};


const TIERS = {
  A: {
    label: 'Budget-Friendly', badge: '💚',
    hotel_low: 18, hotel_high: 45, food_day: 10, transport: 4, activity: 6,
    countries: ['IN','BD','PK','NP','LK','KH','MM','VN','LA','ID','PH',
                'NG','ET','KE','TZ','GH','UG','ZM','MZ','SD']
  },
  B: {
    label: 'Mid-Range', badge: '💛',
    hotel_low: 55, hotel_high: 110, food_day: 28, transport: 14, activity: 20,
    countries: ['CN','TH','MY','BR','MX','AR','CO','PE','CL','EG','MA',
                'TN','ZA','TR','SA','AE','QA','PL','CZ','HU','RO','BG',
                'HR','RS','UA','BY','KZ','GE','AM','AZ']
  },
  C: {
    label: 'Premium', badge: '🔴',
    hotel_low: 140, hotel_high: 280, food_day: 65, transport: 30, activity: 45,
    countries: ['US','CA','GB','FR','DE','IT','ES','NL','CH','AT','BE',
                'SE','NO','DK','FI','IE','PT','JP','KR','SG','AU','NZ',
                'HK','TW','IS','LU','MC']
  }
};

function resolveTier(countryCode) {
  const cc = (countryCode || '').toUpperCase();
  for (const key of ['A', 'B', 'C']) {
    if (TIERS[key].countries.includes(cc)) return TIERS[key];
  }
  return TIERS.B; 
}



const DAY_THEMES = [
  { icon: '🏛', title: 'Arrival & Orientation',
    tip: 'Settle in, stroll your neighbourhood and enjoy a welcome dinner at a local restaurant.' },
  { icon: '🗿', title: 'History & Heritage',
    tip: 'Spend the morning at museums or historic sites; explore local markets in the afternoon.' },
  { icon: '🌿', title: 'Nature & Parks',
    tip: 'Visit parks, gardens or scenic viewpoints. Pack a picnic for a relaxed midday break.' },
  { icon: '🎨', title: 'Arts & Culture',
    tip: 'Explore galleries, street art districts and cultural centres of the city.' },
  { icon: '🍜', title: 'Food & Local Markets',
    tip: 'Dedicate the day to a food tour — street stalls, cafes and beloved local specialities.' },
  { icon: '🛍', title: 'Shopping & Leisure',
    tip: 'Browse bazaars, boutiques or artisan markets. Unwind by the waterfront in the evening.' },
  { icon: '✈️', title: 'Farewell & Departure',
    tip: 'Final morning stroll, last souvenir pick-ups, then head to the airport or station.' }
];


function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function prettifyCategory(slug) {
  if (!slug) return 'Place';
  const segment = String(slug).split('.').pop();      
  return segment
    .replace(/_/g, ' ')
    .replace(/\b\w/g, ch => ch.toUpperCase());          
}


function normaliseFeature(feature) {
  const p = feature.properties || {};

  const name = p.name
    || p.address_line1
    || (p.formatted || '').split(',')[0]
    || 'Unnamed Place';

  const address = p.formatted
    || [p.address_line1, p.address_line2].filter(Boolean).join(', ')
    || 'Address not available';

  const cats          = Array.isArray(p.categories) ? p.categories : [];
  const bestSlug      = cats[cats.length - 1] || '';   
  const categoryLabel = prettifyCategory(bestSlug);

  return { name, address, categoryLabel };
}


function buildGeoUrl(lat, lon, categories, limit) {
  const params = new URLSearchParams({
    categories,
    filter : `circle:${lon},${lat},${GEO_RADIUS}`,
    limit,
    apiKey : GEOAPIFY_KEY
  });
  return `${GEOAPIFY_BASE}?${params}`;
}



function setLoadBar(pct) {
  const bar = document.getElementById('loading-bar');
  bar.style.transition = pct === 0
    ? 'none'
    : 'width 0.45s ease, opacity 0.6s ease 0.3s';
  bar.style.width   = pct + '%';
  bar.style.opacity = pct >= 100 ? '0' : '1';
}



function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.classList.add('visible');
}
function clearError() {
  const el = document.getElementById('error-msg');
  el.textContent = '';
  el.classList.remove('visible');
}

function buildSkeletonCard() {
  return `<div class="place-card">
    <div class="card-accent sk-accent"></div>
    <div class="card-body">
      <div class="skeleton sk-num"></div>
      <div class="skeleton sk-name"></div>
      <div class="skeleton sk-badge"></div>
      <div class="skeleton sk-line-lg"></div>
      <div class="skeleton sk-line-sm"></div>
    </div>
  </div>`;
}

function showSkeletons(gridId, emptyId, count) {
  const grid = document.getElementById(gridId);
  grid.innerHTML = Array(count).fill(buildSkeletonCard()).join('');
  grid.style.display = 'grid';
  document.getElementById(emptyId).style.display = 'none';
}


function renderCards(items, gridId, emptyId, metaId, type) {
  const grid  = document.getElementById(gridId);
  const empty = document.getElementById(emptyId);
  const meta  = document.getElementById(metaId);

  grid.innerHTML = '';

  if (!items || items.length === 0) {
    grid.style.display  = 'none';
    empty.style.display = 'block';
    meta.textContent    = 'No results found';
    return;
  }

  empty.style.display = 'none';
  grid.style.display  = 'grid';
  meta.textContent    = `${items.length} ${type === 'hotel' ? 'Hotels' : 'Places'} found`;

  const pin = type === 'hotel' ? '🏨' : '📍';

  items.forEach((item, i) => {
    const num   = String(i + 1).padStart(2, '0');
    const delay = (i * 0.07).toFixed(2);

    grid.innerHTML += `
      <div class="place-card" style="animation-delay:${delay}s">
        <div class="card-accent"></div>
        <div class="card-body">
          <div class="card-number">No. ${num}</div>
          <div class="card-name">${esc(item.name)}</div>
          <div class="card-category-row">
            <span class="card-category">✦ ${esc(item.categoryLabel)}</span>
          </div>
          <div class="card-address">
            <span class="pin-icon">${pin}</span>
            <span>${esc(item.address)}</span>
          </div>
        </div>
      </div>`;
  });
}

function renderBudget(tier, city) {
  const N = 7;

  const lineItems = [
    { icon: '🏨', label: `${N} Nights Hotel`,   low: tier.hotel_low * N,   high: tier.hotel_high * N },
    { icon: '🍽', label: `${N} Days Food`,       low: tier.food_day * 6,    high: tier.food_day * 9   },
    { icon: '🚌', label: `${N} Days Transport`,  low: tier.transport * 5,   high: tier.transport * 9  },
    { icon: '🎭', label: `${N} Days Activities`, low: tier.activity * 5,    high: tier.activity * 9   }
  ];

  const totalLow  = lineItems.reduce((s, x) => s + x.low,  0);
  const totalHigh = lineItems.reduce((s, x) => s + x.high, 0);

  document.getElementById('budget-summary').innerHTML = `
    <div class="budget-tier-badge">
      <span class="tier-badge-icon">${tier.badge}</span>
      <span>${esc(tier.label)} Destination</span>
      <span class="tier-city">· ${esc(city)}</span>
    </div>
    <div class="budget-cards-row">
      ${lineItems.map(it => `
        <div class="budget-card">
          <div class="budget-icon">${it.icon}</div>
          <div class="budget-label">${esc(it.label)}</div>
          <div class="budget-range">$${it.low} – $${it.high}</div>
        </div>`).join('')}
      <div class="budget-card budget-card--total">
        <div class="budget-icon">💰</div>
        <div class="budget-label">Estimated Grand Total</div>
        <div class="budget-range budget-total-num">$${totalLow} – $${totalHigh}</div>
        <div class="budget-note">per person · 7 days</div>
      </div>
    </div>`;
}

function renderItinerary(places, hotels, city) {
  const grid = document.getElementById('itinerary-grid');
  const pool = [...places]; 

  grid.innerHTML = '';
  grid.style.display = 'grid';
  document.getElementById('itinerary-empty').style.display = 'none';
  document.getElementById('itinerary-meta').textContent    = `7-Day Plan · ${esc(city)}`;

  for (let d = 0; d < 7; d++) {
    const theme    = DAY_THEMES[d];
    const daySpots = pool.splice(0, d < 6 ? 2 : 1);
    const hotel    = hotels[0] || null;

    const spotsHtml = daySpots.length > 0
      ? daySpots.map(s => `
          <div class="itinerary-spot">
            <span class="spot-dot"></span>
            <div class="spot-detail">
              <span class="spot-name">${esc(s.name)}</span>
              <span class="spot-cat">${esc(s.categoryLabel)}</span>
            </div>
          </div>`).join('')
      : `<div class="itinerary-spot">
           <span class="spot-dot"></span>
           <div class="spot-detail">
             <span class="spot-name">Free exploration</span>
           </div>
         </div>`;

    const hotelHtml = (d < 6 && hotel)
      ? `<div class="itinerary-hotel">🏨 Stay at <strong>${esc(hotel.name)}</strong></div>`
      : (d === 6 ? `<div class="itinerary-hotel">🧳 Check-out &amp; depart</div>` : '');

    grid.innerHTML += `
      <div class="itinerary-card" style="animation-delay:${(d * 0.09).toFixed(2)}s">
        <div class="itinerary-day-header">
          <span class="itinerary-day-num">Day ${d + 1}</span>
          <span class="itinerary-theme-icon">${theme.icon}</span>
        </div>
        <div class="itinerary-theme-title">${esc(theme.title)}</div>
        <p class="itinerary-tip">${esc(theme.tip)}</p>
        <div class="itinerary-spots">
          <div class="spots-label">Suggested Visits</div>
          ${spotsHtml}
        </div>
        ${hotelHtml}
      </div>`;
  }
}

async function handleSearch() {
  const city = document.getElementById('city-input').value.trim();
  if (!city) {
    showError('Please enter a city name to begin your journey.');
    return;
  }

  clearError();
  setLoadBar(5);
  const btn = document.getElementById('search-btn');
  btn.disabled    = true;
  btn.textContent = 'Exploring…';

  showSkeletons('places-grid', 'places-empty', 6);
  showSkeletons('hotels-grid', 'hotels-empty', 6);

  document.getElementById('itinerary-grid').innerHTML      = '';
  document.getElementById('itinerary-grid').style.display  = 'none';
  document.getElementById('budget-summary').innerHTML      = '';
  document.getElementById('itinerary-empty').style.display = 'block';
  document.getElementById('itinerary-meta').textContent    = '—';
  document.getElementById('places-meta').textContent       = '—';
  document.getElementById('hotels-meta').textContent       = '—';

  try {

    setLoadBar(10);

    const imgData = await fetch(
      `${UNSPLASH_BASE}?query=${encodeURIComponent(city + ' city landmark travel')}`
      + `&per_page=1&orientation=landscape&client_id=${UNSPLASH_KEY}`
    ).then(r => r.json());

    const imgUrl = imgData.results?.[0]?.urls?.regular;
    if (imgUrl) {
      const heroBg = document.getElementById('hero-bg');
      heroBg.style.opacity    = '0';
      heroBg.style.transition = 'opacity 1s ease';
      setTimeout(() => {
        heroBg.style.backgroundImage = `url('${imgUrl}')`;
        heroBg.style.opacity         = '1';
      }, 300);
    }



    setLoadBar(25);

    const wData = await fetch(
      `${OWM_BASE}?q=${encodeURIComponent(city)}&appid=${OWM_KEY}&units=metric`
    ).then(r => r.json());

    if (wData.cod !== 200) {
      document.getElementById('weather-card').style.display = 'none';
      showError(`City "${city}" not found. Please check the spelling and try again.`);
      btn.disabled    = false;
      btn.textContent = 'Explore';
      setLoadBar(100);
      return;
    }

    
    const lat         = wData.coord.lat;   
    const lon         = wData.coord.lon;   
    const countryCode = wData.sys.country; 

    
    const cond = wData.weather[0].main.toLowerCase();
    const desc = wData.weather[0].description;

    document.getElementById('w-city').textContent     = `${wData.name}, ${countryCode}`;
    document.getElementById('w-temp').textContent     = `${Math.round(wData.main.temp)}°C`;
    document.getElementById('w-desc').textContent     = desc[0].toUpperCase() + desc.slice(1);
    document.getElementById('w-humidity').textContent = wData.main.humidity;
    document.getElementById('w-wind').textContent     = Math.round(wData.wind.speed * 3.6);
    document.getElementById('w-feels').textContent    = Math.round(wData.main.feels_like);
    document.getElementById('w-icon').textContent     = WEATHER_EMOJI[cond] || '🌡';
    document.getElementById('weather-card').style.display = 'block';

    setLoadBar(45);

    const placesData = await fetch(
      buildGeoUrl(lat, lon, GEO_PLACES_CATS, GEO_LIMIT_PLACES)
    ).then(r => r.json());

    
    const places = (placesData.features || [])
      .filter(f => f.properties && f.properties.name)
      .map(normaliseFeature);

    renderCards(places, 'places-grid', 'places-empty', 'places-meta', 'place');


   
    setLoadBar(65);

    const hotelsData = await fetch(
      buildGeoUrl(lat, lon, GEO_HOTELS_CATS, GEO_LIMIT_HOTELS)
    ).then(r => r.json());

    const hotels = (hotelsData.features || [])
      .filter(f => f.properties && f.properties.name)
      .map(normaliseFeature);

    renderCards(hotels, 'hotels-grid', 'hotels-empty', 'hotels-meta', 'hotel');


  
    setLoadBar(85);

    const tier = resolveTier(countryCode);
    renderBudget(tier, city);
    renderItinerary([...places], [...hotels], city);

    setLoadBar(100);

  } catch (err) {
    console.error('[TravelGuide] Error:', err);
    showError('Something went wrong while fetching data. Please check your connection and try again.');
    ['places-grid', 'hotels-grid'].forEach(id => {
      document.getElementById(id).style.display = 'none';
    });
    ['places-empty', 'hotels-empty'].forEach(id => {
      document.getElementById(id).style.display = 'block';
    });
    setLoadBar(100);

  } finally {
    btn.disabled    = false;
    btn.textContent = 'Explore';
  }
}

document.getElementById('city-input').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') handleSearch();
});

document.getElementById('search-btn').addEventListener('click', handleSearch);

window.addEventListener('load', function () {
  document.getElementById('city-input').value = 'Indore';
  handleSearch();
});
