/* ========================================================================
   DYNANCA — Local Mathematics Visual Engine
   Dependency-free SVG renderer for mathematics content.

   Supported visual types:
     bar-chart / bar, line-chart / line, scatter
     coordinate-plane / coordinate
     number-line
     geometry (circle, rectangle, triangle, polygon, line, point)

   Venn diagrams remain handled by venn-renderer.js.
   No CDN, remote JS, chart service, or image API is required.
   ======================================================================== */
(function () {
  "use strict";

  function esc(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function num(v, fallback) { var n = Number(v); return Number.isFinite(n) ? n : (fallback == null ? 0 : fallback); }
  function idSafe(v) { return String(v || "visual").replace(/[^A-Za-z0-9_-]/g, ""); }
  function wrap(id, title, body, caption) {
    var tid = "visual-title-" + idSafe(id);
    return '<figure class="practice-media practice-math-visual" aria-labelledby="' + tid + '">' +
      '<svg viewBox="0 0 520 300" role="img" aria-labelledby="' + tid + '">' +
      '<title id="' + tid + '">' + esc(title || "Mathematical diagram") + '</title>' + body + '</svg>' +
      (caption ? '<figcaption>' + esc(caption) + '</figcaption>' : '') + '</figure>';
  }

  function graph(v, id, mode) {
    var raw = Array.isArray(v.data) ? v.data : [];
    var pts = raw.map(function (p) { return Array.isArray(p) ? {x:num(p[0]),y:num(p[1])} : {x:num(p.x),y:num(p.y)}; })
      .filter(function(p){return Number.isFinite(p.x)&&Number.isFinite(p.y);});
    if (pts.length < 1) return "";
    var xs=pts.map(function(p){return p.x;}), ys=pts.map(function(p){return p.y;});
    var xmin=Math.min.apply(Math,xs), xmax=Math.max.apply(Math,xs), ymin=Math.min.apply(Math,ys), ymax=Math.max.apply(Math,ys);
    var px=(xmax-xmin||1)*.12, py=(ymax-ymin||1)*.12; xmin-=px;xmax+=px;ymin-=py;ymax+=py;
    var sx=function(x){return 58+(x-xmin)/(xmax-xmin)*420;}, sy=function(y){return 242-(y-ymin)/(ymax-ymin)*190;};
    var body='';
    for(var i=0;i<=8;i++){var x=58+i*52.5;body+='<line x1="'+x+'" y1="52" x2="'+x+'" y2="242" class="math-grid"></line>';
      var xv=xmin+i*(xmax-xmin)/8; body+='<text x="'+x+'" y="260" text-anchor="middle" class="math-tick">'+esc(Number(xv.toFixed(2)))+'</text>';
    }
    for(var j=0;j<=6;j++){var y=52+j*31.6667;body+='<line x1="58" y1="'+y+'" x2="478" y2="'+y+'" class="math-grid"></line>';
      var yv=ymax-j*(ymax-ymin)/6; body+='<text x="48" y="'+(y+4)+'" text-anchor="end" class="math-tick">'+esc(Number(yv.toFixed(2)))+'</text>';
    }
    var axX=(ymin<=0&&ymax>=0)?sy(0):242, axY=(xmin<=0&&xmax>=0)?sx(0):58;
    body+='<line x1="58" y1="'+axX+'" x2="478" y2="'+axX+'" class="math-axis"></line><line x1="'+axY+'" y1="52" x2="'+axY+'" y2="242" class="math-axis"></line>';
    if(mode!=='scatter') body+='<polyline points="'+pts.map(function(p){return sx(p.x).toFixed(2)+","+sy(p.y).toFixed(2);}).join(" ")+'" class="math-line" fill="none"></polyline>';
    body+=pts.map(function(p){return '<circle cx="'+sx(p.x).toFixed(2)+'" cy="'+sy(p.y).toFixed(2)+'" r="4" class="math-point"></circle>';}).join('');
    return wrap(id,v.title||"Coordinate graph",body,v.caption);
  }

  function bars(v,id) {
    var raw=Array.isArray(v.data)?v.data:[]; if(!raw.length)return "";
    var vals=raw.map(function(p,i){return {label:Array.isArray(p)?p[0]:(p.label!=null?p.label:i+1),value:num(Array.isArray(p)?p[1]:p.value)};});
    var max=Math.max(0,Math.max.apply(Math,vals.map(function(p){return p.value;}))), min=Math.min(0,Math.min.apply(Math,vals.map(function(p){return p.value;})));
    var range=max-min||1, sy=function(value){return 242-(value-min)/range*175;}, zero=sy(0);
    var w=390/vals.length, labelY=min<0?278:258, body='<line x1="65" y1="'+zero+'" x2="475" y2="'+zero+'" class="math-axis"></line>';
    vals.forEach(function(p,i){var end=sy(p.value), h=Math.abs(end-zero), x=70+i*w+7, y=Math.min(zero,end);body+='<rect x="'+x+'" y="'+y+'" width="'+Math.max(8,w-14)+'" height="'+h+'" rx="3" class="math-bar"></rect>'+
      '<text x="'+(x+(w-14)/2)+'" y="'+labelY+'" text-anchor="middle" class="math-tick">'+esc(p.label)+'</text>'+
      '<text x="'+(x+(w-14)/2)+'" y="'+(p.value>=0?end-6:end+14)+'" text-anchor="middle" class="math-value">'+esc(p.value)+'</text>';});
    return wrap(id,v.title||"Bar chart",body,v.caption);
  }

  function numberLine(v,id) {
    var min=num(v.min,0), max=num(v.max,10); if(max<=min)max=min+10; var y=160, x0=55,x1=485, body='<line x1="'+x0+'" y1="'+y+'" x2="'+x1+'" y2="'+y+'" class="math-axis"></line>';
    var ticks=Number.isInteger(v.ticks)?v.ticks:10; ticks=Math.max(2,Math.min(20,ticks));
    for(var i=0;i<=ticks;i++){var x=x0+(x1-x0)*i/ticks,val=min+(max-min)*i/ticks;body+='<line x1="'+x+'" y1="'+(y-9)+'" x2="'+x+'" y2="'+(y+9)+'" class="math-axis"></line><text x="'+x+'" y="190" text-anchor="middle" class="math-tick">'+esc(Number(val.toFixed(2)))+'</text>';}
    (v.points||[]).forEach(function(p){var val=typeof p==='object'?num(p.value):num(p);var x=x0+(val-min)/(max-min)*(x1-x0);body+='<circle cx="'+x+'" cy="'+y+'" r="7" class="math-point"></circle>';});
    return wrap(id,v.title||"Number line",body,v.caption);
  }

  function coordinate(v,id) {
    var body='', xmin=num(v.xMin,-5), xmax=num(v.xMax,5), ymin=num(v.yMin,-5), ymax=num(v.yMax,5);
    if(xmax<=xmin)xmax=xmin+10;if(ymax<=ymin)ymax=ymin+10;
    var sx=function(x){return 58+(x-xmin)/(xmax-xmin)*420;},sy=function(y){return 242-(y-ymin)/(ymax-ymin)*190;};
    // Integer grid, thinned so a wide range can never emit thousands of lines.
    var stepX=Math.max(1,Math.ceil((xmax-xmin)/20)), stepY=Math.max(1,Math.ceil((ymax-ymin)/20));
    for(var x=Math.ceil(xmin/stepX)*stepX;x<=Math.floor(xmax);x+=stepX){var xx=sx(x);body+='<line x1="'+xx+'" y1="52" x2="'+xx+'" y2="242" class="math-grid"></line><text x="'+xx+'" y="260" text-anchor="middle" class="math-tick">'+x+'</text>';}
    for(var y=Math.ceil(ymin/stepY)*stepY;y<=Math.floor(ymax);y+=stepY){var yy=sy(y);body+='<line x1="58" y1="'+yy+'" x2="478" y2="'+yy+'" class="math-grid"></line><text x="48" y="'+(yy+4)+'" text-anchor="end" class="math-tick">'+y+'</text>';}
    if(ymin<=0&&ymax>=0)body+='<line x1="58" y1="'+sy(0)+'" x2="478" y2="'+sy(0)+'" class="math-axis"></line>';
    if(xmin<=0&&xmax>=0)body+='<line x1="'+sx(0)+'" y1="52" x2="'+sx(0)+'" y2="242" class="math-axis"></line>';
    (v.points||[]).forEach(function(p){body+='<circle cx="'+sx(num(p.x))+'" cy="'+sy(num(p.y))+'" r="5" class="math-point"></circle>';});
    (v.segments||v.lines||[]).forEach(function(l){if(l&&l.a&&l.b)body+='<line x1="'+sx(num(l.a.x))+'" y1="'+sy(num(l.a.y))+'" x2="'+sx(num(l.b.x))+'" y2="'+sy(num(l.b.y))+'" class="math-line"></line>';});
    return wrap(id,v.title||"Coordinate plane",body,v.caption);
  }

  function geometry(v,id) {
    var body=''; (v.shapes||[]).forEach(function(s){if(!s||!s.type)return;var t=s.type.toLowerCase();
      if(t==='circle')body+='<circle cx="'+num(s.cx,260)+'" cy="'+num(s.cy,150)+'" r="'+Math.max(0,num(s.r,50))+'" class="math-shape"></circle>';
      else if(t==='rectangle')body+='<rect x="'+num(s.x,100)+'" y="'+num(s.y,80)+'" width="'+Math.max(0,num(s.width,120))+'" height="'+Math.max(0,num(s.height,80))+'" class="math-shape"></rect>';
      else if(t==='line')body+='<line x1="'+num(s.x1,80)+'" y1="'+num(s.y1,80)+'" x2="'+num(s.x2,440)+'" y2="'+num(s.y2,220)+'" class="math-line"></line>';
      else if(t==='polygon'||t==='triangle')body+='<polygon points="'+(Array.isArray(s.points)?s.points:[]).map(function(p){return Array.isArray(p)?num(p[0])+','+num(p[1]):num(p&&p.x)+','+num(p&&p.y);}).join(' ')+'" class="math-shape"></polygon>';
    }); return wrap(id,v.title||"Geometry diagram",body,v.caption);
  }

  function render(v,id){
    if(!v||typeof v!=='object')return '';
    var t=String(v.type||'').toLowerCase();
    if(t==='bar'||t==='bar-chart'||t==='barchart')return bars(v,id);
    if(t==='line'||t==='line-chart'||t==='scatter'||t==='scatter-plot')return graph(v,id,t==='scatter'||t==='scatter-plot'?'scatter':'line');
    if(t==='coordinate'||t==='coordinate-plane')return coordinate(v,id);
    if(t==='number-line'||t==='numberline')return numberLine(v,id);
    if(t==='geometry')return geometry(v,id);
    return '';
  }
  window.DynancaMathVisuals={render:render};
})();
