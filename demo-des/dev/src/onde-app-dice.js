/* ONDE — self-contained organic dice renderer. No network dependencies. */
(function (global) {
  'use strict';
  const VERTEX = `attribute vec2 aPosition;void main(){gl_Position=vec4(aPosition,0.,1.);}`;
  const FRAGMENT = `
precision highp float;
uniform vec2 uResolution;
uniform mat3 uRotation;
uniform vec3 uPosition,uScale,uColor;
uniform int uType,uCount;
uniform vec3 uNormals[20],uTangents[20],uBitangents[20];
uniform float uOffset,uBound,uValue,uResultLight;
uniform sampler2D uAtlas;
vec3 localPoint(vec3 p){vec3 v=(p-uPosition)/uScale;return vec3(dot(v,uRotation[0]),dot(v,uRotation[1]),dot(v,uRotation[2]));}
float poly(vec3 p){float s=0.;for(int i=0;i<20;i++){if(i<uCount){float q=max(dot(p,uNormals[i]),0.);float q2=q*q;float q4=q2*q2;float q8=q4*q4;s+=uType==4?q4:q8*q8;}}float exponent=uType==4?.25:.0625;return (pow(max(s,1.e-20),exponent)-uOffset)/pow(float(uCount),exponent);}
float roundedBox(vec3 p){vec3 q=p*p;q*=q;return (pow(q.x+q.y+q.z,.25)-1.)/1.316074;}
float bodyLocal(vec3 p){return uType==6?roundedBox(p):poly(p);}
float body(vec3 p){return bodyLocal(localPoint(p))*min(uScale.x,min(uScale.y,uScale.z));}
// Analytic derivatives keep rounded-edge lighting stable while the die turns.
vec3 localGradient(vec3 p){
 if(uType==6){vec3 p2=p*p;float s=max(dot(p2,p2),1.e-12);return p*p2*pow(s,-.75)/1.316074;}
 float s=0.;vec3 grad=vec3(0.);for(int i=0;i<20;i++){if(i<uCount){float q=max(dot(p,uNormals[i]),0.);float q2=q*q,q3=q2*q,q4=q2*q2,q8=q4*q4;if(uType==4){s+=q4;grad+=q3*uNormals[i];}else{s+=q8*q8;grad+=q8*q4*q3*uNormals[i];}}}
 float exponent=uType==4?.25:.0625;return grad*pow(max(s,1.e-12),exponent-1.)/pow(float(uCount),exponent);
}
vec3 worldGradient(vec3 lp){return (uRotation*localGradient(lp))/uScale*min(uScale.x,min(uScale.y,uScale.z));}
float stamp(vec2 uv,float idx){if(uv.x<.02||uv.x>.98||uv.y<.02||uv.y>.98)return 0.;vec2 cell=vec2(mod(idx,4.),floor(idx/4.));return texture2D(uAtlas,(cell+vec2(uv.x,1.-uv.y))/vec2(4.,8.)).r;}
float grain(vec3 p){return sin(p.x*71.)*sin(p.y*59.+sin(p.z*43.))*sin(p.z*67.+p.x*13.);}
void main(){
 vec2 uv=(gl_FragCoord.xy/uResolution-.5)*vec2(uResolution.x/uResolution.y,1.);
 vec3 eye=vec3(4.3,6.2,6.4),target=vec3(0.,.95,0.);vec3 f=normalize(target-eye),right=normalize(cross(f,vec3(0.,1.,0.))),up=cross(right,f);
 vec3 ro=eye+right*uv.x*4.4+up*uv.y*4.4,rd=f;
 float floorT=-ro.y/rd.y;vec3 floorP=ro+rd*floorT;
 float h=max(0.,uPosition.y-.70);vec2 shadowP=floorP.xz-uPosition.xz-vec2(.18,-.13)*h;
 // A restrained contact shadow grounds the object without a dark platform.
 float spread=.48+h*.18;float shadow=exp(-dot(shadowP/vec2(spread*1.4,spread),shadowP/vec2(spread*1.4,spread)))*(.20/(1.+h*.6));
 float contact=exp(-dot((floorP.xz-uPosition.xz)/vec2(.52,.42),(floorP.xz-uPosition.xz)/vec2(.52,.42)))*.12/(1.+h*3.);
 float outputAlpha=min(.32,shadow+contact);vec3 color=vec3(.014,.018,.014);
 vec3 oc=ro-uPosition;float b=dot(oc,rd),c=dot(oc,oc)-uBound*uBound,disc=b*b-c;
 if(disc>0.){
  float t=max(0.,-b-sqrt(disc)),end=min(floorT,-b+sqrt(disc));bool hit=false;
  float best=1.e4,bestT=t,previous=1.e4,pixel=4.4/uResolution.y;
  // A pixel-sized coverage fringe replaces a binary silhouette. It also keeps
  // grazing rays visible instead of switching whole pixels on and off.
  for(int j=0;j<112;j++){if(t>end)break;float d=body(ro+rd*t);if(d<best){best=d;bestT=t;}if(d<.0008){hit=true;break;}if(d>previous&&best<pixel*1.4)break;previous=d;t+=max(.0005,d*.92);}
  if(hit||best<pixel*1.4){
   if(!hit)t=bestT;
   vec3 p=ro+rd*t,lp=localPoint(p),gradient=worldGradient(lp),n=normalize(gradient),v=-rd;float mark=0.;
   float coverage=hit?1.:1.-smoothstep(0.,pixel*.95,best/max(length(gradient),.15));
   float shadowAlpha=outputAlpha;vec3 shadowColor=color;
   float md=-1.e10,idx=0.;vec3 tn=vec3(1.,0.,0.),bn=vec3(0.,1.,0.);for(int j=0;j<20;j++){if(j<uCount){float z=dot(lp,uNormals[j]);if(z>md){md=z;idx=float(j);tn=uTangents[j];bn=uBitangents[j];}}}
   float labelScale=uType==4?.95:(uType==6?.68:1.78);vec2 tex=vec2(dot(lp,tn),dot(lp,bn))*labelScale+.5;mark=stamp(tex,idx);float eps=.012;
   vec2 grad=vec2(stamp(tex+vec2(eps,0.),idx)-stamp(tex-vec2(eps,0.),idx),stamp(tex+vec2(0.,eps),idx)-stamp(tex-vec2(0.,eps),idx));
   n=normalize(n+(uRotation*tn*grad.x+uRotation*bn*grad.y)/uScale*.09);
   float g=grain(lp);n=normalize(n+vec3(g,grain(lp.yzx),grain(lp.zxy))*.004);
   vec3 base=pow(uColor,vec3(2.2));vec3 stampColor=pow(mix(uColor,vec3(.86,.85,.78),.58),vec3(2.2));base=mix(base,stampColor,mark*.86);
   vec3 light=normalize(vec3(-3.,6.,4.)),fill=normalize(vec3(4.,2.,-3.));float diffuse=max(dot(n,light),0.),fillD=max(dot(n,fill),0.);
   float ambient=.27+.17*(n.y*.5+.5);color=base*(ambient+diffuse*1.15+fillD*.25);
   vec3 halfV=normalize(light+v);float spec=pow(max(dot(n,halfV),0.),20.)*.11+pow(max(dot(n,halfV),0.),64.)*.008;
   vec3 rimHalf=normalize(fill+v);spec+=pow(max(dot(n,rimHalf),0.),35.)*.09;
   color+=vec3(1.,.98,.91)*spec*(1.-mark*.55);
   float fresnel=pow(1.-max(dot(n,v),0.),4.);color+=vec3(.27,.32,.28)*fresnel*.10;
   color*=.93+.07*smoothstep(.0,.48,p.y);color*=1.+g*.004;
   // Only the settled result receives bright ivory ink. The glint stays inside
   // the numeral, with fine material-space grain rather than an external glow.
   float resultFace=1.-step(.5,abs(idx-(uValue-1.)));
   float inkSpec=pow(max(dot(n,halfV),0.),24.)*.11;
   vec3 resultInk=pow(vec3(.99,.985,.955),vec3(2.2))*(.94+.06*diffuse)+vec3(1.,.995,.97)*inkSpec+grain(lp*1.7)*.006;
   color=mix(color,resultInk,mark*resultFace*uResultLight);
   outputAlpha=coverage+shadowAlpha*(1.-coverage);
   color=(color*coverage+shadowColor*shadowAlpha*(1.-coverage))/max(outputAlpha,.0001);
  }
 }
 color=pow(max(color,vec3(0.)),vec3(1./2.2));
 float dith=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5)/255.;
 gl_FragColor=vec4(color+dith,outputAlpha);
}`;
  const add = (a,b) => a.map((x,i) => x+b[i]);
  const sub = (a,b) => a.map((x,i) => x-b[i]);
  const mul = (a,s) => a.map(x => x*s);
  const dot = (a,b) => a.reduce((s,x,i) => s+x*b[i],0);
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const norm = a => mul(a,1/Math.hypot(...a));
  const qmul = (a,b) => [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
  const axisQ = (axis,angle) => [...mul(norm(axis),Math.sin(angle/2)),Math.cos(angle/2)];
  function fromTo(a,b) {
    const d=dot(a,b);
    if(d<-.99999) { let v=cross(a,[1,0,0]);if(Math.hypot(...v)<.01)v=cross(a,[0,0,1]);return axisQ(v,Math.PI); }
    const q=[...cross(a,b),1+d];return mul(q,1/Math.hypot(...q));
  }
  function matrix(q) {
    const [x,y,z,w]=q;
    return [1-2*(y*y+z*z),2*(x*y+z*w),2*(x*z-y*w),2*(x*y-z*w),1-2*(x*x+z*z),2*(y*z+x*w),2*(x*z+y*w),2*(y*z-x*w),1-2*(x*x+y*y)];
  }
  const transform=(m,p)=>[m[0]*p[0]+m[3]*p[1]+m[6]*p[2],m[1]*p[0]+m[4]*p[1]+m[7]*p[2],m[2]*p[0]+m[5]*p[1]+m[8]*p[2]];
  function slerp(a,b,t) {
    let d=dot(a,b);if(d<0){b=mul(b,-1);d=-d;}
    if(d>.9995){const q=a.map((x,i)=>x+(b[i]-x)*t);return mul(q,1/Math.hypot(...q));}
    const theta=Math.acos(Math.min(1,d)),s=Math.sin(theta);
    return a.map((x,i)=>(x*Math.sin((1-t)*theta)+b[i]*Math.sin(t*theta))/s);
  }
  const smooth=t=>t*t*(3-2*t),ease=t=>1-Math.pow(1-t,3),phi=(1+Math.sqrt(5))/2;
  function makePoly(type) {
    let vs=type===4?[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]]:[[-1,phi,0],[1,phi,0],[-1,-phi,0],[1,-phi,0],[0,-1,phi],[0,1,phi],[0,-1,-phi],[0,1,-phi],[phi,0,-1],[phi,0,1],[-phi,0,-1],[-phi,0,1]];
    const r=type===4?1.75:1.48;vs=vs.map(v=>mul(norm(v),r));
    const edge=type===4?Math.hypot(...sub(vs[0],vs[1])):2*r/Math.sqrt(1+phi*phi),faces=[];
    for(let i=0;i<vs.length;i++)for(let j=i+1;j<vs.length;j++)for(let k=j+1;k<vs.length;k++) {
      const a=vs[i],b=vs[j],c=vs[k];
      if(type===20&&[sub(a,b),sub(a,c),sub(b,c)].some(v=>Math.abs(Math.hypot(...v)-edge)>.0001))continue;
      const center=mul(add(add(a,b),c),1/3);let n=norm(cross(sub(b,a),sub(c,a)));if(dot(n,center)<0)n=mul(n,-1);
      const t=norm(cross(Math.abs(n[1])>.9?[0,0,1]:[0,1,0],n));faces.push({n,t,b:cross(n,t),h:dot(n,a),points:[a,b,c]});
    }
    if(type===4)faces.forEach((f,i)=>{const ns=faces[(i+1)%4].n;f.b=norm(add(mul(ns,-1),mul(f.n,dot(ns,f.n))));f.t=cross(f.b,f.n);});
    const h=faces[0].h,samples=[],exponent=type===4?4:16,sampleCount=6400;
    for(let i=0;i<sampleCount;i++) {
      const y=1-2*(i+.5)/sampleCount,a=i*2.3999632297,d=[Math.sqrt(1-y*y)*Math.cos(a),y,Math.sqrt(1-y*y)*Math.sin(a)];
      let sum=0;for(const f of faces)sum+=Math.pow(Math.max(0,dot(d,f.n)),exponent);
      samples.push(mul(d,h/Math.pow(sum,1/exponent)));
    }
    return {faces,samples};
  }
  const POLYS={4:makePoly(4),20:makePoly(20)};
  const CUBE_NORMALS=[[0,1,0],[0,0,1],[1,0,0],[-1,0,0],[0,0,-1],[0,-1,0]];
  // One right-handed face basis is shared by WebGL, fallback and result poses.
  const CUBE_TANGENTS=[[1,0,0],[1,0,0],[0,0,-1],[0,0,1],[-1,0,0],[1,0,0]];
  const CUBE_FACES=CUBE_NORMALS.map((n,i)=>{const t=CUBE_TANGENTS[i],b=cross(n,t);return {n,t,b,h:1,value:i+1,points:[[-1,-1],[1,-1],[1,1],[-1,1]].map(p=>add(n,add(mul(t,p[0]),mul(b,p[1]))))};});

  const COLORS={4:[.4196,.4824,.5490],6:[.4863,.5412,.4353],20:[.7608,.6471,.4706]};
  const HEX={4:'#6b7b8c',6:'#7c8a6f',20:'#c2a578'};
  const MATERIALS={4:'ardoise',6:'sauge',20:'sable'};
  function validKind(kind){kind=Number(kind);if(![4,6,20].includes(kind))throw new RangeError('ONDE supports D4, D6 and D20.');return kind;}
  function validValue(value,kind){value=Number(value);if(!Number.isInteger(value)||value<1||value>kind)throw new RangeError('Dice result must be an integer from 1 to '+kind+'.');return value;}
  function clampPower(value){value=Number(value);return Number.isNaN(value)?0:Math.max(0,Math.min(1,value));}
  function rollDuration(base,power){return Math.max(1650,Math.min(2500,(Number(base)||1650)+850*power));}
  function targetRotation(type,value,yaw=.48) {
    if(type===4) {
      const faces=POLYS[4].faces,base=fromTo(faces[value%4].n,[0,-1,0]),p=transform(matrix(base),faces[value-1].n),cam=[4.3,0,6.4];
      const angle=Math.atan2(cam[0],cam[2])-Math.atan2(p[0],p[2])+.42;return qmul(axisQ([0,1,0],angle),base);
    }
    const n=type===6?CUBE_NORMALS[value-1]:POLYS[20].faces[value-1].n,base=fromTo(n,[0,1,0]);
    if(type===20||type===6) {const face=type===6?CUBE_FACES[value-1]:POLYS[20].faces[value-1],b=transform(matrix(base),face.b);yaw=Math.atan2(-4.3,-6.4)-Math.atan2(b[0],b[2])+(type===6?(yaw-.48)*.18:0);}
    return qmul(axisQ([0,1,0],yaw),base);
  }
  // The unthrown D6 shows three faces; settled results retain their physical pose.
  function initialRotation(type,value){const q=targetRotation(type,value);return type===6?qmul(axisQ([0,1,0],.42),q):q;}
  function support(type,m) {
    if(type===6)return Math.pow(Math.pow(Math.abs(m[1]),4/3)+Math.pow(Math.abs(m[4]),4/3)+Math.pow(Math.abs(m[7]),4/3),3/4);
    let min=1e6;for(const p of POLYS[type].samples)min=Math.min(min,m[1]*p[0]+m[4]*p[1]+m[7]*p[2]);return -min;
  }
  function create(canvas,options={}) {
    if(!canvas||typeof canvas.getContext!=='function')throw new TypeError('A canvas is required.');
    let type=validKind(options.kind??6),result=validValue(options.value??1,type),rotation=initialRotation(type,result);
    let alive=true,raf=0,busy=false,pressed=false,pressAt=0,pressScale=1,rollAt=0,startQ=rotation,goalQ=rotation,pointerId=null,charge=0;
    let duration=rollDuration(options.duration,0),activeDuration=duration,activePower=0,spinTurns=2,settleAt=0,settleScale=1,pressPoint=null;
    let reduced=typeof options.reducedMotion==='boolean'?options.reducedMotion:!!global.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let manualReduced=typeof options.reducedMotion==='boolean',pending=null,resolveRoll=null;
    let resultLight=1;
    let gl=null,program=null,buffer=null,texture=null,shaders=[],uniforms={},mode='fallback',renderError='',contextMessage='';
    let lastFrame={q:rotation,sy:1,lift:0,x:0,z:0},fallbackCanvas=null,fallbackCtx=null,fallbackTargetCtx=null;
    const previousBackground=canvas.style.backgroundImage,previousSize=canvas.style.backgroundSize,previousPosition=canvas.style.backgroundPosition,previousRepeat=canvas.style.backgroundRepeat;
    const query=global.matchMedia?.('(prefers-reduced-motion: reduce)');
    const cancelFrame=()=>{if(raf)cancelAnimationFrame(raf);raf=0;};
    const updateLabel=(moving=false)=>canvas.setAttribute('aria-label',moving?`Dé D${type} en mouvement.`:`Dé D${type} en caoutchouc ${MATERIALS[type]}. Résultat : ${result}.`);
    canvas.setAttribute('role','img');
    function rendererStatus(){canvas.setAttribute('data-renderer',mode);canvas.setAttribute('data-renderer-error',renderError);}
    function contextCreationError(event){contextMessage=String(event.statusMessage||'WebGL context creation failed.');}
    canvas.addEventListener('webglcontextcreationerror',contextCreationError);
    function compile(shaderType,source) {
      const shader=gl.createShader(shaderType);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error((shaderType===gl.VERTEX_SHADER?'Vertex':'Fragment')+' shader: '+String(gl.getShaderInfoLog(shader)||'Compilation failed without driver log.'));return shader;
    }
    function setGeometry() {
      if(mode!=='webgl')return;
      gl.useProgram(program);gl.uniform1i(uniforms.uType,type);
      const f=type===6?CUBE_FACES:POLYS[type].faces,n=new Float32Array(60),t=new Float32Array(60),b=new Float32Array(60);
      for(let i=0;i<f.length;i++){n.set(f[i].n,i*3);t.set(f[i].t,i*3);b.set(f[i].b,i*3);}
      gl.uniform3fv(uniforms.uNormals,n);gl.uniform3fv(uniforms.uTangents,t);gl.uniform3fv(uniforms.uBitangents,b);
      gl.uniform1i(uniforms.uCount,f.length||6);gl.uniform1f(uniforms.uOffset,f[0]?.h||1);gl.uniform3fv(uniforms.uColor,COLORS[type]);
    }
    function initialize() {
      try {
        gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false,powerPreference:'high-performance',preserveDrawingBuffer:false});
        if(!gl){renderError='WebGL context unavailable'+(contextMessage?': '+contextMessage:'.');fallbackTargetCtx=canvas.getContext('2d');rendererStatus();if(typeof options.onError==='function')options.onError(new Error(renderError));return;}
        program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,VERTEX));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(program);
        if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Shader link: '+String(gl.getProgramInfoLog(program)||'Link failed without driver log.'));
        gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
        const attr=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
        for(const name of ['uResolution','uRotation','uPosition','uScale','uColor','uType','uCount','uNormals','uTangents','uBitangents','uOffset','uBound','uAtlas','uValue','uResultLight'])uniforms[name]=gl.getUniformLocation(program,name);
        const atlas=document.createElement('canvas');atlas.width=512;atlas.height=1024;const a=atlas.getContext('2d');
        if(!a)throw new Error('Dice texture canvas unavailable.');
        a.fillStyle='#000';a.fillRect(0,0,512,1024);a.fillStyle='#fff';a.font='500 67px Arial,sans-serif';a.textAlign='center';a.textBaseline='middle';
        for(let i=0;i<20;i++)a.fillText(String(i+1),(i%4+.5)*128,(Math.floor(i/4)+.5)*128+4);
        texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlas);
        gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.uniform1i(uniforms.uAtlas,0);
        mode='webgl';renderError='';rendererStatus();setGeometry();
      } catch(error) {
        mode='fallback';renderError=String(error.message||error).slice(0,1800);rendererStatus();try{if(gl){gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);}}catch(_){}
        if(typeof options.onError==='function')options.onError(error);
      }
    }
    function roundedPoly(ctx,points,radius) {
      ctx.beginPath();
      for(let i=0;i<points.length;i++) {
        const prev=points[(i+points.length-1)%points.length],p=points[i],next=points[(i+1)%points.length];
        const edgeA=Math.hypot(prev[0]-p[0],prev[1]-p[1]),edgeB=Math.hypot(next[0]-p[0],next[1]-p[1]);
        if(edgeA<1.e-6||edgeB<1.e-6)continue;
        const pa=[(prev[0]-p[0])/edgeA,(prev[1]-p[1])/edgeA],pb=[(next[0]-p[0])/edgeB,(next[1]-p[1])/edgeB];
        const cut=Math.min(radius,edgeA*.45,edgeB*.45);
        const a=[p[0]+pa[0]*cut,p[1]+pa[1]*cut],b=[p[0]+pb[0]*cut,p[1]+pb[1]*cut];
        if(!i)ctx.moveTo(...a);else ctx.lineTo(...a);ctx.quadraticCurveTo(p[0],p[1],b[0],b[1]);
      }
      ctx.closePath();
    }
    function drawFallback(q=rotation,sy=1,lift=0,x=0,z=0) {
      if(!fallbackCanvas){fallbackCanvas=document.createElement('canvas');fallbackCanvas.width=480;fallbackCanvas.height=480;fallbackCtx=fallbackCanvas.getContext('2d');}
      const c=fallbackCtx;if(!c)return;
      c.clearRect(0,0,480,480);
      const m=matrix(q),scale=[1/Math.sqrt(sy),sy,1/Math.sqrt(sy)],position=[x,sy*support(type,m)+lift+.002,z];
      const forward=norm([-4.3,.95-6.2,-6.4]),right=norm(cross(forward,[0,1,0])),up=cross(right,forward),view=mul(forward,-1);
      const world=p=>add(transform(m,p).map((v,i)=>v*scale[i]),position);
      const projectWorld=p=>{const d=sub(p,[0,.95,0]);return [240+dot(d,right)*109.0909,240-dot(d,up)*109.0909];};
      const project=p=>projectWorld(world(p));
      const transformedNormal=n=>norm(transform(m,n).map((v,i)=>v/scale[i]));
      const light=norm([-3,6,4]),fill=norm([4,2,-3]);
      const rgb=(factor,blend=0)=>{const b=COLORS[type].map((v,i)=>Math.round(Math.min(255,(v*255*(1-blend)+[235,232,215][i]*blend)*factor)));return 'rgb('+b.join(',')+')';};
      const shadowCenter=projectWorld([x,0,z]);c.save();c.translate(shadowCenter[0]+5,shadowCenter[1]);c.scale(1,.27);
      const shadow=c.createRadialGradient(0,0,8,0,0,105+lift*12);shadow.addColorStop(0,'rgba(0,0,0,'+(.13/(1+lift))+')');shadow.addColorStop(.55,'rgba(0,0,0,.035)');shadow.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=shadow;c.fillRect(-150,-150,300,300);c.restore();
      let faces;
      if(type===6)faces=CUBE_FACES;
      else faces=POLYS[type].faces.map((f,i)=>({...f,value:i+1}));
      const allPoints=faces.flatMap(f=>f.points.map(project));
      const sorted=allPoints.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
      const turn=(a,b,d)=>(b[0]-a[0])*(d[1]-a[1])-(b[1]-a[1])*(d[0]-a[0]);
      const lower=[],upper=[];for(const point of sorted){while(lower.length>=2&&turn(lower[lower.length-2],lower[lower.length-1],point)<=0)lower.pop();lower.push(point);}
      for(const point of sorted.slice().reverse()){while(upper.length>=2&&turn(upper[upper.length-2],upper[upper.length-1],point)<=0)upper.pop();upper.push(point);}lower.pop();upper.pop();const hull=lower.concat(upper);
      if(hull.length<3)return;
      const rounding=type===6?31:type===4?26:14;
      roundedPoly(c,hull,rounding);c.fillStyle=rgb(.79);c.fill();c.save();c.clip();
      const visible=faces.filter(f=>dot(transformedNormal(f.n),view)>.012).map(f=>({...f,center:mul(f.points.reduce((a,b)=>add(a,b),[0,0,0]),1/f.points.length)}));
      visible.sort((a,b)=>dot(world(a.center),view)-dot(world(b.center),view));
      for(const face of visible) {
        const n=transformedNormal(face.n),shade=.58+.40*Math.max(0,dot(n,light))+.15*Math.max(0,dot(n,fill));
        const polygon=face.points.map(project);c.beginPath();c.moveTo(...polygon[0]);for(const p of polygon.slice(1))c.lineTo(...p);c.closePath();
        const bounds=polygon.reduce((a,p)=>[Math.min(a[0],p[0]),Math.min(a[1],p[1]),Math.max(a[2],p[0]),Math.max(a[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]);
        const gradient=c.createLinearGradient(bounds[0],bounds[1],bounds[2],bounds[3]);gradient.addColorStop(0,rgb(Math.min(1.15,shade+.09)));gradient.addColorStop(.58,rgb(shade));gradient.addColorStop(1,rgb(Math.max(.45,shade-.08)));c.fillStyle=gradient;c.fill();c.strokeStyle=rgb(shade);c.lineWidth=1.8;c.lineJoin='round';c.stroke();
      }
      const gleam=c.createRadialGradient(175,135,10,210,210,210);gleam.addColorStop(0,'rgba(255,255,235,.18)');gleam.addColorStop(.48,'rgba(255,255,235,.035)');gleam.addColorStop(1,'rgba(255,255,235,0)');c.fillStyle=gleam;c.fillRect(0,0,480,480);
      const lowerShade=c.createLinearGradient(0,150,0,390);lowerShade.addColorStop(0,'rgba(0,0,0,0)');lowerShade.addColorStop(.7,'rgba(0,0,0,.015)');lowerShade.addColorStop(1,'rgba(0,0,0,.20)');c.fillStyle=lowerShade;c.fillRect(0,0,480,480);
      for(const face of visible) {
        const n=transformedNormal(face.n),shade=.72+.27*Math.max(0,dot(n,light));
        const center=project(face.center),tp=project(add(face.center,face.t)),bp=project(add(face.center,face.b)),size=type===4?.60:type===6?.80:.34;
        c.save();c.transform((tp[0]-center[0])*size/64,(tp[1]-center[1])*size/64,-(bp[0]-center[0])*size/64,-(bp[1]-center[1])*size/64,center[0],center[1]);
        c.fillStyle=rgb(shade,.75);
        if(face.value===result&&resultLight>0) {
          const ink=c.createLinearGradient(-30,-28,30,34),muted=COLORS[type].map((v,i)=>(v*255*.25+[235,232,215][i]*.75)*shade);
          for(const [stop,ivory] of [[0,[247,246,237]],[.34,[250,249,241]],[.43,[255,254,248]],[.57,[250,249,241]],[1,[247,246,237]]])ink.addColorStop(stop,'rgb('+muted.map((v,i)=>Math.round(v+(ivory[i]-v)*resultLight)).join(',')+')');
          c.fillStyle=ink;
        }
        c.font='500 64px Arial,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(String(face.value),0,3);c.restore();
      }
      c.restore();
      roundedPoly(c,hull,rounding);c.save();c.clip();c.lineWidth=1.4;c.strokeStyle='rgba(255,255,235,.11)';c.stroke();c.restore();
      if(fallbackTargetCtx){const side=Math.min(canvas.width,canvas.height);fallbackTargetCtx.clearRect(0,0,canvas.width,canvas.height);fallbackTargetCtx.drawImage(fallbackCanvas,(canvas.width-side)/2,(canvas.height-side)/2,side,side);}else{canvas.style.backgroundImage='url('+fallbackCanvas.toDataURL('image/png')+')';canvas.style.backgroundSize='contain';canvas.style.backgroundRepeat='no-repeat';canvas.style.backgroundPosition='center';}
    }
    function draw(q=rotation,sy=1,lift=0,x=0,z=0) {
      if(!alive)return;lastFrame={q,sy,lift,x,z};
      if(mode!=='webgl'){drawFallback(q,sy,lift,x,z);return;}
      const m=matrix(q),scale=[1/Math.sqrt(sy),sy,1/Math.sqrt(sy)],y=scale[1]*support(type,m)+lift+.002;
      gl.useProgram(program);gl.uniformMatrix3fv(uniforms.uRotation,false,new Float32Array(m));gl.uniform3fv(uniforms.uScale,scale);gl.uniform3f(uniforms.uPosition,x,y,z);gl.uniform1f(uniforms.uBound,2.05*Math.max(...scale));gl.uniform1f(uniforms.uValue,result);gl.uniform1f(uniforms.uResultLight,resultLight);gl.drawArrays(gl.TRIANGLES,0,6);
    }
    function resize() {
      if(!alive)return;
      const w=canvas.clientWidth||300,h=canvas.clientHeight||w,dpr=Math.min(global.devicePixelRatio||1,Number(options.maxPixelRatio)||2);
      const rw=Math.max(1,Math.round(w*dpr)),rh=Math.max(1,Math.round(h*dpr));if(canvas.width!==rw)canvas.width=rw;if(canvas.height!==rh)canvas.height=rh;
      if(mode==='webgl'){gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);gl.uniform2f(uniforms.uResolution,canvas.width,canvas.height);}
      draw(lastFrame.q,lastFrame.sy,lastFrame.lift,lastFrame.x,lastFrame.z);
    }
    function resolvePending() { const resolve=resolveRoll;resolveRoll=null;pending=null;if(resolve)resolve(result); }
    function finish() { cancelFrame();busy=false;pressed=false;pointerId=null;charge=0;rotation=goalQ||rotation;pressScale=1;resultLight=1;draw();updateLabel();resolvePending(); }
    function animate(now) {
      raf=0;if(!alive||!busy)return;
      const ms=(now-rollAt)*2250/activeDuration;let sy=1,lift=0,q=startQ,x=0,z=0;
      if(ms<160){const t=ms/160;sy=pressScale-(pressScale-.82)*smooth(t);}
      else if(ms<1160){const t=(ms-160)/1000,e=smooth(t),wave=Math.pow(Math.sin(Math.PI*t),2);q=qmul(axisQ([.8,.2,-.65],Math.PI*2*spinTurns*(1-e)),slerp(startQ,goalQ,e));lift=(.45+.12*activePower)*4*t*(1-t);x=(.21+.06*activePower)*wave;z=-(.15+.05*activePower)*wave;sy=1-.18*(1-smooth(Math.min(1,t/.16)))+.055*wave;}
      else if(ms<1600){const t=(ms-1160)/440;if(t<.36){sy=1-.19*Math.pow(Math.sin(Math.PI*t/.36),2);}else{const b=(t-.36)/.64,wave=Math.pow(Math.sin(Math.PI*b),2);lift=.14*wave;sy=1+.035*Math.sin(2*Math.PI*b)*wave;}q=qmul(axisQ([.5,0,.8],.12*Math.sin(t*3*Math.PI)*Math.pow(Math.sin(Math.PI*t),2)*Math.exp(-t*3)),goalQ);}
      else if(ms<2250){const t=(ms-1600)/650,wave=Math.pow(Math.sin(Math.PI*t),2);sy=1-.035*Math.sin(t*4*Math.PI)*wave*Math.exp(-t*3);q=qmul(axisQ([.3,0,1],.035*Math.sin(t*3*Math.PI)*wave*Math.exp(-t*3)),goalQ);}
      else{finish();return;}
      resultLight=smooth(Math.max(0,Math.min(1,(ms-1600)/650)));
      draw(q,sy,lift,x,z);raf=requestAnimationFrame(animate);
    }
    function animatePress(now) {
      raf=0;if(!alive||!pressed||busy)return;
      const elapsed=now-pressAt;charge=clampPower(elapsed/1200);pressScale=reduced?1:1-.18*smooth(charge);draw(rotation,pressScale);
      if(elapsed<1200&&!reduced)raf=requestAnimationFrame(animatePress);
    }
    function animateRelease(now) {
      raf=0;if(!alive||pressed||busy)return;
      const t=Math.min(1,(now-settleAt)/270);pressScale=1-(1-settleScale)*Math.exp(-t*6)*Math.cos(t*8)*(1-t);draw(rotation,pressScale);
      if(t<1)raf=requestAnimationFrame(animateRelease);else{pressScale=1;draw();}
    }
    function press(event) {
      if(!alive||busy||pressed||event.button>0||options.interactive===false)return;
      pressed=true;pointerId=event.pointerId;pressPoint=[Number(event.clientX)||0,Number(event.clientY)||0];charge=0;pressAt=performance.now();cancelFrame();
      try{canvas.setPointerCapture(event.pointerId);}catch(_){}
      if(reduced){pressScale=1;draw();}else raf=requestAnimationFrame(animatePress);
      if(typeof options.onPress==='function')options.onPress(event);
    }
    function move(event) {
      if(pressed&&event.pointerId===pointerId&&pressPoint&&Math.hypot((Number(event.clientX)||0)-pressPoint[0],(Number(event.clientY)||0)-pressPoint[1])>10)cancelPress();
    }
    function release(event) {
      if(!pressed||!alive||event.pointerId!==pointerId)return;
      const power=clampPower((performance.now()-pressAt)/1200);pressed=false;pointerId=null;charge=0;cancelFrame();
      if(typeof options.onRelease==='function')options.onRelease(power,event);
      if(busy)return;
      if(reduced){pressScale=1;draw();}else{settleAt=performance.now();settleScale=pressScale;raf=requestAnimationFrame(animateRelease);}
    }
    function cancelPress() {if(!pressed&&!charge)return;pressed=false;pointerId=null;charge=0;cancelFrame();pressScale=1;draw();}
    function setCharge(value) {
      if(!alive||busy)return;
      const next=clampPower(value);cancelFrame();pressed=false;pointerId=null;charge=next;
      if(reduced){pressScale=1;draw();}
      else if(next>0){pressScale=1-.18*smooth(next);draw(rotation,pressScale);}
      else if(pressScale!==1){settleAt=performance.now();settleScale=pressScale;raf=requestAnimationFrame(animateRelease);}
      else draw();
    }
    function setReducedMotion(value){reduced=!!value;manualReduced=true;if(reduced&&busy)finish();else if(reduced&&(pressed||charge||pressScale!==1)){cancelFrame();pressScale=1;draw();}}
    function motionChanged(event){if(!manualReduced){reduced=event.matches;if(reduced&&busy)finish();else if(reduced&&(pressed||charge||pressScale!==1)){cancelFrame();pressScale=1;draw();}}}
    function visibilityChanged(){if(document.hidden&&busy)finish();else if(document.hidden)cancelPress();}
    function contextLost(event){event.preventDefault();mode='fallback';renderError='WebGL context lost.';rendererStatus();if(busy)finish();else{cancelPress();draw();}}
    initialize();
    canvas.addEventListener('pointerdown',press);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',cancelPress);canvas.addEventListener('lostpointercapture',cancelPress);canvas.addEventListener('webglcontextlost',contextLost);
    document.addEventListener('visibilitychange',visibilityChanged);query?.addEventListener?.('change',motionChanged);
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;observer?.observe(canvas);if(!observer)global.addEventListener('resize',resize);
    resize();updateLabel();
    return {
      get mode(){return mode;},get error(){return renderError;},get busy(){return busy;},get value(){return result;},get kind(){return type;},
      setKind(kind,value=1){if(!alive)return;const nextKind=validKind(kind),nextValue=validValue(value,nextKind),changedKind=nextKind!==type,same=!changedKind&&nextValue===result;cancelFrame();pressed=false;pointerId=null;charge=0;busy=false;resultLight=1;resolvePending();if(same){rotation=goalQ||rotation;pressScale=1;draw();updateLabel();return;}type=nextKind;result=nextValue;rotation=changedKind?initialRotation(type,result):targetRotation(type,result);goalQ=rotation;pressScale=1;setGeometry();draw();updateLabel();},
      roll(value,rollOptions={}) {
        if(!alive)return Promise.resolve(result);if(busy)return pending;
        const next=validValue(value,type);cancelFrame();pressed=false;pointerId=null;charge=0;busy=true;resultLight=0;startQ=rotation;result=next;goalQ=targetRotation(type,result,.3+Math.random()*.8);rollAt=performance.now();activePower=clampPower(rollOptions.power);spinTurns=2+Math.round(activePower*3);activeDuration=rollDuration(rollOptions.duration??duration,activePower);updateLabel(true);
        const promise=new Promise(resolve=>{resolveRoll=resolve;});pending=promise;
        if(reduced){finish();}else raf=requestAnimationFrame(animate);return promise;
      },
      setReducedMotion,setCharge,
      destroy(){if(!alive)return;cancelFrame();alive=false;busy=false;pressed=false;resolvePending();observer?.disconnect();if(!observer)global.removeEventListener('resize',resize);query?.removeEventListener?.('change',motionChanged);document.removeEventListener('visibilitychange',visibilityChanged);canvas.removeEventListener('pointerdown',press);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',release);canvas.removeEventListener('pointercancel',cancelPress);canvas.removeEventListener('lostpointercapture',cancelPress);canvas.removeEventListener('webglcontextlost',contextLost);canvas.removeEventListener('webglcontextcreationerror',contextCreationError);try{if(gl){if(texture)gl.deleteTexture(texture);if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);for(const shader of shaders)gl.deleteShader(shader);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);}}catch(_){}canvas.style.backgroundImage=previousBackground;canvas.style.backgroundSize=previousSize;canvas.style.backgroundPosition=previousPosition;canvas.style.backgroundRepeat=previousRepeat;}
    };
  }
  global.OndeDice=Object.freeze({create});
})(window);
