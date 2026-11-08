/* Original Dés·ir enamel insignia. All artwork is local vector geometry. */
(function(scope){
  'use strict';
  const definition=(id,shape,metal,enamel,motif,mark,ornament,pattern)=>Object.freeze({id,shape,metal,enamel,motif,mark:mark||'',ornament:ornament||'studs',pattern:pattern||'facets'});
  // Each entry is an authored composition. Family milestones change their
  // silhouette and illustration as well as their material and engraved number.
  const catalogue=Object.freeze([
    definition('ind-draws-1','coin','champagne','jade','first-die','1','studs','rays'),
    definition('ind-draws-5','hex','silver','cobalt','paired-dice','5','notches','facets'),
    definition('ind-draws-15','diamond','copper','teal','spinning-die','15','rays','waves'),
    definition('ind-draws-30','scallop','gold','cobalt','lucky-wheel','30','studs','rays'),
    definition('ind-draws-75','starburst','gold','plum','crowned-dice','75','laurel','night'),
    definition('ind-proposals-1','shield','champagne','coral','idea-bulb','1','studs','rays'),
    definition('ind-proposals-5','hex','copper','jade','idea-box','5','notches','grid'),
    definition('ind-proposals-15','ticket','silver','cobalt','idea-mailbox','15','studs','facets'),
    definition('ind-proposals-30','cog','gold','teal','idea-engine','30','notches','rays'),
    definition('ind-proposals-75','oval','gold','coral','idea-rocket','75','laurel','night'),
    definition('ind-participations-1','coin','champagne','teal','rendezvous','1','studs','waves'),
    definition('ind-participations-5','pentagon','gold','cobalt','five-stars','5','notches','night'),
    definition('ind-participations-15','shield','copper','jade','pennants','15','rays','facets'),
    definition('ind-participations-30','arch','gold','plum','pillar','30','laurel','grid'),
    definition('ind-completed-sent-5','diamond','champagne','cobalt','paper-flight','5','studs','waves'),
    definition('ind-completed-sent-15','shield','gold','jade','idea-route','15','laurel','grid'),
    definition('ind-completed-received-5','scallop','copper','coral','raised-glove','5','notches','rays'),
    definition('ind-completed-received-15','ticket','champagne','teal','starting-flags','15','studs','facets'),
    definition('ind-complicite-3','clover','copper','coral','puzzle-pair','3','studs','facets'),
    definition('ind-complicite-10','winged','gold','cobalt','flying-kites','10','laurel','waves'),
    definition('ind-attention-3','shield','champagne','rose','treasure-pocket','3','notches','grid'),
    definition('ind-attention-10','coin','copper','coral','kindness-tea','10','laurel','waves'),
    definition('ind-projets-3','hex','champagne','cobalt','crossed-tools','3','studs','grid'),
    definition('ind-projets-10','ticket','gold','jade','house-plan','10','notches','grid'),
    definition('ind-intimite-3','arch','copper','plum','private-key','3','studs','night'),
    definition('ind-intimite-10','shield','gold','indigo','private-doors','10','laurel','night'),
    definition('ind-active-days-3','coin','silver','jade','calendar-stack','3','notches','grid'),
    definition('ind-active-days-10','flower','champagne','coral','habit-flower','10','studs','rays'),
    definition('ind-active-streak-3','diamond','copper','coral','triple-flame','3','rays','facets'),
    definition('ind-distinct-variants-6','hex','silver','indigo','six-prism','6','notches','rays'),
    definition('duo-completed-1','coin','champagne','jade','twin-jewels','1','studs','rays'),
    definition('duo-completed-5','cog','copper','cobalt','duo-gears','5','notches','grid'),
    definition('duo-completed-10','shield','champagne','coral','memory-factory','10','studs','waves'),
    definition('duo-completed-25','flower','gold','jade','reason-bouquet','25','notches','rays'),
    definition('duo-completed-50','hex','silver','indigo','fifty-jubilee','50','laurel','night'),
    definition('duo-completed-100','starburst','gold','jade','hundred-monument','100','studs','rays'),
    definition('duo-completed-250','arch','champagne','plum','moment-cabinet','250','notches','grid'),
    definition('duo-completed-500','crown','gold','cobalt','grand-trophy','500','laurel','night'),
    definition('duo-distinct-categories-2','ticket','silver','teal','two-landscapes','2','studs','facets'),
    definition('duo-distinct-categories-4','clover','gold','indigo','four-winds','4','notches','rays'),
    definition('duo-distinct-cards-6','hex','copper','coral','card-fan','6','studs','facets'),
    definition('duo-distinct-cards-12','shield','champagne','cobalt','card-bridge','12','notches','waves'),
    definition('duo-distinct-cards-24','starburst','gold','jade','card-world','24','laurel','grid'),
    definition('duo-distinct-variants-12','coin','silver','plum','kaleidoscope','12','notches','rays'),
    definition('duo-distinct-variants-36','ticket','champagne','jade','travel-case','36','studs','grid'),
    definition('duo-distinct-variants-72','flower','gold','indigo','artist-palette','72','laurel','facets'),
    definition('duo-completion-days-3','ticket','copper','coral','three-dates','3','studs','grid'),
    definition('duo-completion-days-10','coin','gold','cobalt','sun-calendar','10','notches','rays'),
    definition('duo-completion-days-30','shield','champagne','jade','month-calendar','30','laurel','grid'),
    definition('duo-completion-streak-3','hex','copper','cobalt','triple-chevron','3','notches','facets'),
    definition('duo-completion-streak-7','ticket','gold','coral','tandem','7','studs','waves'),
    definition('duo-weekend-completed-5','oval','champagne','jade','weekend-hammock','5','studs','night'),
    definition('duo-weekend-completed-20','scallop','copper','coral','sunday-brunch','20','laurel','rays'),
    definition('duo-every-category-5','cog','gold','cobalt','four-wheel','5','notches','grid'),
    definition('duo-thigh-massage-3','oval','champagne','jade','anatomical-thigh','3','studs','waves'),
    definition('duo-covered-face-3','scallop','silver','plum','porcelain-canopy','3','notches','rays'),
    definition('duo-kind-note-3','ticket','champagne','coral','folded-note','3','studs','grid'),
    definition('duo-crepes-3','coin','copper','amber','crepe-pan','3','notches','rays'),
    definition('duo-forest-walk-3','arch','gold','jade','forest-path','3','studs','night'),
    definition('duo-phone-drawer-3','shield','silver','cobalt','quiet-drawer','3','notches','grid'),
    definition('duo-kiss-language-3','clover','champagne','coral','conversation','3','studs','waves'),
    definition('duo-kiss-neck-3','teardrop','gold','plum','genie-lamp','3','notches','night'),
    definition('duo-oral-car-3','hex','silver','cobalt','carpool','3','studs','facets'),
    definition('duo-oral-shower-3','arch','copper','teal','shower-clock','3','notches','waves'),
    definition('duo-oral-desk-3','ticket','champagne','cobalt','desk-files','3','studs','grid'),
    definition('duo-sit-face-3','shield','gold','plum','velvet-chair','3','notches','facets'),
    definition('duo-veranda-3','arch','champagne','jade','glasshouse','3','studs','grid'),
    definition('duo-andromaque-reverse-3','octagon','copper','coral','turnaround','3','notches','waves'),
    definition('duo-spoon-3','oval','silver','indigo','silver-spoons','3','studs','rays'),
    definition('duo-free-position-3','diamond','gold','jade','creative-direction','3','notches','facets'),
    definition('duo-lovense-quarter-3','coin','silver','cobalt','vibration-timer','3','studs','waves'),
    definition('duo-lovense-evening-3','ticket','champagne','plum','night-battery','3','notches','night'),
    definition('duo-photo-monochrome-3','hex','silver','slate','monochrome-camera','3','studs','facets'),
    definition('duo-photo-shadows-3','diamond','copper','plum','shadow-frame','3','notches','grid'),
    definition('duo-photo-shower-3','coin','silver','teal','fog-lens','3','studs','waves'),
    definition('duo-hc-golden-3','scallop','gold','indigo','golden-rain','3','notches','waves'),
    definition('duo-hc-chapel-3','arch','champagne','plum','rose-window','3','studs','facets'),
    definition('duo-hc-manual-camera-3','hex','copper','jade','manual-camera','3','notches','grid'),
    definition('duo-hc-video-finale-3','shield','gold','cobalt','finale-screen','3','laurel','night'),
    definition('duo-hc-upper-frame-3','ticket','silver','coral','upper-signal','3','studs','rays'),
    definition('duo-hc-lower-frame-3','arch','champagne','plum','empty-meeting','3','notches','grid'),
    definition('duo-hc-rear-camera-3','octagon','copper','teal','reverse-camera','3','studs','facets'),
    definition('duo-hc-artists-entry-3','arch','gold','coral','stage-door','3','notches','night'),
    definition('duo-hc-double-booking-3','hex','champagne','jade','double-ticket','3','studs','grid'),
    definition('duo-hc-hour-contract-3','shield','copper','cobalt','hour-contract','3','notches','facets'),
    definition('duo-hc-applause-3','flower','gold','coral','applause-rosette','3','studs','rays'),
    definition('duo-hc-private-cinema-3','ticket','gold','plum','private-cinema','3','laurel','night'),
    definition('duo-hc-studio-3','diamond','silver','indigo','studio-light','3','notches','grid'),
    definition('duo-hc-glide-3','teardrop','champagne','teal','gliding-stone','3','studs','waves'),
    definition('duo-hc-remake-3','crown','gold','cobalt','remake-projector','3','laurel','night')
  ]);
  const records=new Map(catalogue.map(item=>[item.id,item]));
  const ids=Object.freeze(catalogue.map(item=>item.id));
  const instances=new Set(['recent','collection','notice','detail','asset']);
  const metals=Object.freeze({
    champagne:{dark:'#624426',mid:'#b18c58',light:'#ecd4a1',shine:'#fff4d6',edge:'#493020'},
    gold:{dark:'#74430e',mid:'#c5912c',light:'#f6d67e',shine:'#fff3bd',edge:'#4f2d13'},
    copper:{dark:'#723b2c',mid:'#c67f58',light:'#efbd98',shine:'#ffe0bf',edge:'#4e2a25'},
    silver:{dark:'#3c4c5b',mid:'#93a6af',light:'#dce9eb',shine:'#fffaf0',edge:'#28323d'},
    locked:{dark:'#30383c',mid:'#606b6d',light:'#a2abaa',shine:'#d1d5cc',edge:'#202a2f'}
  });
  const enamels=Object.freeze({
    jade:{deep:'#073e33',mid:'#137b61',light:'#4acaa3',glint:'#b0f2c4',accent:'#ddc76d'},
    cobalt:{deep:'#082951',mid:'#165caa',light:'#5aa5f3',glint:'#b4e0ff',accent:'#5ce0cb'},
    coral:{deep:'#702d34',mid:'#cf4f58',light:'#fa8c73',glint:'#ffd6ac',accent:'#f3c665'},
    plum:{deep:'#321f48',mid:'#733d84',light:'#b877b0',glint:'#eac1df',accent:'#cfabec'},
    teal:{deep:'#073e47',mid:'#147d8d',light:'#59c5cb',glint:'#b9efe4',accent:'#a8d985'},
    indigo:{deep:'#151e4c',mid:'#3d4892',light:'#7e89d8',glint:'#d2d4ff',accent:'#de9ecb'},
    rose:{deep:'#60233d',mid:'#ae4676',light:'#e885a8',glint:'#ffd0d6',accent:'#f2b770'},
    amber:{deep:'#573519',mid:'#b4732d',light:'#eeb65d',glint:'#ffe4a7',accent:'#f28b67'},
    slate:{deep:'#1b2a35',mid:'#526570',light:'#97a9ae',glint:'#e4efeb',accent:'#f0e6c7'},
    locked:{deep:'#182629',mid:'#34484a',light:'#5c7271',glint:'#9baea5',accent:'#8e9b91'}
  });
  const fixed=value=>String(Math.round(value*100)/100);
  function points(n,outer,inner=outer,cx=80,cy=80,phase=-90){
    const count=inner===outer?n:n*2;
    return Array.from({length:count},(_,i)=>{const angle=(phase+i*360/count)*Math.PI/180,r=i%2?inner:outer;return fixed(cx+Math.cos(angle)*r)+' '+fixed(cy+Math.sin(angle)*r);}).join('L');
  }
  function lobes(n,r){let d='';for(let i=0;i<=n;i++){const a=(-90+i*360/n)*Math.PI/180,x=80+Math.cos(a)*r,y=80+Math.sin(a)*r;if(!i)d='M'+fixed(x)+' '+fixed(y);else{const mid=(-90+(i-.5)*360/n)*Math.PI/180;d+='Q'+fixed(80+Math.cos(mid)*(r+12))+' '+fixed(80+Math.sin(mid)*(r+12))+' '+fixed(x)+' '+fixed(y);}}return d+'Z';}
  function cog(){let d='';for(let i=0;i<40;i++){const a=(-94.5+i*9)*Math.PI/180,r=i%4===0||i%4===3?60:68;d+=(i?'L':'M')+fixed(80+Math.cos(a)*r)+' '+fixed(80+Math.sin(a)*r);}return d+'Z';}
  const outlines=Object.freeze({
    coin:'M144 80A64 64 0 1 1 16 80A64 64 0 1 1 144 80Z',
    oval:'M80 10C113 10 138 42 138 80C138 118 113 150 80 150C47 150 22 118 22 80C22 42 47 10 80 10Z',
    shield:'M80 11L137 30L132 95Q119 132 80 151Q41 132 28 95L23 30Z',
    hex:'M48 16H112L145 80L112 144H48L15 80Z',
    diamond:'M80 10L150 80L80 150L10 80Z',
    scallop:lobes(12,62),flower:lobes(8,60),clover:lobes(4,61),
    starburst:'M'+points(12,69,59)+'Z',pentagon:'M'+points(5,68)+'Z',
    ticket:'M40 19H120Q132 19 132 31V51Q116 60 132 70V102Q116 113 132 124V131Q132 143 120 143H40Q28 143 28 131V124Q44 113 28 102V70Q44 60 28 51V31Q28 19 40 19Z',
    arch:'M22 144V68A58 58 0 0 1 138 68V144Z',
    octagon:'M48 13H112L147 48V112L112 147H48L13 112V48Z',cog:cog(),
    winged:'M80 13L104 34L143 27L137 57L149 72L127 104L116 127L80 150L44 127L33 104L11 72L23 57L17 27L56 34Z',
    crown:'M25 58L17 25L55 43L80 10L105 43L143 25L135 58V99Q127 131 80 151Q33 131 25 99Z',
    teardrop:'M80 10C95 35 141 62 141 96C141 128 115 151 80 151C45 151 19 128 19 96C19 62 65 35 80 10Z'
  });
  const path=(d,fill,stroke,width=1.4,extra='')=>'<path d="'+d+'" fill="'+(fill||'none')+'"'+(stroke?' stroke="'+stroke+'" stroke-width="'+width+'" stroke-linejoin="round" stroke-linecap="round"':'')+(extra?' '+extra:'')+'/>';
  const line=(d,color,width=2.5,extra='')=>path(d,'none',color,width,extra);
  const rect=(x,y,w,h,r,fill,stroke,width=1.2)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+r+'" fill="'+fill+'"'+(stroke?' stroke="'+stroke+'" stroke-width="'+width+'"':'')+'/>';
  const circle=(x,y,r,fill,stroke,width=1.2)=>'<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+fill+'"'+(stroke?' stroke="'+stroke+'" stroke-width="'+width+'"':'')+'/>';
  const ellipse=(x,y,rx,ry,fill,extra='')=>'<ellipse cx="'+x+'" cy="'+y+'" rx="'+rx+'" ry="'+ry+'" fill="'+fill+'"'+(extra?' '+extra:'')+'/>';
  const group=(body,transform,extra='')=>'<g'+(transform?' transform="'+transform+'"':'')+(extra?' '+extra:'')+'>'+body+'</g>';
  const star=(x,y,r,fill)=>path('M'+points(5,r,r*.46,x,y)+'Z',fill);
  const sparkle=(x,y,r,fill)=>path('M'+x+' '+(y-r)+'Q'+(x+r*.18)+' '+(y-r*.18)+' '+(x+r)+' '+y+'Q'+(x+r*.18)+' '+(y+r*.18)+' '+x+' '+(y+r)+'Q'+(x-r*.18)+' '+(y+r*.18)+' '+(x-r)+' '+y+'Q'+(x-r*.18)+' '+(y-r*.18)+' '+x+' '+(y-r)+'Z',fill);
  const relief=(d,c,fill=c.M)=>path(d,c.m.edge,undefined,0,'transform="translate(0 2.5)" opacity=".7"')+path(d,fill,c.m.edge,1.3)+path(d,'none',c.m.shine,.55,'opacity=".5"');
  const leaf=(x,y,angle,c,fill=c.M)=>group(relief('M0 0Q-11-12 0-24Q11-12 0 0Z',c,fill)+line('M0-3V-18',c.m.shine,.75),'translate('+x+' '+y+') rotate('+angle+')');
  function jewel(x,y,r,c,fill=c.A){return path('M'+x+' '+(y-r)+'L'+(x+r)+' '+y+'L'+x+' '+(y+r)+'L'+(x-r)+' '+y+'Z',fill,c.m.edge,1.2)+path('M'+x+' '+(y-r)+'V'+(y+r)+'L'+(x-r)+' '+y+'Z',c.m.shine,undefined,0,'opacity=".32"')+line('M'+(x-r)+' '+y+'L'+x+' '+(y-r)+'L'+(x+r)+' '+y,c.m.shine,1.1);}
  const digitPaths=Object.freeze({0:'M3 0H7Q10 0 10 4V14Q10 18 7 18H3Q0 18 0 14V4Q0 0 3 0Z',1:'M1 4L5 0V18M1 18H9',2:'M0 3Q1 0 5 0Q10 0 10 4Q10 7 7 10L0 18H10',3:'M0 1Q10-3 10 5Q10 9 5 9Q10 9 10 14Q10 21 0 17',4:'M8 18V0L0 12H11',5:'M10 0H1V8H6Q11 8 10 14Q9 20 0 17',6:'M9 1Q0-2 0 9V14Q0 18 5 18Q10 18 10 13Q10 8 5 8H0',7:'M0 0H11L3 18',8:'M5 9Q0 9 0 4Q0 0 5 0Q10 0 10 4Q10 9 5 9Q0 9 0 14Q0 18 5 18Q10 18 10 14Q10 9 5 9Z',9:'M1 17Q10 20 10 9V4Q10 0 5 0Q0 0 0 5Q0 10 5 10H10'});
  function numerals(value,x,y,height,color,width=2){const text=String(value),scale=height/18,w=text.length*15-5;return group([...text].map((ch,i)=>group(line(digitPaths[ch],color,width),'translate('+(i*15)+' 0)')).join(''),'translate('+fixed(x-w*scale/2)+' '+y+') scale('+fixed(scale)+')');}
  function die(x,y,size,face,c,angle=0){const pip=face===1?[[.5,.5]]:face===2?[[.28,.28],[.72,.72]]:face===3?[[.25,.25],[.5,.5],[.75,.75]]:face===4?[[.27,.27],[.73,.27],[.27,.73],[.73,.73]]:face===5?[[.27,.27],[.73,.27],[.5,.5],[.27,.73],[.73,.73]]:[[.27,.23],[.73,.23],[.27,.5],[.73,.5],[.27,.77],[.73,.77]];
    return group(rect(-size/2,-size/2+3,size,size,size*.16,c.m.edge)+rect(-size/2,-size/2,size,size,size*.16,c.M,c.m.edge,1.3)+rect(-size*.39,-size*.39,size*.78,size*.78,size*.1,c.m.shine,c.m.mid,.8)+pip.map(([a,b])=>circle((a-.5)*size,(b-.5)*size,size*.065,c.e.deep)).join('')+line('M'+(-size*.31)+' '+(-size*.44)+'H'+(size*.3),c.m.shine,1),'translate('+x+' '+y+') rotate('+angle+')');}
  function gear(x,y,r,c,fill=c.M){let d='';for(let i=0;i<32;i++){const a=i*Math.PI/16,R=i%4===1||i%4===2?r:r*.79;d+=(i?'L':'M')+fixed(x+Math.cos(a)*R)+' '+fixed(y+Math.sin(a)*R);}return relief(d+'Z',c,fill)+circle(x,y,r*.42,c.E,c.m.edge,1.5)+circle(x,y,r*.2,c.M,c.m.shine,.7);}
  function camera(x,y,s,c,mono=false){return group(relief('M-32-15H-17L-12-23H9L15-15H32V23H-32Z',c)+rect(-27,-10,54,27,3,mono?c.e.deep:c.A,c.m.edge)+circle(0,3,15,c.M,c.m.edge,1.5)+circle(0,3,11,c.E,c.m.shine,1)+circle(0,3,5.8,mono?c.m.light:c.A)+path('M-7-2Q-2-9 4-5L-1 3Z',c.m.shine,undefined,0,'opacity=".74"')+rect(18,-8,6,4,1,c.m.shine)+line('M-24-16H-19',c.m.shine,2.6),'translate('+x+' '+y+') scale('+s+')');}
  function screen(x,y,w,h,c){return relief('M'+(x-w/2)+' '+y+'H'+(x+w/2)+'V'+(y+h)+'H'+(x-w/2)+'Z',c)+rect(x-w/2+4,y+4,w-8,h-8,2,c.E,c.m.dark,.8)+path('M'+(x-4)+' '+(y+h)+'V'+(y+h+10)+'H'+(x-15)+'V'+(y+h+13)+'H'+(x+15)+'V'+(y+h+10)+'H'+(x+4)+'V'+(y+h)+'Z',c.M,c.m.edge)+circle(x,y+2,1,c.e.deep);}
  function calendar(x,y,s,c,mark,tiles=false){return group(relief('M-25-26H25V28H-25Z',c)+rect(-21,-14,42,37,2,c.m.shine)+rect(-21,-22,42,11,1,c.A)+line('M-12-31V-20M12-31V-20',c.m.shine,4)+line('M-12-31V-20M12-31V-20',c.m.dark,1)+(mark?numerals(mark,0,-5,20,c.e.deep,2.4):[[-12,-3],[0,-3],[12,-3],[-12,9],[0,9],[12,9]].map(([a,b],i)=>rect(a-3,b-3,6,6,1,tiles&&i%2?c.A:c.m.mid)).join('')),'translate('+x+' '+y+') scale('+s+')');}
  function bulb(x,y,s,c){return group(relief('M-14 7C-33-12-17-32 0-32C17-32 33-12 14 7L10 17H-10Z',c)+path('M-13-16Q-8-25 2-25', 'none',c.m.shine,3.2)+line('M-7 10L-4-3L0 1L4-3L7 10',c.e.deep,2)+rect(-11,14,22,8,2,c.A,c.m.edge)+line('M-8 26H8',c.m.shine,3),'translate('+x+' '+y+') scale('+s+')');}
  function plane(x,y,s,c,angle=0){return group(relief('M-29-5L31-26L12 27L-1 7L-17 15L-14-1Z',c)+path('M31-26L-1 7L12 27Z',c.A,c.m.edge,1)+line('M-14-1L31-26',c.m.shine,1.5),'translate('+x+' '+y+') rotate('+angle+') scale('+s+')');}
  function smallCard(x,y,s,c,angle=0,face=1){return group(rect(-16,-23+2,32,46,4,c.m.edge)+rect(-16,-23,32,46,4,c.M,c.m.edge)+rect(-12,-18,24,36,2,c.E)+jewel(0,0,7,c)+numerals(face,-6,-15,5,c.m.shine,2),'translate('+x+' '+y+') rotate('+angle+') scale('+s+')');}
  function clock(x,y,r,c,minutes=0){return circle(x,y+2,r,c.m.edge)+circle(x,y,r,c.M,c.m.edge,1.5)+circle(x,y,r-5,c.E,c.m.shine,.8)+[0,90,180,270].map(a=>{const q=a*Math.PI/180;return line('M'+fixed(x+Math.cos(q)*(r-8))+' '+fixed(y+Math.sin(q)*(r-8))+'L'+fixed(x+Math.cos(q)*(r-11))+' '+fixed(y+Math.sin(q)*(r-11)),c.m.shine,1.4);}).join('')+line('M'+x+' '+(y-r*.47)+'V'+y+'L'+(x+r*.34)+' '+(y+minutes),c.m.shine,2.3)+circle(x,y,2.4,c.A);}
  function wave(x,y,c){return line('M'+(x-8)+' '+(y+7)+'Q'+(x-14)+' '+y+' '+(x-8)+' '+(y-7)+'M'+(x+8)+' '+(y+7)+'Q'+(x+14)+' '+y+' '+(x+8)+' '+(y-7),c.m.shine,2.4);}
  function motif(d,c){
    switch(d.motif){
      case 'first-die':return die(80,79,53,1,c,-9)+sparkle(113,46,7,c.m.shine)+line('M47 104L42 110M43 97L36 99',c.e.glint,2);
      case 'paired-dice':return die(64,71,43,2,c,-18)+die(96,91,43,5,c,13)+sparkle(111,47,5,c.m.shine);
      case 'spinning-die':return line('M41 96Q19 64 62 44M115 60Q141 90 102 113',c.m.mid,5)+line('M38 88Q28 63 59 49',c.m.shine,1.4)+die(80,79,47,3,c,19)+sparkle(42,52,6,c.m.shine);
      case 'lucky-wheel':return circle(80,79,37,c.M,c.m.edge)+circle(80,79,31,c.E,c.m.shine,.9)+Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return jewel(80+Math.cos(a)*32,79+Math.sin(a)*32,3,c);}).join('')+die(80,79,38,6,c,8);
      case 'crowned-dice':return die(66,89,39,4,c,-12)+die(98,86,39,5,c,13)+relief('M57 57L51 39L69 48L80 30L91 48L110 39L104 57Z',c)+jewel(80,47,5,c)+sparkle(45,75,4,c.m.shine);
      case 'idea-bulb':return bulb(80,80,.98,c)+[-42,0,42].map(a=>group(line('M0-42V-49',c.m.shine,2.7),'translate(80 68) rotate('+a+')')).join('');
      case 'idea-box':return relief('M45 78L80 66L115 78V108L80 121L45 108Z',c)+path('M80 89L115 78V108L80 121Z',c.A,c.m.edge)+line('M45 78L80 89V121',c.m.shine,1.6)+path('M45 78L33 65L65 55L80 67L95 55L126 65L115 78L80 67Z',c.M,c.m.edge)+bulb(80,58,.55,c)+sparkle(111,44,5,c.m.shine);
      case 'idea-mailbox':return relief('M48 76Q48 49 75 49H94Q114 49 114 70V101H48Z',c)+path('M75 49Q94 49 94 72V101H48V76Q48 49 75 49Z',c.A,c.m.edge)+rect(58,75,26,18,2,c.m.shine,c.m.edge)+line('M58 75L71 85L84 75',c.m.mid,1.8)+line('M99 49V30H117V41H100M76 102V119',c.M,5)+sparkle(40,50,4,c.m.shine);
      case 'idea-engine':return gear(80,82,37,c)+bulb(80,78,.8,c)+sparkle(119,51,5,c.m.shine);
      case 'idea-rocket':return relief('M80 32Q109 48 102 86L89 99H71L58 86Q51 48 80 32Z',c)+path('M80 32Q62 61 70 91H58Q51 48 80 32Z',c.A)+circle(80,63,10,c.E,c.m.dark,2)+circle(78,60,3,c.m.shine)+path('M58 80L43 105L68 96M102 80L117 105L92 96',c.M,c.m.edge)+path('M71 102Q80 124 89 102L80 113Z',c.A)+sparkle(41,53,5,c.m.shine);
      case 'rendezvous':return relief('M47 63L67 52L87 63L87 96L67 108L47 96Z',c)+relief('M74 63L94 52L114 63V96L94 108L74 96Z',c,c.A)+line('M62 80L73 90L99 66',c.m.shine,4)+sparkle(80,40,6,c.m.shine);
      case 'five-stars':return [[80,42,10],[48,65,9],[112,65,9],[59,103,9],[101,103,9]].map(([x,y,r])=>star(x,y,r,c.M)).join('')+circle(80,77,18,c.A,c.m.shine,1.2)+line('M69 77L77 85L93 68',c.m.shine,4);
      case 'pennants':return line('M57 114L70 45M103 114L90 45',c.M,5)+relief('M68 45L106 55L83 74L63 67Z',c)+relief('M92 45L54 55L77 74L97 67Z',c,c.A)+star(80,91,14,c.M)+line('M56 116H104',c.m.shine,2);
      case 'pillar':return relief('M48 53H112V64H48ZM56 64H104V106H56ZM47 106H113V116H47Z',c)+line('M66 69V101M80 69V101M94 69V101',c.m.dark,4)+line('M63 69V101M77 69V101M91 69V101',c.m.shine,1.4)+star(80,38,12,c.A);
      case 'paper-flight':return line('M44 108Q67 116 81 99Q88 87 59 92Q33 95 49 77',c.e.glint,2.2,'stroke-dasharray="4 5"')+plane(82,70,.93,c,-5)+sparkle(115,44,4,c.m.shine);
      case 'idea-route':return path('M42 50L66 43L94 50L119 43V106L94 113L66 105L42 113Z',c.M,c.m.edge)+path('M66 43L94 50V113L66 105Z',c.A)+line('M52 98Q48 76 74 79T109 58',c.e.deep,2.2,'stroke-dasharray="3 4"')+plane(94,59,.55,c,-8)+circle(52,99,4,c.e.deep);
      case 'raised-glove':return relief('M53 92L47 76Q43 61 54 57V49Q54 41 63 43Q64 35 73 39Q80 32 87 40Q98 36 100 48L108 67Q114 86 98 100L96 113H61V100Z',c)+path('M53 92L62 78Q64 69 58 65L51 62M64 43V62M76 40V59M88 43V63', 'none',c.m.dark,2.3)+rect(59,101,40,14,3,c.A,c.m.edge)+star(80,82,10,c.A);
      case 'starting-flags':return line('M49 119L68 42M111 119L92 42',c.M,4)+path('M67 44L111 55L103 84L60 73Z',c.M,c.m.edge)+path('M93 44L49 55L57 84L100 73Z',c.A,c.m.edge)+path('M53 57L63 54L65 65L55 68ZM65 65L75 62L78 72L68 75ZM87 54L97 57L94 67L84 64ZM94 67L104 70L101 80L91 77Z',c.m.shine)+sparkle(80,102,8,c.m.shine);
      case 'puzzle-pair':return relief('M45 54H73V68Q82 61 88 69Q93 80 79 83V100H45V82Q60 85 59 74Q58 64 45 69Z',c)+relief('M115 107H87V93Q78 100 72 92Q67 81 81 78V61H115V79Q100 76 101 87Q102 97 115 92Z',c,c.A);
      case 'flying-kites':return line('M65 87Q82 107 61 119M99 77Q77 105 101 120',c.m.light,1.8)+relief('M63 39L83 60L63 89L43 60Z',c)+path('M63 39V89L83 60Z',c.A)+relief('M99 45L115 62L99 79L83 62Z',c)+path('M99 45V79L115 62Z',c.A)+path('M65 100L57 95L59 105ZM95 100L103 95L102 106Z',c.M);
      case 'treasure-pocket':return relief('M47 66H113V101Q80 130 47 101Z',c)+path('M52 72H108V99Q80 119 52 99Z',c.A,c.m.dark)+line('M54 78H106M58 98L80 111L102 98',c.m.shine,1.1,'stroke-dasharray="2 3"')+jewel(77,54,18,c)+star(105,48,9,c.M)+circle(57,52,5,c.M);
      case 'kindness-tea':return ellipse(79,108,39,8,c.M)+relief('M48 68H104V91Q99 109 76 109Q53 109 48 91Z',c)+line('M105 72H112Q127 73 120 87Q116 95 103 95',c.M,6)+path('M54 75H98V90Q94 102 77 102Q59 102 54 90Z',c.A)+line('M68 59Q57 50 69 41M85 59Q96 49 84 38',c.m.shine,2)+sparkle(108,48,5,c.m.shine);
      case 'crossed-tools':return group(relief('M-8-42H8V42H-8Z',c)+[-28,-14,0,14,28].map(y=>line('M-8 '+y+'H0',c.m.dark,1.5)).join(''),'translate(80 78) rotate(-35)')+group(relief('M-6-36H6V27L0 40L-6 27Z',c,c.A)+path('M-6 27H6L0 40Z',c.m.shine)+line('M0-29V25',c.m.shine,1.2),'translate(81 80) rotate(35)');
      case 'house-plan':return rect(42,42,76,77,4,c.M,c.m.edge)+rect(47,47,66,67,2,c.E)+line('M53 53V108M65 53V108M77 53V108M89 53V108M101 53V108M52 61H108M52 75H108M52 89H108M52 103H108',c.e.glint,.7,'opacity=".4"')+relief('M54 79L80 55L106 79H99V105H84V87H73V105H61V79Z',c)+line('M50 117H110M43 53V111',c.m.shine,1.6);
      case 'private-key':return circle(75,66,22,c.M,c.m.edge,1.5)+circle(75,66,12,c.E,c.m.shine,1)+relief('M69 84H81V112H92V104H100V119H69Z',c)+sparkle(109,49,7,c.m.shine)+circle(75,66,4,c.A);
      case 'private-doors':return relief('M46 115V62Q46 38 80 38Q114 38 114 62V115Z',c)+path('M52 112V63Q52 45 77 44V112ZM83 44Q108 45 108 63V112H83Z',c.A,c.m.dark)+line('M58 63H71M58 72H71M89 63H102M89 72H102',c.m.light,1.2)+circle(72,88,3,c.m.shine)+circle(88,88,3,c.m.shine)+path('M84 24A11 11 0 1 0 95 36A10 10 0 0 1 84 24Z',c.m.shine);
      case 'calendar-stack':return group(calendar(70,76,.82,c,'',true),'rotate(-13 70 76)')+group(calendar(88,85,.82,c,'3'),'rotate(8 88 85)');
      case 'habit-flower':return line('M80 111V73',c.M,4)+leaf(80,104,-54,c,c.A)+leaf(81,94,52,c,c.A)+Array.from({length:8},(_,i)=>group(ellipse(0,-18,8,16,c.M),'translate(80 65) rotate('+(i*45)+')')).join('')+circle(80,65,13,c.A,c.m.edge,1.5)+circle(77,61,4,c.m.shine)+path('M59 110H101L94 121H66Z',c.M);
      case 'triple-flame':return [-26,0,26].map((dx,i)=>group(relief('M0-32Q4-14 13-5Q26 13 8 24Q-12 34-18 13Q-22 0-8-12Q-13 4 0 7Q8-5 0-32Z',c,i===1?c.M:c.A),'translate('+(80+dx)+' '+(i===1?79:88)+') scale('+(i===1?.94:.67)+')')).join('');
      case 'six-prism':return path('M80 39L117 62V104L80 125L43 104V62Z',c.M,c.m.edge)+path('M80 39L80 83L43 62Z',c.m.shine)+path('M80 39L117 62L80 83Z',c.A)+path('M117 62V104L80 83Z',c.e.glint)+path('M117 104L80 125V83Z',c.m.mid)+path('M80 125L43 104L80 83Z',c.e.light)+path('M43 104V62L80 83Z',c.m.light)+line('M80 39V125M43 62L117 104M117 62L43 104',c.m.edge,1);
      default:return specificMotif(d,c);
    }
  }

  function specificMotif(d,c){
    switch(d.motif){
      case 'twin-jewels':return jewel(64,76,27,c,c.M)+jewel(96,76,27,c,c.A)+sparkle(80,77,12,c.m.shine)+line('M56 110Q80 121 104 110',c.m.light,2.4);
      case 'duo-gears':return gear(62,77,27,c)+gear(101,88,24,c,c.A)+sparkle(105,45,6,c.m.shine)+line('M51 109L59 115L69 105',c.m.shine,2.4);
      case 'memory-factory':return relief('M43 113V76L65 62V76L87 62V76L106 64L111 113Z',c)+path('M51 81H102V106H51Z',c.A,c.m.dark)+rect(95,43,10,32,1,c.M,c.m.edge)+[55,73,91].map(x=>rect(x,86,10,12,1,c.m.shine,c.m.dark,.8)).join('')+star(99,31,8,c.M)+sparkle(113,41,4,c.m.shine)+sparkle(83,44,4,c.e.glint);
      case 'reason-bouquet':return line('M59 68L80 110L103 63M80 110V55M80 110L52 86M80 110L110 86',c.M,3)+leaf(77,100,-65,c,c.A)+leaf(83,95,60,c,c.A)+[[56,61,11],[80,48,12],[105,60,11],[49,80,9],[111,81,9]].map(([x,y,r])=>{let s='';for(let i=0;i<5;i++)s+=group(ellipse(0,-r*.6,r*.5,r*.7,c.M),'translate('+x+' '+y+') rotate('+(i*72)+')');return s+circle(x,y,r*.4,c.A,c.m.edge,.8);}).join('')+path('M80 109L63 100L60 115L78 113L69 123L78 119L81 111L91 122L99 119L83 112L101 115L98 100Z',c.A,c.m.edge,1.2);
      case 'fifty-jubilee':return relief('M80 40L110 57V98L80 119L50 98V57Z',c)+path('M80 47L103 61V94L80 111L57 94V61Z',c.E,c.m.shine,.8)+numerals('50',80,62,30,c.m.shine,2.5)+star(80,49,5,c.A)+line('M65 101H95',c.m.light,1.4);
      case 'hundred-monument':return relief('M46 112H114V119H46ZM53 100H107V112H53ZM62 73H98V100H62ZM71 59H89V73H71Z',c)+path('M80 59H89V100H80Z',c.A)+jewel(80,43,18,c)+numerals('100',80,83,10,c.e.deep,2)+line('M43 105L33 100M117 105L127 100',c.m.shine,2);
      case 'moment-cabinet':return relief('M43 118V55Q43 37 80 37Q117 37 117 55V118Z',c)+path('M49 111V57Q49 44 80 44Q111 44 111 57V111Z',c.E,c.m.dark)+line('M80 46V112M49 79H111',c.M,4)+jewel(64,62,11,c)+star(96,62,11,c.M)+die(64,96,21,3,c,8)+smallCard(96,96,.45,c,-7,1)+line('M46 119V124M114 119V124',c.m.mid,4);
      case 'grand-trophy':return relief('M57 43H103L99 73Q95 91 84 92V104H99V115H61V104H76V92Q65 91 61 73Z',c)+line('M58 52H45V64Q45 83 66 85M102 52H115V64Q115 83 94 85',c.M,7)+path('M63 49H97L94 70Q92 82 80 86Q68 82 66 70Z',c.A)+star(80,64,12,c.m.shine)+rect(67,107,26,4,1,c.e.deep)+sparkle(80,29,6,c.m.shine);
      case 'two-landscapes':return group(relief('M43 49H79V108H43Z',c)+rect(47,53,28,51,1,c.E)+circle(57,65,6,c.m.shine)+path('M47 101L58 80L65 90L75 76V104H47Z',c.A)+line('M47 74H72',c.e.glint,1),'rotate(-7 61 79)')+group(relief('M81 49H117V108H81Z',c)+rect(85,53,28,51,1,c.E)+path('M103 60A9 9 0 1 0 111 70A8 8 0 0 1 103 60Z',c.m.shine)+path('M85 103L95 84L103 92L113 78V104Z',c.M)+sparkle(92,67,2.5,c.e.glint),'rotate(7 99 79)');
      case 'four-winds':return circle(80,80,36,c.M,c.m.edge)+circle(80,80,29,c.E,c.m.shine,.7)+path('M80 37L89 71L123 80L89 89L80 123L71 89L37 80L71 71Z',c.M,c.m.edge,1.2)+path('M80 37V80L89 71ZM123 80H80L89 89ZM80 123V80L71 89ZM37 80H80L71 71Z',c.A)+jewel(80,80,11,c)+[[-26,-26],[26,-26],[-26,26],[26,26]].map(([x,y])=>circle(80+x,80+y,3,c.m.shine,c.m.dark,.7)).join('');
      case 'card-fan':return [-34,-21,-7,7,21,34].map((angle,i)=>smallCard(80+Math.sin(angle*Math.PI/180)*44,86-Math.cos(angle*Math.PI/180)*11,.92,c,angle,i+1)).join('')+path('M62 113Q80 123 98 113L95 120Q80 128 65 120Z',c.M,c.m.edge);
      case 'card-bridge':return smallCard(51,86,.79,c,-18,1)+smallCard(61,80,.79,c,-10,2)+smallCard(109,86,.79,c,18,4)+smallCard(99,80,.79,c,10,3)+relief('M48 102Q80 71 112 102V112Q80 89 48 112Z',c)+Array.from({length:6},(_,i)=>jewel(60+i*8,99-Math.sin((i+.5)*Math.PI/6)*9,2.5,c)).join('')+sparkle(80,44,6,c.m.shine);
      case 'card-world':return circle(80,78,28,c.M,c.m.edge)+circle(80,78,24,c.E)+ellipse(80,78,11,24,'none','stroke="'+c.m.light+'" stroke-width="1.3"')+line('M57 70H103M57 86H103M80 54V102',c.m.light,1.2)+smallCard(42,72,.63,c,-19,1)+smallCard(118,87,.63,c,19,6)+smallCard(81,42,.5,c,0,3)+line('M48 107Q79 125 116 106',c.M,3)+path('M111 100L122 104L115 114Z',c.M);
      case 'kaleidoscope':return Array.from({length:12},(_,i)=>{const a=(-90+i*30)*Math.PI/180,b=a+Math.PI/6;return path('M80 80L'+fixed(80+Math.cos(a)*35)+' '+fixed(80+Math.sin(a)*35)+'L'+fixed(80+Math.cos(b)*35)+' '+fixed(80+Math.sin(b)*35)+'Z',[c.M,c.A,c.e.glint,c.E][i%4],c.m.edge,.7);}).join('')+path('M'+points(6,22,10,80,80)+'Z',c.M,c.m.edge,1)+jewel(80,80,9,c)+circle(80,80,39,'none',c.m.light,1.5);
      case 'travel-case':return relief('M48 58H112V109H48Z',c)+line('M67 57V47H93V57',c.M,5)+rect(52,63,56,41,4,c.A,c.m.dark)+rect(60,59,6,49,1,c.M,c.m.edge,.6)+rect(94,59,6,49,1,c.M,c.m.edge,.6)+rect(72,76,16,14,2,c.m.shine,c.m.dark)+star(80,83,5,c.e.deep)+line('M47 114H113',c.m.shine,1.4)+sparkle(115,45,5,c.m.shine);
      case 'artist-palette':return relief('M78 43C54 40 38 58 40 80C42 104 65 117 87 111C100 108 97 95 88 93C80 91 80 82 89 79C108 72 118 84 122 73C128 56 104 41 78 43Z',c)+circle(58,65,7,c.A,c.m.dark)+circle(77,56,6,c.E,c.m.dark)+circle(97,58,6,c.e.glint,c.m.dark)+circle(58,87,6,c.E,c.m.dark)+circle(77,101,5,c.A,c.m.dark)+circle(91,91,7,c.e.deep)+group(relief('M-3-38H3V21L0 29L-3 21Z',c,c.A)+path('M-4 21Q-9 31 0 39Q9 31 4 21Z',c.M,c.m.edge),'translate(100 84) rotate(36)');
      case 'three-dates':return line('M49 53Q80 36 111 53',c.M,2)+calendar(51,78,.6,c,'1')+calendar(80,84,.65,c,'2')+calendar(109,78,.6,c,'3')+sparkle(80,43,4,c.m.shine);
      case 'sun-calendar':return Array.from({length:10},(_,i)=>group(line('M0-21V-28',c.M,3),'translate(62 56) rotate('+(i*36)+')')).join('')+circle(62,56,17,c.A,c.m.edge)+calendar(87,86,.94,c,'10');
      case 'month-calendar':return group(calendar(77,80,1.08,c,'30'),'rotate(-4 77 80)')+path('M109 43A13 13 0 1 0 122 56A12 12 0 0 1 109 43Z',c.M)+sparkle(43,95,5,c.m.shine);
      case 'triple-chevron':return [48,69,90].map((y,i)=>relief('M48 '+(y+14)+'L80 '+(y-4)+'L112 '+(y+14)+'V'+(y+27)+'L80 '+(y+9)+'L48 '+(y+27)+'Z',c,i%2?c.A:c.M)).join('');
      case 'tandem':return [49,113].map(x=>circle(x,101,18,c.m.edge)+circle(x,100,16,c.M)+circle(x,100,12,c.E,c.m.shine,.6)+line('M'+(x-10)+' 100H'+(x+10)+'M'+x+' 90V110',c.m.mid,1)).join('')+line('M49 100L65 72L82 100H49M65 72H97L113 100H82L97 72M97 72L92 62H102M65 72L61 64H70M78 72L75 63H83',c.M,3.8)+circle(82,100,5,c.A,c.m.edge)+line('M81 101L88 107H92',c.m.shine,2)+sparkle(81,46,5,c.m.shine);
      case 'weekend-hammock':return line('M41 116L47 48M119 116L113 48',c.M,5)+relief('M49 65Q80 104 111 65L105 88Q80 118 55 88Z',c,c.A)+line('M49 65L55 88M111 65L105 88M57 76Q80 106 103 76M63 81L69 103M79 87V108M97 81L91 103',c.m.shine,1)+path('M83 36A13 13 0 1 0 96 49A11 11 0 0 1 83 36Z',c.M)+sparkle(58,40,3,c.m.shine);
      case 'sunday-brunch':return ellipse(78,108,40,9,c.M)+relief('M77 61H108V85Q105 97 93 97Q80 97 77 85Z',c)+path('M82 66H103V83Q99 91 93 91Q85 91 82 83Z',c.A)+line('M108 67H115Q126 69 119 80Q116 85 108 85',c.M,4)+relief('M44 99Q41 77 58 74Q73 73 79 88L70 102Q60 88 51 106Z',c)+line('M52 78L61 93M62 77L69 95',c.m.dark,1.8)+line('M84 53Q77 45 85 38M99 53Q106 45 99 37',c.m.shine,1.8);
      case 'four-wheel':return line('M51 56H109M51 107H109',c.M,6)+[[49,56],[111,56],[49,107],[111,107]].map(([x,y])=>circle(x,y,14,c.m.edge)+circle(x,y-1,11,c.M)+circle(x,y-1,6,c.A,c.m.edge)).join('')+relief('M62 43H98V119H62Z',c)+rect(67,51,26,60,5,c.E,c.m.shine,.6)+jewel(80,81,15,c)+line('M72 58H88M72 104H88',c.m.light,1.5);
      case 'anatomical-thigh':return relief('M58 40Q80 34 102 42C109 59 99 73 101 88Q104 105 95 117H73Q62 105 60 88C57 73 50 56 58 40Z',c)+path('M63 45Q79 40 96 46Q102 61 93 76L95 98Q91 109 84 111Q73 103 70 89Q60 69 63 45Z',c.A,c.m.dark,1.1)+path('M68 47Q58 68 71 92Q74 100 79 105L79 68ZM88 48L84 70Q87 85 84 103Q98 93 93 75Q100 59 88 48Z',c.E,c.m.mid,.9)+relief('M59 43L66 40Q70 58 81 75Q93 93 96 112L90 116Q86 96 75 80Q62 60 59 43Z',c)+line('M62 45Q67 60 79 78Q90 96 93 111',c.m.shine,1.4)+path('M76 110Q84 105 91 110L90 119H79Z',c.M,c.m.dark,1.2)+line('M48 53L52 56M109 88L114 88',c.e.glint,1.2);
      case 'porcelain-canopy':return relief('M46 62Q44 47 59 46Q66 32 81 41Q95 32 105 48Q121 51 114 66H46Z',c)+path('M48 61Q55 72 64 61Q72 73 80 61Q89 73 97 61Q107 73 114 61',c.m.shine,c.m.mid,.8)+relief('M64 81Q80 73 96 81L101 104Q80 119 59 104Z',c,c.m.shine)+[65,80,95].map((x,i)=>jewel(x,84+i%2*8,5,c,c.m.light)).join('')+line('M66 105Q80 111 94 105',c.m.mid,1.4)+sparkle(44,88,5,c.m.shine);
      case 'folded-note':return relief('M49 40H98L113 56V113H49Z',c)+path('M98 40V56H113Z',c.A,c.m.edge)+line('M60 62H91M60 73H101M60 84H85',c.e.deep,2.5)+star(92,95,11,c.A)+line('M58 109H85',c.m.shine,1.2);
      case 'crepe-pan':return line('M105 85L126 68',c.M,10)+ellipse(75,92,34,24,c.m.edge)+ellipse(75,88,34,23,c.M)+ellipse(75,87,29,18,c.E)+ellipse(75,87,25,14,c.m.mid)+ellipse(75,82,25,14,c.m.light)+ellipse(75,77,25,14,c.m.shine)+path('M53 79L88 66L92 85Z',c.A,c.m.mid)+[[60,75],[78,72],[84,85],[67,83]].map(([x,y])=>ellipse(x,y,2,1.2,c.m.mid)).join('')+line('M62 54Q54 47 62 39M82 51Q89 44 83 37',c.m.shine,1.7);
      case 'forest-path':return relief('M80 36L59 64H68L50 88H67V111H93V88H110L92 64H101Z',c,c.A)+path('M80 36V111H93V88H110L92 64H101Z',c.E)+path('M47 56L30 81H39L27 100H49V114H55V100H66L54 81H63Z',c.M,c.m.edge)+path('M114 55L98 80H105L94 99H112V113H118V99H133L121 80H129Z',c.M,c.m.edge)+path('M73 119Q95 105 79 97Q68 89 83 80Q74 93 91 99Q107 110 89 119Z',c.m.shine)+sparkle(108,38,5,c.m.shine);
      case 'quiet-drawer':return relief('M44 72L58 60H104L117 72V111H44Z',c)+path('M50 75H111V101H50Z',c.E,c.m.edge)+group(rect(67,40,26,47,5,c.M,c.m.edge)+rect(71,46,18,32,2,c.E)+line('M77 43H83',c.m.dark,1)+path('M80 53A8 8 0 1 0 87 62A7 7 0 0 1 80 53Z',c.m.shine),'rotate(10 80 63)')+relief('M42 87H119V113H42Z',c)+rect(48,93,65,15,2,c.A,c.m.dark)+line('M73 99H89',c.M,3)+circle(81,100,2,c.m.shine);
      default:return intimateMotif(d,c);
    }
  }

  function intimateMotif(d,c){
    switch(d.motif){
      case 'conversation':return relief('M40 49H91Q100 49 100 58V80Q100 89 91 89H65L50 102V89H40Q32 89 32 80V58Q32 49 40 49Z',c)+path('M45 61H85M45 71H73', 'none',c.e.deep,3)+relief('M78 75H118Q126 75 126 83V99Q126 107 118 107H109L118 119L97 107H78Q70 107 70 99V83Q70 75 78 75Z',c,c.A)+[83,97,111].map(x=>circle(x,91,2.6,c.m.shine)).join('');
      case 'genie-lamp':return relief('M49 79Q47 64 61 63H93Q102 63 104 72L121 67Q118 88 103 90Q99 105 78 106Q58 105 54 91H42Q32 90 34 79Q36 69 49 74Z',c)+path('M54 73H99Q99 93 79 96Q61 94 54 73Z',c.A)+path('M67 107H91L96 117H61Z',c.M,c.m.edge)+line('M78 59Q64 50 78 42Q89 35 79 26',c.m.shine,2.3)+sparkle(103,44,8,c.M)+sparkle(55,44,4,c.m.shine);
      case 'carpool':return relief('M42 82L51 61Q55 55 64 55H97Q105 55 110 63L119 83V105H42Z',c)+path('M57 62H100L109 80H49Z',c.E,c.m.shine,.8)+path('M80 62V80H109L100 62Z',c.A)+rect(48,88,16,8,3,c.m.shine,c.m.dark)+rect(98,88,15,8,3,c.m.shine,c.m.dark)+rect(70,94,21,5,1,c.e.deep)+rect(49,105,12,9,3,c.m.edge)+rect(101,105,12,9,3,c.m.edge)+line('M49 117L43 122M110 117L116 122',c.m.light,1.8)+star(80,42,9,c.M);
      case 'shower-clock':return line('M47 111V48Q47 36 62 36H83Q94 36 94 47',c.M,5)+relief('M79 48Q94 38 110 48V56H79Z',c)+[82,94,106].map((x,i)=>line('M'+x+' 63L'+(x-4)+' '+(76+i%2*6),c.m.shine,2.6)).join('')+clock(93,97,24,c,6)+line('M48 112H65',c.M,4);
      case 'desk-files':return relief('M39 79H121V89H39ZM46 89H53V119H46ZM107 89H114V119H107Z',c)+relief('M54 51H68L73 56H83V78H54Z',c,c.A)+relief('M70 45H85L91 50H105V78H70Z',c)+line('M77 58H98M77 66H93',c.e.deep,2)+rect(79,91,27,18,2,c.A,c.m.edge)+line('M89 98H97',c.m.shine,2.5)+rect(58,91,15,3,1,c.m.mid);
      case 'velvet-chair':return relief('M57 78V54Q57 40 71 40H89Q103 40 103 54V78H115V102H45V78Z',c)+rect(63,47,34,41,8,c.A,c.m.dark)+line('M80 50V79M65 66H95',c.m.mid,1.5)+rect(51,85,58,17,5,c.A,c.m.dark)+rect(43,73,15,23,6,c.M,c.m.edge)+rect(102,73,15,23,6,c.M,c.m.edge)+line('M55 104L52 117M105 104L108 117',c.M,5)+star(80,57,6,c.m.shine);
      case 'glasshouse':return relief('M43 112V66L80 36L117 66V112Z',c)+path('M49 107V69L80 44L111 69V107Z',c.E,c.m.shine,.8)+line('M80 44V108M49 70H111M64 57V108M96 57V108M49 89H111',c.M,2)+leaf(65,109,-20,c,c.A)+leaf(66,108,39,c,c.A)+leaf(96,109,19,c,c.A)+leaf(95,108,-40,c,c.A)+rect(74,88,12,20,1,c.M,c.m.dark)+sparkle(107,44,4,c.m.shine);
      case 'turnaround':return relief('M45 111V71Q45 42 76 42Q107 42 107 71V84H122L98 108L74 84H90V71Q90 58 76 58Q62 58 62 71V111Z',c)+path('M54 111V71Q54 50 76 50Q98 50 98 71V96', 'none',c.m.shine,1.6)+line('M47 119H68M77 119H88M98 119H113',c.e.glint,2.4);
      case 'silver-spoons':return group(relief('M0-40C-22-40-22-7-7 0L-7 34Q-7 43 0 43Q7 43 7 34L7 0C22-7 22-40 0-40Z',c)+path('M0-34C-13-34-14-13 0-6C12-13 13-34 0-34Z','url(#'+c.p+'-bevel)')+line('M-2 4V32',c.m.shine,1.2),'translate(66 78) rotate(-19) scale(.87)')+group(relief('M0-40C-22-40-22-7-7 0L-7 34Q-7 43 0 43Q7 43 7 34L7 0C22-7 22-40 0-40Z',c)+path('M0-34C-13-34-14-13 0-6C12-13 13-34 0-34Z','url(#'+c.p+'-bevel)')+line('M-2 4V32',c.m.shine,1.2),'translate(94 78) rotate(19) scale(.87)')+sparkle(81,38,5,c.m.shine);
      case 'creative-direction':return line('M45 64V47H62M98 47H115V64M45 98V115H62M98 115H115V98',c.M,4)+relief('M76 53H84L105 109L95 112L80 73L65 112L55 109Z',c)+circle(80,58,9,c.A,c.m.edge,1.5)+line('M65 89H95',c.M,2.5)+star(80,34,6,c.m.shine);
      case 'vibration-timer':return rect(73,33,14,9,2,c.M,c.m.edge)+circle(80,79,33,c.M,c.m.edge,1.6)+circle(80,79,26,c.E,c.m.shine,.8)+path('M80 53A26 26 0 0 1 106 79H80Z',c.A)+numerals('15',80,69,22,c.m.shine,2.3)+line('M80 55V60M56 79H61M99 79H104M80 99V104',c.m.shine,1.7)+line('M40 66Q30 79 40 92M33 61Q18 79 33 97M120 66Q130 79 120 92M127 61Q142 79 127 97',c.m.light,2.2);
      case 'night-battery':return relief('M47 70H109V80H116V94H109V105H47Z',c)+rect(52,76,51,23,3,c.E,c.m.dark)+[57,72,87].map(x=>rect(x,80,11,15,1,c.A,c.m.shine,.5)).join('')+path('M84 35A17 17 0 1 0 103 54A16 16 0 0 1 84 35Z',c.M)+sparkle(53,48,5,c.m.shine)+sparkle(114,40,3,c.m.shine)+line('M59 114H99',c.e.glint,1.2);
      case 'monochrome-camera':return camera(80,78,1.13,c,true)+path('M80 68A15 15 0 0 1 80 98Z',c.m.shine)+path('M80 70L90 82L80 94Z',c.e.deep)+[0,1,2,3,4,5].map(i=>rect(52+i*10,113,8,4,0,i%2?c.m.shine:c.m.dark)).join('')+sparkle(116,44,4,c.m.shine);
      case 'shadow-frame':return relief('M45 42H115V115H45Z',c)+rect(51,48,58,61,1,c.E,c.m.dark)+path('M63 70L109 96V109H87L59 84Z',c.e.deep)+path('M82 64L109 79V105L82 88Z',c.m.dark)+relief('M59 70L74 61L84 70L69 83Z',c,c.A)+path('M59 70V85L69 96V83Z',c.M,c.m.edge)+path('M69 83L84 70V85L69 96Z',c.A,c.m.edge)+line('M87 51L106 64M88 56L104 67',c.e.glint,1.2);
      case 'fog-lens':return circle(80,81,35,c.m.edge)+circle(80,78,35,c.M,c.m.edge,1.4)+circle(80,78,28,c.E,c.m.light,2)+circle(80,78,20,c.A,c.m.dark,2)+circle(80,78,11,c.E)+path('M62 69Q75 51 93 62L81 77Z',c.m.shine,undefined,0,'opacity=".55"')+line('M60 43Q51 37 59 29M96 45Q106 36 97 28',c.m.light,1.8)+[[-30,25],[29,21],[-26,-13]].map(([x,y])=>relief('M'+(80+x)+' '+(78+y-7)+'Q'+(90+x)+' '+(87+y)+' '+(80+x)+' '+(88+y)+'Q'+(70+x)+' '+(87+y)+' '+(80+x)+' '+(78+y-7)+'Z',c,c.A)).join('');
      case 'golden-rain':return relief('M47 76Q32 74 37 60Q40 49 53 51Q58 35 75 39Q87 29 102 43Q117 43 119 59Q133 66 120 77Z',c)+line('M49 57Q54 49 63 49M77 45Q88 39 97 48',c.m.shine,2)+[58,80,102].map((x,i)=>relief('M'+x+' '+(86-i%2*4)+'Q'+(x+12)+' '+(107-i%2*4)+' '+x+' '+(111-i%2*4)+'Q'+(x-12)+' '+(107-i%2*4)+' '+x+' '+(86-i%2*4)+'Z',c)).join('')+sparkle(119,93,4,c.m.shine);
      case 'rose-window':return relief('M48 116V73Q48 53 80 33Q112 53 112 73V116Z',c)+path('M55 109V74Q55 57 80 42Q105 57 105 74V109Z',c.E,c.m.shine,.7)+Array.from({length:6},(_,i)=>group(path('M0 0Q-14-11 0-22Q14-11 0 0Z',i%2?c.A:c.M,c.m.edge,.7),'translate(80 76) rotate('+(i*60)+')')).join('')+circle(80,76,7,c.m.shine,c.m.edge)+line('M55 101H105M64 108V98M80 108V98M96 108V98',c.M,2);
      case 'manual-camera':return relief('M49 52H108Q118 52 118 64V76Q118 86 108 86H49Q39 86 39 76V64Q39 52 49 52Z',c)+rect(46,58,65,23,8,c.E)+circle(69,70,16,c.M,c.m.edge)+circle(69,70,11,c.A,c.m.shine,.9)+circle(69,70,5,c.e.deep)+gear(99,70,10,c)+line('M80 86V109M80 109L58 119M80 109L102 119',c.M,4)+line('M49 43H61M49 43V34H61V43',c.m.light,2)+sparkle(110,39,4,c.m.shine);
      case 'finale-screen':return screen(80,47,72,52,c)+star(80,72,17,c.M)+star(80,72,8,c.A)+line('M52 89H63M97 89H108',c.m.shine,1.3)+relief('M68 42L64 30L75 35L80 25L85 35L96 30L92 42Z',c);
      case 'upper-signal':return screen(80,76,70,32,c)+[0,1,2,3].map(i=>relief('M'+(51+i*16)+' 68V'+(57-i*9)+'H'+(61+i*16)+'V68Z',c,i%2?c.M:c.A)).join('')+line('M54 91H68M75 91H105',c.m.shine,1.4)+path('M115 35L123 44L115 53Z',c.M);
      case 'empty-meeting':return screen(66,47,51,35,c)+rect(46,53,16,11,1,c.A)+line('M68 55H85M68 61H79M46 70H85',c.m.light,1.4)+relief('M94 76V62Q94 55 102 55Q112 55 112 62V85H117V101H90V85Z',c,c.A)+line('M94 102L92 116M114 102L116 116',c.M,3.6)+ellipse(72,96,30,7,c.M)+path('M68 100V118H75V100Z',c.M,c.m.edge)+path('M56 91L64 81L71 91Z',c.A,c.m.edge)+circle(82,90,4,c.m.shine);
      case 'reverse-camera':return relief('M42 53H118V103H42Z',c)+rect(47,58,66,40,5,c.E)+path('M56 94L72 66H88L104 94', 'none',c.A,3)+line('M80 91V86M80 80V75M80 70V67',c.m.shine,2.4)+line('M53 105L47 113M107 105L113 113',c.M,3.6)+circle(80,45,9,c.M,c.m.edge)+circle(80,45,5,c.A,c.m.shine,.6)+line('M53 85H61M99 85H107',c.m.light,1.8);
      case 'stage-door':return relief('M43 113V56Q43 38 80 38Q117 38 117 56V113Z',c)+path('M50 109V58Q50 45 80 45Q110 45 110 58V109Z',c.e.deep)+path('M50 51H78Q77 78 53 96L50 109Z',c.A,c.m.edge)+path('M110 51H82Q83 78 107 96L110 109Z',c.A,c.m.edge)+line('M57 55Q64 75 53 88M103 55Q96 75 107 88',c.m.shine,1.2)+star(80,65,11,c.M)+relief('M39 111H121V117H39ZM33 117H127V123H33Z',c);
      case 'double-ticket':return group(relief('M-21-30H21V-14Q11-10 21-6V8Q11 12 21 16V30H-21V16Q-11 12-21 8V-6Q-11-10-21-14Z',c)+line('M-11-20H11M-11-13H4M-9 11L-2 18L12 2',c.e.deep,2.4)+line('M-15-2H15',c.m.shine,1.1,'stroke-dasharray="2 3"'),'translate(62 77) rotate(-17)')+group(relief('M-21-30H21V-14Q11-10 21-6V8Q11 12 21 16V30H-21V16Q-11 12-21 8V-6Q-11-10-21-14Z',c,c.A)+line('M-11-20H11M-11-13H4M-9 11L-2 18L12 2',c.m.shine,2.4)+line('M-15-2H15',c.m.shine,1.1,'stroke-dasharray="2 3"'),'translate(96 87) rotate(12)');
      case 'hour-contract':return relief('M49 41H92L107 56V113H49Z',c)+path('M92 41V56H107Z',c.A,c.m.edge)+line('M59 63H94M59 73H91M59 83H74',c.e.deep,2.2)+path('M58 99Q65 91 69 99Q74 103 79 96', 'none',c.e.deep,1.6)+clock(102,101,21,c,-7)+line('M102 101L108 92',c.m.shine,2.2)+circle(61,110,5,c.A,c.m.edge,.8);
      case 'applause-rosette':return path('M64 88L54 119L70 113L78 124L84 92M85 92L93 124L102 113L118 119L102 88Z',c.M,c.m.edge)+Array.from({length:10},(_,i)=>group(path('M-7-22L0-32L7-22V0H-7Z',i%2?c.M:c.A,c.m.edge,.7),'translate(81 75) rotate('+(i*36)+')')).join('')+circle(81,75,24,c.M,c.m.edge)+circle(81,75,18,c.E,c.m.shine,1)+star(81,75,13,c.m.shine)+line('M39 61L30 57M38 76H27M43 91L33 96M122 61L131 57M124 76H135M119 91L129 96',c.m.light,2);
      case 'private-cinema':return relief('M45 69H116V113H45Z',c)+rect(51,76,59,30,2,c.E,c.m.dark)+group(relief('M45 56H116V70H45Z',c)+path('M50 56H61L52 70H45ZM72 56H83L74 70H63ZM94 56H105L96 70H85ZM116 56V69L107 70Z',c.e.deep),'rotate(-10 45 70)')+circle(81,88,7,c.M)+path('M78 91H84L87 103H75Z',c.M)+sparkle(103,38,5,c.m.shine);
      case 'studio-light':return path('M65 59L122 82L100 110L58 71Z',c.e.glint,undefined,0,'opacity=".18"')+group(relief('M-16-13H13L25-23V23L13 13H-16Z',c)+rect(-12,-9,25,18,2,c.A,c.m.edge)+line('M-5 13V45M-5 45L-21 56M-5 45L11 56',c.M,3.4),'translate(56 59) rotate(-12)')+relief('M86 80H119V113H86Z',c)+rect(90,84,25,25,1,c.E)+star(102,96,9,c.A)+sparkle(114,43,6,c.m.shine)+line('M73 115L79 109L76 103L83 98',c.m.shine,2);
      case 'gliding-stone':return line('M38 105Q59 94 80 105T122 105M45 115Q66 104 87 115T128 115M33 94Q50 87 65 93',c.m.light,2.1)+relief('M49 77Q49 61 78 59Q106 57 114 72Q116 87 85 92Q56 96 49 77Z',c)+path('M55 74Q64 62 87 63Q103 64 107 71Q87 66 64 78Z',c.m.shine,undefined,0,'opacity=".55"')+path('M79 43Q91 58 81 60Q68 60 79 43Z',c.A,c.m.edge)+sparkle(113,48,5,c.m.shine);
      case 'remake-projector':return relief('M47 76H105V108H47Z',c)+path('M105 85L122 77V105L105 97Z',c.M,c.m.edge)+[65,95].map(x=>circle(x,60,16,c.M,c.m.edge)+circle(x,60,11,c.E)+[0,120,240].map(a=>{const q=a*Math.PI/180;return circle(fixed(x+Math.cos(q)*6),fixed(60+Math.sin(q)*6),3,c.m.shine);}).join('')).join('')+rect(53,82,46,20,2,c.A,c.m.dark)+path('M70 96V87L80 81L90 87V96H83V90H77V96Z',c.m.shine)+line('M55 109L50 119M97 109L102 119',c.M,4)+line('M56 37Q80 24 108 38',c.m.shine,2.8)+path('M104 30L117 42L101 43Z',c.M);
      default:throw new RangeError('Artwork composition is not defined: '+d.motif);
    }
  }

  function decorations(d,c){
    if(d.ornament==='laurel')return line('M49 129Q25 109 32 77M111 129Q135 109 128 77',c.m.mid,1.6)+[0,1,2,3].map(i=>leaf(35+i*2,115-i*10,-62+i*9,c)+leaf(125-i*2,115-i*10,62-i*9,c)).join('');
    const angles=d.ornament==='notches'?[-146,-122,-58,-34,34,58,122,146]:d.ornament==='rays'?[-155,-135,-45,-25,25,45,135,155]:[-140,-40,40,140];
    return angles.map(angle=>{const a=angle*Math.PI/180,x=80+Math.sin(a)*55,y=80-Math.cos(a)*55;return d.ornament==='studs'?circle(fixed(x),fixed(y),2,c.m.shine,c.m.dark,.6):group(line('M0-2V3',c.m.dark,2)+line('M1-2V3',c.m.shine,.7),'translate('+fixed(x)+' '+fixed(y)+') rotate('+angle+')');}).join('');
  }
  function background(d,c){
    if(d.pattern==='night')return [[42,42,3],[112,49,2.5],[116,100,2],[43,99,2],[101,29,1.8]].map(([x,y,r])=>sparkle(x,y,r,c.e.glint)).join('');
    if(d.pattern==='waves')return [50,76,102,126].map(y=>line('M20 '+y+'Q50 '+(y-22)+' 80 '+y+'T140 '+y,c.e.glint,.8,'opacity=".2"')).join('');
    if(d.pattern==='grid')return [36,58,80,102,124].map(n=>line('M'+n+' 23V138M23 '+n+'H138',c.e.glint,.6,'opacity=".18"')).join('');
    if(d.pattern==='rays')return Array.from({length:12},(_,i)=>group(path('M77 77L67 8H85Z',c.e.glint,undefined,0,'opacity=".09"'),'rotate('+(i*30)+' 80 80)')).join('');
    return path('M18 105L80 19L142 73L80 144Z',c.e.glint,undefined,0,'opacity=".1"')+path('M80 19L80 144L142 73Z',c.e.deep,undefined,0,'opacity=".23"');
  }
  function render(badgeId,options={}){
    const d=records.get(badgeId);if(!d)throw new RangeError('Unknown badge artwork.');
    if(!options||typeof options!=='object'||Array.isArray(options))throw new TypeError('Artwork options must be an object.');
    const instance=options.instance===undefined?'asset':options.instance;if(!instances.has(instance))throw new RangeError('Unknown artwork instance.');
    const locked=options.locked===true,p='oba-'+instance+'-'+badgeId+'-'+(locked?'l':'e'),m=metals[locked?'locked':d.metal],e=enamels[locked?'locked':d.enamel];
    const c={p,m,e,M:'url(#'+p+'-metal)',A:'url(#'+p+'-accent)',E:'url(#'+p+'-enamel)'};
    const outline=outlines[d.shape],inset='translate(80 80) scale(.81) translate(-80 -80)',rim='translate(80 80) scale(.9) translate(-80 -80)';
    const defs='<defs><linearGradient id="'+p+'-metal" x1="25" y1="15" x2="126" y2="150" gradientUnits="userSpaceOnUse"><stop stop-color="'+m.light.replace(',','')+'"/><stop offset=".19" stop-color="'+m.shine+'"/><stop offset=".37" stop-color="'+m.mid+'"/><stop offset=".5" stop-color="'+m.dark+'"/><stop offset=".64" stop-color="'+m.light.replace(',','')+'"/><stop offset=".82" stop-color="'+m.mid+'"/><stop offset="1" stop-color="'+m.dark+'"/></linearGradient><linearGradient id="'+p+'-bevel" x1="25" y1="151" x2="130" y2="18" gradientUnits="userSpaceOnUse"><stop stop-color="'+m.light.replace(',','')+'"/><stop offset=".46" stop-color="'+m.dark+'"/><stop offset=".7" stop-color="'+m.mid+'"/><stop offset="1" stop-color="'+m.shine+'"/></linearGradient><radialGradient id="'+p+'-enamel" cx="62" cy="40" r="105" gradientUnits="userSpaceOnUse"><stop stop-color="'+e.light+'"/><stop offset=".39" stop-color="'+e.mid+'"/><stop offset="1" stop-color="'+e.deep+'"/></radialGradient><linearGradient id="'+p+'-accent" x1="49" y1="39" x2="112" y2="119" gradientUnits="userSpaceOnUse"><stop stop-color="'+e.glint+'"/><stop offset=".34" stop-color="'+e.accent+'"/><stop offset="1" stop-color="'+e.mid+'"/></linearGradient><linearGradient id="'+p+'-gloss" x1="60" y1="20" x2="83" y2="111" gradientUnits="userSpaceOnUse"><stop stop-color="#ffffff" stop-opacity=".32"/><stop offset=".6" stop-color="#ffffff" stop-opacity=".02"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient><clipPath id="'+p+'-field">'+path(outline,'#fff',undefined,0,'transform="'+inset+'"')+'</clipPath></defs>';
    const body=ellipse(80,160,49,7,'#000','opacity=".18"')+ellipse(80,159,33,3,'#000','opacity=".2"')+path(outline,m.edge,undefined,0,'transform="translate(0 4)"')+path(outline,c.M,m.edge,1.8)+path(outline,'none',m.shine,.85,'transform="translate(80 80) scale(.975) translate(-80 -80)" opacity=".8"')+path(outline,'none','url(#'+p+'-bevel)',4,'transform="'+rim+'"')+path(outline,c.E,m.edge,1.5,'transform="'+inset+'"')+group(background(d,c)+path('M14 18H147V63Q78 96 14 72Z','url(#'+p+'-gloss)'),'','clip-path="url(#'+p+'-field)"')+decorations(d,c)+motif(d,c)+(d.mark?rect(65-d.mark.length*3,125,30+d.mark.length*6,17,6,m.edge,undefined)+rect(65-d.mark.length*3,123,30+d.mark.length*6,17,6,c.M,m.edge,.9)+numerals(d.mark,80,126,10,e.deep,2.2):'')+sparkle(33,42,3.1,m.shine);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 176" aria-hidden="true" focusable="false" class="oa-badge-art" data-badge-art="'+badgeId+'" data-art-motif="'+d.motif+'" data-locked="'+locked+'">'+defs+body+'</svg>';
  }
  const api=Object.freeze({version:1,ids,catalogue,render});scope.OndeBadgeArt=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
