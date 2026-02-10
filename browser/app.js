const CATALOG_URL = "../stac/catalog.json";

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}`);
  return res.json();
}

async function loadNode(url, container) {
  const nodeUrl = new URL(url, window.location.href);
  const node = await fetchJSON(nodeUrl);

  // COLLECTION
  if (node.type === "Collection" || node.extent) {
    await loadCollection(node, nodeUrl, container);
    return;
  }

  // CATALOG
  const children = node.links.filter(l => l.rel === "child");

  for (const link of children) {
    await loadNode(new URL(link.href, nodeUrl), container);
  }
}


async function loadCollection(collection, collectionUrl, container) {
  const section = document.createElement("section");
  section.innerHTML = `
    <h2>${collection.title || collection.id}</h2>
    <p>${collection.description || ""}</p>
  `;
  container.appendChild(section);

  const items = collection.links.filter(l => l.rel === "item");

  for (const link of items) {
    const itemUrl = new URL(link.href, collectionUrl);
    const item = await fetchJSON(itemUrl);
    renderItem(item, section);
  }
}


function renderItem(item, container) {
  const div = document.createElement("div");
  div.className = "item";

  const assets = Object.values(item.assets || {})
    .map(a => {
      const href = new URL(a.href, container.baseURI).href;
      return `<li><a href="${href}" target="_blank">${a.title || a.type || "Asset"}</a></li>`;
    })
    .join("");

  div.innerHTML = `
    <h3>${item.title || item.id}</h3>
    <p>${item.properties?.description || ""}</p>
    <ul>${assets}</ul>
  `;

  container.appendChild(div);
}

const content = document.getElementById("content");

loadNode(CATALOG_URL, content).catch(err => {
  content.innerText = err.message;
});
