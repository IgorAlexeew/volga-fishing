'use strict';

function createRiverWeather(canvas) {
  const ctx = canvas.getContext('2d');
  const root = new URL('assets/', document.currentScript.src);
  function image(file) {
    const picture = new Image();
    picture.src = new URL(file, root).href;
    return picture;
  }
  const clouds = image('clouds.png');
  const sunRipples = image('sun-ripples.png');
  const sky = Object.fromEntries(['morning','day','evening','night'].map(period => [period,image(period+'.jpg')]));
  const photo = document.createElement('canvas');
  const blendContext = photo.getContext('2d');
  const air = document.createElement('canvas');
  const haze = air.getContext('2d');
  const drawBankWind = createBankWind();
  const riverSurface = new Path2D();
  riverSurface.moveTo(.28,.40); riverSurface.lineTo(1.05,.40); riverSurface.lineTo(1.05,1.05);
  riverSurface.lineTo(.48,1.05); riverSurface.lineTo(.26,.84); riverSurface.lineTo(.13,.70);
  riverSurface.lineTo(.15,.64); riverSurface.lineTo(.40,.57); riverSurface.lineTo(.32,.49);
  riverSurface.closePath();
  const waterMask = document.createElement('canvas');
  waterMask.width=512; waterMask.height=320;
  const mask=waterMask.getContext('2d');
  mask.scale(waterMask.width,waterMask.height);
  mask.filter='blur(3px)';
  mask.fill(riverSurface);
  const reflection=document.createElement('canvas');
  reflection.width=waterMask.width; reflection.height=waterMask.height;
  const ripple=reflection.getContext('2d');
  ripple.scale(reflection.width,reflection.height);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let previousLight, lastTime = -1;

  return (time, light) => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const base = sky[light.low], overlay = sky[light.high];
    if (!w || !h || !base.naturalWidth || !overlay.naturalWidth) return;
    const staticScene = reduced.matches;
    if (canvas.width === w && canvas.height === h && previousLight === light &&
        (staticScene || time-lastTime < 1/20)) return;
    lastTime = time;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    if (previousLight !== light) {
      if (photo.width !== base.width || photo.height !== base.height) {photo.width=base.width; photo.height=base.height;}
      blendContext.drawImage(base,0,0);
      blendContext.globalAlpha = light.blend;
      blendContext.drawImage(overlay,0,0);
      blendContext.globalAlpha = 1;
      previousLight = light;
    }
    const frame = riverPhotoFrame(w,h);
    const pw = frame.width, ph = frame.height;
    const t = staticScene ? 0 : time;
    ctx.setTransform(pw,0,0,ph,frame.left,frame.top);
    ctx.drawImage(photo,0,0,1,1);
    if (!staticScene) drawBankWind(ctx,photo,t,canvas.parentElement);

    // Feather the sky into the photograph behind the canopy and the wooded horizon.
    const skyPixels = Math.min(720,photo.width);
    const scaledHeight = skyPixels*ph/pw;
    if (air.width !== skyPixels) {air.width = skyPixels; air.height = Math.ceil(scaledHeight*.34);}
    haze.setTransform(skyPixels,0,0,scaledHeight,0,0);
    haze.clearRect(0,0,1,.35);
    if (light.altitude > -2 && light.sunY > -.22) {
      haze.save(); haze.translate(light.sunX,light.sunY); haze.scale(ph/pw,1);
      const glow = haze.createRadialGradient(0,0,.008,0,0,.19);
      glow.addColorStop(0,'#ffe2a2db'); glow.addColorStop(.24,'#ffc47d65'); glow.addColorStop(1,'#ffbb7100');
      haze.fillStyle = glow; haze.fillRect(-.19,-.19,.38,.38);
      haze.beginPath(); haze.arc(0,0,.012,0,2*Math.PI); haze.fillStyle='#fff1cb'; haze.fill(); haze.restore();
    }
    if (clouds.naturalWidth) {
      haze.globalAlpha = light.brightness*.72;
      const drift = (t*.0029 + .17) % .84;
      for (const x of [drift-.84,drift,drift+.84]) haze.drawImage(clouds,x,.055,.69,.17);
      haze.globalAlpha = 1;
    }
    haze.globalCompositeOperation='destination-in';
    const canopy=haze.createLinearGradient(.22,0,.35,0);
    canopy.addColorStop(0,'transparent'); canopy.addColorStop(1,'black');
    haze.fillStyle=canopy; haze.fillRect(0,0,1,.35);
    const horizon=haze.createLinearGradient(0,.266,0,.298);
    horizon.addColorStop(0,'black'); horizon.addColorStop(1,'transparent');
    haze.fillStyle=horizon; haze.fillRect(0,0,1,.35);
    haze.globalCompositeOperation='source-over';
    ctx.drawImage(air,0,0,1,air.height/scaledHeight);

    // Only the surface moves. The left boundary follows the sand spit and the near beach.
    ctx.save(); ctx.clip(riverSurface);
    const strip = Math.max(2,Math.ceil(photo.height/100));
    for (let y=Math.floor(photo.height*.39); y<photo.height; y+=strip) {
      const depth=y/photo.height;
      const dx=(Math.sin(depth*65+t*1.5)+.45*Math.sin(depth*119-t*1.1))*.0025*depth;
      const dy=Math.sin(depth*83-t*1.7)*1.25*depth;
      const rows=Math.min(strip,photo.height-y);
      ctx.drawImage(photo,0,limit(y+dy,0,photo.height-rows),photo.width,rows,dx,depth,1,rows/photo.height);
    }
    ctx.restore();
    const mirrorY = 2*riverHorizonY-light.sunY;
    const glint = limit((light.altitude+.5)/3,0,1)*limit((1.32-mirrorY)/.46,0,1);
    if (glint > 0 && sunRipples.naturalWidth) {
      ripple.clearRect(0,0,1,1);
      // Compress the spacing of distant ripples without tapering the column of light.
      const surfaceY = depth => .375+.72*depth*(.65+.35*depth);
      const spread=.22;
      for (let y=0; y<sunRipples.height; y+=8) {
        const depth=y/sunRipples.height, rows=Math.min(8,sunRipples.height-y);
        const phase=depth*41+t*1.5;
        const dx=Math.sin(phase)*(.0006+.002*depth);
        const top=surfaceY(depth), bottom=surfaceY(depth+rows/sunRipples.height);
        const distanceFromMirror = (top-mirrorY)/.21;
        const mirrorHighlight = Math.exp(-distanceFromMirror*distanceFromMirror);
        ripple.globalAlpha=glint*(.61+.34*mirrorHighlight)*(.87+.12*Math.cos(phase));
        ripple.drawImage(sunRipples,0,y,sunRipples.width,rows,light.sunX-spread/2+dx,top,
          spread,bottom-top);
      }
      ripple.globalAlpha=1;
      ripple.globalCompositeOperation='destination-in';
      ripple.drawImage(waterMask,0,0,1,1);
      ripple.globalCompositeOperation='source-over';
      ctx.drawImage(reflection,0,0,1,1);
    }
  };
}
