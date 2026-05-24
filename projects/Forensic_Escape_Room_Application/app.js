/*! Forensic Escape Room – Unified Logic (balanced build) */
(function(){
  "use strict";

  // ---------------- Utilities ----------------
  function $(sel){ return document.querySelector(sel); }
  function $all(sel){ return Array.from(document.querySelectorAll(sel)); }
  function on(el, ev, fn){ if(el) el.addEventListener(ev, fn, false); }

  function getAnyById(ids){
    for (var i=0;i<ids.length;i++){
      var el = document.getElementById(ids[i]);
      if (el) return el;
    }
    return null;
  }

  function toast(msg){
    try {
      var t = document.createElement('div');
      t.textContent = msg;
      t.style.position='fixed'; t.style.bottom='20px'; t.style.right='20px';
      t.style.background='#111'; t.style.color='#fff';
      t.style.padding='10px 14px'; t.style.borderRadius='8px';
      t.style.zIndex='9999'; t.style.boxShadow='0 6px 18px rgba(0,0,0,.35)';
      document.body.appendChild(t);
      setTimeout(function(){ if(t&&t.parentNode){ t.parentNode.removeChild(t); } }, 2600);
    } catch(e){ alert(msg); }
  }

  // ---------------- Hash-synced timer (file:// safe) ----------------
  function parseHash(){
    var h = (location.hash||"").replace(/^#/, "");
    var out = {};
    h.split("&").forEach(function(pair){
      if (!pair) return;
      var kv = pair.split("=");
      if (kv.length===2){ out[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]); }
    });
    return out;
  }
  function buildHash(obj){
    var parts = [];
    for (var k in obj){
      if (obj[k]===undefined || obj[k]===null || obj[k]==="") continue;
      parts.push(encodeURIComponent(k)+"="+encodeURIComponent(String(obj[k])));
    }
    return parts.length ? "#"+parts.join("&") : "";
  }
  function updateHash(obj){
    var current = parseHash();
    for (var k in obj){ current[k] = obj[k]; }
    var newHash = buildHash(current);
    try { history.replaceState(null, "", location.pathname + newHash); } catch(e){ location.hash = newHash; }
  }

  var DEFAULT_TOTAL = 300;
  var timer = { left: DEFAULT_TOTAL, paused: false, deadline: 0, intervalId: null };

  function nowMs(){ return (new Date()).getTime(); }
  function fmt(s){ var m=Math.floor(s/60),sec=s%60; return (m<10?"0":"")+m+":"+(sec<10?"0":"")+sec; }
  function renderTimer(){ var el = $("#countdown"); if (el) el.textContent = fmt(timer.left); }

  function readTimer(){
    var h = parseHash();
    var p = (h.p === "1");
    var t = parseInt(h.t||"",10);
    var d = parseInt(h.d||"",10);
    if (!isNaN(t) && t >= 0) timer.left = t; else timer.left = DEFAULT_TOTAL;
    if (!isNaN(d) && d > 0) timer.deadline = d; else timer.deadline = nowMs() + timer.left*1000;
    timer.paused = p;
    if (!h.t && !h.d){
      timer.left = DEFAULT_TOTAL; timer.paused = false; timer.deadline = nowMs() + DEFAULT_TOTAL*1000;
      updateHash({ t: timer.left, p: 0, d: timer.deadline });
    }
  }
  function writeTimer(){
    var payload = { t: timer.left, p: timer.paused ? 1 : 0 };
    if (!timer.paused && timer.deadline) payload.d = timer.deadline;
    updateHash(payload);
    // propagate hash to internal links
    var h = location.hash || "";
    if (h){
      $all('a[href$=".html"]').forEach(function(a){
        try {
          var url = new URL(a.getAttribute("href"), location.href);
          url.hash = h;
          a.setAttribute("href", url.pathname + url.hash);
        } catch(e){ /* ignore */ }
      });
    }
  }
  function recalc(){
    if (!timer.paused && timer.deadline){
      var rem = Math.max(0, Math.floor((timer.deadline - nowMs())/1000));
      timer.left = rem;
    }
  }
  function tick(){
    recalc();
    renderTimer();
    if (timer.left <= 0){
      stopTimer();
      try { alert("Time is up!"); } catch(e){}
      try { window.location.href = 'main_menu.html'; } catch(e){}
    }
    writeTimer();
  }
  function startTimer(){
    timer.paused = false;
    timer.deadline = nowMs() + DEFAULT_TOTAL*1000;
    timer.left = DEFAULT_TOTAL;
    if (timer.intervalId) clearInterval(timer.intervalId);
    timer.intervalId = setInterval(tick, 1000);
    renderTimer(); writeTimer();
  }
  function pauseTimer(){
    if (timer.paused) return;
    recalc();
    timer.paused = true;
    timer.deadline = 0;
    renderTimer(); writeTimer();
  }
  function resumeTimer(){
    if (!timer.paused) return;
    timer.paused = false;
    timer.deadline = nowMs() + timer.left*1000;
    renderTimer(); writeTimer();
  }
  function stopTimer(){
    if (timer.intervalId){ clearInterval(timer.intervalId); timer.intervalId = null; }
  }
  function wireTimerUI(){
    readTimer();
    renderTimer();
    if (!timer.paused && timer.left > 0){
      if (timer.intervalId) clearInterval(timer.intervalId);
      timer.intervalId = setInterval(tick, 1000);
    }
    var pauseBtn = $("#pauseBtn");
    if (pauseBtn){
      pauseBtn.style.cursor = "pointer";
      function syncBtn(){
        pauseBtn.textContent = timer.paused ? "Resume" : "Pause";
        pauseBtn.style.backgroundColor = timer.paused ? "#0275d8" : "#d9534f";
      }
      syncBtn();
      on(pauseBtn, "click", function(){
        if (timer.paused) resumeTimer(); else pauseTimer();
        syncBtn();
      });
    }
    var startBtn = $all("button").find(function(b){ return (b.textContent||"").trim().toLowerCase()==="start"; });
    if (startBtn){
      on(startBtn, "click", function(){ startTimer(); });
    }
  }

  // ---------------- Completion helper ----------------
  function setRoomComplete(n){
    try {
      localStorage.setItem("room"+n+"_complete","true");
      localStorage.setItem("room"+n+"Complete","true");
      var completed=[]; try{ completed=JSON.parse(localStorage.getItem("completedRooms")||"[]"); }catch(e){ completed=[]; }
      if (completed.indexOf(n)===-1){ completed.push(n); localStorage.setItem("completedRooms", JSON.stringify(completed)); }
    } catch(e){ /* ignore */ }
  }

  // ---------------- Smart Hint ----------------
  function wireSmartHint(){
    var btn = $("#smartHintBtn"); if(!btn) return;
    btn.style.background = "#1e90ff"; btn.style.color="#fff"; btn.style.border="none";
    btn.style.padding="10px 14px"; btn.style.borderRadius="8px"; btn.style.cursor="pointer";
    on(btn, "click", function(){
      if ($("#summary") && $("#timeline") && $("#conclusion")){
        var s = ($("#summary").value||"").trim().length;
        var t = ($("#timeline").value||"").trim().length;
        var c = ($("#conclusion").value||"").trim().length;
        if (s < 40){ toast("Start with what/when/who."); return; }
        if (t < 40){ toast("Add an ordered event timeline."); return; }
        if (c < 30){ toast("Conclude with findings + next steps."); return; }
        toast("Looks solid. Use Next Room to proceed.");
        return;
      }
      if ($("#deviceSelect") && $("#fileInput")){
        var device = $("#deviceSelect").value;
        if (!device){ toast("Select the most likely source device first."); return; }
        if (device !== "dslr"){ toast("EXIF camera make/model → DSLR."); return; }
        var chosen = ($("#fileInput").files||[]).length>0;
        if (!chosen){ toast("Choose the evidence image, then Analyze Image."); return; }
        var _sb = $("#stringsBtn"), _hb = $("#hexBtn");
        if (_sb) _sb.disabled = false; if (_hb) _hb.disabled = false;
        toast("Try Run strings or Open Hex Viewer for the clue.");
        return;
      }
      toast("Explore the controls to progress.");
    });
  }

  // ---------------- Room 4 ----------------
  function wireRoom4(){
    var summary = $("#summary"), timeline=$("#timeline"), conclusion=$("#conclusion"), submit=$("#submitReport");
    if (!(summary && timeline && conclusion && submit)) return;
    on(submit, "click", function(ev){
      ev.preventDefault();
      var s=(summary.value||"").trim(), tl=(timeline.value||"").trim(), c=(conclusion.value||"").trim();
      var ok=true, msgs=[];
      if (s.length<60){ ok=false; msgs.push("Summary (≥ 60 chars)"); }
      if (tl.length<60){ ok=false; msgs.push("Timeline (≥ 60 chars)"); }
      if (c.length<50){ ok=false; msgs.push("Conclusion (≥ 50 chars)"); }
      if (!ok){ alert("Please refine your report:\n- "+msgs.join("\n- ")); return; }
      setRoomComplete(4);
      alert("Report submitted. Use the green Next Room button to proceed to Room 5.");
    });
    var next = $all("a,button").find(function(el){ return ((el.textContent||'').toLowerCase().indexOf('next room')!==-1); });
    if (next){
      var href = "room5.html" + (location.hash||"");
      if (next.tagName.toLowerCase()==='a'){ next.setAttribute("href", href); }
      next.disabled = false;
      on(next, "click", function(e){ if (!next.getAttribute('href')){ e.preventDefault(); location.href = href; } });
    }
  }

  // ---------------- Room 5 ----------------
  function wireRoom5(){
    var deviceSelect=$("#deviceSelect");
    var confirmBtn=$("#confirmDevice");
    var analyzeBtn=$("#analyzeBtn");
    var stringsBtn=$("#stringsBtn");
    var hexBtn=$("#hexBtn");
    var fileInput=$("#fileInput");
    var clueModal=$("#clueModal");
    var clueMessage=getAnyById(['clueMessage','clueText']);
    var toolModal=$("#toolModal");
    var toolTitle=$("#toolTitle");
    var toolOutput=$("#toolOutput");
    var closeModal=$("#closeModal");
    var closeTool=$("#closeTool");
    var tools_ok = false;

    function openClue(msg){
      if (clueModal){
        if (clueMessage) clueMessage.textContent=msg;
        clueModal.style.display='flex';
      } else { alert(msg); }
    }
    function openTool(title, out){
      if (toolModal && toolTitle && toolOutput){
        toolTitle.textContent = title;
        toolOutput.textContent = out;
        toolModal.style.display = 'flex';
      } else { alert(title + "\\n\\n" + out); }
    }
    function closeModals(){
      if (clueModal) clueModal.style.display='none';
      if (toolModal) toolModal.style.display='none';
    }
    on(closeModal,'click',closeModals);
    on(closeTool,'click',closeModals);
    on(window,'keydown',function(e){ if(e.key==='Escape') closeModals(); });

    // Enable Confirm only when a device is selected
    if (deviceSelect && confirmBtn){
      confirmBtn.disabled = !(deviceSelect.value && deviceSelect.value !== '');
      on(deviceSelect, 'change', function(){
        confirmBtn.disabled = !(deviceSelect.value && deviceSelect.value !== '');
      });
    }
    // Lock Analyze/Image chooser until device confirmed
    if (analyzeBtn) analyzeBtn.disabled = true;
    if (fileInput) fileInput.disabled = true;
    if (stringsBtn) stringsBtn.disabled = true;
    if (hexBtn) hexBtn.disabled = true;

    on(confirmBtn, "click", function(){
      if (confirmBtn && confirmBtn.disabled) return;
      if (!deviceSelect) return;
      var v = deviceSelect.value;
      if (!v){ alert("Select a device first."); return; }
      if (v === "dslr"){
        alert("Correct device! DSLR EXIF reveals camera make/model.");
        localStorage.setItem("room5_device_ok","1");
        if (fileInput) fileInput.disabled = false;
        if (analyzeBtn) analyzeBtn.disabled = false;
      } else {
        alert("Re-check EXIF: camera make/model points to DSLR.");
      }
    });

    on(analyzeBtn, "click", function(){
      if (analyzeBtn && analyzeBtn.disabled) return;
      var files = (fileInput && fileInput.files) ? fileInput.files : [];
      if (!files.length){ alert("Choose the evidence image first."); return; }
      var name = (files[0].name||"").toLowerCase();
      // Gentle filename hint only; not blocking
      if (!/evidence[_-]?photo\.(jpg|jpeg|png)$/.test(name)){ /* ignore */ }
      openClue("EXIF reveals a camera model and a hidden note: CLUE CODE = CF-2025-ALPHA");
      localStorage.setItem("room5_image_ok","1");
      // After analyze, enable tools
      if (stringsBtn) stringsBtn.disabled = false;
      if (hexBtn) hexBtn.disabled = false;
      tryComplete();
    });

    on(stringsBtn, "click", function(){
      if (stringsBtn && stringsBtn.disabled) return;
      openTool("strings output", "...JFIF..Exif..Canon EOS... Created: 2025:08:10 14:23:10 ... NOTE: CF-2025-ALPHA ...");
      tools_ok = true;
      localStorage.setItem("room5_tools_ok","1");
      tryComplete();
    });

    on(hexBtn, "click", function(){
      if (hexBtn && hexBtn.disabled) return;
      openTool("hex viewer", "000000  FF D8 FF E1  45 78 69 66  00 00  43 4C 55 45 20 43 4F 44 45 3A 20 43 46 2D 32 30 32 35 2D 41 4C 50 48 41 ...");
      tools_ok = true;
      localStorage.setItem("room5_tools_ok","1");
      tryComplete();
    });

    function tryComplete(){
      var deviceOk = localStorage.getItem("room5_device_ok")==="1" || (deviceSelect && deviceSelect.value==="dslr");
      var imageOk  = localStorage.getItem("room5_image_ok")==="1";
      var toolOk   = localStorage.getItem("room5_tools_ok")==="1" || tools_ok===true;
      var ok = deviceOk && imageOk && toolOk;
      if (ok){
        setRoomComplete(5);
        var next = getAnyById(['nextBtn']) || $all('a,button').find(function(el){
          return (el.textContent||'').toLowerCase().indexOf('next room') !== -1;
        });
        var certHref = "certificate.html" + (location.hash||"");
        if (next){
          if (String(next.tagName).toLowerCase()==='a'){ next.setAttribute('href', certHref); }
          next.disabled = false;
          next.style.pointerEvents = "";
          next.style.opacity = "";
          next.style.filter = "";
          next.title = "";
          on(next, 'click', function(e){ if (!next.getAttribute('href')){ e.preventDefault(); location.href = certHref; } });
        }
        alert('Room 5 complete! You can proceed to the certificate.');
      }
    }
  }

  // ---------------- Main Menu ----------------
  function wireMainMenu(){
    var isMenu = !!document.querySelector('.menu-container') || !!document.getElementById('progressFill');
    if (!isMenu) return;

    function isDone(n){
      return localStorage.getItem("room"+n+"_complete")==="true" || localStorage.getItem("room"+n+"Complete")==="true";
    }

    // Progress bar
    var pf = document.getElementById("progressFill");
    if (pf){
      var prog = 0;
      for (var i=1;i<=5;i++){ if (isDone(i)) prog += 20; }
      pf.style.width = prog + "%";
      pf.textContent = prog + "%";
    }

    // Build link map
    var links = Array.from(document.querySelectorAll('a[href$=".html"]'));
    var linkMap = {};
    links.forEach(function(a){
      var href = a.getAttribute('href')||"";
      var m = href.match(/room([1-5])\.html$/i);
      if (m){ linkMap[parseInt(m[1],10)] = a; }
    });

    // Clear old marks
    Array.from(document.querySelectorAll('.room-check, .room-check-badge')).forEach(function(n){
      if (n.parentNode) n.parentNode.removeChild(n);
    });

    // Add strong badges for completed rooms
    for (var i=1;i<=5;i++){
      if (isDone(i) && linkMap[i]){
        var mark = document.createElement('span');
        mark.className = 'room-check-badge';
        mark.textContent = '✔ COMPLETED';
        mark.style.marginLeft = '10px';
        mark.style.padding = '3px 8px';
        mark.style.borderRadius = '999px';
        mark.style.fontSize = '13px';
        mark.style.fontWeight = '900';
        mark.style.letterSpacing = '0.3px';
        mark.style.background = '#00e676';
        mark.style.color = '#0b1a0f';
        mark.style.border = '2px solid #00c853';
        mark.style.boxShadow = '0 2px 6px rgba(0,0,0,.25)';
        /* BADGE_ALIGNMENT */
        mark.style.display = 'inline-flex';
        mark.style.alignItems = 'center';
        mark.style.justifyContent = 'center';
        mark.style.verticalAlign = 'middle';
        linkMap[i].appendChild(mark);
      }
    }

    // Wire reset full game progress button if present
    var resetBtn = document.querySelector('.reset-btn');
    if (resetBtn){
      resetBtn.addEventListener('click', function(){
        if (!confirm('Reset all game progress?')) return;
        try { localStorage.clear(); sessionStorage.clear(); } catch(e){}
        location.href = 'main_menu.html?v=' + Date.now();
      }, false);
    }

    // Locking: only allow next room if previous completed
    var allow = {1:true, 2:isDone(1), 3:isDone(2), 4:isDone(3), 5:isDone(4)};
    links.forEach(function(a){
      var href = a.getAttribute('href') || "";
      var m = href.match(/room([1-5])\.html$/i);
      if (!m) return;
      var n = parseInt(m[1],10);
      if (!allow[n]){
        a.dataset.locked = "1";
        a.style.pointerEvents = "none";
        a.style.opacity = "0.6";
        a.style.filter = "grayscale(100%)";
        a.title = "Locked: complete previous room first";
      } else {
        a.dataset.locked = "0";
        a.style.pointerEvents = "";
        a.style.opacity = "";
        a.style.filter = "";
        a.title = "";
      }
      // carry timer hash
      var h = location.hash || "";
      if (h){
        try { var url = new URL(href, location.href); url.hash = h; a.setAttribute('href', url.pathname + url.hash); } catch(e){}
      }
    });
  }

  // ---------------- Init ----------------
  document.addEventListener("DOMContentLoaded", function(){
    try { wireTimerUI(); } catch(e){ console.error(e); }
    try { wireSmartHint(); } catch(e){ console.error(e); }
    try { wireRoom4(); } catch(e){ console.error(e); }
    try { wireRoom5(); } catch(e){ console.error(e); }
    try { wireMainMenu(); } catch(e){ console.error(e); }
  });
})();
