/**
 * Bros & Bitez - Digital QR Menu Application Logic
 * Fetches real-time dynamic menu, brand visuals, socials & hours from API.
 */

// Fallback Default Data
let MENU_DATA = [
  {
    id: "coffee",
    name: "Coffee",
    icon: "☕",
    items: [
      {
        id: "c1",
        name: "Espresso Coffee",
        price: 99,
        diet: "veg",
        desc: "Rich, intense full-bodied double shot extracted from freshly ground dark roast arabica beans.",
        image: "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?q=80&w=400&auto=format&fit=crop"
      },
      {
        id: "c2",
        name: "Cappuccino",
        price: 149,
        diet: "veg",
        desc: "Balanced espresso poured over velvety steamed whole milk topped with thick creamy microfoam and cocoa dust.",
        image: "https://images.unsplash.com/photo-1534778101976-62847782c213?q=80&w=400&auto=format&fit=crop"
      },
      {
        id: "c3",
        name: "Caramel Macchiato",
        price: 189,
        diet: "veg",
        desc: "Freshly steamed milk with vanilla-flavored syrup marked with espresso and topped with caramel drizzle.",
        image: "https://images.unsplash.com/photo-1485808191679-5f86510681a2?q=80&w=400&auto=format&fit=crop"
      }
    ]
  }
];

// App State
let currentCategoryId = null; // Automatically follows the first category in data
let userSelectedCategoryManually = false;
let currentDietFilter = "all";
let currentSearchQuery = "";

// DOM Elements
const categoriesContainer = document.getElementById("categoriesContainer");
const menuListContainer = document.getElementById("menuListContainer");
const currentCategoryTitle = document.getElementById("currentCategoryTitle");
const itemCountBadge = document.getElementById("itemCountBadge");
const menuSearch = document.getElementById("menuSearch");
const clearSearchBtn = document.getElementById("clearSearch");
const dietButtons = document.querySelectorAll(".diet-btn");

// Item Modal
const itemModal = document.getElementById("itemModal");
const closeItemModal = document.getElementById("closeItemModal");
const modalItemImage = document.getElementById("modalItemImage");
const modalDietTag = document.getElementById("modalDietTag");
const modalItemTitle = document.getElementById("modalItemTitle");
const modalItemPrice = document.getElementById("modalItemPrice");
const modalItemDesc = document.getElementById("modalItemDesc");

// Wi-Fi Modal
const btnShowWifi = document.getElementById("btnShowWifi");
const wifiModal = document.getElementById("wifiModal");
const closeWifiModal = document.getElementById("closeWifiModal");
const copyWifiBtn = document.getElementById("copyWifiBtn");
const wifiPass = document.getElementById("wifiPass");

// Contact & Brand elements
const brandMainLogo = document.querySelector(".brand-main-logo");
const heroBanner = document.querySelector(".hero-banner");
const btnLocation = document.getElementById("btnLocation");
const btnPhone = document.getElementById("btnPhone");
const btnWhatsApp = document.getElementById("btnWhatsApp");
const fbLink = document.getElementById("fbLink");
const igLink = document.getElementById("igLink");
const btnGoogleReview = document.getElementById("btnGoogleReview");
const cafeTimings = document.querySelector(".cafe-timings");
const copyrightNote = document.querySelector(".copyright-note");

// ==========================================================
// INITIALIZATION
// ==========================================================
async function initApp() {
  setupEventListeners();
  await loadMenuData();
  renderCategories();
  renderMenuList();
  setupLiveSync();
}

// Fetch dynamic configuration from API
async function loadMenuData() {
  try {
    const res = await fetch("/api/menu");
    if (res.ok) {
      const data = await res.json();
      applyConfig(data);
    }
  } catch (err) {
    console.warn("Using local fallback menu data:", err);
  }
}

function applyConfig(data) {
  if (!data) return;

  // 1. Brand Visuals
  if (data.brand) {
    if (data.brand.logoUrl && brandMainLogo) {
      brandMainLogo.src = data.brand.logoUrl;
    }
    if (data.brand.heroBgUrl && heroBanner) {
      heroBanner.style.backgroundImage = `url('${data.brand.heroBgUrl}')`;
    }
    if (data.brand.dineInHours && cafeTimings) {
      const hours = data.brand.dineInHours;
      cafeTimings.textContent = hours.startsWith("🕒") ? hours : `🕒 Dine-in Hours: ${hours}`;
    }
    if (data.brand.footerText && copyrightNote) {
      copyrightNote.textContent = data.brand.footerText;
    }
  }

  // 2. Social & Contacts
  if (data.contacts) {
    if (btnLocation && data.contacts.mapsUrl) btnLocation.href = data.contacts.mapsUrl;
    if (btnPhone && data.contacts.phone) btnPhone.href = `tel:${data.contacts.phone}`;
    if (btnWhatsApp && data.contacts.whatsapp) btnWhatsApp.href = `https://wa.me/${data.contacts.whatsapp}`;
    if (fbLink && data.contacts.fbUrl) fbLink.href = data.contacts.fbUrl;
    if (igLink && data.contacts.igUrl) igLink.href = data.contacts.igUrl;
    if (btnGoogleReview && data.contacts.googleReviewUrl) btnGoogleReview.href = data.contacts.googleReviewUrl;
    
    // Wi-Fi dialog details
    if (data.contacts.wifiSsid) {
      const wNameEl = document.querySelector(".wifi-details-card .wifi-row:first-child .w-val");
      if (wNameEl) wNameEl.textContent = data.contacts.wifiSsid;
    }
    if (data.contacts.wifiPass && wifiPass) {
      wifiPass.textContent = data.contacts.wifiPass;
    }
  }

  // 3. Categories & Items
  if (data.categories && Array.isArray(data.categories) && data.categories.length > 0) {
    const prevFirstCategory = (MENU_DATA && MENU_DATA.length > 0) ? MENU_DATA[0].id : null;
    MENU_DATA = data.categories;
    const newFirstCategory = MENU_DATA[0].id;

    // Follow the new first category unless customer explicitly tapped another category
    if (!currentCategoryId || !MENU_DATA.find(c => c.id === currentCategoryId) || (!userSelectedCategoryManually && currentCategoryId === prevFirstCategory)) {
      currentCategoryId = newFirstCategory;
    }
  }
}

// ==========================================================
// RENDER CATEGORIES
// ==========================================================
function renderCategories() {
  categoriesContainer.innerHTML = "";
  
  if (!currentCategoryId && MENU_DATA.length > 0) {
    currentCategoryId = MENU_DATA[0].id;
  }

  MENU_DATA.forEach((cat) => {
    const pill = document.createElement("button");
    pill.className = `category-pill ${cat.id === currentCategoryId ? "active" : ""}`;
    pill.setAttribute("data-cat-id", cat.id);
    pill.innerHTML = `<span class="cat-icon">${cat.icon || "🍽️"}</span> <span>${cat.name}</span>`;
    
    pill.addEventListener("click", () => {
      userSelectedCategoryManually = true;
      if (currentCategoryId !== cat.id) {
        currentCategoryId = cat.id;
        
        if (currentSearchQuery) {
          currentSearchQuery = "";
          menuSearch.value = "";
          clearSearchBtn.style.display = "none";
        }
        
        document.querySelectorAll(".category-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        
        pill.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        renderMenuList();
      }
    });

    categoriesContainer.appendChild(pill);
  });

  const activePill = categoriesContainer.querySelector(".category-pill.active");
  if (activePill) {
    activePill.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }
}

// ==========================================================
// RENDER MENU ITEMS (PRICE IN RUPEES & 1:1 SQUARE IMAGES)
// ==========================================================
function renderMenuList() {
  menuListContainer.innerHTML = "";
  
  const activeCategory = MENU_DATA.find(c => c.id === currentCategoryId);
  let itemsToRender = [];

  if (currentSearchQuery.trim() !== "") {
    currentCategoryTitle.textContent = `Search: "${currentSearchQuery}"`;
    const query = currentSearchQuery.toLowerCase();
    
    MENU_DATA.forEach(cat => {
      if (cat.items) {
        cat.items.forEach(item => {
          if (item.name.toLowerCase().includes(query) || (item.desc && item.desc.toLowerCase().includes(query))) {
            itemsToRender.push(item);
          }
        });
      }
    });
  } else {
    currentCategoryTitle.textContent = activeCategory ? activeCategory.name : "Menu";
    itemsToRender = (activeCategory && activeCategory.items) ? [...activeCategory.items] : [];
  }

  if (currentDietFilter !== "all") {
    itemsToRender = itemsToRender.filter(item => item.diet === currentDietFilter);
  }

  itemCountBadge.textContent = `${itemsToRender.length} item${itemsToRender.length === 1 ? "" : "s"}`;

  if (itemsToRender.length === 0) {
    menuListContainer.innerHTML = `
      <div class="empty-menu-box">
        <div class="empty-menu-icon">🍽️</div>
        <p>No menu items found in this section.</p>
      </div>
    `;
    return;
  }

  itemsToRender.forEach(item => {
    const row = document.createElement("div");
    row.className = "menu-item-row";
    row.id = `item-${item.id}`;

    const itemImageSrc = item.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop";

    row.innerHTML = `
      <div class="item-info-col">
        <h3 class="item-name">${item.name}</h3>
        <span class="item-price">₹${item.price}</span>
      </div>
      <div class="item-thumb-col">
        <img class="item-img" src="${itemImageSrc}" alt="${item.name}" loading="lazy">
      </div>
    `;

    row.addEventListener("click", () => openItemDetail(item));
    menuListContainer.appendChild(row);
  });
}

// ==========================================================
// ITEM DETAIL MODAL
// ==========================================================
let currentlyViewedItemId = null;

function openItemDetail(item) {
  currentlyViewedItemId = item.id;
  modalItemImage.src = item.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop";
  modalItemImage.alt = item.name;
  modalItemTitle.textContent = item.name;
  modalItemPrice.textContent = `₹${item.price}`;
  if (modalItemDesc) modalItemDesc.textContent = "";
  
  modalDietTag.className = `diet-tag ${item.diet || 'veg'}`;
  modalDietTag.textContent = item.diet === 'nonveg' ? '🍗 Non-Veg' : '🌱 Vegetarian';
  modalDietTag.style.color = item.diet === 'nonveg' ? '#D32F2F' : '#108A46';

  itemModal.classList.add("active");
  itemModal.setAttribute("aria-hidden", "false");
}

function closeModals() {
  currentlyViewedItemId = null;
  itemModal.classList.remove("active");
  itemModal.setAttribute("aria-hidden", "true");
  wifiModal.classList.remove("active");
  wifiModal.setAttribute("aria-hidden", "true");
}

// ==========================================================
// EVENT LISTENERS
// ==========================================================
function setupEventListeners() {
  dietButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      dietButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentDietFilter = btn.dataset.diet;
      renderMenuList();
    });
  });

  menuSearch.addEventListener("input", (e) => {
    currentSearchQuery = e.target.value;
    clearSearchBtn.style.display = currentSearchQuery ? "block" : "none";
    renderMenuList();
  });

  clearSearchBtn.addEventListener("click", () => {
    menuSearch.value = "";
    currentSearchQuery = "";
    clearSearchBtn.style.display = "none";
    renderMenuList();
  });

  closeItemModal.addEventListener("click", closeModals);
  itemModal.addEventListener("click", (e) => {
    if (e.target === itemModal) closeModals();
  });

  btnShowWifi.addEventListener("click", () => {
    wifiModal.classList.add("active");
    wifiModal.setAttribute("aria-hidden", "false");
  });

  closeWifiModal.addEventListener("click", closeModals);
  wifiModal.addEventListener("click", (e) => {
    if (e.target === wifiModal) closeModals();
  });

  copyWifiBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(wifiPass.textContent).then(() => {
      copyWifiBtn.textContent = "Copied! ✓";
      setTimeout(() => copyWifiBtn.textContent = "Copy", 2000);
    });
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModals();
  });
}

// ==========================================================
// REAL-TIME INSTANT LIVE SYNC (SSE + BROADCASTCHANNEL)
// ==========================================================
function onLiveMenuUpdate(data) {
  if (!data) return;
  applyConfig(data);
  renderCategories();
  renderMenuList();
  updateOpenDetailModalIfAny();
}

function updateOpenDetailModalIfAny() {
  if (!currentlyViewedItemId || !itemModal || !itemModal.classList.contains("active")) return;
  
  let found = null;
  for (const cat of MENU_DATA) {
    const item = (cat.items || []).find(i => i.id === currentlyViewedItemId);
    if (item) {
      found = item;
      break;
    }
  }

  if (found) {
    openItemDetail(found);
  } else {
    // If dish was deleted by admin, close the dialog gracefully
    closeModals();
  }
}

function setupLiveSync() {
  // 1. Cross-tab BroadcastChannel for 0ms same-device sync
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const syncChannel = new BroadcastChannel("bros_bitez_menu_sync");
      syncChannel.onmessage = (event) => {
        if (event.data && event.data.type === "menu_update" && event.data.data) {
          onLiveMenuUpdate(event.data.data);
        }
      };
    } catch (e) {
      console.warn("BroadcastChannel not available:", e);
    }
  }

  // 2. Server-Sent Events (SSE) for phone/remote sync
  if (typeof EventSource !== "undefined") {
    let eventSource = null;

    function connectSSE() {
      try {
        eventSource = new EventSource("/api/live-sync");

        eventSource.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === "menu_update" && payload.data) {
              onLiveMenuUpdate(payload.data);
            }
          } catch (err) {
            // Heartbeat or non-JSON event
          }
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          // Reconnect with backoff
          setTimeout(connectSSE, 2500);
        };
      } catch (err) {
        console.warn("SSE connection error:", err);
      }
    }

    connectSSE();
  }

  // 3. Re-sync when customer tab or phone wakes from sleep
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      loadMenuData().then(() => {
        renderCategories();
        renderMenuList();
        updateOpenDetailModalIfAny();
      });
    }
  });

  window.addEventListener("online", () => {
    loadMenuData().then(() => {
      renderCategories();
      renderMenuList();
      updateOpenDetailModalIfAny();
    });
  });
}

document.addEventListener("DOMContentLoaded", initApp);
