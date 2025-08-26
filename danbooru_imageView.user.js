// ==UserScript==
// @name         Danbooru: Tag View
// @version      1.00
// @author       Llynkurin
// @namespace    https://github.com/Llynkurin
// @downloadURL  https://raw.githubusercontent.com/Llynkurin/userscripts/main/userscripts/danbooru_imageView.user.js
// @updateURL    https://raw.githubusercontent.com/Llynkurin/userscripts/main/userscripts/danbooru_imageView.user.js
// @description  Previews visual examples and wiki info with table pagination and per-tag refresh functionality.
// @match        https://danbooru.donmai.us/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=donmai.us
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      self
// @connect      gelbooru.com
// ==/UserScript==

(function() {
    'use strict';

    let currentSource = GM_getValue('tag-preview-source', 'danbooru');
    const PAGE_SIZE = 10;

    GM_registerMenuCommand('Set Gelbooru Credentials', () => {
        const authString = prompt('Enter your full Gelbooru API credential string (e.g., &user_id=...&api_key=...):', GM_getValue('gelbooru_auth_string', ''));
        if (authString !== null) {
            GM_setValue('gelbooru_auth_string', authString.trim());
        }
    });

    GM_addStyle(`
        .d-preview-tooltip {
            position: fixed; top: 0; left: 0; z-index: 10000; width: 350px; max-width: 350px; pointer-events: none;
            border: 1px solid var(--post-tooltip-border-color, #4a4a4a); border-radius: 4px; color: var(--text-color, #ccc);
            background-color: var(--post-tooltip-background-color, #1a1a1a); box-shadow: var(--shadow-lg, 0 5px 15px rgba(0,0,0,0.5));
            padding: 8px;
        }
        .d-preview-wiki {
            font-size: 12px; line-height: 1.4; max-height: 400px; overflow-y: auto; margin-bottom: 8px;
            color: var(--wiki-page-body-text-color, var(--text-color));
        }
        .d-preview-wiki > *:first-child { margin-top: 0 !important; }
        .d-preview-wiki > *:last-child { margin-bottom: 0 !important; }
        .d-preview-wiki a { color: var(--link-color, #007bff); }
        .d-preview-wiki h1 { font-size: 1.2em; margin: 0 0 0.5em 0; padding-bottom: 0.2em; border-bottom: 1px solid var(--border-color); text-transform: capitalize; }
        .d-preview-wiki h2, .d-preview-wiki h3, .d-preview-wiki h4 { font-size: 1.1em; margin: 0.8em 0 0.4em 0; }
        .d-preview-wiki ul, .d-preview-wiki ol { padding-left: 20px; }
        .d-preview-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
        .d-preview-grid a { display: block; }
        .d-preview-grid img { width: 100%; height: 150px; object-fit: cover; border-radius: 3px; }
        .d-table-preview-row td { padding: 0px 10px 10px 10px !important; border: none !important; }
        .d-preview-content-container { display: flex; align-items: center; gap: 10px; }
        .d-table-preview-images { display: flex; gap: 10px; margin-top: 5px; flex-grow: 1; }
        .d-table-preview-images img { width: 150px; aspect-ratio: 1 / 1; object-fit: cover; border-radius: 4px; }
        .d-preview-refresh-btn {
            background-color: var(--button-background-color); border: 1px solid var(--button-border-color); color: var(--button-text-color);
            padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 1.2em; align-self: center;
        }
        .source-toggle-container { display: inline-flex; align-items: center; gap: 5px; margin-left: 10px; vertical-align: bottom; }
        .source-toggle-container img { width: 20px; height: 20px; }
        .source-toggle { position: relative; display: inline-block; width: 44px; height: 24px; }
        .source-toggle input { opacity: 0; width: 0; height: 0; }
        .source-toggle .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #4B85F0; transition: .4s; border-radius: 24px; }
        .source-toggle .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
        .source-toggle input:checked + .slider { background-color: #00AEEF; }
        .source-toggle input:checked + .slider:before { transform: translateX(20px); }
        .d-preview-pagination { display: flex; justify-content: center; align-items: center; gap: 15px; margin-top: 10px; }
        .d-preview-pagination button {
            background-color: var(--button-background-color); border: 1px solid var(--button-border-color); color: var(--button-text-color);
            padding: 5px 10px; border-radius: 4px; cursor: pointer;
        }
        .d-preview-pagination button:disabled { cursor: not-allowed; opacity: 0.5; }
    `);

    function createSourceToggle() {
        const searchButton = document.querySelector('form.search-form input[type="submit"]');
        if (!searchButton || document.querySelector('.source-toggle-container')) return;
        const container = document.createElement('div');
        container.className = 'source-toggle-container';
        const danbooruIcon = document.createElement('img');
        danbooruIcon.src = 'https://www.google.com/s2/favicons?sz=64&domain=donmai.us';
        danbooruIcon.title = 'Danbooru';
        const toggleLabel = document.createElement('label');
        toggleLabel.className = 'source-toggle';
        const toggleInput = document.createElement('input');
        toggleInput.type = 'checkbox';
        toggleInput.checked = (currentSource === 'gelbooru');
        const slider = document.createElement('span');
        slider.className = 'slider';
        toggleLabel.append(toggleInput, slider);
        const gelbooruIcon = document.createElement('img');
        gelbooruIcon.src = 'https://www.google.com/s2/favicons?sz=64&domain=gelbooru.com';
        gelbooruIcon.title = 'Gelbooru';
        container.append(danbooruIcon, toggleLabel, gelbooruIcon);
        searchButton.parentNode.insertBefore(container, searchButton.nextSibling);
        toggleInput.addEventListener('change', () => {
            currentSource = toggleInput.checked ? 'gelbooru' : 'danbooru';
            GM_setValue('tag-preview-source', currentSource);
        });
    }

    function gmFetch(args, signal) {
        return new Promise((resolve, reject) => {
            if (signal?.aborted) {
                return reject(new DOMException('Aborted', 'AbortError'));
            }
            const request = GM_xmlhttpRequest({
                ...args,
                onload: resolve,
                onerror: reject,
                ontimeout: reject,
                onabort: () => reject(new DOMException('Aborted', 'AbortError')),
            });
            signal?.addEventListener('abort', () => request.abort(), { once: true });
        });
    }

    async function fetchPosts(tagName, limit, signal) {
        if (currentSource === 'gelbooru') {
            const authString = GM_getValue('gelbooru_auth_string', '');
            if (!authString) return [];
            try {
                const url = `https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tagName)}&limit=${limit}${authString.startsWith('&') ? '' : '&'}${authString}`;
                const res = await gmFetch({ method: 'GET', url: url }, signal);
                if (!res?.responseText) return [];
                const data = JSON.parse(res.responseText);
                return data?.post?.map(p => ({
                    preview_url: p.preview_url,
                    post_url: `https://gelbooru.com/index.php?page=post&s=view&id=${p.id}`
                })) ?? [];
            } catch (e) { return []; }
        } else {
            try {
                const url = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tagName)}&limit=${limit}`;
                const res = await gmFetch({ method: 'GET', url: url }, signal);
                const data = JSON.parse(res.responseText);
                return Array.isArray(data) ? data.map(p => ({
                    preview_url: p.preview_file_url,
                    post_url: `/posts/${p.id}`
                })) : [];
            } catch (e) { return []; }
        }
    }

    async function createTooltip(link, tagName, initialEvent) {
        if (link.dataset.hasTooltip === 'true') return;
        link.dataset.hasTooltip = 'true';

        const controller = new AbortController();
        const tooltip = document.createElement('div');
        tooltip.className = 'd-preview-tooltip';
        tooltip.textContent = 'Loading...';
        document.body.appendChild(tooltip);

        const updatePosition = (e) => {
            let x = e.clientX + 20, y = e.clientY + 20;
            if (x + tooltip.offsetWidth > window.innerWidth) x = e.clientX - tooltip.offsetWidth - 20;
            if (y + tooltip.offsetHeight > window.innerHeight) y = e.clientY - tooltip.offsetHeight - 20;
            tooltip.style.transform = `translate(${x}px, ${y}px)`;
        };

        const removeTooltip = () => {
            controller.abort();
            tooltip.remove();
            link.removeEventListener('mousemove', updatePosition);
            link.removeEventListener('mouseleave', removeTooltip);
            delete link.dataset.hasTooltip;
        };

        updatePosition(initialEvent);
        link.addEventListener('mousemove', updatePosition);
        link.addEventListener('mouseleave', removeTooltip);

        try {
            const isWikiLink = link.matches('a.dtext-wiki-link');
            const postsRequest = fetchPosts(tagName, 4, controller.signal);
            const wikiRequest = isWikiLink ? gmFetch({ method: 'GET', url: link.href }, controller.signal) : Promise.resolve(null);
            const [postsResult, wikiResult] = await Promise.allSettled([postsRequest, wikiRequest]);

            if (controller.signal.aborted || !tooltip.isConnected) return;
            tooltip.innerHTML = '';
            let hasContent = false, wikiDiv = null, gridDiv = null;

            if (isWikiLink && wikiResult.status === 'fulfilled' && wikiResult.value) {
                const doc = new DOMParser().parseFromString(wikiResult.value.responseText, 'text/html');
                const titleEl = doc.querySelector('#wiki-page-title'), bodyEl = doc.querySelector('#wiki-page-body');
                if (titleEl && bodyEl) {
                    wikiDiv = document.createElement('div');
                    wikiDiv.className = 'd-preview-wiki';
                    bodyEl.querySelectorAll('a[href]').forEach(a => { a.href = new URL(a.getAttribute('href'), link.href).href; });
                    wikiDiv.append(titleEl.cloneNode(true), bodyEl.cloneNode(true));
                }
            }

            if (postsResult.status === 'fulfilled' && postsResult.value.length > 0) {
                gridDiv = document.createElement('div');
                gridDiv.className = 'd-preview-grid';
                postsResult.value.forEach(post => {
                    if (post.preview_url) {
                        const a = document.createElement('a');
                        a.href = post.post_url; a.target = '_blank'; a.rel = 'noopener noreferrer';
                        a.appendChild(Object.assign(document.createElement('img'), { src: post.preview_url }));
                        gridDiv.appendChild(a);
                    }
                });
            }

            if (wikiDiv) { tooltip.appendChild(wikiDiv); hasContent = true; }
            if (gridDiv?.hasChildNodes()) { tooltip.appendChild(gridDiv); hasContent = true; }

            if (!hasContent) {
                tooltip.textContent = (currentSource === 'gelbooru' && !GM_getValue('gelbooru_auth_string', '')) ? 'Gelbooru credentials not set.' : 'No wiki or posts found.';
            }
        } catch (error) {
            if (error.name !== 'AbortError' && tooltip.isConnected) {
                tooltip.textContent = 'Error loading preview.';
            }
        }
    }

    async function addPreviewToRow(row) {
        if (row.dataset.previewInjected) return;
        let tagLink, tagName;
        const standardTagLink = row.querySelector('a[href*="/posts?tags="]');
        if (standardTagLink) {
            tagLink = standardTagLink;
            tagName = new URL(tagLink.href).searchParams.get('tags');
        } else {
            const artistLink = row.querySelector('.name-column a[href*="/artists/"]');
            if (artistLink) {
                tagLink = artistLink;
                tagName = tagLink.textContent.trim();
            }
        }

        if (!tagName || !tagLink) return;
        row.dataset.previewInjected = 'true';

        const previewRow = document.createElement('tr');
        previewRow.className = 'd-table-preview-row';
        const previewCell = previewRow.insertCell();
        previewCell.colSpan = row.cells.length;
        const container = document.createElement('div');
        container.className = 'd-preview-content-container';
        const imagesDiv = document.createElement('div');
        imagesDiv.className = 'd-table-preview-images';
        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'd-preview-refresh-btn';
        refreshBtn.textContent = '↻';
        refreshBtn.title = 'Refresh preview';
        container.append(imagesDiv, refreshBtn);
        previewCell.appendChild(container);

        const populateImages = (data) => {
            imagesDiv.innerHTML = '';
            if (data?.length) {
                data.forEach(post => {
                    if (post.preview_url) {
                        const a = document.createElement('a');
                        a.href = post.post_url; a.target = '_blank'; a.rel = 'noopener noreferrer';
                        a.appendChild(Object.assign(document.createElement('img'), { src: post.preview_url }));
                        imagesDiv.appendChild(a);
                    }
                });
            }
            if (!imagesDiv.hasChildNodes()) {
                imagesDiv.textContent = 'No previews found.';
            }
        };

        refreshBtn.addEventListener('click', async () => {
            imagesDiv.textContent = 'Refreshing...';
            try {
                const data = await fetchPosts(tagName, 3);
                populateImages(data);
            } catch (e) {
                imagesDiv.textContent = 'Error refreshing.';
            }
        });

        try {
            const initialData = await fetchPosts(tagName, 3);
            populateImages(initialData);
            if (imagesDiv.hasChildNodes() || imagesDiv.textContent) {
                row.after(previewRow);
            }
        } catch (e) { /*failstate */ }
    }

    function showPage(table, page) {
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        const rows = [...tbody.children].filter(tr => !tr.classList.contains('d-table-preview-row'));
        const totalPages = Math.ceil(rows.length / PAGE_SIZE);
        page = Math.max(1, Math.min(page, totalPages));
        table.dataset.currentPage = page;

        rows.forEach(row => row.style.display = 'none');
        tbody.querySelectorAll('.d-table-preview-row').forEach(pr => pr.style.display = 'none');

        const startIndex = (page - 1) * PAGE_SIZE;
        const pageRows = rows.slice(startIndex, startIndex + PAGE_SIZE);

        pageRows.forEach(row => {
            row.style.display = '';
            const nextSibling = row.nextElementSibling;
            if (nextSibling?.classList.contains('d-table-preview-row')) {
                nextSibling.style.display = '';
            }
            addPreviewToRow(row);
        });
        updatePaginationControls(table);
    }

    function updatePaginationControls(table) {
        const controls = table.nextElementSibling;
        if (!controls?.classList.contains('d-preview-pagination')) return;

        const { currentPage, totalPages } = table.dataset;
        const pageNum = parseInt(currentPage, 10);
        const totalNum = parseInt(totalPages, 10);

        controls.querySelector('.page-indicator').textContent = `Page ${pageNum} of ${totalNum}`;
        controls.querySelector('.prev-btn').disabled = pageNum <= 1;
        controls.querySelector('.next-btn').disabled = pageNum >= totalNum;
    }

    function setupPagination(table) {
        if (table.dataset.paginated) return;
        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        const rows = [...tbody.children].filter(tr => !tr.classList.contains('d-table-preview-row'));
        if (rows.length <= PAGE_SIZE) {
             rows.forEach(addPreviewToRow);
             return;
        }
        table.dataset.paginated = 'true';
        table.dataset.totalPages = Math.ceil(rows.length / PAGE_SIZE);

        const controls = document.createElement('div');
        controls.className = 'd-preview-pagination';
        controls.innerHTML = `
            <button class="prev-btn">&laquo; Prev</button>
            <span class="page-indicator"></span>
            <button class="next-btn">Next &raquo;</button>
        `;
        table.after(controls);

        controls.querySelector('.prev-btn').addEventListener('click', () => {
            let currentPage = parseInt(table.dataset.currentPage, 10);
            showPage(table, currentPage - 1);
        });
        controls.querySelector('.next-btn').addEventListener('click', () => {
            let currentPage = parseInt(table.dataset.currentPage, 10);
            showPage(table, currentPage + 1);
        });

        showPage(table, 1);
    }

    document.body.addEventListener('mouseover', e => {
        const link = e.target.closest('a.search-tag, a.dtext-wiki-link');
        if (!link || link.closest('table.striped, .d-preview-tooltip')) return;
        const linkUrl = new URL(link.href, document.location.origin);
        let tagName;
        if (link.matches('a.search-tag')) {
            tagName = linkUrl.searchParams.get('tags');
        } else if (link.matches('a.dtext-wiki-link') && linkUrl.pathname.startsWith('/wiki_pages/')) {
            tagName = decodeURIComponent(linkUrl.pathname.substring('/wiki_pages/'.length)).replaceAll('_', ' ');
        }
        if (tagName && !tagName.includes(' ')) {
            createTooltip(link, tagName, e);
        }
    });

    const tableObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;
                const tablesToPaginate = [];
                if (node.matches('table.striped, #artists-table')) {
                    tablesToPaginate.push(node);
                } else {
                    node.querySelectorAll('table.striped, #tags-table, #related-tags-table, #artists-table').forEach(t => tablesToPaginate.push(t));
                }
                tablesToPaginate.forEach(setupPagination);
            }
        }
    });

    const targetNode = document.getElementById('page') || document.body;
    document.querySelectorAll('#tags-table, .striped, #related-tags-table, #artists-table').forEach(setupPagination);
    tableObserver.observe(targetNode, { childList: true, subtree: true });

    createSourceToggle();
})();
