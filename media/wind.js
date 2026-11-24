'use strict';

// Centers of leaf clusters and grass tips in the four aligned shore photographs.
// The displacement tapers to zero outside each ellipse, leaving roots and trunks fixed.
function createBankWind() {
  const clusters = [
    [.15,.04,.21,.15, .010,.007], [.19,.17,.10,.15, .014,.007],
    [.15,.32,.08,.10, .012,.005], [.035,.16,.06,.20, .006,.003],
    [.16,.44,.085,.07, .009,.003], [.265,.515,.086,.06, .008,.004],
    [.026,.68,.075,.17, .017,.006], [.09,.79,.09,.08, .015,.004],
    [.23,.824,.15,.085, .019,.006], [.402,.889,.046,.075, .013,.005]
  ];
  const columns = 16, rows = 26;
  const dx = .48/columns, dy = 1/rows;
  const vertices = Array.from({length:(columns+1)*(rows+1)}, (_,i) => {
    const x = i%(columns+1)*dx, y = Math.floor(i/(columns+1))*dy;
    const weights = clusters.map(([cx,cy,rx,ry],group) => {
      const falloff = 1-((x-cx)/rx)**2-((y-cy)/ry)**2;
      return {group, weight:Math.max(0,falloff)**2};
    }).filter(entry=>entry.weight>0);
    return {x,y,px:x,py:y,weights};
  });
  const cells = [];
  for (let row=0; row<rows; row++) {
    for (let col=0; col<columns; col++) {
      const i=row*(columns+1)+col;
      const corners=[vertices[i],vertices[i+1],vertices[i+columns+1],vertices[i+columns+2]];
      if (corners.some(point=>point.weights.length)) cells.push(corners);
    }
  }
  function drawTriangle(ctx,photo,origin,right,down) {
    const sx=right.x-origin.x, sy=down.y-origin.y;
    const a=(right.px-origin.px)/sx, b=(right.py-origin.py)/sx;
    const c=(down.px-origin.px)/sy, d=(down.py-origin.py)/sy;
    const mx=Math.sign(sx)*.0009, my=Math.sign(sy)*.0013;
    ctx.save();
    ctx.transform(a,b,c,d,origin.px-a*origin.x-c*origin.y,origin.py-b*origin.x-d*origin.y);
    ctx.beginPath();
    ctx.moveTo(origin.x-mx,origin.y-my);
    ctx.lineTo(right.x+2*mx,right.y-my);
    ctx.lineTo(down.x-mx,down.y+2*my);
    ctx.closePath(); ctx.clip();
    const x=Math.max(0,Math.min(origin.x,right.x)-.002), y=Math.max(0,Math.min(origin.y,down.y)-.003);
    const w=Math.min(1-x,dx+.004), h=Math.min(1-y,dy+.006);
    ctx.drawImage(photo,x*photo.width,y*photo.height,w*photo.width,h*photo.height,x,y,w,h);
    ctx.restore();
  }
  return (ctx,photo,time,scene) => {
    const gust = phase => .63*Math.sin(time*1.12-phase)+.26*Math.sin(time*.62-phase*.6)
      +.11*Math.sin(time*2.68-phase*1.7);
    const winds=clusters.map((cluster,i)=>gust(cluster[0]*3.2+cluster[1]*.7+i*.09));
    for (const p of vertices) {
      p.px=p.x; p.py=p.y;
      for (const {group,weight} of p.weights) {
        const offset=winds[group]*weight;
        if (p.x>0) p.px+=clusters[group][4]*offset;
        if (p.y>0 && p.y<1) p.py+=clusters[group][5]*offset;
      }
    }
    for (const [tl,tr,bl,br] of cells) {
      drawTriangle(ctx,photo,tl,tr,bl);
      drawTriangle(ctx,photo,br,bl,tr);
    }
    scene.style.setProperty('--branch-angle',(gust(.55)*3.4).toFixed(2)+'deg');
    scene.style.setProperty('--reed-angle',(-gust(1.1)*6.5).toFixed(2)+'deg');
  };
}
