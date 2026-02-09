const CATALOG_URL = "../stac/catalog.json";

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}`);
  return res.json();
}

async function loadCatalog() {
  const catalogUrl = new URL(CATALOG_URL, window.location.href);
  const catalog = await fetchJSON(catalogUrl);

  const content = document.getElementById("content");
  content.innerHTML = "";

  const collections = catalog.links.filter(l => l.rel === "child");

  for (const link of collections) {
    const collectionUrl = new URL(link.href, catalogUrl);
    const collection = await fetchJSON(collectionUrl);
    await loadCollection(collection, collectionUrl, content);
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
    .map(a => `<li><a href="${a.href}" target="_blank">${a.title || "Asset"}</a></li>`)
    .join("");

  div.innerHTML = `
    <h3>${item.title || item.id}</h3>
    <p>${item.properties?.description || ""}</p>
    <ul>${assets}</ul>
  `;

  container.appendChild(div);
}

loadCatalog().catch(err => {
  document.getElementById("content").innerText = err.message;
});
