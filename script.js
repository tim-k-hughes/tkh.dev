const setCurrentYear = () => {
  document.querySelectorAll("[data-year]").forEach((node) => {
    node.textContent = new Date().getFullYear();
  });
};

const setActiveNav = () => {
  const currentPath = window.location.pathname.replace(/index\.html$/, "");

  document.querySelectorAll("[data-nav]").forEach((link) => {
    const href = new URL(link.href).pathname.replace(/index\.html$/, "");
    const isHome = href === "/";
    const isActive = isHome ? currentPath === "/" : currentPath.startsWith(href);
    link.classList.toggle("is-active", isActive);
  });
};

const revealSections = () => {
  const elements = document.querySelectorAll("[data-reveal]");

  if (!("IntersectionObserver" in window)) {
    elements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.15,
      rootMargin: "0px 0px -30px 0px",
    }
  );

  elements.forEach((element) => observer.observe(element));
};

const initWritingFilters = () => {
  const buttons = Array.from(document.querySelectorAll("[data-note-filter]"));
  const notes = Array.from(document.querySelectorAll("[data-note-kind]"));

  if (!buttons.length || !notes.length) {
    return;
  }

  const applyFilter = (filter, revealMatches = true) => {
    buttons.forEach((button) => {
      const isSelected = button.dataset.noteFilter === filter;

      button.dataset.selected = String(isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
    });

    notes.forEach((note) => {
      const matches = filter === "all" || note.dataset.noteKind === filter;

      note.hidden = !matches;

      if (matches && revealMatches) {
        note.classList.add("is-visible");
      }
    });
  };

  const initialFilter =
    buttons.find((button) => button.dataset.selected === "true")?.dataset.noteFilter ?? "all";

  applyFilter(initialFilter, false);

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      applyFilter(button.dataset.noteFilter ?? "all");
    });
  });
};

const photographStorageKey = "tkh.photograph.album.v1";

const createTodayValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatPhotoDate = (value) => {
  if (!value) {
    return "Date not set";
  }

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.valueOf())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const createPhotoId = () =>
  window.crypto?.randomUUID?.() ?? `photo-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const buildDefaultCaption = (filename) => {
  const cleaned = filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();

  if (!cleaned) {
    return "Untitled photograph";
  }

  return `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}`.slice(0, 180);
};

const normalizePhotoAlbum = (album) => {
  if (!Array.isArray(album)) {
    return [];
  }

  return album
    .filter((item) => item && typeof item.id === "string" && typeof item.src === "string")
    .map((item) => ({
      id: item.id,
      src: item.src,
      caption: typeof item.caption === "string" ? item.caption : "Untitled photograph",
      date: typeof item.date === "string" ? item.date : "",
      filename: typeof item.filename === "string" ? item.filename : "",
      createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
      width: Number.isFinite(item.width) ? item.width : 4,
      height: Number.isFinite(item.height) ? item.height : 3,
    }))
    .sort((first, second) => {
      const dateDifference = second.date.localeCompare(first.date);

      if (dateDifference !== 0) {
        return dateDifference;
      }

      return second.createdAt.localeCompare(first.createdAt);
    });
};

const loadPhotoAlbum = () => {
  try {
    const stored = window.localStorage.getItem(photographStorageKey);
    return stored ? normalizePhotoAlbum(JSON.parse(stored)) : [];
  } catch {
    return [];
  }
};

const savePhotoAlbum = (album) => {
  try {
    window.localStorage.setItem(photographStorageKey, JSON.stringify(album));
    return true;
  } catch {
    return false;
  }
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image."));
    image.src = src;
  });

const preparePhotoAsset = async (file) => {
  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const maxDimension = 1800;
  const longestSide = Math.max(image.width, image.height);
  const scale = longestSide > maxDimension ? maxDimension / longestSide : 1;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not prepare canvas.");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  const outputType = file.type === "image/png" ? "image/png" : "image/webp";
  const quality = outputType === "image/png" ? undefined : 0.86;

  return {
    src: canvas.toDataURL(outputType, quality),
    width,
    height,
    filename: file.name,
  };
};

const initPhotographExperience = () => {
  const app = document.querySelector("[data-photo-app]");

  if (!app) {
    return;
  }

  const form = app.querySelector("[data-photo-form]");
  const fileInput = app.querySelector("[data-photo-input]");
  const dropzone = app.querySelector("[data-photo-dropzone]");
  const previewImage = app.querySelector("[data-photo-preview-image]");
  const previewPlaceholder = app.querySelector("[data-photo-preview-placeholder]");
  const captionInput = app.querySelector("[data-photo-caption]");
  const dateInput = app.querySelector("[data-photo-date]");
  const resetButton = app.querySelector("[data-photo-reset]");
  const statusNode = app.querySelector("[data-photo-status]");
  const photoCount = app.querySelector("[data-photo-count]");
  const feature = app.querySelector("[data-photo-feature]");
  const featureImage = app.querySelector("[data-feature-image]");
  const featurePlaceholder = app.querySelector("[data-feature-placeholder]");
  const featureDate = app.querySelector("[data-feature-date]");
  const featureCaption = app.querySelector("[data-feature-caption]");
  const featureDescription = app.querySelector("[data-feature-description]");
  const gallery = app.querySelector("[data-photo-gallery]");

  if (
    !form ||
    !fileInput ||
    !dropzone ||
    !previewImage ||
    !previewPlaceholder ||
    !captionInput ||
    !dateInput ||
    !resetButton ||
    !statusNode ||
    !photoCount ||
    !feature ||
    !featureImage ||
    !featurePlaceholder ||
    !featureDate ||
    !featureCaption ||
    !featureDescription ||
    !gallery
  ) {
    return;
  }

  let photoAlbum = loadPhotoAlbum();
  let featuredPhotoId = photoAlbum[0]?.id ?? null;
  let pendingPhoto = null;

  const setStatus = (message, tone = "neutral") => {
    statusNode.textContent = message;
    statusNode.dataset.tone = tone;
  };

  const renderPendingPreview = () => {
    const hasPendingPhoto = Boolean(pendingPhoto);

    dropzone.classList.toggle("has-file", hasPendingPhoto);

    if (!hasPendingPhoto) {
      previewImage.hidden = true;
      previewImage.removeAttribute("src");
      previewImage.alt = "";
      previewPlaceholder.hidden = false;
      return;
    }

    previewImage.hidden = false;
    previewImage.src = pendingPhoto.src;
    previewImage.alt = pendingPhoto.filename
      ? `Preview of ${pendingPhoto.filename}`
      : "Preview of selected photograph";
    previewPlaceholder.hidden = true;
  };

  const renderFeaturedPhoto = () => {
    photoCount.textContent = String(photoAlbum.length);

    const activePhoto = photoAlbum.find((item) => item.id === featuredPhotoId) ?? photoAlbum[0];

    if (!activePhoto) {
      featuredPhotoId = null;
      feature.classList.add("is-empty");
      featureImage.hidden = true;
      featureImage.removeAttribute("src");
      featureImage.alt = "";
      featurePlaceholder.hidden = false;
      featureDate.textContent = "Album ready";
      featureCaption.textContent = "Choose a photo, add a caption, and save it.";
      featureDescription.textContent =
        "The newest photo becomes the featured view, and you can switch focus from the wall below at any time.";
      return;
    }

    featuredPhotoId = activePhoto.id;
    feature.classList.remove("is-empty");
    featureImage.hidden = false;
    featureImage.src = activePhoto.src;
    featureImage.alt = activePhoto.caption || `Photograph from ${formatPhotoDate(activePhoto.date)}`;
    featurePlaceholder.hidden = true;
    featureDate.textContent = formatPhotoDate(activePhoto.date);
    featureCaption.textContent = activePhoto.caption || "Untitled photograph";
    featureDescription.textContent =
      "Saved locally in this browser. Use the wall below to change the featured photograph whenever you want.";
  };

  const createGalleryEmptyState = () => {
    const emptyCard = document.createElement("div");
    const title = document.createElement("h3");
    const copy = document.createElement("p");

    emptyCard.className = "album-empty";
    title.textContent = "Your photo wall is empty.";
    copy.textContent =
      "Upload a photo from the uploader, then add a caption and date to start the album.";

    emptyCard.append(title, copy);

    return emptyCard;
  };

  const removePhoto = (photo) => {
    const label = photo.caption || "Untitled photograph";

    if (!window.confirm(`Remove "${label}" from this album?`)) {
      return;
    }

    const nextAlbum = photoAlbum.filter((item) => item.id !== photo.id);

    if (!savePhotoAlbum(nextAlbum)) {
      setStatus(
        "That photo could not be removed right now. Refresh and try again if the problem persists.",
        "error"
      );
      return;
    }

    photoAlbum = nextAlbum;

    if (featuredPhotoId === photo.id) {
      featuredPhotoId = nextAlbum[0]?.id ?? null;
    }

    renderAlbum();
    setStatus(`Removed "${label}" from the album.`, "success");
  };

  const createPhotoCard = (photo) => {
    const card = document.createElement("article");
    const selectButton = document.createElement("button");
    const media = document.createElement("div");
    const image = document.createElement("img");
    const body = document.createElement("div");
    const title = document.createElement("h3");
    const meta = document.createElement("p");
    const hint = document.createElement("span");
    const actions = document.createElement("div");
    const removeButton = document.createElement("button");
    const isSelected = photo.id === featuredPhotoId;

    card.className = "photo-card";
    selectButton.className = "photo-card-button";
    selectButton.type = "button";
    selectButton.setAttribute("aria-pressed", String(isSelected));
    media.className = "photo-card-media";
    image.className = "photo-card-image";
    body.className = "photo-card-body";
    title.className = "photo-card-caption";
    meta.className = "photo-card-meta";
    hint.className = "photo-card-hint";
    actions.className = "photo-card-actions";
    removeButton.className = "photo-card-action photo-card-action-delete";
    removeButton.type = "button";

    if (isSelected) {
      card.classList.add("is-selected");
    }

    media.style.aspectRatio = `${photo.width} / ${photo.height}`;
    image.src = photo.src;
    image.alt = photo.caption || `Photograph from ${formatPhotoDate(photo.date)}`;
    title.textContent = photo.caption || "Untitled photograph";
    meta.textContent = formatPhotoDate(photo.date);
    hint.textContent = isSelected ? "Featured above" : "Click to feature";
    removeButton.textContent = "Remove";

    selectButton.addEventListener("click", () => {
      featuredPhotoId = photo.id;
      renderAlbum();
    });

    removeButton.addEventListener("click", () => {
      removePhoto(photo);
    });

    media.append(image);
    body.append(title, meta, hint);
    selectButton.append(media, body);
    actions.append(removeButton);
    card.append(selectButton, actions);

    return card;
  };

  const renderAlbum = () => {
    renderFeaturedPhoto();
    gallery.replaceChildren();

    if (!photoAlbum.length) {
      gallery.append(createGalleryEmptyState());
      return;
    }

    photoAlbum.forEach((photo) => {
      gallery.append(createPhotoCard(photo));
    });
  };

  const resetFormState = (keepStatus = false) => {
    form.reset();
    fileInput.value = "";
    captionInput.value = "";
    dateInput.value = createTodayValue();
    pendingPhoto = null;
    renderPendingPreview();

    if (!keepStatus) {
      setStatus("Photos stay on this device and in this browser.", "neutral");
    }
  };

  const handlePhotoSelection = async (file) => {
    if (!file) {
      pendingPhoto = null;
      renderPendingPreview();
      return;
    }

    if (!file.type.startsWith("image/")) {
      fileInput.value = "";
      pendingPhoto = null;
      renderPendingPreview();
      setStatus("Please choose an image file for the album.", "error");
      return;
    }

    setStatus("Preparing your photo...", "info");

    try {
      pendingPhoto = await preparePhotoAsset(file);
      renderPendingPreview();

      if (!captionInput.value.trim()) {
        captionInput.value = buildDefaultCaption(file.name);
      }

      if (!dateInput.value) {
        dateInput.value = createTodayValue();
      }

      setStatus("Photo ready. Add a caption and date, then save it to the album.", "info");
    } catch {
      fileInput.value = "";
      pendingPhoto = null;
      renderPendingPreview();
      setStatus("That image could not be prepared. Try a different file.", "error");
    }
  };

  fileInput.addEventListener("change", async () => {
    await handlePhotoSelection(fileInput.files?.[0]);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragging");
    });
  });

  ["dragleave", "dragend", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, () => {
      dropzone.classList.remove("is-dragging");
    });
  });

  dropzone.addEventListener("drop", async (event) => {
    event.preventDefault();

    const file = event.dataTransfer?.files?.[0];

    if (!file) {
      return;
    }

    if (window.DataTransfer) {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      fileInput.files = transfer.files;
    }

    await handlePhotoSelection(file);
  });

  resetButton.addEventListener("click", () => {
    resetFormState();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const caption = captionInput.value.trim();
    const date = dateInput.value;

    if (!pendingPhoto) {
      setStatus("Choose a photo first so there is something to add to the album.", "error");
      return;
    }

    if (!caption) {
      setStatus("Add a caption before saving so the album stays easy to browse.", "error");
      captionInput.focus();
      return;
    }

    if (!date) {
      setStatus("Set a date for the photo before saving it.", "error");
      dateInput.focus();
      return;
    }

    const entry = {
      id: createPhotoId(),
      src: pendingPhoto.src,
      caption,
      date,
      filename: pendingPhoto.filename,
      createdAt: new Date().toISOString(),
      width: pendingPhoto.width,
      height: pendingPhoto.height,
    };
    const nextAlbum = normalizePhotoAlbum([entry, ...photoAlbum]);

    if (!savePhotoAlbum(nextAlbum)) {
      setStatus(
        "That photo could not be saved. The album may be full, so try a smaller image or remove one first.",
        "error"
      );
      return;
    }

    photoAlbum = nextAlbum;
    featuredPhotoId = entry.id;
    renderAlbum();
    resetFormState(true);
    setStatus(`Added "${entry.caption}" to the album.`, "success");
  });

  dateInput.value = createTodayValue();
  renderPendingPreview();
  renderAlbum();
  setStatus("Photos stay on this device and in this browser.", "neutral");
};

setCurrentYear();
setActiveNav();
revealSections();
initWritingFilters();
initPhotographExperience();
