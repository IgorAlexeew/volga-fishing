'use strict';

function createRiverRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const drawLanding = createLandingRenderer(ctx);
  const assetRoot = new URL('assets/', document.currentScript.src);
  const baitImages = new Map();
  let width = 0;
  let height = 0;
  let lastFrame;
  let castArcPath, castWaterPath, shorePath;
  const observer = new ResizeObserver(() => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const photo = riverPhotoFrame(width,height);
    castArcPath = new Path2D();
    for (let i=0; i<=80; i++) {
      const x=i/80;
      castArcPath.lineTo(photo.left+x*photo.width,photo.top+farCastSurfaceY(x)*photo.height);
    }
    castWaterPath = new Path2D(castArcPath);
    castWaterPath.lineTo(photo.left+photo.width,height);
    castWaterPath.lineTo(photo.left,height);
    castWaterPath.closePath();
    shorePath = new Path2D();
    for (const [y,x] of waterline) shorePath.lineTo(photo.left+x*photo.width,photo.top+y*photo.height);
    shorePath.lineTo(photo.left+photo.width,height);
    shorePath.lineTo(photo.left+photo.width,photo.top+waterline[0][0]*photo.height);
    shorePath.closePath();
    if (lastFrame) paintRiver(...lastFrame);
  });
  observer.observe(canvas);

  function strokeCurve(start, control, end, color, thickness) {
    ctx.beginPath();
    ctx.moveTo(...start);
    ctx.quadraticCurveTo(...control, ...end);
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.stroke();
  }

  const rodImage = new Image();
  rodImage.src = new URL('rod.png', assetRoot).href;
  const floatImage = new Image();
  floatImage.src = new URL('float.png', assetRoot).href;
  const floatWidth = 6.5, floatHeight = 32, floatTop = -24;
  // The attachment eye sits left of the antenna, halfway down the sprite.
  const eyeX = (.22-.52)*floatWidth, eyeY = floatTop + .503*floatHeight;

  function drawFloat(x, y, angle, submerged, night) {
    if (!floatImage.naturalWidth) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    if (night) ctx.filter = 'brightness(1.3)';
    ctx.drawImage(floatImage,-.52*floatWidth,floatTop+submerged,floatWidth,floatHeight);
    ctx.restore();
  }

  function drawRod(butt, control, tip, flexX, flexY, broken) {
    if (!rodImage.naturalWidth) return;
    const segments = 36;
    const sliceHeight = rodImage.naturalHeight/segments;
    const gripWidth = limit(width*.046,10,28);
    let previous = butt;
    // Bend contiguous bands of the same photograph along the blank.
    for (let i=1; i<=(broken ? 21 : segments); i++) {
      const t=i/segments, u=1-t;
      const flex=t**2.7;
      const x=u*u*butt[0]+2*u*t*control[0]+t*t*tip[0]+flexX*flex;
      const y=u*u*butt[1]+2*u*t*control[1]+t*t*tip[1]+flexY*flex;
      const dx=previous[0]-x, dy=previous[1]-y, length=Math.hypot(dx,dy);
      if (length > .01) {
        ctx.save();
        ctx.transform(dy/length,-dx/length,dx/length,dy/length,x,y);
        const bandWidth=gripWidth*(.37+.63*Math.sqrt(u));
        ctx.drawImage(rodImage,0,(segments-i)*sliceHeight,rodImage.naturalWidth,sliceHeight,
          -bandWidth*.64,0,bandWidth,length+.5);
        ctx.restore();
      }
      previous = [x,y];
    }
  }

  function drawShoals(shoals, time, night, photo) {
    for (const shoal of shoals) {
      const age = (time + shoal.rippleOffset) % 13;
      if (shoal.state === 'resting' || age > 3.8) continue;
      const visibility = Math.sin(Math.PI*age/3.8) * (night ? .13 : .24);
      const length = Math.max(2.5, Math.min(6, width*.009));
      for (const [index, fish] of shoal.members.entries()) {
        const surfaceY = waterSurfaceY(fish.y);
        if (!isRiverWater(fish.x,surfaceY) || fish.baitPoint) continue;
        const x = photo.left+fish.x*photo.width, y = photo.top+surfaceY*photo.height;
        const heading = Math.atan2(fish.vy*photo.height, fish.vx*photo.width);
        ctx.beginPath();
        ctx.ellipse(x, y, length, length*.23, heading, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(37,56,52,' + visibility + ')';
        ctx.fill();
        const spread = (age - fish.rhythm*.3)/1.5;
        if (shoal.state !== 'feeding' || index%5 !== 0 || spread <= 0 || spread >= 1) continue;
        ctx.beginPath();
        ctx.ellipse(x - fish.vx*photo.width*spread*1.5, y - fish.vy*photo.height*spread*1.5,
          2+spread*7, 1+spread*2, 0, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(245,243,208,' + .36*Math.sin(Math.PI*spread) + ')';
        ctx.lineWidth = .8;
        ctx.stroke();
      }
    }
  }

  function paintRiver(trip, time, light) {
    if (!width || !height) return;
    const night = light.period === 'night';
    const photo = riverPhotoFrame(width,height);
    const castX = photo.left+trip.target.x*photo.width;
    const castY = photo.top+waterSurfaceY(trip.target.y)*photo.height;
    ctx.clearRect(0, 0, width, height);
    if (trip.canCast && canvas.matches(':hover, :focus-visible')) {
      ctx.save();
      ctx.clip(shorePath);
      ctx.fillStyle = 'rgba(251,235,176,.065)';
      ctx.fill(castWaterPath);
      ctx.strokeStyle = 'rgba(47,47,32,.50)';
      ctx.lineWidth = 2.5;
      ctx.stroke(castArcPath);
      ctx.strokeStyle = 'rgba(252,239,192,.88)';
      ctx.lineWidth = 1;
      ctx.stroke(castArcPath);
      ctx.restore();
    }
    drawShoals(trip.ground.shoals, time, night, photo);
    const live = !trip.canCast;
    const fighting = trip.phase === 'fight';
    const approach = fighting ? limit(1 - trip.distance / trip.startDistance, -.15, 1) : 0;
    const retrieved = Math.max(0, approach);
    const casting = trip.phase === 'casting';
    const castArc = casting ? Math.sin(Math.PI * Math.min(1, trip.elapsed / .62)) : 0;
    const bend = fighting ? Math.sin(time * 6) * .008 : Math.sin(time * 1.3) * .002;
    const landed = trip.phase === 'result' && trip.outcome === 'caught';
    const raise = landed ? Math.min(1, trip.elapsed / .65) : 0;
    const lift = fighting || landed ? trip.lift * (1-raise) : 0;
    const reelTipRise = (landed ? 1-raise : retrieved) * .08;
    const unloadedTip = [width * (.68 - lift * .05 + castArc * .08 - .16*raise),
      height * (.19 - lift * .12 - reelTipRise - castArc * .08 + bend - .178*raise)];
    const flex = fighting ? limit((trip.fishPull-.46)/1.2,0,1)*(.72+.3*trip.rodLoad/100)
      * (1-Math.exp(-trip.elapsed*5)) : 0;
    const flexX = limit((castX-unloadedTip[0])*.45,-width*.16,width*.16)*flex;
    const flexY = height*.42*flex;
    const tipX = unloadedTip[0]+flexX, tipY = unloadedTip[1]+flexY;
    const butt = [photo.left+photo.width*rodGrip.x,photo.top+photo.height*rodGrip.y-height*1.43*raise];
    const tip = [tipX, tipY];
    const control = [width * .72, height * (.12 - lift * .14 - .40*raise)];
    ctx.lineCap = 'round';
    const broken = trip.phase === 'result' && trip.outcome === 'rod';
    drawRod(butt,control,unloadedTip,flexX,flexY,broken);
    if (landed) {
      drawLanding(trip.species, trip.grams, trip.elapsed, width, height, tip, light);
      return;
    }
    if (broken || (trip.phase === 'result' && trip.outcome === 'reel')) return;

    let x = tipX - 2;
    let y = tipY + Math.min(61, height * .18);
    let floatRise = 0;
    if (live) {
      const targetX = castX + approach * (width*.7-castX) + (fighting ? Math.sin(time * 3) * 8 * (1-retrieved) : 0);
      const targetY = castY + approach * (height*.94-castY);
      // Keep the fish and its wake at the surface while the float travels up the line.
      const floatAtTipY = tipY + 14 + height * .05;
      floatRise = retrieved * Math.max(0, height * .94 - floatAtTipY);
      const progress = casting ? limit(trip.elapsed / .62, 0, 1) : 1;
      x += (targetX - x) * progress;
      y += (targetY - y) * progress - height * .34 * castArc;
    }
    const biting = trip.phase === 'bite';
    const bob = live ? Math.sin(time * 2.7) * 1.1 * (1-retrieved) : 0;
    let floatX = x;
    let floatY = y - floatRise + bob;
    const tapCycle = trip.phase === 'nibbling' ? (trip.elapsed % trip.tapInterval) / trip.tapInterval : 1;
    const tap = tapCycle < .5 ? Math.sin(2 * Math.PI * tapCycle) : 0;
    const take = trip.takeProgress;
    let dip = tap * 4;
    let angle = Math.sin(time * 1.4) * .045 + tap * .13;
    if (biting) {
      switch (trip.species.take) {
        case 'lift':
          dip = -6 * take;
          angle += 1.42 * take;
          break;
        case 'glide':
          x += (trip.target.x < .5 ? 1 : -1) * width * .12 * trip.elapsed / 2.1;
          dip = 8 * take;
          angle += .55 * take;
          break;
        case 'sink':
          dip = 31 * take;
          break;
      }
    }
    const hookInAir = !live || casting;
    const lineColor = night ? '#d4ecf7b8' : '#f3f1d9bd';
    if (fighting) {
      // Slide the float along the taut line between the rod tip and the fish.
      const depthOnScreen = y - tipY;
      const alongLine = depthOnScreen > 0 ? limit((floatY-tipY)/depthOnScreen, 0, 1) : 1;
      floatX = tipX + (x-tipX)*alongLine;
      floatY = tipY + depthOnScreen*alongLine;
      angle = Math.atan2(tipX-x, depthOnScreen);
      ctx.beginPath();
      ctx.moveTo(...tip);
      ctx.lineTo(x, y);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1.3;
      ctx.stroke();
    } else {
      floatX = x;
      if (hookInAir) angle = Math.atan2(tipX-floatX, floatY-tipY);
      const lineEnd = Math.min(eyeY + dip, 0);
      const eye = [floatX + Math.cos(angle)*eyeX - Math.sin(angle)*lineEnd, floatY + Math.sin(angle)*eyeX + Math.cos(angle)*lineEnd];
      const sag = hookInAir ? 0 : 15;
      strokeCurve(tip, [(tipX+eye[0])/2, (tipY+eye[1])/2 + sag], eye, lineColor, .85);
    }
    if (live && !casting) {
      for (let i=0; i<2; i++) {
        const wave = (time * (biting || fighting ? 1.2 : .53) + i / 2) % 1;
        ctx.beginPath();
        ctx.ellipse(x, y+1, 4+wave*25, 1.2+wave*6, 0, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(245,248,225,' + (.62*(1-wave)) + ')';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(floatX-40, 0, 80, y+3);
      ctx.clip();
    }
    drawFloat(floatX, floatY, angle, dip, night);
    if (live && !casting) ctx.restore();
    if (hookInAir) {
      const hookY = Math.min(25, height*.14);
      ctx.save();
      ctx.translate(floatX, floatY);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, floatTop+floatHeight-1);
      ctx.lineTo(0, hookY);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, hookY);
      ctx.bezierCurveTo(0, hookY+8, 7, hookY+8, 6, hookY+1);
      ctx.strokeStyle = night ? '#e0d9b9' : '#3d3b2f';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      if (!baitImages.has(trip.baitId)) {
        const image = new Image();
        image.src = new URL('bait-' + trip.baitId + '.png', assetRoot).href;
        baitImages.set(trip.baitId, image);
      }
      const bait = baitImages.get(trip.baitId);
      if (bait.complete && bait.naturalWidth) ctx.drawImage(bait, -3, hookY-2, 11, 11);
      ctx.restore();
    }
  }
  return (trip, time, light) => {
    lastFrame = [trip, time, light];
    paintRiver(trip, time, light);
  };
}
