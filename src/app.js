(() => {
  'use strict';
  const $ = id => document.getElementById(id), NS = 'http://www.w3.org/2000/svg';
  const clone = value => JSON.parse(JSON.stringify(value));
  const round = n => Math.round(n * 1000) / 1000;
  const STORAGE = 'kanji-maker.library.v1', DRAFT = 'kanji-maker.draft.v1', META = 'kanji-maker.library-metadata.v1';
  let libraryMeta={id:crypto.randomUUID(),nextCodePoint:0xe000,revision:1};
  let font, defaultFont, fontLabel = 'Included Japanese serif', customFont = false;
  let model = {version:1, character:'長', name:'長 variant', basePath:'', operations:[]};
  let library = [], past = [], future = [], tool = 'erase', drag = null, saved = '', libraryId = null;
  let statusTimer, busy = false, storageError = false;
  let camera = {x:0,y:0,zoom:1}, spaceDown = false, selection = null, polygon = [], polygonHover = null;
  let parsedPath = '', parsedContours = null, pinch = null;
  const touches = new Map();
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const outlineChanged = () => !!model.originalPath && model.basePath !== model.originalPath;
  const hasEdits = () => !!model.operations.length || outlineChanged();
  function svgNode(tag, attrs = {}) {
    const e = document.createElementNS(NS, tag);
    for (const [k,v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    return e;
  }
  function status(message, error = false, sticky = false) {
    clearTimeout(statusTimer); $('status').textContent = message; $('status').classList.toggle('error', error);
    if (!sticky) statusTimer = setTimeout(() => { $('status').textContent = ''; }, error ? 8000 : 3500);
  }
  function persist(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (_) { if (!storageError) { storageError = true; status('Browser storage is unavailable or full. Download a library backup to keep your work.', true); } return false; }
  }
  const fingerprint = () => JSON.stringify(validModel(model));
  function saveDraft() { persist(DRAFT, {model, libraryId, saved}); }
  const fontFamily=()=>`KanjiMakerLibrary-${libraryMeta.id.replace(/-/g,'').slice(0,8)}`;
  const validCode=code=>Number.isInteger(code)&&code>=0xe000&&code<=0xf8ff;
  const modelFingerprint=value=>JSON.stringify(validModel(value));
  function currentLibraryEntry(){const entry=library.find(g=>g.id===libraryId);return entry&&modelFingerprint(entry.model)===fingerprint()?entry:null;}
  function allocateCode(meta=libraryMeta){if(meta.nextCodePoint>0xf8ff)throw Error('This library has used all its private character codes. Start a new library with an empty browser profile.');return meta.nextCodePoint++;}
  function persistLibrary(next=library){
    // Save the high-water mark first so a failed library save cannot recycle codes.
    if(!persist(META,libraryMeta)||!persist(STORAGE,next))return false;
    return true;
  }
  function normalizeLibraryCodes(){
    const used=new Set(),ids=new Set();
    libraryMeta.nextCodePoint=Math.max(libraryMeta.nextCodePoint,...library.map(g=>validCode(g.codePoint)?g.codePoint+1:0));
    for(const item of library){
      if(!item.id||ids.has(item.id))item.id=crypto.randomUUID();ids.add(item.id);
      if(!validCode(item.codePoint)||used.has(item.codePoint))item.codePoint=allocateCode();used.add(item.codePoint);
    }
  }
  function snapshot() { past.push(clone(model)); if (past.length > 70) past.shift(); future = []; }
  function refreshHistory() {
    $('undo').disabled = !past.length || busy; $('redo').disabled = !future.length || busy;
    $('reset').disabled = !hasEdits() || busy;
    $('editCount').textContent = [model.operations.length ? `${model.operations.length} edit${model.operations.length === 1 ? '' : 's'}` : '',outlineChanged() ? 'Outline edited' : ''].filter(Boolean).join(' · ') || 'Original character';
    for (const id of ['exportSvg','exportPng','exportFont','saveGlyph']) $(id).disabled = !model.basePath || busy || !!polygon.length;
    $('exportCharacterProject').disabled=!model.basePath||busy||!!polygon.length;
    for(const id of ['exportLibraryWord','exportLibraryFont','exportProject'])$(id).disabled=!library.length||busy;
    $('importProject').disabled=busy;
    document.querySelectorAll('#library button').forEach(b=>b.disabled=busy);
    const image=$('copyDocumentMode').value==='image',entry=model.basePath?currentLibraryEntry():null;
    $('copyDocument').disabled=busy||!!polygon.length||!model.basePath||(!image&&!entry);
    $('copyDocumentHint').textContent=image?'Copies a transparent picture that can be pasted without installing a font.':entry?`Copies editable text using ${fontFamily()}. Install the library font once in Word, and keep source formatting when pasting.`:'Save the current version to your library to copy it as editable text. Or choose Transparent image.';
  }
  function pathFor(points, straight = false) {
    if (!points.length) return '';
    const use = straight ? [points[0], points.at(-1)] : points;
    if (use.length === 1 || (use.length === 2 && use[0][0] === use[1][0] && use[0][1] === use[1][1])) {
      return `M${use[0][0]} ${use[0][1]}l.001 0`;
    }
    return use.map((p,i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join('');
  }
  function buildSvg(data, prefix, title = false) {
    const svg = svgNode('svg', {xmlns:NS, viewBox:'0 0 1000 1000', width:1000, height:1000});
    if (title) { const t = svgNode('title'); t.textContent = data.name; svg.append(t); }
    const defs = svgNode('defs'); svg.append(defs);
    let group = svgNode('g'); group.append(svgNode('path', {d:data.basePath, fill:'#000'}));
    for (const [i,op] of data.operations.entries()) {
      if (op.kind === 'erase' || op.kind === 'cut' || op.kind === 'polygon') {
        const id = `${prefix}-erase-${i}`, mask = svgNode('mask', {id, maskUnits:'userSpaceOnUse', x:0, y:0, width:1000, height:1000, 'mask-type':'luminance'});
        mask.append(svgNode('rect', {width:1000, height:1000, fill:'#fff'}));
        if (op.kind === 'cut') {
          const [a,b] = [op.points[0],op.points.at(-1)];
          mask.append(svgNode('rect', {x:Math.min(a[0],b[0]), y:Math.min(a[1],b[1]), width:Math.abs(b[0]-a[0]), height:Math.abs(b[1]-a[1]), fill:'#000'}));
        } else if (op.kind === 'polygon') mask.append(svgNode('path',{d:pathFor(op.points)+'Z',fill:'#000'}));
        else mask.append(svgNode('path', {d:pathFor(op.points), fill:'none', stroke:'#000', 'stroke-width':op.width, 'stroke-linecap':'round', 'stroke-linejoin':'round'}));
        defs.append(mask);
        const masked = svgNode('g', {mask:`url(#${id})`}); masked.append(group);
        group = svgNode('g'); group.append(masked);
      } else group.append(svgNode('path', {d:pathFor(op.points, op.kind === 'line'), fill:'none', stroke:'#000', 'stroke-width':op.width, 'stroke-linecap':'round', 'stroke-linejoin':'round'}));
    }
    svg.append(group); return svg;
  }
  function render() {
    $('artwork').replaceChildren(buildSvg(model, 'edit'));
    const preview = $('textPreview'); preview.replaceChildren();
    preview.append(document.createTextNode('あ'), buildSvg(model, 'preview'), document.createTextNode('い'));
    refreshHistory(); renderOutline(); renderPolygon();
  }
  function commit() { render(); saveDraft(); }
  function setTool(value) {
    if (drag) return;
    polygon = []; polygonHover = null;
    tool = value;
    document.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === value)));
    $('toolHint').textContent = {points:'Squares are outline points; circles are curve handles. Drag or use the X/Y fields. Arrow keys nudge; Alt makes a finer move.',erase:'Drag to erase. The checkerboard shows transparent areas.', cut:'Drag a rectangle around the part you want to remove.', polygon:'Click corners, then Apply cut or Enter. Click the first corner to close; Escape cancels.',draw:'Drag to add a stroke. Reduce Size for finer details.', line:'Drag to add a straight stroke. Hold Shift to snap its angle.',pan:'Drag to move around the character. Scroll to zoom; Fit shows the whole character.'}[value];
    $('canvas').dataset.mode = value;
    $('pointControls').hidden = value !== 'points'; $('polygonControls').hidden = value !== 'polygon';
    $('brushSize').disabled = $('brushValue').disabled = !['erase','draw','line'].includes(value);
    $('brushCursor').style.display = 'none';
    if (value === 'points' && model.basePath && !contours()) status('This imported outline cannot be point-edited. Erase and cut tools are still available.',true);
    renderOutline(); renderPolygon(); refreshHistory();
  }
  function rawPosition(e) {
    const p = new DOMPoint(e.clientX,e.clientY).matrixTransform($('canvas').getScreenCTM().inverse());
    return [p.x,p.y];
  }
  function position(e) { return rawPosition(e).map(n=>round(clamp(n,0,1000))); }
  function viewChanged() {
    const size = 1000/camera.zoom;
    camera.x = clamp(camera.x,0,1000-size); camera.y = clamp(camera.y,0,1000-size);
    $('canvas').setAttribute('viewBox',`${camera.x} ${camera.y} ${size} ${size}`);
    const value = String(camera.zoom), select = $('zoomLevel'); select.querySelector('[data-live]')?.remove();
    if (![...select.options].some(o=>o.value === value)) { const o = document.createElement('option'); o.dataset.live=''; o.value=value; o.textContent=`${Math.round(camera.zoom*100)}%`; select.append(o); }
    select.value = value; $('zoomOut').disabled = camera.zoom <= 1; $('zoomIn').disabled = camera.zoom >= 16;
    $('brushCursor').style.display = 'none'; renderOutline(); renderPolygon();
  }
  function zoomTo(value, anchor) {
    if (drag) return;
    const zoom = clamp(value,1,16), focus = anchor || (tool==='points' && activePoint()) || [camera.x+500/camera.zoom,camera.y+500/camera.zoom];
    const ratio = camera.zoom/zoom;
    camera = {zoom,x:focus[0]-(focus[0]-camera.x)*ratio,y:focus[1]-(focus[1]-camera.y)*ratio}; viewChanged();
  }
  function fitView() { if (!drag) { camera={x:0,y:0,zoom:1}; viewChanged(); } }
  $('zoomIn').addEventListener('click',()=>zoomTo(camera.zoom*1.5));
  $('zoomOut').addEventListener('click',()=>zoomTo(camera.zoom/1.5));
  $('zoomLevel').addEventListener('change',()=>zoomTo(Number($('zoomLevel').value)));
  $('zoomFit').addEventListener('click',fitView);
  $('canvas').addEventListener('wheel',e=>{ e.preventDefault(); zoomTo(camera.zoom*Math.exp(-clamp(e.deltaY,-300,300)*.0025),rawPosition(e)); },{passive:false});
  new ResizeObserver(()=>{renderOutline();renderPolygon();}).observe($('canvasFrame'));

  function parseOutline(path) {
    const tokens = path.match(/[MLQCZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) || [];
    if (path.replace(/[MLQCZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g,'').trim()) return null;
    const result = []; let i=0, current;
    while (i<tokens.length) {
      const cmd=tokens[i++], length={M:2,L:2,Q:4,C:6,Z:0}[cmd];
      if (length == null || i+length>tokens.length) return null;
      const values = tokens.slice(i,i+length).map(Number); i+=length;
      if (values.some(n=>!Number.isFinite(n))) return null;
      if (cmd === 'M') { current=[]; result.push(current); }
      if (!current) return null; current.push({cmd,values});
    }
    return result;
  }
  const outlineText = data => data.map(c=>c.map(p=>p.cmd+p.values.map(round).join(' ')).join('')).join('');
  function contours() {
    if (model.basePath !== parsedPath) { parsedPath=model.basePath; parsedContours=parseOutline(parsedPath); }
    return parsedContours;
  }
  function activePoint(data = contours()) {
    const command = data?.[selection?.contour]?.[selection?.command];
    if (!command || selection.pair == null || selection.pair*2+1>=command.values.length) return null;
    return command.values.slice(selection.pair*2,selection.pair*2+2);
  }
  function renderOutline() {
    const layer=$('outlineOverlay'); layer.replaceChildren();
    if (tool !== 'points') return;
    const data=contours(); if (!data) return;
    if (!data[selection?.contour]) selection=null;
    const unit=1000/(camera.zoom*($('canvas').getBoundingClientRect().width || 620));
    const handles = svgNode('g');
    for (const [ci,contour] of data.entries()) {
      layer.append(svgNode('path',{d:outlineText([contour]),class:`outline-hit${selection?.contour===ci?' selected':''}`,'data-contour':ci}));
      for (const [pi,p] of contour.entries()) {
        if (!p.values.length) continue; const pair=p.values.length/2-1, [x,y]=p.values.slice(-2);
        const active=selection?.contour===ci && selection.command===pi && selection.pair===pair;
        const anchor=svgNode('rect',{x:x-3.5*unit,y:y-3.5*unit,width:7*unit,height:7*unit,class:`anchor${active?' active-point':''}`,'data-contour':ci,'data-command':pi,'data-pair':pair,'data-command-type':p.cmd});
        const title=svgNode('title');title.textContent=`Outline point: ${round(x)}, ${round(y)}`;anchor.append(title);handles.append(anchor);
      }
    }
    if (selection?.contour != null) {
      const contour=data[selection.contour];
      for (const [pi,p] of contour.entries()) {
        if (p.cmd !== 'Q' && p.cmd !== 'C') continue;
        const previous=contour[pi-1]?.values.slice(-2), end=p.values.slice(-2);
        const selectedSegment=selection.command===pi || selection.command===pi-1;
        if (!selectedSegment || !previous) continue;
        for (let pair=0;pair<p.values.length/2-1;pair++) {
          const [x,y]=p.values.slice(pair*2,pair*2+2), root=p.cmd === 'C' && pair===1 ? end : previous;
          layer.append(svgNode('path',{d:`M${root[0]} ${root[1]}L${x} ${y}`,class:'handle-line'}));
          if (p.cmd==='Q') layer.append(svgNode('path',{d:`M${end[0]} ${end[1]}L${x} ${y}`,class:'handle-line'}));
          const active=selection.command===pi && selection.pair===pair;
          layer.append(svgNode('circle',{cx:x,cy:y,r:4*unit,class:`control-point${active?' active-point':''}`,'data-contour':selection.contour,'data-command':pi,'data-pair':pair}));
        }
      }
    }
    layer.append(handles);
    const p=activePoint(data);
    $('pointX').disabled=$('pointY').disabled=!p || busy;
    if (document.activeElement!==$('pointX')) $('pointX').value=p ? round(p[0]) : '';
    if (document.activeElement!==$('pointY')) $('pointY').value=p ? round(p[1]) : '';
    $('removeContour').disabled=selection?.contour == null || busy;
    $('pointDescription').textContent=p ? (selection.pair===(data[selection.contour][selection.command].values.length/2-1) ? 'Outline point · arrows to nudge' : 'Curve handle · arrows to nudge') : selection ? 'Drag the highlighted outline to move it.' : 'Select an outline or a square point.';
  }
  function shiftedOutline(source, dx, dy) {
    const data=clone(source), p=activePoint(data), contour=data[selection?.contour];
    if (!contour) return data;
    if (p) {
      dx=clamp(dx,-p[0],1000-p[0]); dy=clamp(dy,-p[1],1000-p[1]);
      const command=contour[selection.command], offset=selection.pair*2;
      const endpoint=offset===command.values.length-2;
      const first=contour[0], last=contour.findLast(c=>c.values.length);
      const sameEnds=first.values[0]===last.values.at(-2) && first.values[1]===last.values.at(-1);
      if (endpoint && sameEnds && command!==last && selection.command===0) { last.values[last.values.length-2]+=dx;last.values[last.values.length-1]+=dy; }
      else if (endpoint && sameEnds && command===last) {first.values[0]+=dx;first.values[1]+=dy;}
      command.values[offset]+=dx; command.values[offset+1]+=dy;
    } else {
      const xs=contour.flatMap(c=>c.values.filter((_,i)=>i%2===0)), ys=contour.flatMap(c=>c.values.filter((_,i)=>i%2));
      dx=clamp(dx,-Math.min(...xs),1000-Math.max(...xs)); dy=clamp(dy,-Math.min(...ys),1000-Math.max(...ys));
      contour.forEach(c=>{c.values=c.values.map((v,i)=>round(v+(i%2?dy:dx)));});
    }
    return data;
  }
  function applyPointDelta(dx,dy) {
    if (!selection || !contours() || busy || drag) return;
    const next=outlineText(shiftedOutline(contours(),dx,dy)); if (next===model.basePath) return;
    snapshot(); model.originalPath ||= model.basePath; model.basePath=next; commit();
  }
  for (const [id,axis] of [['pointX',0],['pointY',1]]) $(id).addEventListener('change',()=>{
    const point=activePoint(), value=Number($(id).value); if(!point || !Number.isFinite(value)) {renderOutline();return;}
    $(id).value=round(clamp(value,0,1000));
    const delta=Number($(id).value)-point[axis]; applyPointDelta(axis===0?delta:0,axis===1?delta:0);
  });
  $('removeContour').addEventListener('click',()=>{
    const data=contours();if(selection?.contour==null || !data || busy || drag)return;
    if(data.length===1){status('Use an erase or cut to remove the last remaining outline.',true);return;}
    snapshot();model.originalPath ||= model.basePath;
    const next=clone(data);next.splice(selection.contour,1);model.basePath=outlineText(next);selection=null;commit();
  });
  function renderPolygon() {
    const layer=$('polygonOverlay');layer.replaceChildren();
    $('applyPolygon').disabled=polygon.length<3; $('cancelPolygon').disabled=!polygon.length;
    if (!polygon.length) return;
    const points=polygonHover?[...polygon,polygonHover]:polygon, unit=1000/(camera.zoom*($('canvas').getBoundingClientRect().width || 620));
    layer.append(svgNode('polygon',{points:points.map(p=>p.join(',')).join(' ')}));
    for(const [x,y] of polygon)layer.append(svgNode('circle',{cx:x,cy:y,r:4*unit}));
  }
  function finishPolygon() {
    if(polygon.length<3 || busy)return;
    const area=polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
    if(Math.abs(area)<.1){status('Choose corners that enclose an area.',true);return;}
    snapshot();model.operations.push({kind:'polygon',width:1,points:clone(polygon)});polygon=[];polygonHover=null;commit();
  }
  $('applyPolygon').addEventListener('click',finishPolygon);
  $('cancelPolygon').addEventListener('click',()=>{polygon=[];polygonHover=null;renderPolygon();refreshHistory();});
  $('canvas').addEventListener('dblclick',e=>{if(tool==='polygon'){e.preventDefault();finishPolygon();}});
  function cursor(e) {
    const p = position(e), c = $('brushCursor');
    c.setAttribute('cx',p[0]); c.setAttribute('cy',p[1]); c.setAttribute('r',Number($('brushSize').value)/2);
    c.style.display = !['erase','draw','line'].includes(tool) || spaceDown || e.pointerType === 'touch' ? 'none' : '';
  }
  $('canvas').addEventListener('pointerdown', e => {
    if (busy || !model.basePath || (e.pointerType === 'mouse' && ![0,1].includes(e.button))) return;
    if(e.pointerType==='touch') {
      touches.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY});
      if(touches.size===2){
        if(drag)finishDrag({pointerId:drag.pointer},true);
        const [a,b]=[...touches.values()],middle={clientX:(a.clientX+b.clientX)/2,clientY:(a.clientY+b.clientY)/2};
        pinch={zoom:camera.zoom,distance:Math.max(1,Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)),anchor:rawPosition(middle)};
        for(const id of touches.keys())$('canvas').setPointerCapture(id);
        e.preventDefault();return;
      }
      if(pinch || touches.size>2)return;
    }
    if(drag)return;
    e.preventDefault(); $('canvas').focus();
    if(tool==='pan' || spaceDown || e.button===1){
      $('canvas').setPointerCapture(e.pointerId);
      drag={type:'pan',pointer:e.pointerId,start:[e.clientX,e.clientY],camera:{...camera}};
      $('canvas').classList.add('is-panning');return;
    }
    if(tool==='polygon'){
      const p=position(e),threshold=7*1000/(camera.zoom*$('canvas').getBoundingClientRect().width);
      if(polygon.length>=3 && Math.hypot(p[0]-polygon[0][0],p[1]-polygon[0][1])<threshold){finishPolygon();return;}
      if(!polygon.length || Math.hypot(p[0]-polygon.at(-1)[0],p[1]-polygon.at(-1)[1])>threshold)polygon.push(p);
      polygonHover=null;renderPolygon();refreshHistory();return;
    }
    if(tool==='points'){
      const hit=e.target.closest('[data-contour]');
      selection=hit?{contour:Number(hit.dataset.contour),command:hit.hasAttribute('data-command')?Number(hit.dataset.command):null,pair:hit.hasAttribute('data-pair')?Number(hit.dataset.pair):null}:null;
      if(!selection){renderOutline();return;}
      $('canvas').setPointerCapture(e.pointerId);
      drag={type:'point',pointer:e.pointerId,start:position(e),previous:clone(model),previousFuture:future,source:clone(contours()),changed:false};
      renderOutline();return;
    }
    $('canvas').setPointerCapture(e.pointerId);
    drag = {type:'stroke',pointer:e.pointerId, previous:clone(model), previousFuture:future}; snapshot();
    model.operations.push({kind:tool, width:Number($('brushValue').value), points:[position(e)]});
    cursor(e); render();
  });
  $('canvas').addEventListener('pointermove', e => {
    if(touches.has(e.pointerId))touches.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY});
    if(pinch && touches.size>=2){
      const [a,b]=[...touches.values()],rect=$('canvas').getBoundingClientRect();
      const zoom=clamp(pinch.zoom*Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)/pinch.distance,1,16),size=1000/zoom;
      camera={zoom,x:pinch.anchor[0]-((a.clientX+b.clientX)/2-rect.left)/rect.width*size,y:pinch.anchor[1]-((a.clientY+b.clientY)/2-rect.top)/rect.height*size};
      viewChanged();return;
    }
    if(tool==='polygon' && polygon.length){polygonHover=position(e);renderPolygon();}
    if(drag?.type==='pan' && drag.pointer===e.pointerId){
      const unit=1000/(drag.camera.zoom*$('canvas').getBoundingClientRect().width);
      camera={...drag.camera,x:drag.camera.x-(e.clientX-drag.start[0])*unit,y:drag.camera.y-(e.clientY-drag.start[1])*unit};viewChanged();return;
    }
    if(drag?.type==='point' && drag.pointer===e.pointerId){
      const p=position(e);let dx=p[0]-drag.start[0],dy=p[1]-drag.start[1];
      if(e.shiftKey){if(Math.abs(dx)>Math.abs(dy))dy=0;else dx=0;}
      const next=outlineText(shiftedOutline(drag.source,dx,dy));
      if(next!==model.basePath){if(!drag.changed){snapshot();drag.changed=true;}model.originalPath ||= drag.previous.basePath;model.basePath=next;render();}
      return;
    }
    cursor(e); if (!drag || e.pointerId !== drag.pointer) return;
    let p = position(e); const op = model.operations.at(-1), start = op.points[0];
    if (op.kind === 'line' && e.shiftKey) {
      const dx = p[0]-start[0], dy = p[1]-start[1], angle = Math.round(Math.atan2(dy,dx)/(Math.PI/4))*Math.PI/4, length = Math.hypot(dx,dy);
      p = [round(Math.max(0,Math.min(1000,start[0]+Math.cos(angle)*length))),round(Math.max(0,Math.min(1000,start[1]+Math.sin(angle)*length)))];
    }
    if (op.kind === 'cut' || op.kind === 'line') op.points = [start,p];
    else if (Math.hypot(p[0]-op.points.at(-1)[0],p[1]-op.points.at(-1)[1]) >= .6) op.points.push(p);
    render();
  });
  function finishDrag(e, cancel = false) {
    if (!drag || e.pointerId !== drag.pointer) return;
    const type=drag.type, op = type==='stroke'?model.operations.at(-1):null;
    if(type==='pan'){
      if(cancel){camera=drag.camera;viewChanged();}
      $('canvas').classList.remove('is-panning');
    }else if ((cancel && (type==='stroke' || drag.changed)) || (op?.kind === 'cut' && (op.points.length < 2 || Math.abs(op.points[0][0]-op.points.at(-1)[0]) < 1 || Math.abs(op.points[0][1]-op.points.at(-1)[1]) < 1))) {
      model = drag.previous; past.pop(); future = drag.previousFuture;
    }
    drag = null;
    if ($('canvas').hasPointerCapture(e.pointerId)) $('canvas').releasePointerCapture(e.pointerId);
    if(type!=='pan')commit();
  }
  function finishTouch(e,cancel){
    touches.delete(e.pointerId);finishDrag(e,cancel);
    if(pinch && !touches.size)pinch=null;
  }
  $('canvas').addEventListener('pointerup',e => finishTouch(e,false));
  $('canvas').addEventListener('pointercancel',e => finishTouch(e,true));
  $('canvas').addEventListener('lostpointercapture',e => finishDrag(e,true));
  $('canvas').addEventListener('pointerleave',() => { $('brushCursor').style.display = 'none'; });
  document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click',() => setTool(b.dataset.tool)));
  $('brushSize').addEventListener('input',() => { $('brushValue').value = $('brushSize').value; });
  $('brushValue').addEventListener('change',()=>{const v=Number($('brushValue').value);$('brushValue').value=Number.isFinite(v)?clamp(v,1,160):45;$('brushSize').value=$('brushValue').value;});
  $('showGrid').addEventListener('change',() => { $('grid').style.display = $('showGrid').checked ? '' : 'none'; });
  $('undo').addEventListener('click',() => {
    if (!past.length || drag || busy) return; polygon=[];polygonHover=null;future.push(clone(model)); model = past.pop(); $('glyphName').value = model.name; commit();
  });
  $('redo').addEventListener('click',() => {
    if (!future.length || drag || busy) return; polygon=[];polygonHover=null;past.push(clone(model)); model = future.pop(); $('glyphName').value = model.name; commit();
  });
  $('reset').addEventListener('click',() => { if (!drag && hasEdits()) { snapshot(); model.operations = []; model.basePath=model.originalPath || model.basePath;selection=null;polygon=[];polygonHover=null;commit(); } });
  $('glyphName').addEventListener('input',() => { model.name = $('glyphName').value; saveDraft();refreshHistory(); });
  $('help').addEventListener('click',() => $('helpDialog').showModal());
  function confirm(title, text) {
    $('confirmTitle').textContent = title; $('confirmText').textContent = text;
    return new Promise(resolve => {
      $('confirmDialog').addEventListener('close',() => resolve($('confirmDialog').returnValue === 'confirm'),{once:true});
      $('confirmDialog').returnValue = 'cancel'; $('confirmDialog').showModal();
    });
  }
  async function canReplace() {
    return (!hasEdits() && !polygon.length) || (fingerprint() === saved && !polygon.length) || await confirm('Replace the current character?', 'Save it to your library first if you want to keep this version.');
  }
  function glyphPath(face, character) {
    const code = character.codePointAt(0);
    if (!face.hasGlyphForCodePoint(code)) throw Error('This font does not contain that character. Choose another font.');
    const glyph = face.glyphForCodePoint(code), scale = 840/face.unitsPerEm;
    const x = (1000-glyph.advanceWidth*scale)/2, baseline = 800;
    const commands = {moveTo:'M',lineTo:'L',quadraticCurveTo:'Q',bezierCurveTo:'C',closePath:'Z'};
    return glyph.path.commands.map(c => {
      if (!(c.command in commands)) throw Error('Unsupported outline command.');
      return commands[c.command] + c.args.map((n,i) => round(i%2 ? baseline-n*scale : x+n*scale)).join(' ');
    }).join('');
  }
  async function loadCharacter(e) {
    e?.preventDefault(); if (busy) return;
    const chars = [...$('character').value.trim()];
    if (chars.length !== 1) { status('Enter one character to start with.',true); return; }
    if (!font) { status('The font is not ready yet. You can also choose a font file.',true); return; }
    try {
      const path = glyphPath(font,chars[0]); if (!path) throw Error('That character has no visible outline.');
      if (!await canReplace()) return;
      model = {version:1,character:chars[0],name:`${chars[0]} variant`,basePath:path,operations:[],fontLabel,customFont};
      model.originalPath=path;selection=null;polygon=[];polygonHover=null;fitView();
      libraryId = null; saved = ''; past = []; future = []; $('glyphName').value = model.name;
      commit(); status('Character loaded. Erase or draw to change its shape.');
    } catch (error) { status(error.message,true); }
  }
  $('characterForm').addEventListener('submit',loadCharacter);
  $('chooseFont').addEventListener('click',() => { if (!busy) $('fontFile').click(); });
  $('fontFile').addEventListener('change',async () => {
    const file = $('fontFile').files[0]; if (!file) return;
    try {
      if (!await canReplace()) return;
      status('Reading font…',false,true);
      const loaded = fontkit.create(new Uint8Array(await file.arrayBuffer()));
      if (loaded.fonts || typeof loaded.glyphForCodePoint !== 'function') throw Error('Choose an individual TTF, OTF or WOFF font, rather than a font collection.');
      const path = glyphPath(loaded,[...$('character').value.trim()][0] || '長');
      font = loaded; fontLabel = file.name; customFont = true; $('fontName').textContent = file.name;
      model = {version:1,character:[...$('character').value.trim()][0] || '長',name:`${[...$('character').value.trim()][0] || '長'} variant`,basePath:path,operations:[],fontLabel,customFont};
      model.originalPath=path;selection=null;polygon=[];polygonHover=null;fitView();
      libraryId = null; saved = ''; past = []; future = []; $('glyphName').value = model.name; commit();
      status(`Loaded ${file.name}.`);
    } catch (error) { status(`Could not use this font: ${error.message}`,true); }
    $('fontFile').value = '';
  });
  function download(blob, filename) {
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),30000);
  }
  const filename = () => (model.name.trim() || 'custom-kanji').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').slice(0,80);
  const svgText = () => new XMLSerializer().serializeToString(buildSvg(model,'glyph',true));
  async function raster(size,data=model) {
    const text = new XMLSerializer().serializeToString(buildSvg(data,'raster',true)), url = URL.createObjectURL(new Blob([text],{type:'image/svg+xml'}));
    try {
      const image = new Image(); image.src = url; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
      canvas.getContext('2d').drawImage(image,0,0,size,size); return canvas;
    } finally { URL.revokeObjectURL(url); }
  }
  $('exportSvg').addEventListener('click',() => download(new Blob([svgText()],{type:'image/svg+xml'}),`${filename()}.svg`));
  $('exportPng').addEventListener('click',async () => {
    try { const canvas = await raster(2048); const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/png')); if (!blob) throw Error('Could not create PNG.'); download(blob,`${filename()}.png`); }
    catch (e) { status(e.message,true); }
  });
  function validModel(data) {
    if (!data || data.version !== 1 || typeof data.basePath !== 'string' || !data.basePath || data.basePath.length > 1000000 || !/^[MmLlHhVvCcSsQqTtAaZz0-9+.,eE\s-]+$/.test(data.basePath)) throw Error('Invalid character outline.');
    if (!Array.isArray(data.operations) || data.operations.length > 1000) throw Error('Invalid editing history.');
    for (const op of data.operations) {
      if (!['erase','cut','polygon','draw','line'].includes(op.kind) || !Number.isFinite(op.width) || op.width < 1 || op.width > 500 || !Array.isArray(op.points) || !op.points.length || op.points.length > 50000) throw Error('Invalid stroke.');
      if(op.kind==='polygon' && op.points.length<3)throw Error('A polygon needs at least three corners.');
      for (const p of op.points) if (!Array.isArray(p) || p.length !== 2 || p.some(n => !Number.isFinite(n) || n < 0 || n > 1000)) throw Error('Invalid stroke coordinates.');
    }
    const originalPath=data.originalPath ?? data.basePath;
    if(typeof originalPath!=='string' || originalPath.length>1000000 || !/^[MmLlHhVvCcSsQqTtAaZz0-9+.,eE\s-]+$/.test(originalPath))throw Error('Invalid original outline.');
    return {version:1,character:String(data.character || '').slice(0,8),name:String(data.name || 'Custom kanji').slice(0,80),basePath:data.basePath,originalPath,operations:clone(data.operations),fontLabel:String(data.fontLabel || '').slice(0,160),customFont:!!data.customFont};
  }
  function renderLibrary() {
    const container = $('library'); container.replaceChildren();
    if (!library.length) { const empty = document.createElement('div'); empty.className = 'library-empty'; empty.textContent = 'Your saved characters will appear here.'; container.append(empty); }
    for (const item of library) {
      const row = document.createElement('div'); row.className = 'library-item';
      const load = document.createElement('button'); load.className = 'library-load'; load.title = `Edit ${item.model.name}`;
      const label=document.createElement('span');label.className='library-label';
      const name = document.createElement('span'); name.textContent = item.model.name || 'Untitled';
      const code=document.createElement('small');code.textContent=`U+${item.codePoint.toString(16).toUpperCase()}`;label.append(name,code);load.append(buildSvg(item.model,`library-${item.id}`),label);
      load.addEventListener('click',async () => {
        if (busy || !await canReplace()) return;
        model = clone(item.model); libraryId = item.id; saved = fingerprint(); past = []; future = [];selection=null;polygon=[];polygonHover=null;fitView();
        $('character').value = model.character; $('glyphName').value = model.name; commit(); status('Saved character opened.');
      });
      const remove = document.createElement('button'); remove.className = 'library-delete'; remove.textContent = '×'; remove.setAttribute('aria-label',`Delete ${item.model.name}`);
      remove.addEventListener('click',async () => {
        if (!await confirm('Remove saved character?', `Remove “${item.model.name}” from this browser’s library? The character currently on the canvas will stay.`)) return;
        const next=library.filter(g=>g.id!==item.id);libraryMeta.revision++;
        if(!persistLibrary(next))return;library=next;if(libraryId===item.id){libraryId=null;saved='';saveDraft();}renderLibrary();refreshHistory();
      });
      const copy=document.createElement('button');copy.className='library-copy';copy.textContent='⧉';copy.title=`Copy ${item.model.name} for another document`;copy.setAttribute('aria-label',copy.title);copy.addEventListener('click',()=>copyForDocument(item));
      row.append(load,copy,remove); container.append(row);
    }
    $('libraryFontName').textContent=`Font: ${fontFamily()}`;refreshHistory();
  }
  $('saveGlyph').addEventListener('click',() => {
    model.name = $('glyphName').value.trim() || `${model.character || 'Custom'} variant`; $('glyphName').value = model.name;
    const old=library.find(g=>g.id===libraryId),id=old?.id||crypto.randomUUID();let codePoint;
    try{codePoint=old?.codePoint??allocateCode();}catch(error){status(error.message,true);return;}
    const item = {id,codePoint,model:clone(model)};
    const next = library.filter(g => g.id !== id); next.unshift(item);
    libraryMeta.revision++;if (!persistLibrary(next)) return;
    library = next; libraryId = id; saved = fingerprint(); saveDraft(); renderLibrary(); status('Saved to your library.');
  });
  function appFile(glyphs,meta=libraryMeta){return new Blob([JSON.stringify({format:'kanji-maker-library',version:2,font:meta,glyphs},null,2)],{type:'application/json'});}
  $('exportProject').addEventListener('click',()=>download(appFile(library),'kanji-library.json'));
  $('exportCharacterProject').addEventListener('click',()=>download(appFile([{id:crypto.randomUUID(),codePoint:0xe000,model:clone(model)}],{id:crypto.randomUUID(),nextCodePoint:0xe001,revision:1}),`${filename()}.kanji.json`));
  $('importProject').addEventListener('click',() => $('projectFile').click());
  $('projectFile').addEventListener('change',async () => {
    const file = $('projectFile').files[0]; if (!file) return;
    try {
      if (file.size > 20000000) throw Error('This backup is too large.');
      const data = JSON.parse(await file.text());
      if (data.format !== 'kanji-maker-library' || ![1,2].includes(data.version) || !Array.isArray(data.glyphs) || data.glyphs.length > 2000) throw Error('Choose a Kanji Maker library app file.');
      const restore=!library.length&&data.version===2&&data.font&&/^[a-f0-9-]{16,64}$/i.test(data.font.id);
      const meta=restore?{id:data.font.id,nextCodePoint:Number.isInteger(data.font.nextCodePoint)&&data.font.nextCodePoint>=0xe000&&data.font.nextCodePoint<=0xf900?data.font.nextCodePoint:0xe000,revision:Number.isInteger(data.font.revision)&&data.font.revision>0?data.font.revision:1}:{...libraryMeta};
      const used=new Set(),ids=new Set();
      if(restore)meta.nextCodePoint=Math.max(meta.nextCodePoint,...data.glyphs.map(g=>validCode(g.codePoint)?g.codePoint+1:0));
      const incoming=data.glyphs.map(g=>{
        const model=validModel(g.model),id=restore&&typeof g.id==='string'&&/^[a-z0-9-]{1,80}$/i.test(g.id)&&!ids.has(g.id)?g.id:crypto.randomUUID();ids.add(id);
        const codePoint=restore&&validCode(g.codePoint)&&!used.has(g.codePoint)?g.codePoint:allocateCode(meta);used.add(codePoint);return{id,codePoint,model};
      });
      const next = [...incoming,...library],previousMeta=libraryMeta;meta.revision++;libraryMeta=meta;
      if(!persistLibrary(next)){libraryMeta=previousMeta;return;}
      library = next; renderLibrary(); status(`Imported ${incoming.length} character${incoming.length === 1 ? '' : 's'}${restore?' with their original codes and font identity':''}.`);
    } catch (error) { status(`Could not import: ${error.message}`,true); }
    $('projectFile').value = '';
  });
  $('copyCharacter').addEventListener('click',async () => {
    try { await navigator.clipboard.writeText('\uE000'); $('copyHint').hidden = false; status('Private character copied. Use it with your exported font.'); }
    catch (_) { status('Copy this character and use your exported font: \uE000',true,true); }
  });
  $('copyDocumentMode').addEventListener('change',refreshHistory);
  async function copyForDocument(entry){
    const image=$('copyDocumentMode').value==='image';
    try{
      if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw Error('This browser does not support formatted clipboard copying. Use a Word export or a downloaded PNG.');
      if(image){
        const blobPromise=raster(1024,entry?.model||model).then(canvas=>new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Could not create the clipboard image.')),'image/png')));
        await navigator.clipboard.write([new ClipboardItem({'image/png':blobPromise})]);status('Transparent image copied. Paste it into your document.');
      }else{
        if(!entry)throw Error('Save the current character to the library first.');
        const character=String.fromCodePoint(entry.codePoint);
        await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([character],{type:'text/plain'}),'text/html':new Blob([KanjiExports.clipboardHtml(character,fontFamily())],{type:'text/html'})})]);
        status('Formatted text copied. Paste with source formatting using the installed library font.');
      }
    }catch(error){status(`Could not copy: ${error.message}`,true);}
  }
  $('copyDocument').addEventListener('click',()=>copyForDocument(currentLibraryEntry()));
  document.addEventListener('keydown',e => {
    if (e.target.closest('input,textarea,select,dialog') || busy) return;
    if(e.key==='Escape'){
      if(drag){e.preventDefault();finishDrag({pointerId:drag.pointer},true);}
      else if(polygon.length){e.preventDefault();polygon=[];polygonHover=null;renderPolygon();refreshHistory();}
      return;
    }
    if(e.code==='Space' && !e.target.closest('button,a')){e.preventDefault();spaceDown=true;$('canvas').classList.add('space-pan');$('brushCursor').style.display='none';return;}
    if(drag)return;
    if(tool==='polygon' && e.key==='Enter' && polygon.length){e.preventDefault();finishPolygon();return;}
    if(tool==='points' && selection && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
      e.preventDefault();const step=e.altKey ? .1 : e.shiftKey ? 10 : 1;
      applyPointDelta(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0);return;
    }
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && key === 'z') { e.preventDefault(); $(e.shiftKey ? 'redo' : 'undo').click(); }
    else if ((e.ctrlKey || e.metaKey) && key === 'y') { e.preventDefault(); $('redo').click(); }
    else if(!e.ctrlKey && !e.metaKey && !e.altKey && key==='0'){e.preventDefault();fitView();}
    else if(!e.ctrlKey && !e.metaKey && ['+','='].includes(key)){e.preventDefault();zoomTo(camera.zoom*1.5);}
    else if(!e.ctrlKey && !e.metaKey && key==='-'){e.preventDefault();zoomTo(camera.zoom/1.5);}
    else if (!e.ctrlKey && !e.metaKey && !e.altKey && {n:1,e:1,r:1,p:1,d:1,l:1,h:1}[key]) { e.preventDefault(); setTool({n:'points',e:'erase',r:'cut',p:'polygon',d:'draw',l:'line',h:'pan'}[key]); }
  });
  document.addEventListener('keyup',e=>{if(e.code==='Space'){spaceDown=false;$('canvas').classList.remove('space-pan');}});
  window.addEventListener('blur',()=>{spaceDown=false;$('canvas').classList.remove('space-pan');if(drag)finishDrag({pointerId:drag.pointer},true);touches.clear();pinch=null;});

  // Trace the finished alpha silhouette, preserving holes, then simplify its
  // contours. The downloadable TTF contains ordinary closed outline contours.
  function traceContours(canvas) {
    const size = canvas.width, pixels = canvas.getContext('2d').getImageData(0,0,size,size).data;
    const black = new Uint8Array(size*size); let filled = 0;
    for (let i=0;i<black.length;i++) { black[i] = pixels[i*4+3] >= 128 ? 1 : 0; filled += black[i]; }
    if (!filled) throw Error('The character is empty. Undo an erase or draw a stroke first.');
    const stride = size+1, edges = new Map();
    function edge(a,b) { const out = edges.get(a); if (out) out.push(b); else edges.set(a,[b]); }
    for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
      const i = y*size+x; if (!black[i]) continue; const a = y*stride+x;
      if (!y || !black[i-size]) edge(a,a+1);
      if (x===size-1 || !black[i+1]) edge(a+1,a+stride+1);
      if (y===size-1 || !black[i+size]) edge(a+stride+1,a+stride);
      if (!x || !black[i-1]) edge(a+stride,a);
    }
    function simplify(points) {
      // Ramer–Douglas–Peucker on the two halves of a closed contour.
      let far = 1, distance = 0;
      for (let i=1;i<points.length;i++) { const d = (points[i][0]-points[0][0])**2+(points[i][1]-points[0][1])**2; if (d>distance) { distance=d; far=i; } }
      function open(list) {
        const keep = new Set([0,list.length-1]), stack = [[0,list.length-1]];
        while (stack.length) {
          const [a,b] = stack.pop(), p=list[a], q=list[b], dx=q[0]-p[0], dy=q[1]-p[1], denominator=dx*dx+dy*dy;
          let max=.6*.6, index=-1;
          for (let i=a+1;i<b;i++) {
            const t=denominator ? Math.max(0,Math.min(1,((list[i][0]-p[0])*dx+(list[i][1]-p[1])*dy)/denominator)) : 0;
            const d=(list[i][0]-p[0]-t*dx)**2+(list[i][1]-p[1]-t*dy)**2;
            if (d>max) { max=d; index=i; }
          }
          if (index>=0) { keep.add(index); stack.push([a,index],[index,b]); }
        }
        return [...keep].sort((a,b)=>a-b).map(i=>list[i]);
      }
      return [...open(points.slice(0,far+1)).slice(0,-1), ...open([...points.slice(far),points[0]]).slice(0,-1)];
    }
    const contours = [];
    while (edges.size) {
      const start = edges.keys().next().value; let v=start; const points=[];
      do {
        points.push([v%stride,Math.floor(v/stride)]);
        const out = edges.get(v); if (!out?.length) throw Error('Could not close an outline contour.');
        const next = out.pop(); if (!out.length) edges.delete(v); v=next;
      } while (v!==start);
      if (points.length<4) continue;
      const reduced = simplify(points).map(([x,y])=>[x,size-y]).reverse();
      if (reduced.length>=3) contours.push(reduced);
    }
    if (!contours.length) throw Error('The character has no visible outline.');
    if (contours.reduce((n,c)=>n+c.length,0)>32000 || contours.length>2000) throw Error('Too much detail for one font glyph. Export SVG instead or simplify the edits.');
    return contours;
  }
  function makeFont(contours, family, licence) {
    return KanjiExports.makeFont([{codePoint:0xe000,contours}],family,licence);
  }
  async function outlineForModel(data){
    const source=parseOutline(data.basePath),native=!data.operations.length&&source?.length&&source.every(c=>c.every(p=>p.cmd!=='C'));
    return native?source.map(c=>c.flatMap(p=>{
      if(p.cmd==='Z')return[];
      const point=(i,on)=>[Math.round(p.values[i]*2.048),Math.round((1000-p.values[i+1])*2.048),on];
      return p.cmd==='Q'?[point(0,false),point(2,true)]:[point(0,true)];
    })):traceContours(await raster(2048,data));
  }
  async function buildLibraryFont(items,family,revision){
    const entries=[];
    for(const [i,item] of items.entries()){
      status(`Preparing ${i+1} of ${items.length} characters…`,false,true);
      await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
      try{entries.push({codePoint:item.codePoint,contours:await outlineForModel(item.model)});}
      catch(error){throw Error(`${item.model.name||'Untitled'}: ${error.message}`);}
    }
    // Ordinary Japanese characters used in names are included for readable labels
    // when the Word document is opened on a machine without Japanese system fonts.
    const normal=new Set(items.flatMap(g=>[...`${g.model.name}${g.model.character}`]).map(c=>c.codePointAt(0)).filter(c=>c>127&&!validCode(c)));
    for(const codePoint of normal){
      const face=defaultFont?.hasGlyphForCodePoint(codePoint)?defaultFont:font?.hasGlyphForCodePoint(codePoint)?font:null;
      if(!face)continue;
      const path=glyphPath(face,String.fromCodePoint(codePoint));
      if(path)entries.push({codePoint,contours:await outlineForModel({basePath:path,operations:[],name:'Label'})});
    }
    const customSources=[...new Set(items.filter(g=>g.model.customFont).map(g=>g.model.fontLabel))];
    const licence=INCLUDED_FONT_LICENSE+(customSources.length?`\nAdditional outlines were created from user-selected fonts: ${customSources.join(', ')}. Their source licences apply to those outlines.`:'');
    const bytes=KanjiExports.makeFont(entries,family,licence,revision),check=fontkit.create(bytes);
    if(!items.every(g=>check.hasGlyphForCodePoint(g.codePoint)))throw Error('Library font validation failed.');
    return bytes;
  }
  async function exportLibrary(kind){
    if(busy||!library.length)return;busy=true;refreshHistory();
    const items=clone(library),family=fontFamily(),revision=libraryMeta.revision;
    try{
      const bytes=await buildLibraryFont(items,family,revision);
      if(kind==='word')download(KanjiExports.makeDocx(bytes,family,items.map(g=>({codePoint:g.codePoint,name:g.model.name,character:g.model.character}))),'kanji-library.docx');
      else download(new Blob([bytes],{type:'font/ttf'}),`${family}.ttf`);
      status(kind==='word'?'Word library downloaded with its font embedded.':'Library font downloaded. Install this file once; update it after changing the library.');
    }catch(error){status(`Could not export library: ${error.message}`,true);}
    finally{busy=false;refreshHistory();}
  }
  $('exportLibraryFont').addEventListener('click',()=>exportLibrary('font'));
  $('exportLibraryWord').addEventListener('click',()=>exportLibrary('word'));
  $('exportFont').addEventListener('click',async () => {
    if (busy) return; busy=true; refreshHistory(); status('Building the font…',false,true);
    try {
      await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
      const shape=await outlineForModel(model);
      const family=`KanjiMaker-${Date.now().toString(36)}`;
      const licence=model.customFont ? `Created with Kanji Maker from ${model.fontLabel || 'an uploaded font'}. The source font licence applies to derived outlines.` : INCLUDED_FONT_LICENSE;
      const bytes=makeFont(shape,family,licence);
      // Validate using the same font parser used to load source characters.
      const check=fontkit.create(bytes); if(!check.hasGlyphForCodePoint(0xe000))throw Error('Font validation failed.');
      download(new Blob([bytes],{type:'font/ttf'}),`${family}.ttf`);
      $('copyHint').hidden=false; status('Font downloaded. Install it, then copy the private character and select the new font in your app.');
    } catch(error) { status(`Could not export font: ${error.message}`,true); }
    finally { busy=false; refreshHistory(); }
  });

  async function start() {
    try {
      try{
        const meta=JSON.parse(localStorage.getItem(META)||'null');
        if(meta&&typeof meta.id==='string'&&/^[a-f0-9-]{16,64}$/i.test(meta.id))libraryMeta={id:meta.id,nextCodePoint:Number.isInteger(meta.nextCodePoint)&&meta.nextCodePoint>=0xe000&&meta.nextCodePoint<=0xf900?meta.nextCodePoint:0xe000,revision:Number.isInteger(meta.revision)&&meta.revision>0?meta.revision:1};
        const stored=JSON.parse(localStorage.getItem(STORAGE)||'[]');if(Array.isArray(stored))library=stored.map(g=>({id:String(g.id).replace(/[^a-zA-Z0-9-]/g,''),codePoint:g.codePoint,model:validModel(g.model)}));
        normalizeLibraryCodes();persistLibrary();
      }catch(_){library=[];status('The stored library could not be read. You can import an app file.',true);}
      renderLibrary(); refreshHistory();
      await new Promise(resolve=>setTimeout(resolve,0));
      const raw=atob(INCLUDED_FONT), bytes=new Uint8Array(raw.length); for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
      font=defaultFont=fontkit.create(bytes);
      let restored=false;
      try {
        const draft=JSON.parse(localStorage.getItem(DRAFT)||'null');
        if(draft?.model){model=validModel(draft.model);libraryId=typeof draft.libraryId==='string'?draft.libraryId:null;saved=String(draft.saved||'');
          if(saved){try{saved=JSON.stringify(validModel(JSON.parse(saved)));}catch(_){saved='';}}
          restored=true;}
      } catch (_) {}
      if(!restored){const path=glyphPath(font,'長');model={version:1,character:'長',name:'長 variant',basePath:path,originalPath:path,operations:[],fontLabel,customFont:false};}
      $('character').value=model.character; $('glyphName').value=model.name; setTool('erase');render(); saveDraft();
      status(restored?'Your previous character is ready.':'Ready. Erase or draw to change the character.');
    } catch(error) { status(`Could not load the included font: ${error.message}. Use Choose font to load a TTF or OTF file.`,true,true); refreshHistory(); }
  }
  start();
})();
