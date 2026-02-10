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
  section.className = "collection";

  const header = document.createElement("h2");
  header.textContent = collection.title || collection.id;
  header.className = "collection-header";

  const desc = document.createElement("p");
  desc.textContent = collection.description || "";

  const itemsContainer = document.createElement("div");
  itemsContainer.className = "items";
  itemsContainer.style.display = "none"; // collapsed by default

  header.addEventListener("click", async () => {
    const isOpen = itemsContainer.style.display === "block";
    itemsContainer.style.display = isOpen ? "none" : "block";

    // lazy-load items only once
    if (!itemsContainer.dataset.loaded) {
      const items = collection.links.filter(l => l.rel === "item");
      for (const link of items) {
        const itemUrl = new URL(link.href, collectionUrl);
        const item = await fetchJSON(itemUrl);
        renderItem(item, itemsContainer);
      }
      itemsContainer.dataset.loaded = "true";
    }
  });

  section.appendChild(header);
  section.appendChild(desc);
  section.appendChild(itemsContainer);
  container.appendChild(section);
}


function renderItem(item, container) {
  const itemDiv = document.createElement("div");
  itemDiv.className = "item";

  const header = document.createElement("h3");
  header.textContent = item.title || item.id;
  header.className = "item-header";

  const body = document.createElement("div");
  body.className = "item-body";
  body.style.display = "none";

  const desc = document.createElement("p");
  desc.textContent = item.properties?.description || "";

  const assetsList = document.createElement("ul");

  for (const a of Object.values(item.assets || {})) {
    const li = document.createElement("li");
    const href = new URL(a.href, container.baseURI).href;
    li.innerHTML = `<a href="${href}" target="_blank">${a.title || a.type || "Asset"}</a>`;
    assetsList.appendChild(li);
  }

  body.appendChild(desc);
  body.appendChild(assetsList);

  header.addEventListener("click", () => {
    body.style.display = body.style.display === "none" ? "block" : "none";
  });

  itemDiv.appendChild(header);
  itemDiv.appendChild(body);
  container.appendChild(itemDiv);
}


const content = document.getElementById("content");

loadNode(CATALOG_URL, content).catch(err => {
  content.innerText = err.message;
});
