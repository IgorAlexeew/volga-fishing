'use strict';

const riverHorizonY = .34;

// NOAA fractional-year approximation. The game bank faces south near Saratov.
function riverLight(date, selection = 'auto') {
  const radians = Math.PI / 180;
  const latitude = 51.53 * radians;
  const year = date.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const gamma = 2 * Math.PI * (date.getTime() - yearStart - 43200000) / (Date.UTC(year+1, 0, 1) - yearStart);
  const c = Math.cos, s = Math.sin;
  const declination = .006918-.399912*c(gamma)+.070257*s(gamma)-.006758*c(2*gamma)
    +.000907*s(2*gamma)-.002697*c(3*gamma)+.00148*s(3*gamma);
  const equation = 229.18*(.000075+.001868*c(gamma)-.032077*s(gamma)-.014615*c(2*gamma)-.040849*s(2*gamma));
  const utcMinutes = date.getUTCHours()*60 + date.getUTCMinutes() + date.getUTCSeconds()/60;
  let hourAngle = (((utcMinutes + equation + 4*46.03 + 1440)%1440)/4 - 180)*radians;
  const vertical = s(latitude)*s(declination), horizontal = c(latitude)*c(declination);
  if (selection !== 'auto') {
    const lowSun = Math.acos(limit((s(5*radians)-vertical)/horizontal,-1,1));
    hourAngle = { morning:-lowSun, day:0, evening:lowSun, night:Math.PI }[selection];
  }
  const altitude = Math.asin(limit(vertical+horizontal*c(hourAngle),-1,1))/radians;
  const azimuth = Math.atan2(s(hourAngle),c(hourAngle)*s(latitude)-Math.tan(declination)*c(latitude));
  const twilight = hourAngle < 0 ? 'morning' : 'evening';
  const dayHeight = Math.min(20,.85*Math.asin(vertical+horizontal)/radians);
  const nightBlend = limit((altitude+6)/8,0,1);
  const dayBlend = limit((altitude-6)/(dayHeight-6),0,1);
  const low = altitude < 2 ? 'night' : twilight;
  const high = altitude < 2 ? twilight : 'day';
  const blend = altitude < 2 ? nightBlend : dayBlend;
  return { low, high, blend, period:blend < .5 ? low : high, altitude,
    sunX:.52+azimuth/(Math.PI*1.22), sunY:riverHorizonY-altitude*.014,
    brightness:.34+.70*limit((altitude+6)/(dayHeight+6),0,1) };
}
