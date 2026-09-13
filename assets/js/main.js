(function () {
  var root = document.documentElement;

  // ---------------------------------------------------------------- Theme
  var themeBtn = document.getElementById('theme-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      if (window.renderMermaid) window.renderMermaid();
    });
  }

  // ---------------------------------------------------------------- Mobile nav
  var menuBtn = document.getElementById('menu-btn');
  var scrim = document.getElementById('scrim');
  function setNav(open) {
    document.body.classList.toggle('nav-open', open);
    if (menuBtn) menuBtn.setAttribute('aria-expanded', String(open));
  }
  if (menuBtn) menuBtn.addEventListener('click', function () { setNav(!document.body.classList.contains('nav-open')); });
  if (scrim) scrim.addEventListener('click', function () { setNav(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setNav(false); });

  var content = document.getElementById('post-content');
  if (!content) return;

  // ---------------------------------------------------------------- Code blocks
  var LANG_NAMES = { cpp: 'C++', 'c++': 'C++', c: 'C', csharp: 'C#', cs: 'C#', json: 'JSON', hlsl: 'HLSL', glsl: 'GLSL', bash: 'Bash', sh: 'Shell', ini: 'INI', python: 'Python', plaintext: 'Text', text: 'Text' };

  content.querySelectorAll('div.highlighter-rouge').forEach(function (block) {
    var m = block.className.match(/language-([\w+#-]+)/);
    var lang = m ? m[1].toLowerCase() : 'text';
    if (lang === 'mermaid') return;

    var wrap = document.createElement('div');
    wrap.className = 'code-block';
    var header = document.createElement('div');
    header.className = 'code-header';

    // A paragraph like `File.h` (only inline code) right before the block becomes the file name
    var label = document.createElement('span');
    var prev = block.previousElementSibling;
    if (prev && prev.tagName === 'P' && prev.children.length === 1 && prev.firstElementChild.tagName === 'CODE' &&
        prev.textContent.trim() === prev.firstElementChild.textContent.trim() && /\.\w+$/.test(prev.textContent.trim())) {
      label.className = 'file';
      label.textContent = prev.textContent.trim();
      prev.remove();
    } else {
      label.textContent = LANG_NAMES[lang] || lang;
    }

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.textContent = 'Copy';
    btn.addEventListener('click', function () {
      var code = block.querySelector('code') || block;
      navigator.clipboard.writeText(code.innerText.replace(/\n$/, '')).then(function () {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(function () { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1500);
      });
    });

    header.appendChild(label);
    header.appendChild(btn);
    block.parentNode.insertBefore(wrap, block);
    wrap.appendChild(header);
    wrap.appendChild(block);
  });

  // ---------------------------------------------------------------- Heading anchors + TOC
  var headings = content.querySelectorAll('h2[id], h3[id]');
  var toc = document.getElementById('toc');
  var list = document.getElementById('toc-list');
  var links = [];

  headings.forEach(function (h) {
    var a = document.createElement('a');
    a.className = 'heading-anchor';
    a.href = '#' + h.id;
    a.textContent = '#';
    a.setAttribute('aria-hidden', 'true');
    h.insertBefore(a, h.firstChild);

    if (list) {
      var li = document.createElement('li');
      li.className = 'lvl-' + h.tagName.substring(1);
      var link = document.createElement('a');
      link.href = '#' + h.id;
      link.textContent = h.textContent.replace(/^#/, '');
      li.appendChild(link);
      list.appendChild(li);
      links.push({ el: h, link: link });
    }
  });

  if (toc && links.length >= 3) {
    toc.hidden = false;
    var onScroll = function () {
      var current = links[0];
      links.forEach(function (l) { if (l.el.getBoundingClientRect().top < 120) current = l; });
      links.forEach(function (l) { l.link.classList.toggle('active', l === current); });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ---------------------------------------------------------------- Mermaid
  var diagrams = [];
  content.querySelectorAll('div.language-mermaid, pre > code.language-mermaid').forEach(function (el) {
    var host = el.tagName === 'CODE' ? el.parentNode : el;
    var pre = document.createElement('pre');
    pre.className = 'mermaid';
    var source = el.textContent.trim();
    pre.textContent = source;
    host.parentNode.replaceChild(pre, host);
    diagrams.push({ el: pre, source: source });
  });

  window.renderMermaid = function () {
    if (!window.mermaid || !diagrams.length) return;
    var dark = root.getAttribute('data-theme') === 'dark';
    window.mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'neutral', fontFamily: 'Inter, system-ui, sans-serif' });
    diagrams.forEach(function (d) {
      d.el.removeAttribute('data-processed');
      d.el.textContent = d.source;
    });
    window.mermaid.run({ nodes: diagrams.map(function (d) { return d.el; }) });
  };
})();
