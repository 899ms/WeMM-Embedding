'use strict';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DATA_REVISION = new URL(document.currentScript.src).searchParams.get('v') || 'dev';
let caseData;
let currentCase = new URLSearchParams(location.search).get('example') || 'video';
const CASE_MODEL = '9B';
let caseVideoObserver;

function mediaHTML(asset, itemId, query = false) {
  if (asset.kind === 'frames') {
    return `<video class="benchmark-video" controls muted loop playsinline preload="metadata" poster="${asset.preview.path}" aria-label="${escapeHTML(asset.alt)}"><source src="${asset.playback.path}" type="${asset.playback.type}">Your browser does not support this video preview.</video>`;
  }
  return `<button type="button" class="benchmark-image ${query ? 'reference-image' : asset.isVideo ? 'video-thumbnail' : ''}" data-enlarge="${escapeHTML(itemId)}" aria-label="${asset.isVideo ? 'Play video preview' : 'Enlarge'}: ${escapeHTML(asset.alt)}"><img src="${asset.path}" alt="${escapeHTML(asset.alt)}" width="${asset.width}" height="${asset.height}" loading="lazy"><span aria-hidden="true">${asset.isVideo ? '▶' : '↗'}</span></button>`;
}

function renderCase(key) {
  caseVideoObserver?.disconnect();
  $$('.benchmark-video').forEach(video => video.pause());
  currentCase = key;
  const scene = caseData.cases.find(item => item.id === key);
  $$('[data-case]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.case === key)));
  const ranking = scene.rankings[CASE_MODEL];
  const best = ranking[0];
  const asset = scene.assets[best.id];
  const topCard = `<article class="retrieval-card top-result" data-result-id="${escapeHTML(best.id)}" data-relevant="${best.relevant}"><div class="retrieval-card-top"><span class="rank">TOP 1</span><span class="match-status"><span aria-hidden="true">✓</span> Correct match</span></div><div class="result-media">${mediaHTML(asset,best.id)}</div><div class="retrieval-card-bottom"><h3>${escapeHTML(asset.alt)}</h3><span class="match-confirmation">Matches the benchmark annotation</span>${asset.kind === 'frames' ? '<span class="video-preview-note">Sampled-frame preview · silent</span>' : ''}</div></article>`;
  const comparisons = ranking.slice(1).map((result,index) => {
    const asset = scene.assets[result.id];
    const preview = asset.kind === 'frames' ? {...asset.preview, alt:asset.alt, isVideo:true} : asset;
    const note = scene.comparison_annotations[result.id];
    return `<article class="nearby-candidate" data-result-id="${escapeHTML(result.id)}" data-relevant="${result.relevant}" data-assessment="${escapeHTML(note.assessment)}"><div class="nearby-media">${mediaHTML(preview,result.id)}</div><div class="nearby-copy"><div class="nearby-rank"><span>TOP ${index+2}</span><span>${escapeHTML(note.label)}</span></div><h4>${escapeHTML(note.title)}</h4><p>${escapeHTML(note.detail)}</p></div></article>`;
  }).join('');
  const longQuery = scene.query.length > 300;
  const queryPreview = longQuery ? scene.query.slice(0,scene.query.indexOf('.')+1) : scene.query;
  const queryMedia = scene.query_asset ? `<div class="query-reference"><span class="micro">REFERENCE IMAGE</span>${mediaHTML(scene.query_asset,scene.query_id,true)}</div>` : '';
  $('#scene-panel').innerHTML = `<div class="case-overview"><div><span class="micro">${escapeHTML(scene.dataset)}</span><h3>${escapeHTML(scene.title)}</h3></div><span class="pool-size"><strong>${scene.candidate_count.toLocaleString('en-US')}</strong> candidates searched</span></div><div class="case-body"><div class="query-panel">${queryMedia}<span class="micro">${scene.query_asset ? 'MODIFICATION' : longQuery ? 'QUERY EXCERPT' : 'TEXT QUERY'}</span><blockquote class="benchmark-query">“${escapeHTML(queryPreview)}”</blockquote>${longQuery ? `<details class="full-query"><summary>Read the full query</summary><p>${escapeHTML(scene.query)}</p></details>` : ''}<div class="case-model-caption">WeMM-Embedding-${CASE_MODEL}<span>4,096 dimensions</span></div></div><div class="results-panel">${topCard}<p class="case-reading">${escapeHTML(scene.description)}</p><section class="nearby-results" aria-label="Next retrieved candidates with reviewed semantic fit"><div class="nearby-heading"><h3>Nearby results</h3><span>Original retrieval order</span></div><div class="nearby-grid">${comparisons}</div><p class="nearby-note">Top-2/3 are unannotated in this benchmark. Unannotated does not necessarily mean incorrect.</p></section></div></div><details class="case-protocol"><summary>About this example <span aria-hidden="true">+</span></summary><div><p>${escapeHTML(scene.notes)}</p><p>${escapeHTML(scene.comparison_note)} Labels describe the visible match to the query. Benchmark annotations are included in the case data.</p><p><strong>Original query input</strong></p><pre>${escapeHTML(scene.original_query)}</pre><p><a href="${scene.evidence_path}?v=${encodeURIComponent(DATA_REVISION)}" target="_blank" rel="noopener">Download case data and benchmark annotations ↗</a></p></div></details>`;
  $$('[data-enlarge]').forEach(button => button.addEventListener('click', () => {
    const asset = scene.assets[button.dataset.enlarge];
    const viewer = $('#document-viewer');
    $('#document-viewer-title').textContent = button.dataset.enlarge === scene.query_id ? 'Inspect the reference image' : 'Inspect the retrieved image';
    const img = viewer.querySelector('img');
    const video = $('#viewer-video');
    video.pause(); video.removeAttribute('src'); video.load();
    const isVideo = asset.kind === 'frames';
    img.hidden = isVideo; video.hidden = !isVideo;
    if (isVideo) {
      $('#document-viewer-title').textContent = 'Watch the retrieved video';
      video.src = asset.playback.path; video.poster = asset.preview.path;
      video.setAttribute('aria-label', asset.alt); video.muted = true;
    } else {
      img.src = asset.path; img.alt = asset.alt;
      img.width = asset.width; img.height = asset.height;
    }
    viewer.querySelector('.footnote').textContent = `${scene.dataset} · ${asset.alt}. ${isVideo ? 'Silent sampled-frame preview. Playback speed is illustrative.' : 'Web preview resized from the benchmark source.'}`;
    $('#scene-panel .benchmark-video')?.pause();
    viewer.showModal();
    if (isVideo) video.play().catch(() => {});
  }));
  const video = $('#scene-panel .benchmark-video');
  if (video) {
    video.muted = true;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    caseVideoObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting && !reducedMotion && !document.hidden) video.play().catch(() => {});
        else video.pause();
      }
    }, {threshold:0.3});
    caseVideoObserver.observe(video);
  }
}

async function loadCases() {
  try {
    const response = await fetch(`data/cases.json?v=${encodeURIComponent(DATA_REVISION)}`, {cache: 'no-store'});
    if (!response.ok) throw new Error('Example data unavailable');
    caseData = await response.json();
    if (!caseData.cases.some(scene => scene.id === currentCase)) currentCase = 'video';
    const caseOrder = ['video','detail','quantity','fashion','text','chart'];
    caseData.cases.sort((a,b) => caseOrder.indexOf(a.id) - caseOrder.indexOf(b.id));
    $('#case-buttons').innerHTML = caseData.cases.map((scene,index) => `<button type="button" data-case="${scene.id}" aria-pressed="false"><span>${String(index+1).padStart(2,'0')}</span>${escapeHTML(scene.label)}</button>`).join('');
    $$('[data-case]').forEach(button => button.addEventListener('click', () => renderCase(button.dataset.case)));
    renderCase(currentCase);
  } catch (_) {
    $('#scene-panel').innerHTML = '<p class="case-loading" role="alert">Examples could not be loaded. Please reload this page.</p>';
  }
}
$('#document-viewer').addEventListener('close', () => $('#viewer-video').pause());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) $$('video').forEach(video => video.pause());
});
$('#close-document').addEventListener('click', () => $('#document-viewer').close());
$('#document-viewer').addEventListener('click', event => {
  if (event.target !== $('#document-viewer')) return;
  const box = event.target.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) event.target.close();
});
loadCases();

function renderBenchmark(data) {
  const rows = data.v2;
  const columns = [['overall','AVG'],['image','Image'],['video','Video'],['document','VisDoc']];
  $('#results-table').innerHTML = `<caption>MMEB-v2 · all comparisons from the official README</caption><thead><tr><th scope="col">Model</th><th scope="col">Size</th>${columns.map(([,label]) => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr class="${row.model === 'WeMM-Embedding' ? 'ours' : ''}"><td>${escapeHTML(row.model)}</td><td>${escapeHTML(row.size)}</td>${columns.map(([column]) => `<td>${row[column].toFixed(1)}</td>`).join('')}</tr>`).join('')}</tbody>`;
  $('#benchmark-note').textContent = '78 datasets. Image/video: Hit@1; visual documents: NDCG@5. All reported README comparisons are listed below; higher is better. † Closed-source submission without public weights or a public inference endpoint.';
}

function renderDimension(data, index) {
  const point = data.mrl.points[index];
  const dimension = point.dimension;
  const fraction = dimension / data.mrl.baseline_dimension;
  $('#dimension-value').textContent = dimension.toLocaleString('en-US');
  $('#dimension').setAttribute('aria-valuetext', `${dimension} dimensions`);
  $('#image-retention').textContent = point.image_retention.toFixed(1) + '%';
  $('#video-retention').textContent = point.video_retention.toFixed(1) + '%';
  $('#storage').textContent = `${(1e6 * dimension * 2 / 1e9).toFixed(3)} GB · ${fraction === 1 ? 'full size' : '1/' + (1 / fraction) + ' of full size'}`;
  $('#vector-grid').innerHTML = Array.from({length:64}, (_,i) => `<i class="${i < Math.round(64 * fraction) ? 'active' : ''}"></i>`).join('');
}

async function loadData() {
  try {
    const response = await fetch(`data/benchmarks.json?v=${encodeURIComponent(DATA_REVISION)}`, {cache: 'no-store'});
    if (!response.ok) throw new Error('Unable to load benchmark data.');
    const data = await response.json();
    renderBenchmark(data);
    $('#dimension').disabled = false;
    $('#dimension').addEventListener('input', event => renderDimension(data, Number(event.target.value)));
    renderDimension(data, 0);
    const descriptions = {'2B':'Compact multimodal model','4B':'Mid-size multimodal model','9B':'Largest multimodal model'};
    $('#model-list').innerHTML = data.models.map(model => `<a class="model-card" href="https://huggingface.co/tencent/WeMM-Embedding-${model.size}"><div class="model-card-top"><span class="micro">WeMM-Embedding</span><span aria-hidden="true">↗</span></div><h3 class="model-size">${model.size}</h3><p class="model-description">${descriptions[model.size]}</p><div class="model-dimensions"><span>Embedding dimensions</span><strong>64 – ${model.max_dimension.toLocaleString('en-US')}</strong><small>Selected sizes · Matryoshka representations</small></div><span class="model-cta">Explore model <span aria-hidden="true">→</span></span></a>`).join('');
  } catch (_) {
    $('#data-error').hidden = false;
    $('#data-error').textContent = 'Benchmark data could not be loaded. Please reload, or open the official results linked above.';
  }
}
loadData();

$('#copy-citation').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('#citation').textContent);
    $('#copy-status').textContent = 'Copied.';
  } catch (_) {
    const range = document.createRange();
    range.selectNodeContents($('#citation'));
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    $('#copy-status').textContent = 'Citation selected. Use your browser’s copy command.';
  }
});
