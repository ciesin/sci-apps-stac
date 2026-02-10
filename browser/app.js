const CATALOG_URL = "../stac/catalog.json";

/* ---------------- Utilities ---------------- */

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}`);
  return res.json();
}

function toggle(el, open) {
  el.style.display = open ? "block" : "none";
}

/* ---------------- Entry ---------------- */

const content = document.getElementById("content");
const searchInput = document.getElementById("search");

loadNode(CATALOG_URL, content).catch(err => {
  content.innerText = err.message;
});

/* ---------------- Recursive Loader ---------------- */

async function loadNode(url, container) {
  const nodeUrl = new URL(url, window.location.href);
  const node = await fetchJSON(nodeUrl);

  // COLLECTION
  if (node.type === "Collection" || node.extent) {
    renderCollection(node, nodeUrl, container);
    return;
  }

  // CATALOG
  
  const catalogDiv = document.createElement("div");
  catalogDiv.className = "node catalog level-catalog";

  const header = document.createElement("h1");
  header.textContent = node.title || node.id;
  header.className = "node-header catalog-header";

  const body = document.createElement("div");

  // metadata (shown when catalog is open)
  const metadata = renderMetadata(node);
  body.appendChild(metadata);


  // open root + second level catalogs
  const shouldOpen = depth <= 1;
  body.style.display = shouldOpen ? "block" : "none";
  header.classList.toggle("open", shouldOpen);

  header.addEventListener("click", () => {
    const open = body.style.display === "none";
    body.style.display = open ? "block" : "none";
    header.classList.toggle("open", open);
  });

  catalogDiv.appendChild(header);
  catalogDiv.appendChild(body);
  container.appendChild(catalogDiv);

  // recurse into children
  for (const link of node.links.filter(l => l.rel === "child")) {
    await loadNode(new URL(link.href, nodeUrl), body, depth + 1);
  }

}

/* ---------------- Collections ---------------- */

function renderCollection(collection, collectionUrl, container) {
  const section = document.createElement("section");
  section.className = "node collection level-collection";

  section.dataset.search = `${collection.title || ""} ${collection.description || ""}`.toLowerCase();

  const header = document.createElement("h2");
  header.textContent = collection.title || collection.id;
  header.className = "node-header collection-header";


  const body = document.createElement("div");

  // collection metadata
  const metadata = renderMetadata(collection);
  body.appendChild(metadata);

  body.style.display = "none";

  header.addEventListener("click", async () => {
    const open = body.style.display === "none";
    toggle(body, open);
    header.classList.toggle("open", open);


    if (!body.dataset.loaded) {
      for (const link of collection.links.filter(l => l.rel === "item")) {
        const itemUrl = new URL(link.href, collectionUrl);
        const item = await fetchJSON(itemUrl);
        renderItem(item, body);
      }
      body.dataset.loaded = "true";
    }

  
  });

  section.appendChild(header);
  section.appendChild(body);
  container.appendChild(section);
}

/* ---------------- Metadata for catalogs ---------------- */
function renderMetadata(node) {
  const meta = document.createElement("div");
  meta.className = "node-metadata";

  // Description
  if (node.description) {
    const desc = document.createElement("div");
    desc.className = "node-description";
    desc.innerHTML = renderMarkdown(node.description);
    meta.appendChild(desc);
  }

  // Providers
  if (node.providers?.length) {
    const prov = document.createElement("div");
    prov.innerHTML = `
      <strong>Providers</strong>
      <ul>
        ${node.providers
          .map(
            p =>
              `<li>
                ${p.url ? `<a href="${p.url}" target="_blank">${p.name}</a>` : p.name}
                ${p.roles?.length ? ` (${p.roles.join(", ")})` : ""}
              </li>`
          )
          .join("")}
      </ul>
    `;
    meta.appendChild(prov);
  }

  // Keywords
  if (node.keywords?.length) {
    const kw = document.createElement("div");
    kw.innerHTML = `
      <strong>Keywords</strong>
      <div class="keywords">
        ${node.keywords.map(k => `<span class="keyword">${k}</span>`).join("")}
      </div>
    `;
    meta.appendChild(kw);
  }

  // Helpful links (exclude structural STAC links)
  const usefulLinks = (node.links || []).filter(
    l => !["self", "root", "parent", "child", "item"].includes(l.rel)
  );

  if (usefulLinks.length) {
    const links = document.createElement("div");
    links.innerHTML = `
      <strong>Links</strong>
      <ul>
        ${usefulLinks
          .map(
            l =>
              `<li>
                <a href="${l.href}" target="_blank">
                  ${l.title || l.rel}
                </a>
              </li>`
          )
          .join("")}
      </ul>
    `;
    meta.appendChild(links);
  }

  return meta;
}


/* ---------------- Items ---------------- */
function renderItem(item, container) {
  const itemDiv = document.createElement("div");
  itemDiv.className = "node item level-item";
  itemDiv.dataset.search =
    `${item.title || ""} ${item.id || ""} ${item.properties?.description || ""}`.toLowerCase();

  /* ---------- Header ---------- */

  const header = document.createElement("h3");
  header.textContent = item.title || item.id;
  header.className = "node-header item-header";

  const body = document.createElement("div");
  body.style.display = "none";

  header.addEventListener("click", () => {
    const open = body.style.display === "none";
    body.style.display = open ? "block" : "none";
    header.classList.toggle("open", open);

    // initialize / fix map when opened
    if (open && body._initMap) {
      body._initMap();
    }
    if (open && body._leafletMap) {
      setTimeout(() => body._leafletMap.invalidateSize(), 0);
    }
  });

  /* ---------- Layout ---------- */

  const layout = document.createElement("div");
  layout.className = "item-layout";

  const leftCol = document.createElement("div");
  leftCol.className = "item-col item-left";

  const rightCol = document.createElement("div");
  rightCol.className = "item-col item-right";

  layout.appendChild(leftCol);
  layout.appendChild(rightCol);
  body.appendChild(layout);

  /* ---------- LEFT COLUMN ---------- */
  /* ---- Map ---- */

  if (item.bbox || item.geometry) {
    const mapBlock = document.createElement("div");
    mapBlock.className = "item-block";
    mapBlock.innerHTML = `<h4>Spatial Extent</h4>`;

    const mapDiv = document.createElement("div");
    mapDiv.className = "item-map";
    mapBlock.appendChild(mapDiv);
    leftCol.appendChild(mapBlock);

    body._initMap = () => {
      if (!body._leafletMap) {
        body._leafletMap = renderMap(item, mapDiv);
      }
    };
  }

  /* ---- Assets ---- */

  if (item.assets && Object.keys(item.assets).length) {
    const assetsBlock = document.createElement("div");
    assetsBlock.className = "item-block";
    assetsBlock.innerHTML = `<h4>Assets</h4>`;

    const ul = document.createElement("ul");
    ul.className = "asset-list";

    for (const [key, asset] of Object.entries(item.assets)) {
      const li = document.createElement("li");
      li.className = "asset";

      const href = new URL(asset.href, container.baseURI).href;

      li.innerHTML = `
        <div class="asset-title">
          <a href="${href}" target="_blank">${asset.title || key}</a>
        </div>
        <div class="asset-meta">
          ${asset.type ? `<div><strong>Type:</strong> ${asset.type}</div>` : ""}
          ${asset.roles?.length ? `<div><strong>Roles:</strong> ${asset.roles.join(", ")}</div>` : ""}
        </div>
      `;

      if (asset.type?.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = href;
        img.alt = asset.title || key;
        li.appendChild(img);
      }

      ul.appendChild(li);
    }

    assetsBlock.appendChild(ul);
    leftCol.appendChild(assetsBlock);
  }

  /* ---------- RIGHT COLUMN ---------- */
  /* ---- Description ---- */

  if (item.properties?.description) {
    const descBlock = document.createElement("div");
    descBlock.className = "item-block";
    descBlock.innerHTML = `
      <h4>Description</h4>
      <div class="item-description">
        ${renderMarkdown(item.properties.description)}
      </div>
    `;
    rightCol.appendChild(descBlock);
  }

  /* ---- Item metadata ---- */

  const infoBlock = document.createElement("div");
  infoBlock.className = "item-block";
  infoBlock.innerHTML = `<h4>Item Information</h4>`;

  const infoList = document.createElement("ul");

  if (item.id) {
    infoList.innerHTML += `<li><strong>ID:</strong> ${item.id}</li>`;
  }

  if (item.datetime) {
    infoList.innerHTML += `<li><strong>Date:</strong> ${item.datetime}</li>`;
  }

  if (item.bbox) {
    infoList.innerHTML += `<li><strong>BBox:</strong> ${item.bbox.join(", ")}</li>`;
  }

  infoBlock.appendChild(infoList);
  rightCol.appendChild(infoBlock);

  /* ---------- Assemble ---------- */

  itemDiv.appendChild(header);
  itemDiv.appendChild(body);
  container.appendChild(itemDiv);
}


/* ---------------- Map ---------------- */

function renderMap(item, div) {
  const map = L.map(div, {
    zoomControl: false
  }).setView([0, 0], 2);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
  }).addTo(map);

  let layer;

  if (item.geometry) {
    layer = L.geoJSON(item.geometry).addTo(map);
  } else if (item.bbox) {
    const [w, s, e, n] = item.bbox;
    layer = L.rectangle([[s, w], [n, e]]).addTo(map);
  }

  if (layer) map.fitBounds(layer.getBounds());

  return map;
}


/* ---------------- Search ---------------- */

searchInput?.addEventListener("input", e => {
  const q = e.target.value.toLowerCase().trim();

  document.querySelectorAll(".node").forEach(node => {
    const text = node.dataset.search || "";
    const matches = text.includes(q);

    node.style.display = q === "" || matches ? "" : "none";

    // auto-expand matching nodes
    const header = node.querySelector(".node-header");
    const body = header?.nextElementSibling;

    if (matches && body) {
      body.style.display = "block";
      header.classList.add("open");
    }

    // always show parents of visible nodes
    if (node.style.display !== "none") {
      let parent = node.parentElement;
      while (parent && parent !== content) {
        if (parent.classList.contains("node")) {
          parent.style.display = "";
        }
        parent = parent.parentElement;
      }
    }
  });
});

