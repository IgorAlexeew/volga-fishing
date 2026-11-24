'use strict';

function createLandingRenderer(ctx) {
  const assets = new URL('assets/', document.currentScript.src);
  const textures = new Map();
  const shine = document.createElement('canvas');
  const shineContext = shine.getContext('2d');
  const body = document.createElement('canvas');
  const bodyContext = body.getContext('2d');
  const litFish = document.createElement('canvas');
  const litContext = litFish.getContext('2d');
  const skyTints = {morning:[255,199,156], day:[255,243,215], evening:[255,171,119], night:[130,165,216]};
  let previousLight, previousFish, shineColor, lightX;
  const bent = document.createElement('canvas');
  const bentContext = bent.getContext('2d');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function loadTexture(file) {
    const image = new Image();
    image.src = new URL(file + '.webp', assets).href;
    return image;
  }

  return (species, grams, age, width, height, tip, light) => {
    if (!textures.has(species.id)) {
      textures.set(species.id, [loadTexture(species.id), loadTexture(species.id + '-shine')]);
    }
    const [fish, scaleMask] = textures.get(species.id);
    if (!fish.complete || !fish.naturalWidth) return;
    // Apparent length follows the cube root of mass at this fixed viewing distance.
    const lengthFraction = Math.min(.68, .04 + .043 * Math.cbrt(grams));
    const w = Math.max(1, Math.round(Math.min(width * .78, height * lengthFraction)));
    const h = Math.round(w * fish.naturalHeight / fish.naturalWidth);
    if (body.width !== w || body.height !== h) {
      body.width = shine.width = w;
      body.height = shine.height = h;
      bent.width = w;
      bent.height = h + 2 * Math.ceil(h * .1);
    }
    if (previousLight !== light || previousFish !== fish || litFish.width !== w || litFish.height !== h) {
      litFish.width = w; litFish.height = h;
      const tint = skyTints[light.low].map((value,i) => Math.round(value+(skyTints[light.high][i]-value)*light.blend));
      shineColor = 'rgb('+tint.join(',')+')';
      const exposure = .23+.78*light.brightness;
      litContext.filter = 'brightness('+exposure+') saturate('+(.62+.4*light.brightness)+')';
      litContext.drawImage(fish,0,0,w,h);
      litContext.filter = 'none';
      const moonlight = light.low === 'night' ? 1-light.blend : 0;
      lightX = light.sunX + (.80-light.sunX)*moonlight;
      litContext.globalCompositeOperation = 'source-atop';
      if (moonlight > 0) {
        litContext.fillStyle = 'rgba(51,91,140,'+(.34*moonlight)+')';
        litContext.fillRect(0,0,w,h);
      }
      // Rotating the sprite nose-up puts its lower edge on the angler's left.
      const side = limit((lightX-.52)*2.3,-.85,.85);
      const shade = litContext.createLinearGradient(w*.24,h*(.5-side),w*.85,h*(.5+side));
      shade.addColorStop(0,'rgba('+tint.join(',')+',.29)');
      shade.addColorStop(.55,'rgba('+tint.join(',')+',.07)');
      shade.addColorStop(1,'rgba(28,38,54,.28)');
      litContext.fillStyle = shade;
      litContext.fillRect(0,0,w,h);
      litContext.globalCompositeOperation = 'source-over';
      previousLight = light; previousFish = fish;
    }
    const t = reducedMotion.matches ? 2 : age;
    bodyContext.clearRect(0, 0, w, h);
    bodyContext.drawImage(litFish, 0, 0);
    if (scaleMask.complete && scaleMask.naturalWidth) {
      const sweep = .42 + .22*(lightX-.52) + .37*Math.sin(t*2+.6);
      const gradient = shineContext.createLinearGradient((sweep-.16)*w, h, (sweep+.14)*w, 0);
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(.55, shineColor);
      gradient.addColorStop(1, 'transparent');
      shineContext.clearRect(0, 0, w, h);
      shineContext.drawImage(scaleMask, 0, 0, w, h);
      shineContext.globalCompositeOperation = 'source-in';
      shineContext.fillStyle = gradient;
      shineContext.fillRect(0, 0, w, h);
      shineContext.globalCompositeOperation = 'source-over';
      bodyContext.globalCompositeOperation = 'screen';
      bodyContext.globalAlpha = .70*light.brightness;
      bodyContext.drawImage(shine, 0, 0);
      bodyContext.globalAlpha = 1;
      bodyContext.globalCompositeOperation = 'source-over';
    }
    const raise = Math.min(1, t / .65);
    const noseX = width * (.52 + .075*(1-raise)) + Math.sin(t*2)*1.3;
    const angle = .5 + (Math.PI/2-.5)*raise + Math.sin(t*2.4)*.045;
    const tailBelowMouth = Math.sin(angle)*w*(1-species.mouth[0]) + Math.abs(Math.cos(angle))*h;
    const noseY = Math.min(height*(.26+.40*(1-raise)), height*.98-tailBelowMouth);
    ctx.beginPath();
    ctx.moveTo(...tip);
    ctx.lineTo(noseX, noseY-6);
    ctx.strokeStyle = '#e7e7d5bd';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(noseX, noseY-6);
    ctx.quadraticCurveTo(noseX-1, noseY+5, noseX+3, noseY);
    ctx.strokeStyle = light.period === 'night' ? '#ced2bf' : '#514e3b';
    ctx.stroke();
    ctx.save();
    ctx.translate(noseX, noseY);
    ctx.rotate(angle);
    // Anchor the head. Only the tail and rear flank carry the diminishing flick.
    const amplitude = h * (.018 + .075 * Math.exp(-t * .7));
    const padding = Math.ceil(h*.1);
    bentContext.clearRect(0, 0, bent.width, bent.height);
    for (let x = 0; x < w; x += 2) {
      const u = x / w;
      const offset = amplitude * u*u * Math.sin(t*7 - u*4);
      const slice = Math.min(2, w-x);
      bentContext.drawImage(body, x, 0, slice, h, x, padding + Math.round(offset), slice, h);
    }
    ctx.drawImage(bent, -w*species.mouth[0], -h*species.mouth[1] - padding);
    ctx.restore();
  };
}
