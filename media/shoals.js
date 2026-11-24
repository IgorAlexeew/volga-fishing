'use strict';

const between = (low, high) => low + Math.random()*(high-low);

class Shoal {
  constructor(species, period, slot) {
    this.species = species;
    this.rippleOffset = between(0, 10);
    this.rest();
    if (slot === 0 || Math.random() < species.activity[period] * .65) {
      this.arrive(slot === 0 && Math.random() < .4 + .5*species.activity[period]);
    }
  }

  rest() {
    this.state = 'resting';
    this.remaining = between(5, 18);
    this.members = [];
  }

  chooseFeedingPoint() {
    this.goalX = between(.06, .94);
    this.goalY = this.species.feedingY + between(-.055, .055);
  }

  arrive(alreadyHere = false) {
    this.chooseFeedingPoint();
    this.x = alreadyHere ? this.goalX : (Math.random() < .5 ? -.11 : 1.11);
    this.y = this.goalY;
    this.vx = this.vy = 0;
    this.state = alreadyHere ? 'feeding' : 'arriving';
    this.remaining = between(22, 45);
    if (alreadyHere) this.chooseFeedingPoint();
    const [min, max] = this.species.groupSize;
    this.members = Array.from({ length: Math.floor(between(min, max+1)) }, () => ({
      grams: Math.round(this.species.minGrams + Math.random() ** 1.5 * (this.species.maxGrams - this.species.minGrams)),
      x: this.x + between(-.045, .045), y: this.y + between(-.02, .02),
      vx: 0, vy: 0, rhythm: between(0, 6.28), baitPoint: null
    }));
  }

  step(dt, activity) {
    if (this.state === 'resting') {
      this.remaining -= dt*(.3 + activity);
      if (this.remaining <= 0) this.arrive();
      return;
    }
    if (!this.members.length) { this.rest(); return; }
    if (this.state === 'feeding') {
      this.remaining -= dt / (.45 + activity);
      if (this.remaining <= 0) {
        this.state = 'leaving';
        this.goalX = this.x < .5 ? -.22 : 1.22;
        this.goalY = this.y;
      }
    }
    const dx = this.goalX - this.x, dy = this.goalY - this.y;
    const distance = Math.hypot(dx, dy);
    const speed = this.state === 'feeding' ? .027 : .079;
    const travel = Math.min(speed*dt, distance);
    if (distance > 0 && dt > 0) {
      this.vx = dx/distance * travel/dt;
      this.vy = dy/distance * travel/dt;
      this.x += this.vx*dt;
      this.y += this.vy*dt;
    } else {
      this.vx = this.vy = 0;
    }
    if (this.state !== 'leaving' && distance < .012) {
      this.state = 'feeding';
      this.chooseFeedingPoint();
    }
    this.swimTogether(dt);
    if (this.state === 'leaving' && this.members.every(fish =>
      !fish.baitPoint && (this.goalX < 0 ? fish.x < -.04 : fish.x > 1.04))) this.rest();
  }

  swimTogether(dt) {
    // Follow the group's heading, close gaps and leave space around neighbours.
    const turn = 1-Math.exp(-5*dt);
    for (const fish of this.members) {
      let desiredX = this.vx + (this.x-fish.x)*1.35;
      let desiredY = this.vy + (this.y-fish.y)*1.35;
      for (const other of this.members) {
        if (other === fish || other.baitPoint) continue;
        const dx = fish.x-other.x, dy = (fish.y-other.y)*1.6;
        const separation = Math.hypot(dx, dy);
        if (separation > 0 && separation < .034) {
          const repel = (.034-separation)*2.8/separation;
          desiredX += dx*repel;
          desiredY += dy*repel/1.6;
        }
      }
      if (fish.baitPoint) {
        desiredX = (fish.baitPoint.x-fish.x)*3.5;
        desiredY = (fish.baitPoint.y-fish.y)*3.5;
      }
      fish.vx += (desiredX-fish.vx)*turn;
      fish.vy += (desiredY-fish.vy)*turn;
    }
    for (const fish of this.members) {
      fish.x += fish.vx*dt;
      fish.y += fish.vy*dt;
    }
  }
}

class FishingGround {
  constructor(period) {
    this.period = period;
    this.shoals = speciesList.flatMap(species =>
      Array.from({length:3}, (_,slot) => new Shoal(species, period, slot)));
  }

  step(dt) {
    for (const shoal of this.shoals) shoal.step(dt, shoal.species.activity[this.period]);
  }

  feedingAt(target, baitId) {
    // Weighted reservoir sampling selects a single nearby fish, including the chance of no take.
    let total = .8, encounter;
    for (const shoal of this.shoals) {
      const baitWeight = baits[baitId].weights[shoal.species.id];
      if (shoal.state !== 'feeding' || !baitWeight) continue;
      for (const fish of shoal.members) {
        const range = Math.hypot(target.x-fish.x, 1.5*(target.y-fish.y));
        if (range >= .22) continue;
        const chance = baitWeight * shoal.species.activity[this.period] * (1-range/.22);
        total += chance;
        if (Math.random()*total < chance) encounter = {shoal, fish};
      }
    }
    return encounter;
  }
}
