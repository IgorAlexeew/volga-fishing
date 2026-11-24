'use strict';

const limit = (value, low, high) => Math.min(high, Math.max(low, value));

// Coordinates on the full 768 x 512 river plates, before the sidebar crops them.
function riverPhotoFrame(width, height) {
  const photoWidth = Math.max(width, height * 1.5), photoHeight = photoWidth / 1.5;
  return {width:photoWidth, height:photoHeight, left:(width-photoWidth)/2, top:height-photoHeight};
}

// The grip is just beyond the lower-right edge of the uncropped photograph.
// Ground distances are in metres. A horizontal plane projects depth as 1 / Z.
const rodGrip = {x:1.04, y:1.08};
const maxCastMetres = 8;
const horizontalFocalLength = .65;
const depthScale = 2.2 * 1.5 * horizontalFocalLength;
function waterPlanePoint(x,y) {
  const z = depthScale/(y-riverHorizonY);
  return {x:(x-.5)*z/horizontalFocalLength, z};
}
const castOrigin = waterPlanePoint(rodGrip.x,rodGrip.y);

// Trace only the sand and the spit. Each pair is photo Y and the water's left edge.
const waterline = [
  [.40,.22],[.48,.20],[.52,.25],[.55,.31],[.567,.38],[.580,.27],
  [.595,.17],[.610,.105],[.635,.077],[.670,.092],[.71,.15],
  [.765,.232],[.82,.322],[.90,.45],[1,.59]
];

function isRiverWater(x,y) {
  if (x<0 || x>1 || y<waterline[0][0] || y>1) return false;
  for (let i=1; i<waterline.length; i++) {
    const [bottom,nearX]=waterline[i];
    if (y>bottom) continue;
    const [top,farX]=waterline[i-1];
    return x >= farX+(nearX-farX)*(y-top)/(bottom-top);
  }
  return false;
}

function castDistance(x,y) {
  const point = waterPlanePoint(x,y);
  return Math.hypot(point.x-castOrigin.x,point.z-castOrigin.z);
}

// Intersect a viewing ray with the same circle used for casting and reeling.
function farCastSurfaceY(photoX) {
  const slope=(photoX-.5)/horizontalFocalLength;
  const a=1+slope*slope, b=slope*castOrigin.x+castOrigin.z;
  const c=castOrigin.x**2+castOrigin.z**2-maxCastMetres**2;
  const farZ=(b+Math.sqrt(b*b-a*c))/a;
  return riverHorizonY+depthScale/farZ;
}

const shoalDepthOffset = .105;
const waterSurfaceY = depth => depth+shoalDepthOffset;

class FishingTrip {
  ground = new FishingGround(riverLight(new Date()).period);
  phase = 'ready';
  baitId = 'worm';
  reelLoad = 0;
  rodLoad = 0;
  lift = 0;
  distance = 0;
  elapsed = 0;
  target = { x: .55, y: .64 };

  get canCast() { return this.phase === 'ready' || this.phase === 'result'; }
  get surge() { return (1 + Math.sin(this.elapsed * 1.7 + this.surgeOffset)) / 2; }
  get fishPull() {
    return this.species.pull * (.67 + .60*Math.sqrt(this.grams/largestFishGrams) + .30*this.surge);
  }
  // A bite becomes readable as the float travels into a sustained dip, glide or lift.
  get takeProgress() { return this.phase === 'bite' ? limit(this.elapsed / .8, 0, 1) : 0; }

  cast(x, surfaceY, baitId) {
    if (!this.canCast || !isRiverWater(x,surfaceY)) return false;
    const distance = castDistance(x,surfaceY);
    if (distance > maxCastMetres) return false;
    this.catchId = crypto.randomUUID();
    this.target = { x, y:surfaceY-shoalDepthOffset };
    this.startDistance = distance;
    this.distance = this.startDistance;
    this.baitId = baitId;
    this.species = undefined;
    this.waitTime = 2.5 + Math.random() * 4;
    this.taps = 2 + Math.floor(Math.random() * 3);
    this.tapInterval = .55 + Math.random() * .4;
    this.falseApproach = Math.random() < .25;
    this.surgeOffset = Math.random() * 6;
    this.reelLoad = this.rodLoad = this.lift = this.elapsed = 0;
    this.outcome = '';
    this.phase = 'casting';
    return true;
  }

  hook() {
    if (['waiting', 'nibbling'].includes(this.phase) || (this.phase === 'bite' && this.takeProgress < .3)) this.finish('early');
    else if (this.phase === 'bite') {
      const {shoal, fish} = this.encounter;
      shoal.members.splice(shoal.members.indexOf(fish), 1);
      this.releaseBait();
      this.phase = 'fight';
      this.rodLoad = 13;
      this.elapsed = 0;
    }
  }

  releaseBait() {
    if (this.encounter) this.encounter.fish.baitPoint = null;
    this.encounter = undefined;
  }

  finish(outcome) {
    this.releaseBait();
    this.outcome = outcome;
    this.phase = 'result';
    this.elapsed = 0;
  }

  step(dt, reel, rod) {
    this.ground.step(dt);
    this.elapsed += dt;
    switch (this.phase) {
      case 'casting':
        if (this.elapsed >= .62) { this.phase = 'waiting'; this.elapsed = 0; }
        break;
      case 'waiting':
        if (this.encounter) {
          const {shoal, fish} = this.encounter;
          if (Math.hypot(fish.x-this.target.x, fish.y-this.target.y) < .009) {
            this.species = shoal.species;
            this.grams = fish.grams;
            this.elapsed = 0;
            this.phase = 'nibbling';
          }
        } else if (this.elapsed >= this.waitTime) {
          this.elapsed = 0;
          this.waitTime = 1.8 + Math.random()*2.5;
          this.encounter = this.ground.feedingAt(this.target, this.baitId);
          if (this.encounter) this.encounter.fish.baitPoint = this.target;
        }
        break;
      case 'nibbling':
        if (this.elapsed >= this.taps * this.tapInterval) {
          this.phase = this.falseApproach ? 'waiting' : 'bite';
          if (this.falseApproach) this.releaseBait();
          this.falseApproach = false;
          this.elapsed = 0;
        }
        break;
      case 'bite':
        if (this.elapsed >= 2.1) this.finish('missed');
        break;
      case 'fight': {
        const force = this.fishPull;
        this.reelLoad = limit(this.reelLoad + dt * (reel ? 23 * force * (rod ? .8 : 1) : -38), 0, 100);
        this.rodLoad = limit(this.rodLoad + dt * (rod ? 21 * force : -35), 0, 100);
        const previousLift = this.lift;
        this.lift = limit(this.lift + dt * (rod ? .8 : -.65), 0, 1);
        const drift = reel ? -2.7 / force : .55 + this.surge * .65;
        this.distance += dt * drift - Math.max(0, this.lift - previousLift) * 1.75;
        if (this.reelLoad >= 100) this.finish('reel');
        else if (this.rodLoad >= 100) this.finish('rod');
        else if (this.distance <= 0) { this.distance = 0; this.finish('caught'); }
        else if (this.distance > this.startDistance + 5) this.finish('escaped');
        break;
      }
    }
  }
}
