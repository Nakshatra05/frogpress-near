import './style.css'
const $ = id => document.getElementById(id)
if(location.pathname.replace(/\/$/,'')==='/studio'){
  $('landing').hidden=true
  $('studio').hidden=false
  document.title='Print studio — FrogPress'
  import('./studio.js').catch(()=>{$('sync').textContent='Offline';$('message').textContent='Could not load the studio. Reload this page.'})
}
