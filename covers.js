/* ============================================================
 * 封面插画 —— 纯 SVG 程序化绘制的夜读氛围小景
 * 每种 cover 一个主题：moon/lamp/window/book/cat/key/clock/wave/star/snow
 * 返回一段可 innerHTML 的 SVG 字符串，自适应容器。
 * ============================================================ */

function coverArt(type, seed = 0) {
  const uid = 'c' + (seed || Math.floor(Math.random() * 9999));
  const defs = `
    <defs>
      <linearGradient id="${uid}_bg" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stop-color="#33365f"/>
        <stop offset="0.55" stop-color="#20223e"/>
        <stop offset="1" stop-color="#14162b"/>
      </linearGradient>
      <radialGradient id="${uid}_halo" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#f0c48d" stop-opacity="0.55"/>
        <stop offset="1" stop-color="#f0c48d" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="${uid}_warm" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f3cf9a"/>
        <stop offset="1" stop-color="#c98a46"/>
      </linearGradient>
    </defs>`;

  // 通用星空
  let stars = '';
  const rnd = seeded(seed + 7);
  for (let i = 0; i < 22; i++) {
    const x = (rnd() * 400).toFixed(0);
    const y = (rnd() * 120).toFixed(0);
    const r = (rnd() * 1.2 + 0.4).toFixed(1);
    const o = (rnd() * 0.5 + 0.2).toFixed(2);
    stars += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${o}"/>`;
  }

  const scenes = {
    moon: `
      <circle cx="300" cy="60" r="90" fill="url(#${uid}_halo)"/>
      <circle cx="300" cy="60" r="34" fill="#f3d9ae"/>
      <circle cx="312" cy="52" r="32" fill="#20223e" opacity="0.9"/>
      ${stars}
      <path d="M0 150 Q80 120 160 145 T400 138 V200 H0Z" fill="#12142a"/>
      <path d="M0 168 Q120 150 230 170 T400 160 V200 H0Z" fill="#0c0e1e" opacity="0.8"/>`,
    lamp: `
      ${stars}
      <rect x="0" y="120" width="400" height="80" fill="#1a1622"/>
      <rect x="150" y="40" width="100" height="60" rx="6" fill="url(#${uid}_warm)" opacity="0.18"/>
      <circle cx="200" cy="70" r="70" fill="url(#${uid}_halo)"/>
      <path d="M170 30 h60 l14 34 h-88 z" fill="#3a2e26"/>
      <rect x="196" y="28" width="8" height="6" fill="#5a4838"/>
      <path d="M200 64 v70" stroke="#5a4838" stroke-width="4"/>
      <ellipse cx="200" cy="140" rx="42" ry="10" fill="#3a2e26"/>
      <ellipse cx="200" cy="64" rx="30" ry="8" fill="#f3cf9a"/>
      <path d="M0 200 Q200 150 400 200Z" fill="#0e0c16"/>`,
    window: `
      ${stars}
      <rect x="95" y="20" width="210" height="180" rx="4" fill="#0e1022" stroke="#4a3a2c" stroke-width="8"/>
      <line x1="200" y1="20" x2="200" y2="200" stroke="#4a3a2c" stroke-width="6"/>
      <line x1="95" y1="110" x2="305" y2="110" stroke="#4a3a2c" stroke-width="6"/>
      <circle cx="150" cy="60" r="20" fill="#f3d9ae"/>
      <circle cx="160" cy="54" r="19" fill="#14162b"/>
      <g fill="#fff" opacity="0.7"><circle cx="250" cy="55" r="1.4"/><circle cx="270" cy="80" r="1"/><circle cx="240" cy="90" r="1.2"/><circle cx="130" cy="150" r="1"/><circle cx="265" cy="150" r="1.4"/></g>
      <rect x="100" y="200" width="200" height="6" fill="#3a2e26"/>`,
    book: `
      <rect width="400" height="200" fill="url(#${uid}_bg)"/>
      <circle cx="200" cy="90" r="80" fill="url(#${uid}_halo)" opacity="0.6"/>
      <g transform="translate(80 60)">
        <path d="M0 20 Q60 5 120 20 V100 Q60 85 0 100Z" fill="#e8dcc4"/>
        <path d="M240 20 Q180 5 120 20 V100 Q180 85 240 100Z" fill="#d9cbb0"/>
        <path d="M120 20 V100" stroke="#a8997e" stroke-width="2"/>
        <g stroke="#b5a688" stroke-width="1.5" opacity="0.8">
          <path d="M20 40 H100"/><path d="M20 52 H100"/><path d="M20 64 H85"/>
          <path d="M140 40 H220"/><path d="M140 52 H220"/><path d="M140 64 H205"/>
        </g>
      </g>
      ${stars.slice(0, 400)}`,
    cat: `
      ${stars}
      <circle cx="200" cy="120" r="70" fill="url(#${uid}_halo)" opacity="0.5"/>
      <path d="M0 190 Q200 150 400 190 V200 H0Z" fill="#101222"/>
      <g transform="translate(150 95)" fill="#2a2b3f">
        <path d="M20 30 L10 5 L32 18 L52 18 L74 5 L64 30 Q70 60 42 62 Q14 60 20 30Z"/>
        <g fill="#f0c48d"><circle cx="30" cy="38" r="3"/><circle cx="54" cy="38" r="3"/></g>
        <path d="M39 48 l3 3 3-3" stroke="#f0c48d" stroke-width="1.5" fill="none"/>
      </g>
      <g fill="#f3d9ae"><circle cx="120" cy="40" r="1.5" opacity="0.8"/><circle cx="280" cy="55" r="1.5" opacity="0.8"/></g>`,
    key: `
      ${stars}
      <rect x="0" y="150" width="400" height="50" fill="#12142a"/>
      <circle cx="120" cy="70" r="70" fill="url(#${uid}_halo)" opacity="0.4"/>
      <g transform="translate(120 60) rotate(-30)" fill="none" stroke="url(#${uid}_warm)" stroke-width="7" stroke-linecap="round">
        <circle cx="0" cy="0" r="22"/>
        <path d="M20 0 H75 M62 0 V22 M75 0 V16"/>
      </g>
      <g transform="translate(255 95) rotate(8)" fill="#e8dcc4">
        <rect x="0" y="0" width="70" height="90" rx="4"/>
        <path d="M8 20 H62 M8 34 H62 M8 48 H50" stroke="#b5a688" stroke-width="3"/>
      </g>`,
    clock: `
      ${stars}
      <circle cx="200" cy="100" r="80" fill="url(#${uid}_halo)" opacity="0.45"/>
      <circle cx="200" cy="100" r="56" fill="#e8dcc4" stroke="#b5a688" stroke-width="4"/>
      <g stroke="#5a4838" stroke-width="3" stroke-linecap="round">
        <path d="M200 100 V62"/><path d="M200 100 L230 118"/>
      </g>
      <circle cx="200" cy="100" r="4" fill="#5a4838"/>
      <g stroke="#8a7a60" stroke-width="2">
        <path d="M200 50 v8 M200 142 v8 M150 100 h8 M242 100 h8"/>
      </g>
      <path d="M170 156 h60 l10 44 h-80z" fill="#2a2b3f"/>`,
    wave: `
      ${stars}
      <circle cx="320" cy="55" r="60" fill="url(#${uid}_halo)" opacity="0.6"/>
      <circle cx="320" cy="55" r="22" fill="#f3d9ae"/>
      <path d="M0 120 Q50 100 100 120 T200 120 T300 120 T400 120 V200 H0Z" fill="#28305a"/>
      <path d="M0 145 Q60 125 120 145 T240 145 T360 145 T400 143 V200 H0Z" fill="#1c2244"/>
      <path d="M0 170 Q70 155 140 170 T280 170 T400 168 V200 H0Z" fill="#12162e"/>
      <path d="M60 118 q10 -6 20 0 M180 118 q10 -6 20 0 M250 143 q10 -6 20 0" stroke="#f0c48d" stroke-width="1.5" fill="none" opacity="0.6"/>`,
    star: `
      <g fill="#fff">
        ${(() => { let s=''; const r=seeded(seed+3); for(let i=0;i<40;i++){const x=(r()*400)|0,y=(r()*200)|0,rr=(r()*1.6+0.3).toFixed(1),o=(r()*0.6+0.2).toFixed(2);s+=`<circle cx="${x}" cy="${y}" r="${rr}" opacity="${o}"/>`;} return s; })()}
      </g>
      <path d="M200 40 l6 16 17 1 -13 11 4 17 -14-10 -14 10 4-17 -13-11 17-1z" fill="#f3d9ae" opacity="0.95"/>
      <circle cx="200" cy="64" r="60" fill="url(#${uid}_halo)"/>
      <path d="M0 190 Q100 170 200 188 T400 182 V200 H0Z" fill="#101222"/>`,
    snow: `
      ${stars}
      <circle cx="90" cy="55" r="55" fill="url(#${uid}_halo)" opacity="0.4"/>
      <g fill="#fff" opacity="0.85">
        <circle cx="60" cy="40" r="2"/><circle cx="140" cy="30" r="1.6"/><circle cx="210" cy="60" r="2.2"/>
        <circle cx="280" cy="35" r="1.8"/><circle cx="340" cy="70" r="2"/><circle cx="110" cy="90" r="1.5"/>
        <circle cx="190" cy="110" r="2"/><circle cx="260" cy="100" r="1.6"/><circle cx="320" cy="130" r="2.2"/>
        <circle cx="40" cy="120" r="1.8"/><circle cx="150" cy="150" r="2"/><circle cx="230" cy="160" r="1.5"/>
      </g>
      <path d="M0 165 Q100 145 200 165 T400 158 V200 H0Z" fill="#1a1d38"/>
      <path d="M0 182 Q120 168 240 182 T400 176 V200 H0Z" fill="#0e1024"/>
      <g fill="#e8dcc4" opacity="0.9"><circle cx="70" cy="168" r="1.2"/><circle cx="180" cy="176" r="1.2"/><circle cx="300" cy="170" r="1.2"/></g>`
  };

  const scene = scenes[type] || scenes.moon;
  return `<svg class="cover-art" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="夜读氛围插画">${defs}<rect width="400" height="200" fill="url(#${uid}_bg)"/>${scene}</svg>`;
}

// 确定性伪随机
function seeded(seed) {
  let s = seed * 9301 + 49297;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

if (typeof window !== 'undefined') window.coverArt = coverArt;
