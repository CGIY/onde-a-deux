/* Dés·ir — shared monoline vocabulary, authored for the badge collection. */
(function (scope) {
  'use strict';
  const number = value => String(Math.round(Number(value) * 1000) / 1000);
  const attributes = values => Object.entries(values).filter(([,value]) => value !== undefined)
    .map(([key,value]) => ' ' + key + '="' + value + '"').join('');
  function drawing(paper, ink) {
    const D = {
      paper, ink,
      path: (d, options = {}) => '<path' + attributes({d, fill:options.fill,
        'stroke-width':options.w, opacity:options.opacity}) + '/>',
      line: (x1,y1,x2,y2) => '<path d="M' + [x1,y1].join(' ') + 'L' + [x2,y2].join(' ') + '"/>',
      rect: (x,y,width,height,rx=2,fill='none') => '<rect' + attributes({x,y,width,height,rx,fill}) + '/>',
      circle: (cx,cy,r,fill='none') => '<circle' + attributes({cx,cy,r,fill}) + '/>',
      ellipse: (cx,cy,rx,ry,fill='none') => '<ellipse' + attributes({cx,cy,rx,ry,fill}) + '/>',
      group: (body,transform) => '<g transform="' + transform + '">' + body + '</g>'
    };
    D.head = (x,y,s=1,options={}) => {
      const left=options.facing==='left',long=options.hair==='long';
      const silhouette=long
        ? 'M-13 22 C-16 14-19 4-17-8 C-16-18-8-23 1-22 C10-22 14-16 13-9 L13-4 L17 2 L13 4 L14 7 Q13 10 9 11 Q8 16 3 16 L3 24'
        : 'M-11 20 L-9 12 C-15 9-18 2-17-7 C-17-16-10-22 0-21 C9-21 14-15 13-8 L13-4 L17 2 L13 4 L14 7 Q13 10 9 11 Q8 16 3 16 L3 24';
      let body=D.path(silhouette,{fill:paper});
      if(long){
        body+=D.path('M-2-22 C-4-11-11-9-11 0 Q-11 7-4 9 Q-4 14-11 15 M4-21 C2-10-5-6-5 0 Q-5 5 0 6 M-10-19 C-12-10-18-5-16 6 Q-15 14-9 19');
      }else{
        body+=D.path('M-17-5 C-19-13-14-21-4-22 Q7-23 15-16 Q17-14 12-12 Q4-10-4-13 Q-13-11-16-2',{fill:paper});
        body+=D.path('M-13-11 Q-5-20 9-15 M-14 1 Q-14-6-9-6 Q-4-6-5 0 M-8 2 Q-9 6-5 7');
      }
      body+=D.path('M5-1 Q8 1 10-1');
      return '<g transform="translate('+number(x)+' '+number(y)+') rotate('+number(options.tilt||0)+') scale('+number(left?-s:s)+' '+number(s)+')" stroke-width="'+number(2.4/s)+'">'+body+'</g>';
    };
    D.bust = (x,y,s=1,options={}) => {
      const direction=options.facing==='left'?-1:1;
      const shoulders=D.path('M-11 19 C-19 22-27 32-29 49 L28 49 C26 33 16 25 3 23',{fill:paper})+
        D.path('M-11 20 L-2 32 L5 24');
      return '<g transform="translate('+number(x)+' '+number(y)+') rotate('+number(options.tilt||0)+') scale('+number(direction*s)+' '+number(s)+')" stroke-width="'+number(2.4/s)+'">'+shoulders+'</g>'+D.head(x,y,s,options);
    };
    D.die = (x,y,size=16,face=1,angle=0) => {
      const pips={1:[[0,0]],2:[[-4,-4],[4,4]],3:[[-4,-4],[0,0],[4,4]],
        4:[[-4,-4],[4,-4],[-4,4],[4,4]],5:[[-4,-4],[4,-4],[0,0],[-4,4],[4,4]],
        6:[[-4,-5],[4,-5],[-4,0],[4,0],[-4,5],[4,5]]};
      const s=size/18;
      return '<g transform="translate('+number(x)+' '+number(y)+') rotate('+number(angle)+') scale('+number(s)+')" stroke-width="'+number(2/s)+'">'+
        D.rect(-9,-9,18,18,3,paper)+(pips[face]||pips[1]).map(([a,b])=>D.circle(a,b,.8,ink)).join('')+'</g>';
    };
    D.camera = (x,y,s=1) => '<g transform="translate('+number(x)+' '+number(y)+') scale('+number(s)+')" stroke-width="'+number(2.2/s)+'">'+
      D.path('M-15-8 L-7-8 L-4-12 L5-12 L8-8 L15-8 Q17-8 17-6 L17 10 Q17 12 15 12 L-15 12 Q-17 12-17 10 L-17-6 Q-17-8-15-8Z',{fill:paper})+
      D.circle(1,1,6)+D.path('M-12-3 L-8-3')+'</g>';
    D.plant = (x,y,s=1) => '<g transform="translate('+number(x)+' '+number(y)+') scale('+number(s)+')" stroke-width="'+number(2.2/s)+'">'+
      D.path('M0-10 L0-31 M0-18 Q-13-18-12-28 Q-2-28 0-18 M0-24 Q1-35 8-34 Q12-26 0-24 M0-13 Q10-27 15-22 Q13-12 0-13',{fill:paper})+
      D.path('M-10-11 L10-11 L7 0 L-7 0Z',{fill:paper})+'</g>';
    return Object.freeze(D);
  }
  scope.OndeBadgeDrawing=Object.freeze({create:drawing});
  if(typeof module!=='undefined'&&module.exports)module.exports=scope.OndeBadgeDrawing;
})(typeof globalThis!=='undefined'?globalThis:this);
