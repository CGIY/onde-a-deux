/* One small, self-contained SVG per award. No image or font request. */
(function (scope) {
  'use strict';
  const scenes=[...scope.OndeBadgeScenesIndividual,...scope.OndeBadgeScenesShared,...scope.OndeBadgeScenesIntimacy];
  const catalogue=Object.freeze(scenes.map(({id,motif,shape,tone})=>Object.freeze({id,motif,shape,tone})));
  const ids=Object.freeze(catalogue.map(item=>item.id));
  if(new Set(ids).size!==ids.length)throw new Error('Duplicate badge artwork identifier');
  const records=new Map(scenes.map(item=>[item.id,item]));
  const instances=new Set(['recent','collection','notice','detail','asset']);
  const colors=Object.freeze({peach:'#F1D6C6',ivory:'#F0EEE7',sage:'#D0D6B8',rose:'#ECD1CF'});
  const shapes=Object.freeze({
    circle:'M80 9 A71 71 0 1 1 79.999 151 A71 71 0 1 1 80 9Z',
    shield:'M80 9 C105 9 130 20 147 32 L147 83 C147 116 119 143 80 157 C41 143 13 116 13 83 L13 32 C30 20 55 9 80 9Z',
    hex:'M73 10 Q80 6 87 10 L140 40 Q147 44 147 53 L147 113 Q147 122 140 126 L87 156 Q80 160 73 156 L20 126 Q13 122 13 113 L13 53 Q13 44 20 40Z',
    oval:'M80 7 C120 7 150 39 150 81 C150 125 120 158 80 158 C40 158 10 125 10 81 C10 39 40 7 80 7Z',
    rosette:'M80 7 C89 7 94 17 103 17 C112 17 122 13 130 22 C137 30 132 39 139 46 C146 53 155 57 152 69 C149 79 146 82 151 93 C157 107 146 113 138 117 C129 122 134 136 123 141 C111 146 107 140 98 145 C90 150 89 158 80 158 C71 158 70 150 62 145 C53 140 49 146 37 141 C26 136 31 122 22 117 C14 113 3 107 9 93 C14 82 11 79 8 69 C5 57 14 53 21 46 C28 39 23 30 30 22 C38 13 48 17 57 17 C66 17 71 7 80 7Z'
  });
  function render(id,options={}){
    if(!options||typeof options!=='object'||Array.isArray(options))throw new TypeError('Badge options must be an object');
    const item=records.get(id),instance=options.instance===undefined?'asset':options.instance,locked=!!options.locked;
    if(!item)throw new RangeError('Unknown badge artwork');
    if(!instances.has(instance))throw new RangeError('Unknown badge artwork instance');
    const outline=shapes[item.shape],paper=locked?'#C9C8BC':colors[item.tone],ink=locked?'#66705F':'#176B97';
    if(!outline||!paper)throw new Error('Invalid badge visual definition');
    const prefix='oba-'+instance+'-'+id+'-'+(locked?'l':'e'),clip=prefix+'-scene';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 176" aria-hidden="true" focusable="false" data-badge-art="'+id+'" data-art-motif="'+item.motif+'">'+
      '<defs><clipPath id="'+clip+'"><path d="'+outline+'" transform="translate(80 83) scale(.92) translate(-80 -83)"/></clipPath></defs>'+
      '<path d="'+outline+'" fill="'+paper+'" stroke="'+(locked?'#B0B1A4':'#DCCCB7')+'" stroke-width="1.8"/>'+
      '<path d="'+outline+'" transform="translate(80 83) scale(.956) translate(-80 -83)" fill="none" stroke="'+(locked?'#929A8B':'#A59C89')+'" stroke-width=".8"/>'+
      '<g clip-path="url(#'+clip+')" fill="'+ink+'" stroke="'+ink+'" stroke-width=".55" stroke-linejoin="round">'+
      '<path d="'+item.path+'" fill-rule="evenodd"/></g></svg>';
  }
  const api=Object.freeze({version:2,ids,catalogue,render});
  scope.OndeBadgeArt=api;
  if(scope.window)scope.window.OndeBadgeArt=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
