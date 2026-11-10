/* ONDE — self-contained organic dice renderer. No network dependencies. */
(function (global) {
  'use strict';
  const CAMERA_EYE=[4.3,6.2,6.4],CAMERA_TARGET=[0,.95,0],CAMERA_SPAN=4.4;
  const VERTEX = `attribute vec2 aPosition;void main(){gl_Position=vec4(aPosition,0.,1.);}`;
  const FRAGMENT = `
precision highp float;
uniform vec2 uResolution;
uniform mat3 uRotation;
uniform vec3 uPosition,uScale,uColor,uRimColor;
uniform int uType,uCount;
uniform vec3 uNormals[20],uTangents[20],uBitangents[20];
uniform float uOffset,uBound,uValue,uResultLight;
uniform vec2 uIconScale;
uniform float uAtlasRows;
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
// The padded, black cell edge keeps adjacent numerals out of both ink and bump samples.
float stamp(vec2 uv,float idx){vec2 cell=vec2(mod(idx,4.),floor(idx/4.));vec2 inset=clamp(uv,vec2(.035),vec2(.965));return texture2D(uAtlas,(cell+vec2(inset.x,1.-inset.y))/vec2(4.,uAtlasRows)).r;}
float grain(vec3 p){return sin(p.x*71.)*sin(p.y*59.+sin(p.z*43.))*sin(p.z*67.+p.x*13.);}
void main(){
 vec2 uv=(gl_FragCoord.xy/uResolution-.5)*vec2(uResolution.x/uResolution.y,1.);
 vec3 eye=vec3(${CAMERA_EYE}),target=vec3(${CAMERA_TARGET});vec3 f=normalize(target-eye),right=normalize(cross(f,vec3(0.,1.,0.))),up=cross(right,f);
 vec3 ro=eye+right*uv.x*${CAMERA_SPAN}+up*uv.y*${CAMERA_SPAN},rd=f;
 float floorT=-ro.y/rd.y;vec3 floorP=ro+rd*floorT;
 float h=max(0.,uPosition.y-.70);vec2 shadowP=floorP.xz-uPosition.xz-vec2(.18,-.13)*h;
 // A restrained contact shadow grounds the object without a dark platform.
 float spread=.48+h*.18;float shadow=exp(-dot(shadowP/vec2(spread*1.4,spread),shadowP/vec2(spread*1.4,spread)))*(.20/(1.+h*.6));
 float contact=exp(-dot((floorP.xz-uPosition.xz)/vec2(.52,.42),(floorP.xz-uPosition.xz)/vec2(.52,.42)))*.12/(1.+h*3.);
 float outputAlpha=min(.32,shadow+contact);vec3 color=vec3(.014,.018,.014);
 vec3 oc=ro-uPosition;float b=dot(oc,rd),c=dot(oc,oc)-uBound*uBound,disc=b*b-c;
 if(disc>0.){
  float t=max(0.,-b-sqrt(disc)),end=min(floorT,-b+sqrt(disc));bool hit=false;
  float best=1.e4,bestT=t,previous=1.e4,pixel=${CAMERA_SPAN}/uResolution.y;
  // A pixel-sized coverage fringe replaces a binary silhouette. It also keeps
  // grazing rays visible instead of switching whole pixels on and off.
  for(int j=0;j<112;j++){if(t>end)break;float d=body(ro+rd*t);if(d<best){best=d;bestT=t;}if(d<.0008){hit=true;break;}if(d>previous&&best<pixel*1.4)break;previous=d;t+=max(.0005,d*.92);}
  if(hit||best<pixel*1.4){
   if(!hit)t=bestT;
   vec3 p=ro+rd*t,lp=localPoint(p),gradient=worldGradient(lp),n=normalize(gradient),v=-rd;float mark=0.;
   float coverage=hit?1.:1.-smoothstep(0.,pixel*.95,best/max(length(gradient),.15));
   float shadowAlpha=outputAlpha;vec3 shadowColor=color;
   float md=-1.e10,idx=0.;vec3 tn=vec3(1.,0.,0.),bn=vec3(0.,1.,0.);for(int j=0;j<20;j++){if(j<uCount){float z=dot(lp,uNormals[j]);if(z>md){md=z;idx=float(j);tn=uTangents[j];bn=uBitangents[j];}}}
   float numberScale=uType==4?.95:(uType==6?.68:(uType==8?.90:1.78));
   bool hasIcons=uIconScale.x>0.;
   bool darkSlate=uType==4&&hasIcons;
   bool engravedCardDie=(uType==6||uType==8)&&hasIcons;
   bool darkDie=darkSlate||engravedCardDie;
   vec2 labelScale=hasIcons?uIconScale:vec2(numberScale);
   vec2 tex=vec2(dot(lp,tn),dot(lp,bn))*labelScale+.5;
   // Minute chips alter the outline in die space, so they stay put as a face rolls.
   if(hasIcons)tex+=vec2(grain(lp*4.1),grain(lp.zxy*4.1))*(darkSlate?.0012:.0024);
   mark=stamp(tex,idx);float eps=hasIcons?.006:.012;
   vec2 grad=vec2(stamp(tex+vec2(eps,0.),idx)-stamp(tex-vec2(eps,0.),idx),stamp(tex+vec2(0.,eps),idx)-stamp(tex-vec2(0.,eps),idx));
   float resultFace=1.-step(.5,abs(idx-(uValue-1.)));
   if(hasIcons){
    float chip=smoothstep(.28,.68,grain(lp.yzx*3.2));
    float faceFade=1.-.68*uResultLight*(1.-resultFace);
    float edgeWear=smoothstep(.08,.65,length(grad));
    mark*=faceFade*(1.-chip*(darkSlate?.18*edgeWear:.08+.28*edgeWear));
    grad*=faceFade*(1.-chip*(darkSlate?.22:.32));
   }
   vec3 ridge=(uRotation*tn*grad.x+uRotation*bn*grad.y)/uScale;
   n=normalize(n-ridge*(darkSlate?.038:(hasIcons?.052:.032)));
   float g=grain(lp);n=normalize(n+vec3(g,grain(lp.yzx),grain(lp.zxy))*.004);
   // Pictograms are recessed pigment under the same light and grain as the face.
   float stampContrast=.58;
   vec3 stampTone=vec3(.86,.85,.78);
   if(hasIcons){
    stampTone=vec3(.77,.79,.82);
    float patina=darkSlate?g*.07:g*.14+grain(lp*1.67)*.13;
    stampContrast=mix(darkSlate?.39:.34,(darkSlate?.20:.18)+(darkSlate?.48:.42)*resultFace,uResultLight)*(1.+patina);
   }
   vec3 base=pow(uColor,vec3(2.2));vec3 stampColor=pow(mix(uColor,stampTone,stampContrast),vec3(2.2));base=mix(base,stampColor,mark*.86);
   vec3 light=normalize(vec3(-3.,6.,4.)),fill=normalize(vec3(4.,2.,-3.));float diffuse=max(dot(n,light),0.),fillD=max(dot(n,fill),0.);
   float ambient=.27+.17*(n.y*.5+.5);color=base*(ambient+diffuse*1.15+fillD*.25);
   vec3 halfV=normalize(light+v);float spec=pow(max(dot(n,halfV),0.),darkDie?30.:20.)*(darkDie?.075:.11)+pow(max(dot(n,halfV),0.),64.)*.008;
   vec3 rimHalf=normalize(fill+v);float rimSpec=pow(max(dot(n,rimHalf),0.),35.)*.12;
   vec3 mineralHue=(uRimColor-vec3(.32,.21,.46))*.6;
   vec3 specColor=engravedCardDie?vec3(.43,.38,.54)+mineralHue:vec3(.79,.90,1.);
   color+=(specColor*spec+uRimColor*rimSpec)*(1.-mark*.55);
   float fresnel=pow(1.-max(dot(n,v),0.),4.);
   color+=(engravedCardDie?vec3(.32,.18,.42)+mineralHue:vec3(.24,.37,.55))*fresnel*(darkDie?.073:.10);
   color*=.93+.07*smoothstep(.0,.48,p.y);color*=1.+g*(darkDie?.018:.004);
   if(engravedCardDie){
    // A dark reflection follows the right flank as its normal turns into view.
    float flank=smoothstep(.16,.76,dot(n,right));
    float reflectedSide=dot(reflect(-v,n),right);
    float band=1.-smoothstep(.12,.54,abs(reflectedSide-.58));
    color*=1.-.57*flank*(.35+.65*band)*(1.-mark*.42);
   }
   if(hasIcons){
    float litEdge=-dot(ridge,light);
    color*=1.-min(.32,max(-litEdge,0.)*(darkSlate?.39:.54));
    color+=vec3(.67,.71,.77)*(darkSlate?.055:.046)*max(litEdge,0.);
    // One reflection crosses the selected glyph during the existing settling phase.
    float sweep=mix(.21,.80,uResultLight);
    float band=1.-smoothstep(.008,.052,abs(tex.x+.26*(tex.y-.5)-sweep));
    float envelope=4.*uResultLight*(1.-uResultLight);
    color+=vec3(.75,.71,.85)*(darkSlate?.092:.055)*mark*resultFace*band*envelope;
   }else{
    // A muted, worn ivory preserves the legibility of the numeric result.
    float inkSpec=pow(max(dot(n,halfV),0.),24.)*.035;
    vec3 resultInk=pow(vec3(.95,.93,.88),vec3(2.2))*(.88+.12*diffuse)+vec3(1.,.97,.92)*inkSpec;
    color=mix(color,resultInk,mark*resultFace*uResultLight*(.84+g*.045+grain(lp*1.7)*.045));
   }
   outputAlpha=coverage+shadowAlpha*(1.-coverage);
   color=(color*coverage+shadowColor*shadowAlpha*(1.-coverage))/max(outputAlpha,.0001);
  }
 }
 color=pow(max(color,vec3(0.)),vec3(1./2.2));
 float dith=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5)/255.;
 // Premultiply RGB explicitly, including fully transparent pixels, for reliable mobile compositing.
 gl_FragColor=vec4((color+dith)*outputAlpha,outputAlpha);
}`;
  const add = (a,b) => a.map((x,i) => x+b[i]);
  const sub = (a,b) => a.map((x,i) => x-b[i]);
  const mul = (a,s) => a.map(x => x*s);
  const dot = (a,b) => a.reduce((s,x,i) => s+x*b[i],0);
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const norm = a => mul(a,1/Math.hypot(...a));
  const CAMERA_VIEW=norm(sub(CAMERA_EYE,CAMERA_TARGET)),CAMERA_RIGHT=norm(cross([0,1,0],CAMERA_VIEW)),CAMERA_UP=cross(CAMERA_VIEW,CAMERA_RIGHT);
  function cameraOffset(point) {
    const relative=sub(point,CAMERA_TARGET);
    return [dot(relative,CAMERA_RIGHT)/CAMERA_SPAN,-dot(relative,CAMERA_UP)/CAMERA_SPAN];
  }
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
    const vertices={
      4:[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]],
      8:[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]],
      20:[[-1,phi,0],[1,phi,0],[-1,-phi,0],[1,-phi,0],[0,-1,phi],[0,1,phi],[0,-1,-phi],[0,1,-phi],[phi,0,-1],[phi,0,1],[-phi,0,-1],[-phi,0,1]],
    };
    const radius={4:1.75,8:1.58,20:1.48}[type],vs=vertices[type].map(v=>mul(norm(v),radius));
    const edge=type===8?Math.SQRT2*radius:Math.hypot(...sub(vs[0],vs[1])),faces=[];
    for(let i=0;i<vs.length;i++)for(let j=i+1;j<vs.length;j++)for(let k=j+1;k<vs.length;k++) {
      const a=vs[i],b=vs[j],c=vs[k];
      if(type!==4&&[sub(a,b),sub(a,c),sub(b,c)].some(v=>Math.abs(Math.hypot(...v)-edge)>.0001))continue;
      const center=mul(add(add(a,b),c),1/3);let n=norm(cross(sub(b,a),sub(c,a)));if(dot(n,center)<0)n=mul(n,-1);
      // Aim the top of every D8 numeral at a vertex so all results share the hexagonal profile.
      const up=type===8&&n[1]<0?[0,-1,0]:Math.abs(n[1])>.9?[0,0,1]:[0,1,0];
      const t=norm(cross(up,n));faces.push({n,t,b:cross(n,t),h:dot(n,a),points:[a,b,c]});
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
  const POLYS={4:makePoly(4),8:makePoly(8),20:makePoly(20)};
  const CUBE_NORMALS=[[0,1,0],[0,0,1],[1,0,0],[-1,0,0],[0,0,-1],[0,-1,0]];
  // One right-handed face basis is shared by WebGL, fallback and result poses.
  const CUBE_TANGENTS=[[1,0,0],[1,0,0],[0,0,-1],[0,0,1],[-1,0,0],[1,0,0]];
  const CUBE_FACES=CUBE_NORMALS.map((n,i)=>{const t=CUBE_TANGENTS[i],b=cross(n,t);return {n,t,b,h:1,value:i+1,points:[[-1,-1],[1,-1],[1,1],[-1,1]].map(p=>add(n,add(mul(t,p[0]),mul(b,p[1]))))};});

  const COLORS={4:[.34,.44,.58],6:[.45,.43,.58],8:[.37,.48,.61],20:[.7608,.6471,.4706]};
  const DARK_SLATE=[.19,.25,.36],DARK_MAUVE=[.165,.11,.235];
  const DEFAULT_RIM=[.82,.66,1.],MAUVE_RIM=[.32,.21,.46];
  const MATERIALS={4:'ardoise',6:'sauge',8:'bleu minéral',20:'sable'};
  const ICON_SCALE={4:[.59,.59],6:[.55,.60],8:[.71,.54],20:[1.03,1.15]};
  /*!
   * Lucide and Lucide Lab icon geometry, adapted to the die's engraved strokes.
   * https://lucide.dev/license
   * https://github.com/lucide-icons/lucide/tree/main/icons
   * https://github.com/lucide-icons/lucide-lab/blob/main/LICENSE
   *
   * ISC License
   *
   * Copyright (c) 2026 Lucide Icons and Contributors
   *
   * Permission to use, copy, modify, and/or distribute this software for any
   * purpose with or without fee is hereby granted, provided that the above
   * copyright notice and this permission notice appear in all copies.
   *
   * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
   * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
   * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
   * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
   * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
   * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
   * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
   *
   * Lucide Lab (Bottle Dispenser, Dress and Trousers)
   * ISC License
   *
   * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
   *
   * Permission to use, copy, modify, and/or distribute this software for any
   * purpose with or without fee is hereby granted, provided that the above
   * copyright notice and this permission notice appear in all copies.
   *
   * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
   * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
   * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
   * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
   * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
   * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
   * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
   *
   * The MIT License (MIT) (includes icons derived from Feather)
   *
   * Copyright (c) 2013-present Cole Bemis
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in all
   * copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   * SOFTWARE.
   */
  // SVG circle and rectangle outlines are expressed as paths for the canvas atlas.
  const ICON_PATHS={
    heart:`M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5`,
    coins:`M13.744 17.736a6 6 0 1 1-7.48-7.48
      M15 6h1v4
      M0 0m6.134 14.768.866-.5 2 3.464
      M22 8a6 6 0 1 0 -12 0a6 6 0 1 0 12 0Z`,
    tent:`M3.5 21 14 3
      M20.5 21 10 3
      M15.5 21 12 15l-3.5 6
      M2 21h20`,
    flame:`M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4`,
    note:`M21 9a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z
      M15 3v5a1 1 0 0 0 1 1h5`, // sticky-note
    camera:`M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z
      M15 13a3 3 0 1 0 -6 0a3 3 0 1 0 6 0Z`,
    massage:`M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2
      M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2
      M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8
      M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15`, // hand
    polish:`M19 5.5a0.5 0.5 0 1 0 -1 0a0.5 0.5 0 1 0 1 0Z
      M20 10h.01
      M9 2h7
      M11 2v4
      M10 6H12a1 1 0 0 1 1 1V9a1 1 0 0 1 -1 1H10a1 1 0 0 1 -1 -1V7a1 1 0 0 1 1 -1Z
      M9 10c-1.7 0-3 1.3-3 3v7a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-7c0-1.7-1.3-3-3-3Z
      M6 14.5a6 6 0 0 1 5 0s2 1.25 5 0`, // bottle-dispenser
    moon:`M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401`,
    'phone-off':`m2 8 2 2-2 2 2 2-2 2
      M0 0m22 8-2 2 2 2-2 2 2 2
      M8 8v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2
      M16 10.34V6c0-.55-.45-1-1-1h-4.34
      M2 2L22 22`, // vibrate-off
    kiss:`M19.414 14.414C21 12.828 22 11.5 22 9.5a5.5 5.5 0 0 0-9.591-3.676.6.6 0 0 1-.818.001A5.5 5.5 0 0 0 2 9.5c0 2.3 1.5 4 3 5.5l5.535 5.362a2 2 0 0 0 2.879.052 2.12 2.12 0 0 0-.004-3 2.124 2.124 0 1 0 3-3 2.124 2.124 0 0 0 3.004 0 2 2 0 0 0 0-2.828l-1.881-1.882a2.41 2.41 0 0 0-3.409 0l-1.71 1.71a2 2 0 0 1-2.828 0 2 2 0 0 1 0-2.828l2.823-2.762`, // heart-handshake
    help:`M22 12a10 10 0 1 0 -20 0a10 10 0 1 0 20 0Z
      M0 0m4.93 4.93 4.24 4.24
      M0 0m14.83 9.17 4.24-4.24
      M0 0m14.83 14.83 4.24 4.24
      M0 0m9.17 14.83-4.24 4.24
      M16 12a4 4 0 1 0 -8 0a4 4 0 1 0 8 0Z`, // life-buoy
    shirt:`M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z`,
    'book-open':`M12 5v16
      M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z`,
    sandwich:`M0 0m2.37 11.223 8.372-6.777a2 2 0 0 1 2.516 0l8.371 6.777
      M21 15a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-5.25
      M3 15a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h9
      M0 0m6.67 15 6.13 4.6a2 2 0 0 0 2.8-.4l3.15-4.2
      M3 11h18a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-18a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1Z`,
    utensils:`M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2
      M7 2v20
      M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7`,
    cookie:`M11 17h.01
      M11.496 2c.324-.016.558.292.529.615a4 4 0 004.235 4.368.713.713 0 01.758.757 4 4 0 004.366 4.237c.323-.03.63.204.614.527a10 10 0 01-2.915 6.566A1 1 0 114.93 4.918 10 10 0 0111.496 2
      M12 12h.01
      M16 16h.01
      M16 3h.01
      M21 4h.01
      M21 8h.01
      M7 14h.01
      M9 8h.01`,
    coffee:`M10 2v2
      M14 2v2
      M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1
      M6 2v2`,
    'shopping-basket':`M0 0m15 11-1 9
      M0 0m19 11-4-7
      M2 11h20
      M0 0m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4
      M4.5 15.5h15
      M0 0m5 11 4-7
      M0 0m9 11 1 9`,
    gift:`M12 7v14
      M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8
      M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5
      M4 7h16a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1Z`,
    footprints:`M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z
      M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z
      M16 17h4
      M4 13h4`,
    palette:`M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z
      M14 6.5a0.5 0.5 0 1 0 -1 0a0.5 0.5 0 1 0 1 0Z
      M18 10.5a0.5 0.5 0 1 0 -1 0a0.5 0.5 0 1 0 1 0Z
      M7 12.5a0.5 0.5 0 1 0 -1 0a0.5 0.5 0 1 0 1 0Z
      M9 7.5a0.5 0.5 0 1 0 -1 0a0.5 0.5 0 1 0 1 0Z`,
    map:`M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z
      M15 5.764v15
      M9 3.236v15`,
    armchair:`M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3
      M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z
      M5 18v2
      M19 18v2`,
    archive:`M3 3h18a1 1 0 0 1 1 1v3a1 1 0 0 1 -1 1h-18a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1Z
      M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8
      M10 12h4`,
    compass:`M22 12a10 10 0 1 0 -20 0a10 10 0 1 0 20 0Z
      M0 0m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z`,
    telescope:`M0 0m10.065 12.493-6.18 1.318a.934.934 0 0 1-1.108-.702l-.537-2.15a1.07 1.07 0 0 1 .691-1.265l13.504-4.44
      M0 0m13.56 11.747 4.332-.924
      M0 0m16 21-3.105-6.21
      M16.485 5.94a2 2 0 0 1 1.455-2.425l1.09-.272a1 1 0 0 1 1.212.727l1.515 6.06a1 1 0 0 1-.727 1.213l-1.09.272a2 2 0 0 1-2.425-1.455z
      M0 0m6.158 8.633 1.114 4.456
      M0 0m8 21 3.105-6.21
      M14 13a2 2 0 1 0 -4 0a2 2 0 1 0 4 0Z`,
    speech:`M8.8 20v-4.1l1.9.2a2.3 2.3 0 0 0 2.164-2.1V8.3A5.37 5.37 0 0 0 2 8.25c0 2.8.656 3.054 1 4.55a5.77 5.77 0 0 1 .029 2.758L2 20
      M19.8 17.8a7.5 7.5 0 0 0 .003-10.603
      M17 15a3.5 3.5 0 0 0-.025-4.975`,
    zap:`M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z`,
    vibrate:`M0 0m2 8 2 2-2 2 2 2-2 2
      M0 0m22 8-2 2 2 2-2 2 2 2
      M9 5h6a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1v-12a1 1 0 0 1 1 -1Z`,
    aperture:`M22 12a10 10 0 1 0 -20 0a10 10 0 1 0 20 0Z
      M0 0m14.31 8 5.74 9.94
      M9.69 8h11.48
      M0 0m7.38 12 5.74-9.94
      M9.69 16 3.95 6.06
      M14.31 16H2.83
      M0 0m16.62 12-5.74 9.94`,
    webcam:`M20 10a8 8 0 1 0 -16 0a8 8 0 1 0 16 0Z
      M15 10a3 3 0 1 0 -6 0a3 3 0 1 0 6 0Z
      M7 22h10
      M12 22v-4`,
    'image-up':`M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6 21
      M0 0m14 19.5 3-3 3 3
      M17 22v-5.5
      M11 9a2 2 0 1 0 -4 0a2 2 0 1 0 4 0Z`,
    link:`M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71
      M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71`,
    target:`M22 12a10 10 0 1 0 -20 0a10 10 0 1 0 20 0Z
      M18 12a6 6 0 1 0 -12 0a6 6 0 1 0 12 0Z
      M14 12a2 2 0 1 0 -4 0a2 2 0 1 0 4 0Z`,
    // Lucide symbols for variants from earlier decks.
    circle:'M22 12a10 10 0 1 0-20 0a10 10 0 1 0 20 0Z',
    triangle:'M13.73 4a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z',
    square:'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z',
    diamond:'M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z',
    pentagon:'M10.83 2.38a2 2 0 0 1 2.34 0l8 5.74a2 2 0 0 1 .73 2.25l-3.04 9.26a2 2 0 0 1-1.9 1.37H7.04a2 2 0 0 1-1.9-1.37L2.1 10.37a2 2 0 0 1 .73-2.25z',
    hexagon:'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
    // Lucide symbols for the variant dice.
    'arrow-down-to-dot':`M12 2v14
      M0 0m19 9-7 7-7-7
      M13 21a1 1 0 1 0 -2 0a1 1 0 1 0 2 0Z`,
    'arrow-down-to-line':`M12 17V3
      M0 0m6 11 6 6 6-6
      M19 21H5`,
    'baby':`M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5
      M15 12h.01
      M19.38 6.813A9 9 0 0 1 20.8 10.2a2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1
      M9 12h.01`,
    'badge-euro':`M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z
      M7 12h5
      M15 9.4a4 4 0 1 0 0 5.2`,
    'banknote':`M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-8a2 2 0 0 1 2 -2Z
      M14 12a2 2 0 1 0 -4 0a2 2 0 1 0 4 0Z
      M6 12h.01M18 12h.01`,
    'bed':`M2 4v16
      M2 8h18a2 2 0 0 1 2 2v10
      M2 17h20
      M6 8v9`,
    'bed-double':`M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8
      M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4
      M12 4v6
      M2 18h20`,
    'bell-off':`M10.268 21a2 2 0 0 0 3.464 0
      M17 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8a6 6 0 0 1 .258-1.742
      M0 0m2 2 20 20
      M8.668 3.01A6 6 0 0 1 18 8c0 2.687.77 4.653 1.707 6.05`,
    'biceps-flexed':`M12.409 13.017A5 5 0 0 1 22 15c0 3.866-4 7-9 7-4.077 0-8.153-.82-10.371-2.462-.426-.316-.631-.832-.62-1.362C2.118 12.723 2.627 2 10 2a3 3 0 0 1 3 3 2 2 0 0 1-2 2c-1.105 0-1.64-.444-2-1
      M15 14a5 5 0 0 0-7.584 2
      M9.964 6.825C8.019 7.977 9.5 13 8 15`,
    'bone':`M17 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 1 0 0-5 .5.5 0 0 1-.5-.5 2.5 2.5 0 1 0-5 0c0 .81.7 1.8 0 2.5l-7 7c-.7.7-1.69 0-2.5 0a2.5 2.5 0 0 0 0 5c.28 0 .5.22.5.5a2.5 2.5 0 1 0 5 0c0-.81-.7-1.8 0-2.5Z`,
    'book':`M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20`,
    'book-image':`M0 0m20 13.7-2.1-2.1a2 2 0 0 0-2.8 0L9.7 17
      M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20
      M12 8a2 2 0 1 0 -4 0a2 2 0 1 0 4 0Z`,
    'brain':`M12 18V5
      M15 13a4.17 4.17 0 01-3-4 4.17 4.17 0 01-3 4
      M17.707 6.294A3 3 0 1012 5a3 3 0 10-5.707 1.294
      M17.996 5.125a4 4 0 012.526 5.77
      M18 18a4 4 0 002-7.465
      M19.967 17.482a4 4 0 11-7.967.517 4 4 0 11-7.967-.517
      M6 18a4 4 0 01-2-7.465
      M6.004 5.125a4 4 0 00-2.526 5.77`,
    'brush-cleaning':`M0 0m16 22-1-4
      M19 14a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2h-3a1 1 0 0 1-1-1V4a2 2 0 0 0-4 0v5a1 1 0 0 1-1 1H6a2 2 0 0 0-2 2v1a1 1 0 0 0 1 1
      M19 14H5l-1.973 6.767A1 1 0 0 0 4 22h16a1 1 0 0 0 .973-1.233z
      M0 0m8 22 1-4`,
    'building-complex':`M10 12h4
      M10 8h4
      M14 21v-3a2 2 0 0 0-4 0v3
      M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2
      M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16`,
    'cake':`M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8
      M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1
      M2 21h20
      M7 8v3
      M12 8v3
      M17 8v3
      M7 4h.01
      M12 4h.01
      M17 4h.01`,
    'cake-slice':`M16 13H3
      M16 17H3
      M0 0m7.2 7.9-3.388 2.5A2 2 0 0 0 3 12.01V20a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-8.654c0-2-2.44-6.026-6.44-8.026a1 1 0 0 0-1.082.057L10.4 5.6
      M11 7a2 2 0 1 0 -4 0a2 2 0 1 0 4 0Z`,
    'calendar-clock':`M16 14v2.2l1.6 1
      M16 2v3
      M21 7.338V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h2.338
      M3 9h5.859
      M8 2v3
      M22 16a6 6 0 1 0 -12 0a6 6 0 1 0 12 0Z`,
    'calendar-days':`M8 2v3
      M16 2v3
      M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2Z
      M3 9h18
      M8 13h.01
      M12 13h.01
      M16 13h.01
      M8 17h.01
      M12 17h.01
      M16 17h.01`,
    'car-front':`M0 0m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8
      M7 14h.01
      M17 14h.01
      M5 10h14a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-4a2 2 0 0 1 2 -2Z
      M5 18v2
      M19 18v2`,
    'cherry':`M2 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z
      M12 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z
      M7 14c3.22-2.91 4.29-8.75 5-12 1.66 2.38 4.94 9 5 12
      M22 9c-4.29 0-7.14-2.33-10-7 5.71 0 10 4.67 10 7Z`,
    'chevron-up':`M0 0m18 15-6-6-6 6`,
    'circle-dot':`M13 12a1 1 0 1 0 -2 0a1 1 0 1 0 2 0Z
      M22 12a10 10 0 1 0 -20 0a10 10 0 1 0 20 0Z`,
    'clapperboard':`M0 0m12.296 3.464 3.02 3.956
      M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3z
      M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z
      M0 0m6.18 5.276 3.1 3.899`,
    'cloud':`M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z`,
    'club':`M17.28 9.05a5.5 5.5 0 1 0-10.56 0A5.5 5.5 0 1 0 12 17.66a5.5 5.5 0 1 0 5.28-8.6Z
      M12 17.66L12 22`,
    'contact-round':`M16 2v2
      M17.915 21a6 6 0 10-12 0
      M8 2v2
      M16 11a4 4 0 1 0 -8 0a4 4 0 1 0 8 0Z
      M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2Z`,
    'contrast':`M22 12a10 10 0 1 0 -20 0a10 10 0 1 0 20 0Z
      M12 18a6 6 0 0 0 0-12v12z`,
    'copy':`M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2Z
      M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2`,
    'croissant':`M10.2 18H4.774a1.5 1.5 0 0 1-1.352-.97 11 11 0 0 1 .132-6.487
      M18 10.2V4.774a1.5 1.5 0 0 0-.97-1.352 11 11 0 0 0-6.486.132
      M18 5a4 3 0 0 1 4 3 2 2 0 0 1-2 2 10 10 0 0 0-5.139 1.42
      M5 18a3 4 0 0 0 3 4 2 2 0 0 0 2-2 10 10 0 0 1 1.42-5.14
      M8.709 2.554a10 10 0 0 0-6.155 6.155 1.5 1.5 0 0 0 .676 1.626l9.807 5.42a2 2 0 0 0 2.718-2.718l-5.42-9.807a1.5 1.5 0 0 0-1.626-.676`,
    'crown':`M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z
      M5 21h14`,
    'cup-soda':`M0 0m6 8 1.75 12.28a2 2 0 0 0 2 1.72h4.54a2 2 0 0 0 2-1.72L18 8
      M5 8h14
      M7 15a6.47 6.47 0 0 1 5 0 6.47 6.47 0 0 0 5 0
      M0 0m12 8 1-6h2`,
    'dice-1':`M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2Z
      M12 12h.01`,
    'dice-2':`M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2Z
      M15 9h.01
      M9 15h.01`,
    'dice-3':`M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2Z
      M16 8h.01
      M12 12h.01
      M8 16h.01`,
    'dice-4':`M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2Z
      M16 8h.01
      M8 8h.01
      M8 16h.01
      M16 16h.01`,
    'dice-5':`M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2Z
      M16 8h.01
      M8 8h.01
      M8 16h.01
      M16 16h.01
      M12 12h.01`,
    'dice-6':`M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2Z
      M16 8h.01
      M16 12h.01
      M16 16h.01
      M8 8h.01
      M8 12h.01
      M8 16h.01`,
    'dress':`M16 2v3a5.14 5.14 0 0 1 .7 4.8l-.2.5a7.64 7.64 0 0 0 .4 6.3C17.7 17.9 19 20 19 20s-3.1 2-7 2-7-2-7-2 1.3-2.1 2.1-3.5a7.64 7.64 0 0 0 .4-6.2l-.2-.5A5.66 5.66 0 0 1 8 5V2
      M16 5c-1.8 0-3.3 1-4 2.5C11.3 6 9.8 5 8 5`,
    'droplet':`M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z`,
    'droplets':`M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z
      M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97`,
    'drumstick':`M15.4 15.63a7.875 6 135 1 1 6.23-6.23 4.5 3.43 135 0 0-6.23 6.23
      M0 0m8.29 12.71-2.6 2.6a2.5 2.5 0 1 0-1.65 4.65A2.5 2.5 0 1 0 8.7 18.3l2.59-2.59`,
    'ear':`M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0
      M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4`,
    'eclipse':`M22 12a10 10 0 1 0 -20 0a10 10 0 1 0 20 0Z
      M12 2a7 7 0 1 0 10 10`,
    'face-grinning':`M15 10V9
      M7.084 14.302a5.12 5.12 0 009.833 0 .24.24 0 00-.235-.302H7.32a.24.24 0 00-.235.302
      M9 10V9
      M22 12a10 10 0 1 0 -20 0a10 10 0 1 0 20 0Z`,
    'face-slightly-smiling':`M15 10V9
      M16.472 15a6 6 0 01-8.943 0
      M9 10V9
      M22 12a10 10 0 1 0 -20 0a10 10 0 1 0 20 0Z`,
    'factory':`M12 16h.01
      M16 16h.01
      M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a.5.5 0 0 0-.769-.422l-4.462 2.844A.5.5 0 0 1 15 10.5v-2a.5.5 0 0 0-.769-.422L9.77 10.922A.5.5 0 0 1 9 10.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z
      M8 16h.01`,
    'files':`M15 2h-4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8
      M16.706 2.706A2.4 2.4 0 0 0 15 2v5a1 1 0 0 0 1 1h5a2.4 2.4 0 0 0-.706-1.706z
      M5 7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 1.732-1`,
    'fingerprint-pattern':`M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4
      M14 13.12c0 2.38 0 6.38-1 8.88
      M17.29 21.02c.12-.6.43-2.3.5-3.02
      M2 12a10 10 0 0 1 18-6
      M2 16h.01
      M21.8 16c.2-2 .131-5.354 0-6
      M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2
      M8.65 22c.21-.66.45-1.32.57-2
      M9 6.8a6 6 0 0 1 9 5.2v2`,
    'fish':`M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z
      M18 12v.5
      M16 17.93a9.77 9.77 0 0 1 0-11.86
      M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33
      M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4
      M0 0m16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H9.5a5.96 5.96 0 0 0 1.49-3.98`,
    'flower-2':`M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1
      M14 8a2 2 0 1 0 -4 0a2 2 0 1 0 4 0Z
      M12 10v12
      M12 22c4.2 0 7-1.667 7-5-4.2 0-7 1.667-7 5Z
      M12 22c-4.2 0-7-1.667-7-5 4.2 0 7 1.667 7 5Z`,
    'frame':`M22 6L2 6
      M22 18L2 18
      M6 2L6 22
      M18 2L18 22`,
    'gamepad-2':`M6 11L10 11
      M8 9L8 13
      M15 12L15.01 12
      M18 10L18.01 10
      M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z`,
    'gem':`M10.5 3 8 9l4 13 4-13-2.5-6
      M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z
      M2 9h20`,
    'git-merge':`M21 18a3 3 0 1 0 -6 0a3 3 0 1 0 6 0Z
      M9 6a3 3 0 1 0 -6 0a3 3 0 1 0 6 0Z
      M6 21V9a9 9 0 0 0 9 9`,
    'globe':`M22 12a10 10 0 1 0 -20 0a10 10 0 1 0 20 0Z
      M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20
      M2 12h20`,
    'grid-3x3':`M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2Z
      M3 9h18
      M3 15h18
      M9 3v18
      M15 3v18`,
    'hamburger':`M12 16H4a2 2 0 1 1 0-4h16a2 2 0 1 1 0 4h-4.25
      M5 12a2 2 0 0 1-2-2 9 7 0 0 1 18 0 2 2 0 0 1-2 2
      M5 16a2 2 0 0 0-2 2 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 2 2 0 0 0-2-2q0 0 0 0
      M0 0m6.67 12 6.13 4.6a2 2 0 0 0 2.8-.4l3.15-4.2`,
    'hand':`M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2
      M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2
      M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8
      M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15`,
    'hand-coins':`M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17
      M0 0m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9
      M0 0m2 16 6 6
      M18.9 9a2.9 2.9 0 1 0 -5.8 0a2.9 2.9 0 1 0 5.8 0Z
      M9 5a3 3 0 1 0 -6 0a3 3 0 1 0 6 0Z`,
    'handshake':`M0 0m11 17 2 2a1 1 0 1 0 3-3
      M0 0m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4
      M0 0m21 3 1 11h-2
      M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3
      M3 4h8`,
    'hourglass':`M5 22h14
      M5 2h14
      M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22
      M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2`,
    'house':`M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8
      M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z`,
    'image':`M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2Z
      M11 9a2 2 0 1 0 -4 0a2 2 0 1 0 4 0Z
      M0 0m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21`,
    'images':`M0 0m22 11-1.296-1.296a2.4 2.4 0 0 0-3.408 0L11 16
      M4 8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2
      M14 7a1 1 0 1 0 -2 0a1 1 0 1 0 2 0Z
      M10 2h10a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2Z`,
    'key-round':`M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z
      M17 7.5a0.5 0.5 0 1 0 -1 0a0.5 0.5 0 1 0 1 0Z`,
    'lamp-floor':`M12 10v12
      M17.929 7.629A1 1 0 0 1 17 9H7a1 1 0 0 1-.928-1.371l2-5A1 1 0 0 1 9 2h6a1 1 0 0 1 .928.629z
      M9 22h6`,
    'layers':`M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z
      M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12
      M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17`,
    'leaf':`M11 20a10 10 0 0010-10 25.9 25.9 0 00-1.04-7.281 1 1 0 00-1.755-.325C15.833 5.5 13 5.5 9.8 6.1A7 7 0 0011 20
      M2 21a5 5 0 012.911-4.544C7.613 15.212 8.351 15.24 11 13`,
    'list-todo':`M13 5h8
      M13 12h8
      M13 19h8
      M0 0m3 17 2 2 4-4
      M4 4h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1Z`,
    'lock-keyhole':`M13 16a1 1 0 1 0 -2 0a1 1 0 1 0 2 0Z
      M5 10h14a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-8a2 2 0 0 1 2 -2Z
      M7 10V7a5 5 0 0 1 10 0v3`,
    'mail':`M0 0m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7
      M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2Z`,
    'map-pin':`M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0
      M15 10a3 3 0 1 0 -6 0a3 3 0 1 0 6 0Z`,
    'medal':`M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15
      M11 12 5.12 2.2
      M0 0m13 12 5.88-9.8
      M8 7h8
      M17 17a5 5 0 1 0 -10 0a5 5 0 1 0 10 0Z
      M12 18v-2h-.5`,
    'message-circle':`M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719`,
    'messages-square':`M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z
      M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1`,
    'moon-star':`M18 5h4
      M20 3v4
      M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401`,
    'move':`M12 2v20
      M0 0m15 19-3 3-3-3
      M0 0m19 9 3 3-3 3
      M2 12h20
      M0 0m5 9-3 3 3 3
      M0 0m9 5 3-3 3 3`,
    'paint-roller':`M4 2h12a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-2a2 2 0 0 1 2 -2Z
      M10 16v-2a2 2 0 0 1 2-2h8a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2
      M9 16h2a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1Z`,
    'paintbrush':`M0 0m14.622 17.897-10.68-2.913
      M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707l.944.944a2.41 2.41 0 0 1 0 3.408l-.944.944a.5.5 0 0 1-.707 0L8.354 7.348a.5.5 0 0 1 0-.707l.944-.944a2.41 2.41 0 0 1 3.408 0l.944.944a.5.5 0 0 0 .707 0z
      M9 8c-1.804 2.71-3.97 3.46-6.583 3.948a.507.507 0 0 0-.302.819l7.32 8.883a1 1 0 0 0 1.185.204C12.735 20.405 16 16.792 16 15`,
    'panels-top-left':`M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2Z
      M3 9h18
      M9 21V9`,
    'party-popper':`M5.8 11.3 2 22l10.7-3.79
      M4 3h.01
      M22 8h.01
      M15 2h.01
      M22 20h.01
      M0 0m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10
      M0 0m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17
      M0 0m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7
      M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z`,
    'paw-print':`M13 4a2 2 0 1 0 -4 0a2 2 0 1 0 4 0Z
      M20 8a2 2 0 1 0 -4 0a2 2 0 1 0 4 0Z
      M22 16a2 2 0 1 0 -4 0a2 2 0 1 0 4 0Z
      M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z`,
    'person-standing':`M13 5a1 1 0 1 0 -2 0a1 1 0 1 0 2 0Z
      M0 0m9 20 3-6 3 6
      M0 0m6 8 6 2 6-2
      M12 10v4`,
    'pizza':`M0 0m12 14-1 1
      M0 0m13.75 18.25-1.25 1.42
      M17.775 5.654a15.68 15.68 0 0 0-12.121 12.12
      M18.8 9.3a1 1 0 0 0 2.1 7.7
      M21.964 20.732a1 1 0 0 1-1.232 1.232l-18-5a1 1 0 0 1-.695-1.232A19.68 19.68 0 0 1 15.732 2.037a1 1 0 0 1 1.232.695z`,
    'plane':`M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z`,
    'plane-takeoff':`M2 22h20
      M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l.17.1a2 2 0 0 0 1.8 0L8 12 5 6l.9-.45a2 2 0 0 1 2.09.2l4.02 3a2 2 0 0 0 2.1.2l4.19-2.06a2.41 2.41 0 0 1 1.73-.17L21 7a1.4 1.4 0 0 1 .87 1.99l-.38.76c-.23.46-.6.84-1.07 1.08L7.58 17.2a2 2 0 0 1-1.22.18Z`,
    'plug':`M12 22v-5
      M15 8V2
      M17 8a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1z
      M9 8V2`,
    'power-off':`M18.36 6.64A9 9 0 0 1 20.77 15
      M6.16 6.16a9 9 0 1 0 12.68 12.68
      M12 2v4
      M0 0m2 2 20 20`,
    'puzzle':`M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z`,
    'rotate-ccw-clock':`M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8
      M3 3v5h5
      M12 7v5l4 2`,
    'route':`M9 19a3 3 0 1 0 -6 0a3 3 0 1 0 6 0Z
      M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15
      M21 5a3 3 0 1 0 -6 0a3 3 0 1 0 6 0Z`,
    'ruler':`M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z
      M0 0m14.5 12.5 2-2
      M0 0m11.5 9.5 2-2
      M0 0m8.5 6.5 2-2
      M0 0m17.5 15.5 2-2`,
    'salad':`M19.496 12a2.5 2.5 0 00.399-2.214A2 2 0 0020.32 6.5 2 2 0 0019 3a2 2 0 00-1.5.68 2 2 0 00-3.287.424 2.5 2.5 0 00-3.189 2.06A3 3 0 0012 12l4-4
      M4 12a1 1 0 00-.99 1.133A9 9 0 0012 21a9 9 0 008.99-7.867A1 1 0 0020 12z
      M7 21h10
      M9.85 6.907A3.5 3.5 0 005.05 12`,
    'satellite':`M0 0m13.5 6.5-3.148-3.148a1.205 1.205 0 0 0-1.704 0L6.352 5.648a1.205 1.205 0 0 0 0 1.704L9.5 10.5
      M16.5 7.5 19 5
      M0 0m17.5 10.5 3.148 3.148a1.205 1.205 0 0 1 0 1.704l-2.296 2.296a1.205 1.205 0 0 1-1.704 0L13.5 14.5
      M9 21a6 6 0 0 0-6-6
      M9.352 10.648a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l4.296-4.296a1.205 1.205 0 0 0 0-1.704l-2.296-2.296a1.205 1.205 0 0 0-1.704 0z`,
    'scan-face':`M3 7V5a2 2 0 0 1 2-2h2
      M17 3h2a2 2 0 0 1 2 2v2
      M21 17v2a2 2 0 0 1-2 2h-2
      M7 21H5a2 2 0 0 1-2-2v-2
      M8 14s1.5 2 4 2 4-2 4-2
      M9 9h.01
      M15 9h.01`,
    'send':`M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z
      M0 0m21.854 2.147-10.94 10.939`,
    'shower-head':`M0 0m4 4 2.5 2.5
      M13.5 6.5a4.95 4.95 0 0 0-7 7
      M15 5 5 15
      M14 17v.01
      M10 16v.01
      M13 13v.01
      M16 10v.01
      M11 20v.01
      M17 14v.01
      M20 11v.01`,
    'shrimp':`M10 2a3.28 3.28 0 003.227 1.798l6.17-.561A1 1 0 1119.614 8H8.5a6.44 6.44 0 00-5.63 9.75A6.5 6.5 0 008.5 21c1.38 0 2-.5 2.5-1
      M10 8a8.5 8.5 0 000 8
      M11 22c-.5-.5-1.12-1-2.5-1a1 1 0 010-5H12a7 7 0 007-7V8
      M13 12h.01
      M8 16c-2 0-4.5-4-4-6`,
    'shuffle':`M0 0m18 14 4 4-4 4
      M0 0m18 2 4 4-4 4
      M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22
      M2 6h1.972a4 4 0 0 1 3.6 2.2
      M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45`,
    'soup':`M11.248 3c.273.1.808.53.747 1.36-.05.83-.938 1.2-.989 2.02-.06.78.333 1.24.727 1.62
      M16.252 3c.268.1.794.53.745 1.36-.06.83-.923 1.2-.993 2.02-.05.78.338 1.24.725 1.62
      M19.5 12 22 6
      M4 12a1 1 0 00-.99 1.133A9 9 0 0012 21a9 9 0 008.99-7.867A1 1 0 0020 12z
      M6.252 3c.268.1.794.53.745 1.36-.06.83-.923 1.2-.993 2.02-.05.78.338 1.24.735 1.62
      M7 21h10`,
    'sparkles':`M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z
      M20 2v4
      M22 4h-4
      M6 20a2 2 0 1 0 -4 0a2 2 0 1 0 4 0Z`,
    'spline':`M21 5a2 2 0 1 0 -4 0a2 2 0 1 0 4 0Z
      M7 19a2 2 0 1 0 -4 0a2 2 0 1 0 4 0Z
      M5 17A12 12 0 0 1 17 5`,
    'sun':`M16 12a4 4 0 1 0 -8 0a4 4 0 1 0 8 0Z
      M12 2v2
      M12 20v2
      M0 0m4.93 4.93 1.41 1.41
      M0 0m17.66 17.66 1.41 1.41
      M2 12h2
      M20 12h2
      M0 0m6.34 17.66-1.41 1.41
      M0 0m19.07 4.93-1.41 1.41`,
    'sunrise':`M12 2v8
      M0 0m4.93 10.93 1.41 1.41
      M2 18h2
      M20 18h2
      M0 0m19.07 10.93-1.41 1.41
      M22 22H2
      M0 0m8 6 4-4 4 4
      M16 18a4 4 0 0 0-8 0`,
    'sunset':`M12 10V2
      M0 0m4.93 10.93 1.41 1.41
      M2 18h2
      M20 18h2
      M0 0m19.07 10.93-1.41 1.41
      M22 22H2
      M0 0m16 6-4 4-4-4
      M16 18a4 4 0 0 0-8 0`,
    'swords':`M0 0m13 19 6-6
      M14.5 17.5 3.586 6.586A2 2 0 013 5.172V3h2.172a2 2 0 011.414.586L17.5 14.5
      M0 0m14.828 6.172 2.586-2.586A2 2 0 0118.828 3H21v2.172a2 2 0 01-.586 1.414l-2.586 2.586
      M0 0m16 16 4 4
      M0 0m19 21 2-2
      M0 0m5 14 4 4
      M0 0m5 21-2-2
      M7.5 16.5 4 20`,
    'tag':`M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z
      M8 7.5a0.5 0.5 0 1 0 -1 0a0.5 0.5 0 1 0 1 0Z`,
    'timer':`M10 2L14 2
      M12 14L15 11
      M20 14a8 8 0 1 0 -16 0a8 8 0 1 0 16 0Z`,
    'toy-brick':`M4 8h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10a1 1 0 0 1 1 -1Z
      M10 8V5c0-.6-.4-1-1-1H6a1 1 0 0 0-1 1v3
      M19 8V5c0-.6-.4-1-1-1h-3a1 1 0 0 0-1 1v3`,
    'tree-deciduous':`M8 19a4 4 0 0 1-2.24-7.32A3.5 3.5 0 0 1 9 6.03V6a3 3 0 1 1 6 0v.04a3.5 3.5 0 0 1 3.24 5.65A4 4 0 0 1 16 19Z
      M12 19v3`,
    'trees':`M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z
      M7 16v6
      M13 19v3
      M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5`,
    'triangles-centerline-dashed-vertical':`M12 14v2
      M12 20v2
      M12 2v2
      M12 8v2
      M20.288 16.703A1 1 0 0022 16V8a1 1 0 00-1.712-.703l-3.99 3.991a1 1 0 00-.001 1.424z
      M3.712 16.703A1 1 0 012 16V8a1 1 0 011.712-.703l3.99 3.991a1 1 0 01.001 1.424z`,
    'trousers':`M4 6h16
      M6 22a2 2 0 0 1-2-2V3c0-.6.4-1 1-1h14c.6 0 1 .4 1 1v17a2 2 0 0 1-2 2h-3l-3-10-3 10Z
      M0 0m6 11-2 1
      M9 8.5V6
      M15 6v2.5
      M0 0m20 12-2-1
      M4 18h6
      M14 18h6`,
    'umbrella':`M12 13v7a2 2 0 0 0 4 0
      M12 2v2
      M20.992 13a1 1 0 0 0 .97-1.274 10.284 10.284 0 0 0-19.923 0A1 1 0 0 0 3 13z`,
    'user-round':`M17 8a5 5 0 1 0 -10 0a5 5 0 1 0 10 0Z
      M20 21a8 8 0 0 0-16 0`,
    'users-round':`M18 21a8 8 0 0 0-16 0
      M15 8a5 5 0 1 0 -10 0a5 5 0 1 0 10 0Z
      M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3`,
    'wand-sparkles':`M0 0m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72
      M0 0m14 7 3 3
      M5 6v4
      M19 14v4
      M10 2v2
      M7 8H3
      M21 16h-4
      M11 3H9`,
    'watch':`M12 10v2.2l1.6 1
      M0 0m16.13 7.66-.81-4.05a2 2 0 0 0-2-1.61h-2.68a2 2 0 0 0-2 1.61l-.78 4.05
      M0 0m7.88 16.36.8 4a2 2 0 0 0 2 1.61h2.72a2 2 0 0 0 2-1.61l.81-4.05
      M18 12a6 6 0 1 0 -12 0a6 6 0 1 0 12 0Z`,
    'waves-horizontal':`M2 12q2.5 2 5 0t5 0 5 0 5 0
      M2 19q2.5 2 5 0t5 0 5 0 5 0
      M2 5q2.5 2 5 0t5 0 5 0 5 0`,
    'wine':`M8 22h8
      M7 10h10
      M12 15v7
      M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z`,
  };
  const iconPaths=new Map(),ATLAS_CELL=128;
  function drawIcon(ctx,key,x,y,ink,ridgeAlpha=0) {
    let path=iconPaths.get(key);
    if(!path){path=new Path2D(ICON_PATHS[key]);iconPaths.set(key,path);}
    ctx.save();ctx.translate(x-31,y-31);ctx.scale(62/24,62/24);
    ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=1.55;
    if(ridgeAlpha>0){
      ctx.save();ctx.translate(0,.24);ctx.strokeStyle=`rgba(8,12,22,${ridgeAlpha})`;ctx.stroke(path);ctx.restore();
    }
    ctx.strokeStyle=ink;ctx.stroke(path);ctx.restore();
  }
  function parsePigment(value){return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?[1,3,5].map(index=>parseInt(value.slice(index,index+2),16)/255):null;}
  function validKind(kind){kind=Number(kind);if(![4,6,8,20].includes(kind))throw new RangeError('ONDE supports D4, D6, D8 and D20.');return kind;}
  function validValue(value,kind){value=Number(value);if(!Number.isInteger(value)||value<1||value>kind)throw new RangeError('Dice result must be an integer from 1 to '+kind+'.');return value;}
  function validLabels(labels,kind) {
    if(labels==null)return null;
    if(!Array.isArray(labels)||labels.length!==kind)throw new RangeError('Dice labels must contain one word or phrase for each face.');
    return Array.from(labels,label=>{
      if(typeof label!=='string'||!label.trim())throw new TypeError('Dice face labels must be nonempty strings.');
      return label.trim();
    });
  }
  function validIcons(icons,kind) {
    if(icons==null)return null;
    if(!Array.isArray(icons)||icons.length!==kind)throw new RangeError('Dice icons must contain one pictogram for each face.');
    return Array.from(icons,key=>{
      if(typeof key!=='string'||!Object.hasOwn(ICON_PATHS,key))throw new RangeError('Unknown dice pictogram.');
      return key;
    });
  }
  function clampPower(value){value=Number(value);return Number.isNaN(value)?0:Math.max(0,Math.min(1,value));}
  function rollDuration(base,power){return Math.max(1650,Math.min(2500,(Number(base)||1650)+850*power));}
  function targetRotation(type,value,yaw=.48) {
    if(type===4) {
      const faces=POLYS[4].faces,base=fromTo(faces[value%4].n,[0,-1,0]),p=transform(matrix(base),faces[value-1].n),cam=[4.3,0,6.4];
      const angle=Math.atan2(cam[0],cam[2])-Math.atan2(p[0],p[2])+.42;return qmul(axisQ([0,1,0],angle),base);
    }
    const face=type===6?CUBE_FACES[value-1]:POLYS[type].faces[value-1],base=fromTo(face.n,[0,1,0]),b=transform(matrix(base),face.b);
    const angle=Math.atan2(-4.3,-6.4)-Math.atan2(b[0],b[2])+(type===6?(yaw-.48)*.18:0);
    return qmul(axisQ([0,1,0],angle),base);
  }
  // The unthrown D6 shows three faces; settled results retain their physical pose.
  function initialRotation(type,value){const q=targetRotation(type,value);return type===6?qmul(axisQ([0,1,0],.42),q):q;}
  function support(type,m) {
    if(type===6)return Math.pow(Math.pow(Math.abs(m[1]),4/3)+Math.pow(Math.abs(m[4]),4/3)+Math.pow(Math.abs(m[7]),4/3),3/4);
    let min=1e6;for(const p of POLYS[type].samples)min=Math.min(min,m[1]*p[0]+m[4]*p[1]+m[7]*p[2]);return -min;
  }
  function create(canvas,options={}) {
    if(!canvas||typeof canvas.getContext!=='function')throw new TypeError('A canvas is required.');
    let type=validKind(options.kind??6),result=validValue(options.value??1,type),rotation=initialRotation(type,result),pigment=parsePigment(options.color);
    let faceLabels=validLabels(options.labels,type),faceIcons=faceLabels&&validIcons(options.icons,type);
    let alive=true,raf=0,busy=false,pressed=false,pressAt=0,pressScale=1,rollAt=0,startQ=rotation,goalQ=rotation,pointerId=null,charge=0;
    let duration=rollDuration(options.duration,0),activeDuration=duration,activePower=0,spinTurns=2,settleAt=0,settleScale=1,settleBias=0,startBias=0,pressPoint=null;
    let breathing=false,breatheAt=0,waiting=false,waitAt=0,visible=true,throwDirection=null;
    let reduced=typeof options.reducedMotion==='boolean'?options.reducedMotion:!!global.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let manualReduced=typeof options.reducedMotion==='boolean',pending=null,resolveRoll=null;
    let resultLight=1,hasSettledResult=false;
    let gl=null,program=null,buffer=null,shaders=[],uniforms={},mode='fallback',renderError='',contextMessage='';
    const textures=new Map();
    let lastFrame={q:rotation,sy:1,lift:0,x:0,z:0,spreadBias:0},fallbackCanvas=null,fallbackCtx=null,fallbackTargetCtx=null;
    const previousBackground=canvas.style.backgroundImage,previousSize=canvas.style.backgroundSize,previousPosition=canvas.style.backgroundPosition,previousRepeat=canvas.style.backgroundRepeat;
    const query=global.matchMedia?.('(prefers-reduced-motion: reduce)');
    const cancelFrame=()=>{if(raf)cancelAnimationFrame(raf);raf=0;breathing=false;waiting=false;};
    const isThemeDie=()=>type===4&&!!faceIcons;
    const isEngravedCardDie=()=>(type===6||type===8)&&!!faceIcons;
    const dieColor=()=>isThemeDie()?DARK_SLATE:pigment||(isEngravedCardDie()?DARK_MAUVE:COLORS[type]);
    const rimColor=()=>{
      if(isEngravedCardDie())return pigment?pigment.map(channel=>Math.min(1,.065+channel*1.62)):MAUVE_RIM;
      return isThemeDie()&&pigment?DEFAULT_RIM.map((channel,i)=>channel*.42+pigment[i]*.58):DEFAULT_RIM;
    };
    const updateLabel=(moving=false)=>canvas.setAttribute('aria-label',moving?`Dé D${type} en mouvement.`:`Dé D${type} ${pigment?'aux couleurs de la catégorie':isEngravedCardDie()?'mauve sombre':MATERIALS[type]}. Résultat : ${faceLabels?.[result-1]??result}.`);
    canvas.setAttribute('role','img');
    function rendererStatus(){canvas.setAttribute('data-renderer',mode);canvas.setAttribute('data-renderer-error',renderError);}
    function contextCreationError(event){contextMessage=String(event.statusMessage||'WebGL context creation failed.');}
    canvas.addEventListener('webglcontextcreationerror',contextCreationError);
    function compile(shaderType,source) {
      const shader=gl.createShader(shaderType);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error((shaderType===gl.VERTEX_SHADER?'Vertex':'Fragment')+' shader: '+String(gl.getShaderInfoLog(shader)||'Compilation failed without driver log.'));return shader;
    }
    function setMaterial(){
      gl.uniform3fv(uniforms.uColor,dieColor());
      gl.uniform3fv(uniforms.uRimColor,rimColor());
    }
    function setGeometry() {
      if(mode!=='webgl')return;
      gl.useProgram(program);gl.uniform1i(uniforms.uType,type);
      const f=type===6?CUBE_FACES:POLYS[type].faces,n=new Float32Array(60),t=new Float32Array(60),b=new Float32Array(60);
      for(let i=0;i<f.length;i++){n.set(f[i].n,i*3);t.set(f[i].t,i*3);b.set(f[i].b,i*3);}
      gl.uniform3fv(uniforms.uNormals,n);gl.uniform3fv(uniforms.uTangents,t);gl.uniform3fv(uniforms.uBitangents,b);
      gl.uniform1i(uniforms.uCount,f.length||6);gl.uniform1f(uniforms.uOffset,f[0]?.h||1);setMaterial();
    }
    function setAtlas() {
      if(mode!=='webgl')return;
      const key=faceIcons?faceIcons.join(','):'';
      const rows=faceIcons?Math.ceil(faceIcons.length/4):8;
      let texture=textures.get(key);
      gl.useProgram(program);gl.activeTexture(gl.TEXTURE0);
      if(texture)gl.bindTexture(gl.TEXTURE_2D,texture);
      else {
        const density=faceIcons?2:1,atlas=document.createElement('canvas');
        atlas.width=4*ATLAS_CELL*density;atlas.height=rows*ATLAS_CELL*density;
        const ctx=atlas.getContext('2d');if(!ctx)throw new Error('Dice texture canvas unavailable.');
        ctx.fillStyle='#000';ctx.fillRect(0,0,atlas.width,atlas.height);ctx.fillStyle='#fff';
        if(density!==1)ctx.scale(density,density);
        ctx.font='500 67px Arial,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        for(let i=0;i<(faceIcons?.length??20);i++){
          const x=(i%4+.5)*ATLAS_CELL,y=(Math.floor(i/4)+.5)*ATLAS_CELL;
          if(faceIcons)drawIcon(ctx,faceIcons[i],x,y,'#fff');
          else ctx.fillText(String(i+1),x,y+4);
        }
        texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlas);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        textures.set(key,texture);
        if(textures.size>3){const oldest=textures.keys().next().value;gl.deleteTexture(textures.get(oldest));textures.delete(oldest);}
      }
      gl.uniform1i(uniforms.uAtlas,0);gl.uniform1f(uniforms.uAtlasRows,rows);
      gl.uniform2f(uniforms.uIconScale,...(faceIcons?ICON_SCALE[type]:[0,0]));
    }
    function initialize() {
      try {
        gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,powerPreference:'high-performance',preserveDrawingBuffer:false});
        if(!gl){renderError='WebGL context unavailable'+(contextMessage?': '+contextMessage:'.');fallbackTargetCtx=canvas.getContext('2d');rendererStatus();if(typeof options.onError==='function')options.onError(new Error(renderError));return;}
        program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,VERTEX));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(program);
        if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Shader link: '+String(gl.getProgramInfoLog(program)||'Link failed without driver log.'));
        gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
        const attr=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
        for(const name of ['uResolution','uRotation','uPosition','uScale','uColor','uRimColor','uType','uCount','uNormals','uTangents','uBitangents','uOffset','uBound','uAtlas','uAtlasRows','uValue','uResultLight','uIconScale'])uniforms[name]=gl.getUniformLocation(program,name);
        mode='webgl';setAtlas();setGeometry();renderError='';rendererStatus();
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
    function drawFallback(m,scale,position,lift) {
      if(!fallbackCanvas){fallbackCanvas=document.createElement('canvas');fallbackCanvas.width=480;fallbackCanvas.height=480;fallbackCtx=fallbackCanvas.getContext('2d');}
      const c=fallbackCtx;if(!c)return;
      c.clearRect(0,0,480,480);
      const world=p=>add(transform(m,p).map((v,i)=>v*scale[i]),position);
      const projectWorld=p=>cameraOffset(p).map(value=>240+480*value);
      const project=p=>projectWorld(world(p));
      const transformedNormal=n=>norm(transform(m,n).map((v,i)=>v/scale[i]));
      const light=norm([-3,6,4]),fill=norm([4,2,-3]);
      const rgb=(factor,blend=0)=>{const b=dieColor().map((v,i)=>Math.round(Math.min(255,(v*255*(1-blend)+[235,232,215][i]*blend)*factor)));return 'rgb('+b.join(',')+')';};
      const shadowCenter=projectWorld([position[0],0,position[2]]);c.save();c.translate(shadowCenter[0]+5,shadowCenter[1]);c.scale(1,.27);
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
      const rounding=type===6?31:type===4?26:type===8?18:14;
      roundedPoly(c,hull,rounding);c.fillStyle=rgb(.79);c.fill();c.save();c.clip();
      const visible=faces.filter(f=>dot(transformedNormal(f.n),CAMERA_VIEW)>.012).map(f=>({...f,center:mul(f.points.reduce((a,b)=>add(a,b),[0,0,0]),1/f.points.length)}));
      visible.sort((a,b)=>dot(world(a.center),CAMERA_VIEW)-dot(world(b.center),CAMERA_VIEW));
      for(const face of visible) {
        const n=transformedNormal(face.n),shade=.58+.40*Math.max(0,dot(n,light))+.15*Math.max(0,dot(n,fill));
        const polygon=face.points.map(project);c.beginPath();c.moveTo(...polygon[0]);for(const p of polygon.slice(1))c.lineTo(...p);c.closePath();
        const bounds=polygon.reduce((a,p)=>[Math.min(a[0],p[0]),Math.min(a[1],p[1]),Math.max(a[2],p[0]),Math.max(a[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]);
        const flank=isEngravedCardDie()?smooth(Math.max(0,Math.min(1,(dot(n,CAMERA_RIGHT)-.16)/.60))):0;
        const gradient=c.createLinearGradient(bounds[0],bounds[1],bounds[2],bounds[3]);
        gradient.addColorStop(0,rgb(Math.min(1.15,shade+.09)));
        gradient.addColorStop(.58,rgb(shade*(1-.19*flank)));
        gradient.addColorStop(1,rgb(Math.max(.45,shade-.08)*(1-.38*flank)));
        c.fillStyle=gradient;c.fill();c.strokeStyle=rgb(shade*(1-.22*flank));c.lineWidth=1.8;c.lineJoin='round';c.stroke();
      }
      const gleam=c.createRadialGradient(175,135,10,210,210,210);
      const highlight=isThemeDie()||isEngravedCardDie()?rimColor().map(value=>Math.round(value*255)).join(','):'255,255,235';
      gleam.addColorStop(0,`rgba(${highlight},.18)`);gleam.addColorStop(.48,`rgba(${highlight},.035)`);gleam.addColorStop(1,`rgba(${highlight},0)`);c.fillStyle=gleam;c.fillRect(0,0,480,480);
      const lowerShade=c.createLinearGradient(0,150,0,390);lowerShade.addColorStop(0,'rgba(0,0,0,0)');lowerShade.addColorStop(.7,'rgba(0,0,0,.015)');lowerShade.addColorStop(1,'rgba(0,0,0,.20)');c.fillStyle=lowerShade;c.fillRect(0,0,480,480);
      const numberSize=(type===4?.60:type===6?.80:type===8?.61:.34)/64;
      const [sizeX,sizeY]=faceIcons?ICON_SCALE[type].map(scale=>1/(ATLAS_CELL*scale)):[numberSize,numberSize];
      for(const face of visible) {
        const n=transformedNormal(face.n),shade=.72+.27*Math.max(0,dot(n,light));
        const center=project(face.center),tp=project(add(face.center,face.t)),bp=project(add(face.center,face.b));
        c.save();c.transform((tp[0]-center[0])*sizeX,(tp[1]-center[1])*sizeX,-(bp[0]-center[0])*sizeY,-(bp[1]-center[1])*sizeY,center[0],center[1]);
        const selected=face.value===result&&resultLight>0;
        const key=faceIcons?.[face.value-1],slate=isThemeDie();
        if(key){
          const opacity=(slate?.43:.39)+(selected?(slate?.33:.27):-.27)*resultLight;
          let ink=`rgba(188,196,207,${opacity})`;
          if(!slate){
            ink=c.createLinearGradient(-24,-18,22,20);
            for(const [at,wear] of [[0,.90],[.24,1],[.47,.84],[.71,.95],[1,.89]]){
              ink.addColorStop(at,`rgba(188,196,207,${opacity*wear})`);
            }
          }
          drawIcon(c,key,0,0,ink,(slate?.32:.40)*(selected?1:1-.68*resultLight));
        }else{
          c.fillStyle=rgb(shade,.75);
          if(selected){
            const ink=c.createLinearGradient(-30,-28,30,34),muted=dieColor().map((v,i)=>(v*255*.25+[235,232,215][i]*.75)*shade);
            for(const [stop,ivory] of [[0,[232,226,212]],[.34,[236,230,218]],[.43,[239,232,220]],[.57,[234,229,215]],[1,[230,225,212]]])ink.addColorStop(stop,'rgb('+muted.map((v,i)=>Math.round(v+(ivory[i]-v)*resultLight)).join(',')+')');
            c.fillStyle=ink;
          }
          c.textAlign='center';c.textBaseline='middle';
          c.font='500 64px Arial,sans-serif';
          c.fillText(String(face.value),0,3);
        }
        if(key&&selected&&resultLight<1){
          const at=.12+.76*resultLight,shine=c.createLinearGradient(-29,8,29,-8);
          const intensity=slate?.90:.55;
          shine.addColorStop(at-.07,'rgba(215,207,237,0)');
          shine.addColorStop(at,`rgba(215,207,237,${intensity*resultLight*(1-resultLight)})`);
          shine.addColorStop(at+.07,'rgba(215,207,237,0)');
          drawIcon(c,key,0,0,shine);
        }
        c.restore();
      }
      c.restore();
      roundedPoly(c,hull,rounding);c.save();c.clip();c.lineWidth=1.4;c.strokeStyle='rgba(255,255,235,.11)';c.stroke();c.restore();
      if(fallbackTargetCtx){const side=Math.min(canvas.width,canvas.height);fallbackTargetCtx.clearRect(0,0,canvas.width,canvas.height);fallbackTargetCtx.drawImage(fallbackCanvas,(canvas.width-side)/2,(canvas.height-side)/2,side,side);}else{canvas.style.backgroundImage='url('+fallbackCanvas.toDataURL('image/png')+')';canvas.style.backgroundSize='contain';canvas.style.backgroundRepeat='no-repeat';canvas.style.backgroundPosition='center';}
    }
    function draw(q=rotation,sy=1,lift=0,x=0,z=0,spreadBias=0) {
      if(!alive)return;
      const m=matrix(q),spread=Math.exp(spreadBias),scale=[spread/Math.sqrt(sy),sy,1/(Math.sqrt(sy)*spread)];
      const position=[x,scale[1]*support(type,m)+lift+.002,z];
      lastFrame={q,sy,lift,x,z,spreadBias,m,scale,position};
      if(mode!=='webgl'){drawFallback(m,scale,position,lift);return;}
      gl.useProgram(program);gl.uniformMatrix3fv(uniforms.uRotation,false,new Float32Array(m));gl.uniform3fv(uniforms.uScale,scale);gl.uniform3f(uniforms.uPosition,...position);gl.uniform1f(uniforms.uBound,2.05*Math.max(...scale));gl.uniform1f(uniforms.uValue,result);gl.uniform1f(uniforms.uResultLight,resultLight);gl.drawArrays(gl.TRIANGLES,0,6);
    }
    // Fractions from the canvas's top-left corner, independent of device pixel ratio.
    function getResultAnchor() {
      if(!alive||!hasSettledResult||busy||pressed||charge||pressScale!==1||!faceIcons||canvas.isConnected===false)return null;
      if(type!==4&&type!==6&&type!==8)return null;
      const width=canvas.width,height=canvas.height,webgl=mode==='webgl';
      if(!width||!height||(!webgl&&!fallbackCtx))return null;
      const {m,scale,position}=lastFrame,faces=type===6?CUBE_FACES:POLYS[type].faces,face=faces[result-1];
      const n=transform(m,face.n);
      if(dot(norm(n.map((value,i)=>value/scale[i])),CAMERA_VIEW)<=.012)return null;
      let depth=face.h;
      if(webgl&&type===8){
        // The rounded octahedron meets the stamp axis just inside its flat face plane.
        const contribution=faces.reduce((sum,item)=>sum+Math.max(0,dot(item.n,face.n))**16,0);
        depth/=contribution**(1/16);
      }
      const [u,v]=cameraOffset(add(n.map((value,i)=>value*scale[i]*depth),position));
      const side=webgl?height:Math.min(width,height);
      const x=.5+u*side/width,y=.5+v*side/height;
      return x>=0&&x<=1&&y>=0&&y<=1?{x,y}:null;
    }
    function resize() {
      if(!alive)return;
      const w=canvas.clientWidth||300,h=canvas.clientHeight||w;
      // The fragment shader runs once per pixel, including during a roll.
      const pixelLimit=mode==='webgl'&&options.maxPixels>0?Math.sqrt(options.maxPixels/(w*h)):Infinity;
      const dpr=Math.min(global.devicePixelRatio||1,Number(options.maxPixelRatio)||2,pixelLimit);
      const rw=Math.max(1,Math.round(w*dpr)),rh=Math.max(1,Math.round(h*dpr));if(canvas.width!==rw)canvas.width=rw;if(canvas.height!==rh)canvas.height=rh;
      if(mode==='webgl'){gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);gl.uniform2f(uniforms.uResolution,canvas.width,canvas.height);}
      draw(lastFrame.q,lastFrame.sy,lastFrame.lift,lastFrame.x,lastFrame.z,lastFrame.spreadBias);
    }
    function resolvePending() { const resolve=resolveRoll;resolveRoll=null;pending=null;if(resolve)resolve(result); }
    function pauseMotion(){if(!alive||busy)return;cancelFrame();if(!pressed&&!charge){pressScale=1;draw();}}
    function animateBreath(now){
      raf=0;if(!alive||!breathing||busy||pressed||charge||reduced||document.hidden||!visible){pauseMotion();return;}
      const t=Math.min(1,(now-breatheAt)/2200),envelope=Math.pow(Math.sin(Math.PI*t),2);
      if(t>=1){breathing=false;draw();return;}
      const wave=Math.sin(2*Math.PI*t)*envelope;
      draw(qmul(axisQ([.2,0,1],wave*.012),rotation),1-wave*.014,0,0,0,wave*.008);raf=requestAnimationFrame(animateBreath);
    }
    // A single seated breath invites the next touch; polling never restarts it.
    function breathe(){if(!alive||busy||pressed||charge||breathing||reduced||document.hidden||!visible||canvas.isConnected===false)return false;cancelFrame();breathing=true;breatheAt=performance.now();raf=requestAnimationFrame(animateBreath);return true;}
    // Start immediately while the server chooses the authoritative result.
    function animateWaiting(now){
      raf=0;if(!alive||!waiting||busy||pressed||reduced||document.hidden||!visible){pauseMotion();return;}
      const t=(now-waitAt)/1000,wave=Math.sin(t*5);
      draw(qmul(axisQ([.8,.2,-.65],t*3.2),rotation),1-.025*(1+wave),.06*(1+wave));
      raf=requestAnimationFrame(animateWaiting);
    }
    function startWaiting(){if(!alive||busy||pressed||charge||reduced||document.hidden||!visible||canvas.isConnected===false)return false;cancelFrame();waiting=true;waitAt=performance.now();raf=requestAnimationFrame(animateWaiting);return true;}
    function stopWaiting(){if(!waiting)return;cancelFrame();pressScale=1;draw();}
    function finish() { cancelFrame();busy=false;pressed=false;pointerId=null;charge=0;rotation=goalQ||rotation;pressScale=1;resultLight=1;hasSettledResult=true;draw();updateLabel();resolvePending();if(options.idleMotion)breathe(); }
    function animate(now) {
      raf=0;if(!alive||!busy)return;
      const ms=(now-rollAt)*2250/activeDuration;let sy=1,lift=0,q=startQ,x=0,z=0,spreadBias=0;
      if(ms<160){const t=ms/160;sy=pressScale-(pressScale-.82)*smooth(t);spreadBias=startBias*(1-smooth(t));}
      else if(ms<1160){const t=(ms-160)/1000,e=smooth(t),wave=Math.pow(Math.sin(Math.PI*t),2);q=qmul(axisQ([.8,.2,-.65],Math.PI*2*spinTurns*(1-e)),slerp(startQ,goalQ,e));lift=(.45+.12*activePower)*4*t*(1-t);if(throwDirection){const amplitude=(.30+.08*activePower)*wave;x=throwDirection[0]*amplitude;z=throwDirection[1]*amplitude;}else{x=(.21+.06*activePower)*wave;z=-(.15+.05*activePower)*wave;}sy=1-.18*(1-smooth(Math.min(1,t/.16)))+.055*wave;spreadBias=.025*Math.sin(2*Math.PI*t)*wave;}
      else if(ms<1600){const t=(ms-1160)/440,wave=Math.pow(Math.sin(Math.PI*t),2);if(t<.36){sy=1-(.185+.035*activePower)*Math.pow(Math.sin(Math.PI*t/.36),2);}else{const b=(t-.36)/.64,bounce=Math.pow(Math.sin(Math.PI*b),2);lift=(.115+.035*activePower)*bounce;sy=1+(.032*Math.sin(2*Math.PI*b)+.008*Math.sin(4*Math.PI*b))*bounce;}q=qmul(axisQ([.5,0,.8],(.12+.025*activePower)*Math.sin(t*3*Math.PI)*wave*Math.exp(-t*3)),goalQ);spreadBias=.03*Math.sin(3*Math.PI*t)*wave*Math.exp(-t*3);}
      else if(ms<2250){const t=(ms-1600)/650,wave=Math.pow(Math.sin(Math.PI*t),2);sy=1-.028*Math.sin(t*4*Math.PI)*wave*Math.exp(-t*3);q=qmul(axisQ([.3,0,1],.028*Math.sin(t*3*Math.PI)*wave*Math.exp(-t*3)),goalQ);spreadBias=.012*Math.sin(2*Math.PI*t)*wave*Math.exp(-t*3);}
      else{finish();return;}
      resultLight=smooth(Math.max(0,Math.min(1,(ms-1600)/650)));
      draw(q,sy,lift,x,z,spreadBias);raf=requestAnimationFrame(animate);
    }
    function animatePress(now) {
      raf=0;if(!alive||!pressed||busy)return;
      const elapsed=now-pressAt;charge=clampPower(elapsed/1200);pressScale=reduced?1:1-.18*smooth(charge);draw(rotation,pressScale,0,0,0,reduced?0:.035*smooth(charge));
      if(elapsed<1200&&!reduced)raf=requestAnimationFrame(animatePress);
    }
    function animateRelease(now) {
      raf=0;if(!alive||pressed||busy)return;
      const t=Math.min(1,(now-settleAt)/270),spring=Math.exp(-t*6)*Math.cos(t*8)*(1-t);pressScale=1-(1-settleScale)*spring;draw(rotation,pressScale,0,0,0,settleBias*spring);
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
      if(reduced){pressScale=1;draw();}else{settleAt=performance.now();settleScale=pressScale;settleBias=lastFrame.spreadBias;raf=requestAnimationFrame(animateRelease);}
    }
    function cancelPress() {if(!pressed&&!charge)return;pressed=false;pointerId=null;charge=0;cancelFrame();pressScale=1;draw();}
    function setCharge(value) {
      if(!alive||busy)return;
      const next=clampPower(value);cancelFrame();pressed=false;pointerId=null;charge=next;
      if(reduced){pressScale=1;draw();}
      else if(next>0){pressScale=1-.18*smooth(next);draw(rotation,pressScale,0,0,0,.035*smooth(next));}
      else if(pressScale!==1){settleAt=performance.now();settleScale=pressScale;settleBias=lastFrame.spreadBias;raf=requestAnimationFrame(animateRelease);}
      else draw();
    }
    function applyReducedMotion(){if(!reduced)return;if(busy)finish();else{cancelFrame();pressScale=1;draw();}}
    function setReducedMotion(value){reduced=!!value;manualReduced=true;applyReducedMotion();}
    function motionChanged(event){if(!manualReduced){reduced=event.matches;applyReducedMotion();}}
    function visibilityChanged(){if(document.hidden&&busy)finish();else if(document.hidden){cancelPress();pauseMotion();}}
    function contextLost(event){event.preventDefault();mode='fallback';renderError='WebGL context lost.';rendererStatus();if(busy)finish();else{cancelPress();draw();}}
    initialize();
    canvas.addEventListener('pointerdown',press);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',cancelPress);canvas.addEventListener('lostpointercapture',cancelPress);canvas.addEventListener('webglcontextlost',contextLost);
    document.addEventListener('visibilitychange',visibilityChanged);if(query?.addEventListener)query.addEventListener('change',motionChanged);else query?.addListener?.(motionChanged);
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;observer?.observe(canvas);if(!observer)global.addEventListener('resize',resize);
    const visibilityObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{visible=entries.some(entry=>entry.isIntersecting);if(!visible)pauseMotion();}):null;visibilityObserver?.observe(canvas);
    resize();updateLabel();
    return {
      get mode(){return mode;},get error(){return renderError;},get busy(){return busy;},get value(){return result;},get kind(){return type;},
      setColor(color){if(!alive)return;const next=parsePigment(color);if(JSON.stringify(next)===JSON.stringify(pigment))return;pigment=next;if(mode==='webgl'){gl.useProgram(program);setMaterial();}draw(lastFrame.q,lastFrame.sy,lastFrame.lift,lastFrame.x,lastFrame.z,lastFrame.spreadBias);updateLabel(busy);},
      setLabels(labels,icons){
        if(!alive)return;
        const nextLabels=validLabels(labels,type),nextIcons=nextLabels&&validIcons(icons,type);
        const sameIcons=(!nextIcons&&!faceIcons)||nextIcons?.every((key,i)=>key===faceIcons?.[i]);
        faceLabels=nextLabels;
        if(!sameIcons){
          faceIcons=nextIcons;setAtlas();if(mode==='webgl')setMaterial();
          draw(lastFrame.q,lastFrame.sy,lastFrame.lift,lastFrame.x,lastFrame.z,lastFrame.spreadBias);
        }
        updateLabel(busy);
      },
      setKind(kind,value=1){
        if(!alive)return;
        const nextKind=validKind(kind),nextValue=validValue(value,nextKind),changedKind=nextKind!==type,same=!changedKind&&nextValue===result;
        hasSettledResult=same&&(hasSettledResult||busy);
        cancelFrame();pressed=false;pointerId=null;charge=0;busy=false;resultLight=1;resolvePending();
        if(same){rotation=goalQ||rotation;pressScale=1;draw();updateLabel();return;}
        type=nextKind;result=nextValue;rotation=changedKind?initialRotation(type,result):targetRotation(type,result);goalQ=rotation;pressScale=1;
        if(changedKind){faceLabels=null;if(faceIcons){faceIcons=null;setAtlas();}}
        setGeometry();draw();updateLabel();
      },
      roll(value,rollOptions={}) {
        if(!alive)return Promise.resolve(result);if(busy)return pending;
        const next=validValue(value,type);cancelFrame();pressed=false;pointerId=null;charge=0;busy=true;resultLight=0;hasSettledResult=false;startQ=lastFrame.q;pressScale=lastFrame.sy;startBias=lastFrame.spreadBias;result=next;goalQ=targetRotation(type,result,.3+Math.random()*.8);activePower=clampPower(rollOptions.power);const direction=rollOptions.direction,dx=Number(direction?.x),dy=Number(direction?.y),length=Math.hypot(dx,dy);throwDirection=Number.isFinite(length)&&length>0?norm([CAMERA_RIGHT[0]*dx-CAMERA_UP[0]*dy,0,CAMERA_RIGHT[2]*dx-CAMERA_UP[2]*dy]).filter((_,i)=>i!==1):null;spinTurns=2+Math.round(activePower*3);activeDuration=Number.isFinite(rollOptions.durationMs)?Math.max(100,Math.min(10000,rollOptions.durationMs)):rollDuration(rollOptions.duration??duration,activePower);rollAt=performance.now()-(Number.isFinite(rollOptions.elapsedMs)?Math.max(0,Math.min(activeDuration,rollOptions.elapsedMs)):0);updateLabel(true);
        const promise=new Promise(resolve=>{resolveRoll=resolve;});pending=promise;
        if(reduced){finish();}else raf=requestAnimationFrame(animate);return promise;
      },
      getResultAnchor,setReducedMotion,setCharge,breathe,pauseMotion,startWaiting,stopWaiting,
      destroy(){if(!alive)return;cancelFrame();alive=false;busy=false;pressed=false;resolvePending();observer?.disconnect();visibilityObserver?.disconnect();if(!observer)global.removeEventListener('resize',resize);if(query?.removeEventListener)query.removeEventListener('change',motionChanged);else query?.removeListener?.(motionChanged);document.removeEventListener('visibilitychange',visibilityChanged);canvas.removeEventListener('pointerdown',press);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',release);canvas.removeEventListener('pointercancel',cancelPress);canvas.removeEventListener('lostpointercapture',cancelPress);canvas.removeEventListener('webglcontextlost',contextLost);canvas.removeEventListener('webglcontextcreationerror',contextCreationError);try{if(gl){for(const texture of textures.values())gl.deleteTexture(texture);if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);for(const shader of shaders)gl.deleteShader(shader);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);}}catch(_){}textures.clear();canvas.style.backgroundImage=previousBackground;canvas.style.backgroundSize=previousSize;canvas.style.backgroundPosition=previousPosition;canvas.style.backgroundRepeat=previousRepeat;}
    };
  }
  const iconPath=key=>Object.prototype.hasOwnProperty.call(ICON_PATHS,key)?ICON_PATHS[key]:null;
  global.OndeDice=Object.freeze({create,iconPath});
})(window);
