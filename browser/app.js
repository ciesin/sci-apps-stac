const CATALOG_URL = "../stac/catalog.json";

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${url}`);
  }
  return res.json();
}

async function loadCatalog() {
  const catalog = await fetchJSON(CATALOG_URL);

  const content = document.getElementById("content");
  content.innerHTML = "";

  const collectionLinks = catalog.links.filter(
    l => l.rel === "child"
  );

  for (const link of collectionLinks) {
    const collection = await fetchJSON(link.href);
    await renderCollection(collection, content);
  }
}

async function renderCollection(collection, container) {
  const section = document.createElement("section");

  section.innerHTML = `
    <h2>${collection.title || collection.id}</h2>
    <p>${collection.description || ""}</p>
  `;

  container.appendChild(section);

  const itemLinks = collection.links.filter(
    l => l.rel === "item"
  );

  for (const link of itemLinks) {
    const item = await fetchJSON(link.href);
    renderItem(item, section);
  }
}

function renderItem(item, container) {
  const div = document.createElement("div");
  div.className = "item";

  const assetsHtml = Object.entries(item.assets || {})
    .map(([key, asset]) => `
      <li>
        <a href="${asset.href}" target="_blank">
          ${asset.title || key}
        </a>
      </li>
    `)
    .join("");

  div.innerHTML = `
    <h3>${item.title || item.id}</h3>
    <p class="description">
      ${item.properties?.description || ""}
    </p>
    <ul class="assets">
      ${assetsHtml}
    </ul>
  `;

  container.appendChild(div);
}

loadCatalog().catch(err => {
  document.getElementById("content").innerText = err.message;
});
