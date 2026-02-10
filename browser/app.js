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
  body.style.display = "none";

  header.addEventListener("click", () => {
    const open = body.style.display === "none";
    toggle(body, open);
    header.classList.toggle("open", open);

  });

  catalogDiv.appendChild(header);
  catalogDiv.appendChild(body);
  container.appendChild(catalogDiv);

  for (const link of node.links.filter(l => l.rel === "child")) {
    await loadNode(new URL(link.href, nodeUrl), body);
  }
}

/* ---------------- Collections ---------------- */

function renderCollection(collection, collectionUrl, container) {
  const section = document.createElement("section");
  section.className = "node collection level-collection";

  section.dataset.search = (collection.title || collection.id).toLowerCase();

  const header = document.createElement("h2");
  header.textContent = collection.title || collection.id;
  header.className = "node-header collection-header";


  const body = document.createElement("div");
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

/* ---------------- Items ---------------- */

function renderItem(item, container) {
  const itemDiv = document.createElement("div");
  itemDiv.className = "node item level-item";

  itemDiv.dataset.search = (item.title || item.id).toLowerCase();

  const header = document.createElement("h3");
  header.textContent = item.title || item.id;
  header.className = "node-header item-header";

  const body = document.createElement("div");
  body.style.display = "none";

  header.addEventListener("click", () => {
    toggle(body, body.style.display === "none");
  });

  // description
  if (item.properties?.description) {
    const p = document.createElement("p");
    p.textContent = item.properties.description;
    body.appendChild(p);
  }

  // map preview
  if (item.bbox || item.geometry) {
    const mapDiv = document.createElement("div");
    mapDiv.style.height = "200px";
    mapDiv.style.margin = "10px 0";
    body.appendChild(mapDiv);

    setTimeout(() => renderMap(item, mapDiv), 0);
  }

  // assets
  const ul = document.createElement("ul");

  for (const asset of Object.values(item.assets || {})) {
    const li = document.createElement("li");
    const href = new URL(asset.href, container.baseURI).href;

    // image preview
    if (asset.type?.startsWith("image/")) {
      li.innerHTML = `
        <a href="${href}" target="_blank">${asset.title || "Image"}</a><br>
        <img src="${href}" style="max-width:200px;margin-top:5px"/>
      `;
    } else {
      li.innerHTML = `<a href="${href}" target="_blank">${asset.title || asset.type || "Asset"}</a>`;
    }

    ul.appendChild(li);
  }

  body.appendChild(ul);
  itemDiv.appendChild(header);
  itemDiv.appendChild(body);
  container.appendChild(itemDiv);
}

/* ---------------- Map ---------------- */

function renderMap(item, div) {
  const map = L.map(div).setView([0, 0], 2);

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
}

/* ---------------- Search ---------------- */

searchInput?.addEventListener("input", e => {
  const q = e.target.value.toLowerCase();

  document.querySelectorAll("[data-search]").forEach(el => {
    el.style.display = el.dataset.search.includes(q) ? "" : "none";
  });
});
