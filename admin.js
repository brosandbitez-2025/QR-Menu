/**
 * Bros & Bitez - Admin Dashboard Application Logic
 * Implements complete management for:
 * - Logo & Hero background banner upload/edit
 * - Menu categories & 1:1 dishes with ₹ pricing
 * - Dine-In hours & Free Guest Wi-Fi
 * - Social media links & direct contacts
 */

// PIN loaded from server on init; fallback to "1234" until loaded
let CURRENT_PIN = "1234";

// Global App State
let adminData = {
  brand: {},
  contacts: {},
  categories: []
};

let currentTab = "tab-brand";
let selectedCategoryFilter = "all";
let searchKeyword = "";

// Persistent cross-tab sync channel
const adminBroadcastChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("bros_bitez_menu_sync") : null;

// DOM Elements
const pinGateModal = document.getElementById("pinGateModal");
const adminPinInput = document.getElementById("adminPinInput");
const submitPinBtn = document.getElementById("submitPinBtn");
const pinError = document.getElementById("pinError");
const adminApp = document.getElementById("adminApp");
const logoutBtn = document.getElementById("logoutBtn");
const saveAllChangesBtn = document.getElementById("saveAllChangesBtn");
const adminToast = document.getElementById("adminToast");

// Brand Elements
const headerLogoThumb = document.getElementById("headerLogoThumb");
const brandLogoPreview = document.getElementById("brandLogoPreview");
const logoUrlInput = document.getElementById("logoUrlInput");
const logoFileInput = document.getElementById("logoFileInput");
const bannerPreviewBox = document.getElementById("bannerPreviewBox");
const heroBgUrlInput = document.getElementById("heroBgUrlInput");
const heroFileInput = document.getElementById("heroFileInput");

// Hours & Wi-Fi Elements
const dineInHoursInput = document.getElementById("dineInHoursInput");
const footerTextInput = document.getElementById("footerTextInput");
const wifiSsidInput = document.getElementById("wifiSsidInput");
const wifiPassInput = document.getElementById("wifiPassInput");

// Socials & Contacts Elements
const fbUrlInput = document.getElementById("fbUrlInput");
const igUrlInput = document.getElementById("igUrlInput");
const whatsappInput = document.getElementById("whatsappInput");
const phoneInput = document.getElementById("phoneInput");
const mapsUrlInput = document.getElementById("mapsUrlInput");
const googleReviewUrlInput = document.getElementById("googleReviewUrlInput");

// Menu & Categories Elements
const adminSearchInput = document.getElementById("adminSearchInput");
const adminMenuList = document.getElementById("adminMenuList");
const adminMenuListCount = document.getElementById("adminMenuListCount");
const categoriesGrid = document.getElementById("categoriesGrid");

// Custom Confirm Delete Modal Elements
const confirmDeleteModal = document.getElementById("confirmDeleteModal");
const confirmModalTitle = document.getElementById("confirmModalTitle");
const confirmModalDesc = document.getElementById("confirmModalDesc");
const confirmModalCancelBtn = document.getElementById("confirmModalCancelBtn");
const confirmModalConfirmBtn = document.getElementById("confirmModalConfirmBtn");
const confirmModalBtnText = document.getElementById("confirmModalBtnText");

// Modals
const itemFormModal = document.getElementById("itemFormModal");
const closeItemFormModal = document.getElementById("closeItemFormModal");
const cancelItemBtn = document.getElementById("cancelItemBtn");
const itemEditForm = document.getElementById("itemEditForm");
const openAddItemModalBtn = document.getElementById("openAddItemModalBtn");

const categoryFormModal = document.getElementById("categoryFormModal");
const closeCategoryFormModal = document.getElementById("closeCategoryFormModal");
const cancelCategoryBtn = document.getElementById("cancelCategoryBtn");
const categoryEditForm = document.getElementById("categoryEditForm");
const openAddCategoryModalBtn = document.getElementById("openAddCategoryModalBtn");

// Item Form Inputs
const editItemId = document.getElementById("editItemId");
const itemFormName = document.getElementById("itemFormName");
const itemFormCategory = document.getElementById("itemFormCategory");
const customCatDropdown = document.getElementById("customCatDropdown");
const customCatBtn = document.getElementById("customCatBtn");
const customCatSelected = document.getElementById("customCatSelected");
const customCatMenu = document.getElementById("customCatMenu");
const dietSegmentedPicker = document.getElementById("dietSegmentedPicker");
const itemFormPrice = document.getElementById("itemFormPrice");
const itemFormDiet = document.getElementById("itemFormDiet");
const itemFormDesc = document.getElementById("itemFormDesc");
const itemFormImgPreview = document.getElementById("itemFormImgPreview");
const itemFormImgUrl = document.getElementById("itemFormImgUrl");
const itemFileInput = document.getElementById("itemFileInput");

// Category Form Inputs
const editCategoryId = document.getElementById("editCategoryId");
const catFormName = document.getElementById("catFormName");
const catFormIcon = document.getElementById("catFormIcon");

// ==========================================================
// AUTHENTICATION & PIN CHECK
// ==========================================================
function checkAuth() {
  if (sessionStorage.getItem("bros_admin_auth") === "true") {
    pinGateModal.style.display = "none";
    adminApp.style.display = "block";
    loadData();
  } else {
    pinGateModal.style.display = "flex";
    adminApp.style.display = "none";
  }
}

// Load the stored admin PIN from server at startup
async function loadAdminPin() {
  try {
    const res = await fetch("/api/pin-verify");
    if (res.ok) {
      const data = await res.json();
      CURRENT_PIN = data.pin || "1234";
    }
  } catch (e) {
    // silently use fallback
  }
}

submitPinBtn.addEventListener("click", async () => {
  const entered = adminPinInput.value.trim();
  // Verify PIN against server
  try {
    const res = await fetch("/api/pin-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: entered })
    });
    const data = await res.json();
    if (data.valid) {
      sessionStorage.setItem("bros_admin_auth", "true");
      pinError.style.display = "none";
      checkAuth();
    } else {
      pinError.style.display = "block";
      adminPinInput.value = "";
      adminPinInput.focus();
    }
  } catch (e) {
    // Fallback: compare against in-memory pin
    if (entered === CURRENT_PIN) {
      sessionStorage.setItem("bros_admin_auth", "true");
      pinError.style.display = "none";
      checkAuth();
    } else {
      pinError.style.display = "block";
      adminPinInput.value = "";
      adminPinInput.focus();
    }
  }
});

adminPinInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitPinBtn.click();
});

logoutBtn.addEventListener("click", () => {
  sessionStorage.removeItem("bros_admin_auth");
  checkAuth();
});

// ============================================================
// CHANGE PIN HANDLER
// ============================================================
const changePinForm = document.getElementById("changePinForm");
const changePinCurrentInput = document.getElementById("changePinCurrent");
const changePinNewInput = document.getElementById("changePinNew");
const changePinConfirmInput = document.getElementById("changePinConfirm");
const changePinMsg = document.getElementById("changePinMsg");

if (changePinForm) {
  changePinForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const currentPin = changePinCurrentInput.value.trim();
    const newPin = changePinNewInput.value.trim();
    const confirmPin = changePinConfirmInput.value.trim();

    changePinMsg.className = "change-pin-msg";
    changePinMsg.style.display = "none";

    if (!currentPin || !newPin || !confirmPin) {
      changePinMsg.textContent = "Please fill in all fields.";
      changePinMsg.className = "change-pin-msg error";
      changePinMsg.style.display = "block";
      return;
    }
    if (newPin.length < 4) {
      changePinMsg.textContent = "New PIN must be at least 4 digits.";
      changePinMsg.className = "change-pin-msg error";
      changePinMsg.style.display = "block";
      return;
    }
    if (newPin !== confirmPin) {
      changePinMsg.textContent = "New PIN and confirmation do not match.";
      changePinMsg.className = "change-pin-msg error";
      changePinMsg.style.display = "block";
      return;
    }

    try {
      const res = await fetch("/api/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        CURRENT_PIN = newPin;
        changePinForm.reset();
        changePinMsg.textContent = "✓ PIN changed successfully! Use your new PIN next time you log in.";
        changePinMsg.className = "change-pin-msg success";
        changePinMsg.style.display = "block";
        showToast("Admin PIN updated successfully!");
      } else {
        changePinMsg.textContent = data.error || "Failed to change PIN.";
        changePinMsg.className = "change-pin-msg error";
        changePinMsg.style.display = "block";
      }
    } catch (err) {
      changePinMsg.textContent = "Network error. Please try again.";
      changePinMsg.className = "change-pin-msg error";
      changePinMsg.style.display = "block";
    }
  });
}

// ==========================================================
// DATA LOADING & POPULATION
// ==========================================================
async function loadData() {
  try {
    const res = await fetch("/api/menu");
    if (!res.ok) throw new Error("Could not fetch data");
    adminData = await res.json();
    populateAllFields();
  } catch (err) {
    showToast("Error loading data from server: " + err.message, true);
  }
}

function populateAllFields() {
  // 1. Brand Visuals
  if (adminData.brand) {
    const logo = adminData.brand.logoUrl || "Assets/bros_bitez_logo_clean.png";
    logoUrlInput.value = logo;
    brandLogoPreview.src = logo;
    headerLogoThumb.src = logo;

    const bg = adminData.brand.heroBgUrl || "";
    heroBgUrlInput.value = bg;
    bannerPreviewBox.style.backgroundImage = `url('${bg}')`;

    dineInHoursInput.value = adminData.brand.dineInHours || "";
    footerTextInput.value = adminData.brand.footerText || "";
  }

  // 2. Wi-Fi & Contacts
  if (adminData.contacts) {
    wifiSsidInput.value = adminData.contacts.wifiSsid || "";
    wifiPassInput.value = adminData.contacts.wifiPass || "";

    fbUrlInput.value = adminData.contacts.fbUrl || "";
    igUrlInput.value = adminData.contacts.igUrl || "";
    whatsappInput.value = adminData.contacts.whatsapp || "";
    phoneInput.value = adminData.contacts.phone || "";
    mapsUrlInput.value = adminData.contacts.mapsUrl || "";
    googleReviewUrlInput.value = adminData.contacts.googleReviewUrl || "";
  }

  // 3. Render Categories & Items
  renderCategoryFilterOptions();
  renderItemsTable();
  renderCategoriesGrid();
}

// ==========================================================
// TABS NAVIGATION
// ==========================================================
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));

    btn.classList.add("active");
    currentTab = btn.dataset.tab;
    document.getElementById(currentTab).classList.add("active");
  });
});

// ==========================================================
// FILE UPLOAD HELPERS (BASE64 TO /api/upload)
// ==========================================================
function setupImageUpload(fileInput, urlInput, previewCallback) {
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;
      try {
        showToast("Uploading image...");
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileData: base64
          })
        });
        const result = await res.json();
        if (result.success) {
          urlInput.value = result.filePath;
          previewCallback(result.filePath);
          showToast("Image uploaded successfully!");
        } else {
          showToast("Upload failed: " + result.error, true);
        }
      } catch (err) {
        showToast("Upload error: " + err.message, true);
      }
    };
    reader.readAsDataURL(file);
  });

  urlInput.addEventListener("input", () => {
    previewCallback(urlInput.value);
  });
}

// Bind upload handlers
setupImageUpload(logoFileInput, logoUrlInput, (url) => {
  brandLogoPreview.src = url;
  headerLogoThumb.src = url;
  syncAdminState("✓ Logo updated & live on QR menu!");
});

setupImageUpload(heroFileInput, heroBgUrlInput, (url) => {
  bannerPreviewBox.style.backgroundImage = `url('${url}')`;
  syncAdminState("✓ Banner updated & live on QR menu!");
});

setupImageUpload(itemFileInput, itemFormImgUrl, (url) => {
  itemFormImgPreview.src = url;
});

// ==========================================================
// CATEGORIES & MODERN CHIPS FILTER LOGIC
// ==========================================================
const categoryPillChips = document.getElementById("categoryPillChips");

function renderCategoryFilterOptions() {
  if (categoryPillChips) {
    categoryPillChips.innerHTML = "";

    // 1. "All" Chip with total count
    const totalCount = (adminData.categories || []).reduce((sum, c) => sum + (c.items ? c.items.length : 0), 0);
    const allChip = document.createElement("button");
    allChip.className = `cat-chip-btn ${selectedCategoryFilter === "all" ? "active" : ""}`;
    allChip.innerHTML = `<span>🍽️ All Dishes</span> <span class="cat-chip-count">${totalCount}</span>`;
    allChip.addEventListener("click", () => {
      selectedCategoryFilter = "all";
      renderCategoryFilterOptions();
      renderItemsTable();
    });
    categoryPillChips.appendChild(allChip);

    // 2. Individual Category Chips
    (adminData.categories || []).forEach(cat => {
      const count = (cat.items || []).length;
      const chip = document.createElement("button");
      chip.className = `cat-chip-btn ${selectedCategoryFilter === cat.id ? "active" : ""}`;
      chip.innerHTML = `<span>${cat.icon || "🍽️"} ${cat.name}</span> <span class="cat-chip-count">${count}</span>`;
      
      chip.addEventListener("click", () => {
        selectedCategoryFilter = cat.id;
        renderCategoryFilterOptions();
        renderItemsTable();
      });

      categoryPillChips.appendChild(chip);
    });
  }

  // Populate Add/Edit Dish modal custom category dropdown
  populateCustomCategoryDropdown(itemFormCategory ? itemFormCategory.value : "");
}

function renderCategoriesGrid() {
  if (!categoriesGrid) return;
  categoriesGrid.innerHTML = "";

  const totalCategories = (adminData.categories || []).length;

  (adminData.categories || []).forEach((cat, index) => {
    const card = document.createElement("div");
    card.className = "cat-row-card";
    const itemCount = (cat.items || []).length;

    card.innerHTML = `
      <div class="cat-row-left">
        <span class="cat-order-num" title="Category Order Position">#${index + 1}</span>
        <div class="cat-icon-badge">${cat.icon || "🍽️"}</div>
        <div class="cat-row-info">
          <span class="cat-row-title">${cat.name}</span>
          <span class="cat-row-count">${itemCount} dish${itemCount === 1 ? "" : "es"}</span>
        </div>
      </div>
      <div class="cat-row-actions">
        <div class="cat-reorder-arrows">
          <button type="button" class="arrow-btn move-up-btn" data-id="${cat.id}" title="Move Up" ${index === 0 ? "disabled" : ""}>⬆</button>
          <button type="button" class="arrow-btn move-down-btn" data-id="${cat.id}" title="Move Down" ${index === totalCategories - 1 ? "disabled" : ""}>⬇</button>
        </div>
        <button type="button" class="action-btn-sm edit-cat-btn" data-id="${cat.id}">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
          <span>Edit</span>
        </button>
        <button type="button" class="action-btn-sm delete delete-cat-btn" data-id="${cat.id}">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          <span>Delete</span>
        </button>
      </div>
    `;

    categoriesGrid.appendChild(card);
  });
}

function moveCategoryById(catId, direction) {
  const index = (adminData.categories || []).findIndex(c => c.id === catId);
  if (index === -1) return;
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= adminData.categories.length) return;

  // Swap elements in categories array
  const temp = adminData.categories[index];
  adminData.categories[index] = adminData.categories[newIndex];
  adminData.categories[newIndex] = temp;

  renderCategoryFilterOptions();
  renderCategoriesGrid();
  renderItemsTable();
  syncAdminState(`✓ Moved "${temp.name}" ${direction === -1 ? "Up" : "Down"} (Live synced)`);
}

function openAddCategoryModal() {
  editCategoryId.value = "";
  document.getElementById("categoryModalHeading").textContent = "Add New Category";
  catFormName.value = "";
  catFormIcon.value = "🍽️";
  categoryFormModal.classList.add("active");
}

function openEditCategoryModal(cat) {
  editCategoryId.value = cat.id;
  document.getElementById("categoryModalHeading").textContent = "Edit Category";
  catFormName.value = cat.name;
  catFormIcon.value = cat.icon || "🍽️";
  categoryFormModal.classList.add("active");
}

async function deleteCategory(catId) {
  const cat = adminData.categories.find(c => c.id === catId);
  if (!cat) return;

  const count = (cat.items || []).length;
  const confirmed = await showCustomConfirm({
    title: "Delete Category?",
    message: `Are you sure you want to delete category <strong>"${cat.name}"</strong>${count > 0 ? ` and all its <strong>${count} dishes</strong>` : ""}? This action cannot be undone.`,
    btnText: "Delete Category"
  });

  if (confirmed) {
    adminData.categories = adminData.categories.filter(c => c.id !== catId);
    if (selectedCategoryFilter === catId) {
      selectedCategoryFilter = "all";
    }
    renderCategoryFilterOptions();
    renderCategoriesGrid();
    renderItemsTable();
    syncAdminState(`✓ Category "${cat.name}" deleted (Live synced)`);
  }
}

categoryEditForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = editCategoryId.value.trim();
  const name = catFormName.value.trim();
  const icon = catFormIcon.value.trim() || "🍽️";

  if (!name) return;

  if (id) {
    // Edit existing
    const existing = adminData.categories.find(c => c.id === id);
    if (existing) {
      existing.name = name;
      existing.icon = icon;
    }
  } else {
    // New category
    const newId = name.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now().toString().slice(-4);
    adminData.categories.push({
      id: newId,
      name: name,
      icon: icon,
      items: []
    });
  }

  categoryFormModal.classList.remove("active");
  renderCategoryFilterOptions();
  renderCategoriesGrid();
  renderItemsTable();
  syncAdminState(`✓ Category "${name}" saved & live on QR menu!`);
});

// Setup quick emoji preset selectors in Category modal
document.querySelectorAll(".preset-emoji-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    catFormIcon.value = btn.dataset.emoji;
  });
});

// ==========================================================
// MENU ITEMS LOGIC (1:1 IMAGES & RUPEES)
// ==========================================================
if (adminSearchInput) {
  adminSearchInput.addEventListener("input", (e) => {
    searchKeyword = e.target.value.toLowerCase().trim();
    renderItemsTable();
  });
}

function renderItemsTable() {
  if (!adminMenuList) return;
  adminMenuList.innerHTML = "";
  let rows = [];

  (adminData.categories || []).forEach(cat => {
    if (selectedCategoryFilter === "all" || selectedCategoryFilter === cat.id) {
      (cat.items || []).forEach(item => {
        if (!searchKeyword || item.name.toLowerCase().includes(searchKeyword)) {
          rows.push({ ...item, categoryId: cat.id, categoryName: cat.name });
        }
      });
    }
  });

  if (adminMenuListCount) {
    const filterCatName = selectedCategoryFilter === "all" 
      ? "All Dishes" 
      : (adminData.categories.find(c => c.id === selectedCategoryFilter)?.name || "Dishes");
    adminMenuListCount.textContent = `${filterCatName} (${rows.length})`;
  }

  if (rows.length === 0) {
    adminMenuList.innerHTML = `
      <div class="admin-empty-state">
        <div class="empty-icon">🍽️</div>
        <h3>No dishes found</h3>
        <p>No dishes match the selected category or search keyword. Click <strong>+ Add New Dish</strong> to create one.</p>
      </div>
    `;
    return;
  }

  rows.forEach(item => {
    const card = document.createElement("div");
    card.className = "admin-dish-row";
    const thumbSrc = item.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop";

    // Find position within parent category
    const cat = (adminData.categories || []).find(c => c.id === item.categoryId);
    const itemIndexInCat = cat && cat.items ? cat.items.findIndex(i => i.id === item.id) : -1;
    const totalItemsInCat = cat && cat.items ? cat.items.length : 0;
    const isFirst = itemIndexInCat <= 0;
    const isLast = itemIndexInCat >= totalItemsInCat - 1;
    const orderBadge = itemIndexInCat >= 0 ? `<span class="dish-order-badge" title="Position #${itemIndexInCat + 1} in ${item.categoryName}">#${itemIndexInCat + 1}</span>` : "";

    card.innerHTML = `
      <div class="admin-dish-main">
        <div class="admin-dish-info">
          <div class="admin-dish-topline">
            <span class="diet-symbol ${item.diet === 'nonveg' ? 'nonveg' : 'veg'}" title="${item.diet === 'nonveg' ? 'Non-Vegetarian' : 'Vegetarian'}"></span>
            ${orderBadge}
            <span class="dish-cat-pill">${item.categoryName}</span>
          </div>
          <h4 class="admin-dish-name">${item.name}</h4>
          <div class="admin-dish-price">₹${item.price}</div>
        </div>
        <div class="admin-dish-thumb-col">
          <img class="admin-dish-thumb" src="${thumbSrc}" alt="${item.name}">
        </div>
      </div>

      <div class="admin-dish-footer">
        <div class="dish-reorder-arrows">
          <button type="button" class="arrow-btn move-item-up-btn" data-id="${item.id}" data-cat="${item.categoryId}" title="Move Up within ${item.categoryName}" ${isFirst ? "disabled" : ""}>⬆</button>
          <button type="button" class="arrow-btn move-item-down-btn" data-id="${item.id}" data-cat="${item.categoryId}" title="Move Down within ${item.categoryName}" ${isLast ? "disabled" : ""}>⬇</button>
        </div>
        <div class="dish-mgmt-buttons">
          <button type="button" class="action-btn-sm edit-item-btn" data-id="${item.id}" data-cat="${item.categoryId}">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
            <span>Edit</span>
          </button>
          <button type="button" class="action-btn-sm delete delete-item-btn" data-id="${item.id}" data-cat="${item.categoryId}">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            <span>Delete</span>
          </button>
        </div>
      </div>
    `;

    adminMenuList.appendChild(card);
  });
}

function moveItem(catId, itemId, direction) {
  const cat = (adminData.categories || []).find(c => c.id === catId);
  if (!cat || !cat.items) return;

  const index = cat.items.findIndex(i => i.id === itemId);
  if (index === -1) return;

  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= cat.items.length) return;

  // Swap item positions in category
  const temp = cat.items[index];
  cat.items[index] = cat.items[newIndex];
  cat.items[newIndex] = temp;

  renderItemsTable();
  syncAdminState(`✓ Moved "${temp.name}" ${direction === -1 ? "Up" : "Down"} (Live synced)`);
}

function openAddItemModal() {
  editItemId.value = "";
  document.getElementById("itemModalHeading").textContent = "Add New Menu Item";
  itemFormName.value = "";
  itemFormPrice.value = "";
  setDietaryPreference("veg");
  if (itemFormDesc) itemFormDesc.value = "";
  itemFormImgUrl.value = "";
  itemFormImgPreview.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop";
  
  const defaultCat = (selectedCategoryFilter !== "all" && (adminData.categories || []).some(c => c.id === selectedCategoryFilter))
    ? selectedCategoryFilter
    : ((adminData.categories && adminData.categories[0]) ? adminData.categories[0].id : "");
  populateCustomCategoryDropdown(defaultCat);
  if (customCatDropdown) customCatDropdown.classList.remove("open");

  itemFormModal.classList.add("active");
}

function openEditItemModal(item, catId) {
  editItemId.value = item.id;
  document.getElementById("itemModalHeading").textContent = "Edit Menu Item";
  itemFormName.value = item.name;
  populateCustomCategoryDropdown(catId);
  itemFormPrice.value = item.price;
  setDietaryPreference(item.diet || "veg");
  if (itemFormDesc) itemFormDesc.value = item.desc || "";
  itemFormImgUrl.value = item.image || "";
  itemFormImgPreview.src = item.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop";
  if (customCatDropdown) customCatDropdown.classList.remove("open");
  
  itemFormModal.classList.add("active");
}

async function deleteItem(itemId, catId) {
  const cat = adminData.categories.find(c => c.id === catId);
  if (!cat) return;

  const item = cat.items.find(i => i.id === itemId);
  if (!item) return;

  const confirmed = await showCustomConfirm({
    title: "Delete Dish?",
    message: `Are you sure you want to delete <strong>"${item.name}"</strong> from <strong>${cat.name}</strong>?`,
    btnText: "Delete Dish"
  });

  if (confirmed) {
    cat.items = cat.items.filter(i => i.id !== itemId);
    renderItemsTable();
    renderCategoriesGrid();
    syncAdminState(`✓ Dish "${item.name}" deleted (Live synced)`);
  }
}

itemEditForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = editItemId.value.trim();
  const name = itemFormName.value.trim();
  const catId = itemFormCategory.value;
  const price = parseInt(itemFormPrice.value, 10);
  const diet = itemFormDiet.value;
  const desc = itemFormDesc ? itemFormDesc.value.trim() : "";
  const image = itemFormImgUrl.value.trim() || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop";

  if (!name || isNaN(price) || !catId) return;

  const targetCategory = adminData.categories.find(c => c.id === catId);
  if (!targetCategory) return;

  if (id) {
    // Edit: First remove from any old category if category was changed
    adminData.categories.forEach(c => {
      c.items = c.items.filter(i => i.id !== id);
    });

    targetCategory.items.push({
      id: id,
      name: name,
      price: price,
      diet: diet,
      desc: desc,
      image: image
    });
  } else {
    // New item
    const newId = "dish-" + Date.now().toString();
    targetCategory.items.push({
      id: newId,
      name: name,
      price: price,
      diet: diet,
      desc: desc,
      image: image
    });
  }

  itemFormModal.classList.remove("active");
  renderItemsTable();
  renderCategoriesGrid();
  syncAdminState(`✓ Dish "${name}" saved & live on QR menu!`);
});

// ==========================================================
// REAL-TIME AUTO SYNC TO SERVER & QR MENU
// ==========================================================
async function syncAdminState(toastMsg = null) {
  if (logoUrlInput) {
    adminData.brand = {
      title: "Bros & Bitez - Digital Menu",
      logoUrl: logoUrlInput.value.trim() || "Assets/bros_bitez_logo_clean.png",
      heroBgUrl: heroBgUrlInput.value.trim() || "https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=1000&auto=format&fit=crop",
      dineInHours: dineInHoursInput ? dineInHoursInput.value.trim() || "10:00 AM – 11:30 PM" : "10:00 AM – 11:30 PM",
      footerText: footerTextInput ? footerTextInput.value.trim() || "© 2026 Bros & Bitez • Digital QR Menu" : "© 2026 Bros & Bitez • Digital QR Menu"
    };
  }

  if (mapsUrlInput) {
    adminData.contacts = {
      mapsUrl: mapsUrlInput.value.trim(),
      phone: phoneInput ? phoneInput.value.trim() : "",
      whatsapp: whatsappInput ? whatsappInput.value.trim() : "",
      fbUrl: fbUrlInput ? fbUrlInput.value.trim() : "",
      fbLabel: "Like us on Facebook",
      igUrl: igUrlInput ? igUrlInput.value.trim() : "",
      igLabel: "Follow us on Instagram",
      googleReviewUrl: googleReviewUrlInput ? googleReviewUrlInput.value.trim() : "",
      wifiSsid: wifiSsidInput ? wifiSsidInput.value.trim() : "",
      wifiPass: wifiPassInput ? wifiPassInput.value.trim() : ""
    };
  }

  // 1. Instant cross-tab broadcast for same-browser testing
  if (adminBroadcastChannel) {
    try {
      adminBroadcastChannel.postMessage({ type: "menu_update", data: adminData });
    } catch (err) {}
  }

  // 2. Persist to server (which broadcasts via SSE to all customer phones & tablets)
  try {
    const res = await fetch("/api/menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adminData)
    });
    const result = await res.json();
    if (result.success) {
      if (toastMsg) showToast(toastMsg);
    } else {
      if (toastMsg) showToast("Sync warning: " + result.error, true);
    }
  } catch (err) {
    console.error("Auto-sync error:", err);
  }
}

// SAVE ALL CHANGES BUTTON
saveAllChangesBtn.addEventListener("click", async () => {
  try {
    saveAllChangesBtn.disabled = true;
    saveAllChangesBtn.textContent = "Saving...";
    await syncAdminState("✓ All changes saved and live on QR menu!");
  } finally {
    saveAllChangesBtn.disabled = false;
    saveAllChangesBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
        <polyline points="17 21 17 13 7 13 7 21"></polyline>
        <polyline points="7 3 7 8 15 8"></polyline>
      </svg>
      <span>Save Changes</span>
    `;
  }
});

// ==========================================================
// MODAL CLOSE LISTENERS & TOAST
// ==========================================================
openAddItemModalBtn.addEventListener("click", openAddItemModal);
closeItemFormModal.addEventListener("click", () => itemFormModal.classList.remove("active"));
cancelItemBtn.addEventListener("click", () => itemFormModal.classList.remove("active"));

openAddCategoryModalBtn.addEventListener("click", openAddCategoryModal);
closeCategoryFormModal.addEventListener("click", () => categoryFormModal.classList.remove("active"));
cancelCategoryBtn.addEventListener("click", () => categoryFormModal.classList.remove("active"));

function showToast(msg, isError = false) {
  adminToast.textContent = msg;
  adminToast.style.borderColor = isError ? "var(--accent-danger)" : "var(--primary-amber)";
  adminToast.classList.add("show");
  setTimeout(() => adminToast.classList.remove("show"), 3000);
}

// ==========================================================
// CUSTOM DELETE CONFIRMATION MODAL LOGIC
// ==========================================================
let confirmResolveFn = null;

function showCustomConfirm({ title, message, btnText = "Yes, Delete" }) {
  return new Promise((resolve) => {
    if (!confirmDeleteModal || !confirmModalTitle) {
      // Fallback if modal DOM element is not found
      const plainMsg = message.replace(/<[^>]*>/g, '');
      const userOk = window.confirm(`${title}\n\n${plainMsg}`);
      resolve(userOk);
      return;
    }
    confirmModalTitle.textContent = title;
    confirmModalDesc.innerHTML = message;
    if (confirmModalBtnText) confirmModalBtnText.textContent = btnText;
    confirmResolveFn = resolve;
    confirmDeleteModal.classList.add("active");
  });
}

if (confirmModalCancelBtn) {
  confirmModalCancelBtn.addEventListener("click", () => {
    if (confirmDeleteModal) confirmDeleteModal.classList.remove("active");
    if (confirmResolveFn) {
      confirmResolveFn(false);
      confirmResolveFn = null;
    }
  });
}

if (confirmModalConfirmBtn) {
  confirmModalConfirmBtn.addEventListener("click", () => {
    if (confirmDeleteModal) confirmDeleteModal.classList.remove("active");
    if (confirmResolveFn) {
      confirmResolveFn(true);
      confirmResolveFn = null;
    }
  });
}

// Close confirmation modal when clicking backdrop outside box
if (confirmDeleteModal) {
  confirmDeleteModal.addEventListener("click", (e) => {
    if (e.target === confirmDeleteModal) {
      confirmDeleteModal.classList.remove("active");
      if (confirmResolveFn) {
        confirmResolveFn(false);
        confirmResolveFn = null;
      }
    }
  });
}

// Global delegated click listeners for Dishes and Categories
if (adminMenuList) {
  adminMenuList.addEventListener("click", (e) => {
    const moveUpBtn = e.target.closest(".move-item-up-btn");
    if (moveUpBtn && !moveUpBtn.disabled) {
      const id = moveUpBtn.dataset.id;
      const catId = moveUpBtn.dataset.cat;
      moveItem(catId, id, -1);
      return;
    }

    const moveDownBtn = e.target.closest(".move-item-down-btn");
    if (moveDownBtn && !moveDownBtn.disabled) {
      const id = moveDownBtn.dataset.id;
      const catId = moveDownBtn.dataset.cat;
      moveItem(catId, id, 1);
      return;
    }

    const editBtn = e.target.closest(".edit-item-btn");
    if (editBtn) {
      const id = editBtn.dataset.id;
      const catId = editBtn.dataset.cat;
      const cat = (adminData.categories || []).find(c => c.id === catId);
      const item = cat?.items?.find(i => i.id === id);
      if (item) openEditItemModal(item, catId);
      return;
    }

    const delBtn = e.target.closest(".delete-item-btn");
    if (delBtn) {
      const id = delBtn.dataset.id;
      const catId = delBtn.dataset.cat;
      deleteItem(id, catId);
      return;
    }
  });
}

if (categoriesGrid) {
  categoriesGrid.addEventListener("click", (e) => {
    const moveUpBtn = e.target.closest(".move-up-btn");
    if (moveUpBtn && !moveUpBtn.disabled) {
      const id = moveUpBtn.dataset.id;
      moveCategoryById(id, -1);
      return;
    }

    const moveDownBtn = e.target.closest(".move-down-btn");
    if (moveDownBtn && !moveDownBtn.disabled) {
      const id = moveDownBtn.dataset.id;
      moveCategoryById(id, 1);
      return;
    }

    const editBtn = e.target.closest(".edit-cat-btn");
    if (editBtn) {
      const id = editBtn.dataset.id;
      const cat = (adminData.categories || []).find(c => c.id === id);
      if (cat) openEditCategoryModal(cat);
      return;
    }

    const delBtn = e.target.closest(".delete-cat-btn");
    if (delBtn) {
      const id = delBtn.dataset.id;
      deleteCategory(id);
      return;
    }
  });
}

// Custom Category Dropdown & Dietary Picker Logic
function populateCustomCategoryDropdown(activeId) {
  if (!customCatMenu) return;
  customCatMenu.innerHTML = "";
  
  const categories = adminData.categories || [];
  if (categories.length === 0) return;

  const targetId = activeId || (itemFormCategory ? itemFormCategory.value : "") || categories[0].id;
  const currentCat = categories.find(c => c.id === targetId) || categories[0];

  if (itemFormCategory) {
    itemFormCategory.value = currentCat.id;
  }

  if (customCatSelected) {
    customCatSelected.innerHTML = `
      <span class="cat-drop-icon">${currentCat.icon || "🍽️"}</span>
      <span class="cat-drop-text">${currentCat.name}</span>
    `;
  }

  categories.forEach(cat => {
    const itemEl = document.createElement("div");
    itemEl.className = `custom-dropdown-item ${cat.id === currentCat.id ? "selected" : ""}`;
    itemEl.setAttribute("role", "option");
    itemEl.innerHTML = `
      <div class="custom-dropdown-item-left">
        <span class="cat-drop-icon">${cat.icon || "🍽️"}</span>
        <span>${cat.name}</span>
      </div>
      <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;

    itemEl.addEventListener("click", () => {
      selectCustomCategory(cat.id);
    });

    customCatMenu.appendChild(itemEl);
  });
}

function selectCustomCategory(catId) {
  const cat = (adminData.categories || []).find(c => c.id === catId);
  if (!cat) return;

  if (itemFormCategory) {
    itemFormCategory.value = cat.id;
  }

  if (customCatSelected) {
    customCatSelected.innerHTML = `
      <span class="cat-drop-icon">${cat.icon || "🍽️"}</span>
      <span class="cat-drop-text">${cat.name}</span>
    `;
  }

  if (customCatMenu) {
    customCatMenu.querySelectorAll(".custom-dropdown-item").forEach(item => {
      const isMatch = item.querySelector(".custom-dropdown-item-left span:last-child")?.textContent === cat.name;
      item.classList.toggle("selected", isMatch);
    });
  }

  if (customCatDropdown) {
    customCatDropdown.classList.remove("open");
  }
}

function setDietaryPreference(diet) {
  const finalDiet = diet === "nonveg" ? "nonveg" : "veg";
  if (itemFormDiet) {
    itemFormDiet.value = finalDiet;
  }
  if (dietSegmentedPicker) {
    dietSegmentedPicker.querySelectorAll(".diet-picker-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.diet === finalDiet);
    });
  }
}

// Setup Custom Category Dropdown toggle and outside-click close
if (customCatBtn && customCatDropdown) {
  customCatBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    customCatDropdown.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (customCatDropdown && !customCatDropdown.contains(e.target)) {
      customCatDropdown.classList.remove("open");
    }
  });
}

// Setup Dietary Segmented Picker clicks
if (dietSegmentedPicker) {
  dietSegmentedPicker.querySelectorAll(".diet-picker-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      setDietaryPreference(btn.dataset.diet);
    });
  });
}

// Eye toggle for PIN input fields in Security tab
document.addEventListener("click", (e) => {
  const eyeBtn = e.target.closest(".pin-eye-btn");
  if (!eyeBtn) return;
  const targetId = eyeBtn.dataset.target;
  const inputEl = document.getElementById(targetId);
  if (!inputEl) return;
  const isVisible = inputEl.type === "text";
  inputEl.type = isVisible ? "password" : "text";
  // Swap icon
  const eyeOpen = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
  const eyeClosed = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
  eyeBtn.innerHTML = isVisible ? eyeOpen : eyeClosed;
});

// Boot Admin App
document.addEventListener("DOMContentLoaded", checkAuth);



