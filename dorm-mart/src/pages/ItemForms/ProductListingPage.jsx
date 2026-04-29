import { useState, useRef, useEffect } from "react";
import {
  useParams,
  useMatch,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { API_BASE, PUBLIC_BASE } from "../../utils/apiConfig";
import { csrfFetch } from "../../utils/csrfFetch";
import { resolveProductPhotoUrl } from "../../utils/imageFallback";
import { containsMemePrice } from "../../utils/priceValidation";
import { containsXssPattern } from "../../utils/inputValidation";
import ListingForm from "./components/ListingForm";
import ImageCropperModal from "./components/ImageCropperModal";
import ListingStatusBanners from "./components/ListingStatusBanners";
import ListingSuccessModal from "./components/ListingSuccessModal";
import useListingCategories from "./hooks/useListingCategories";
import {
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_MIME_TYPES,
  CATEGORIES_MAX,
  DEFAULT_FORM,
  getPreviewBoxSize,
  LIMITS,
  MAX_IMAGE_BYTES,
  PRICE_INPUT_PATTERN,
} from "./utils/listingFormConfig";

function ProductListingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Supports both routed and nested /product-listing/new mounts.
  const matchNewAbs = useMatch({ path: "/product-listing/new", end: true });
  const matchNewApp = useMatch({ path: "/app/product-listing/new", end: true });
  const matchNewRel = useMatch({ path: "new", end: true });

  const isEdit = Boolean(id);
  const isNew = !isEdit && Boolean(matchNewAbs || matchNewApp || matchNewRel);

  const [title, setTitle] = useState(DEFAULT_FORM.title);
  const [categories, setCategories] = useState(() => [
    ...DEFAULT_FORM.categories,
  ]);
  const [itemLocation, setItemLocation] = useState(DEFAULT_FORM.itemLocation);
  const [condition, setCondition] = useState(DEFAULT_FORM.condition);
  const [description, setDescription] = useState(DEFAULT_FORM.description);
  const [price, setPrice] = useState(DEFAULT_FORM.price);
  const [acceptTrades, setAcceptTrades] = useState(DEFAULT_FORM.acceptTrades);
  const [priceNegotiable, setPriceNegotiable] = useState(
    DEFAULT_FORM.priceNegotiable,
  );
  const [images, setImages] = useState(() => [...DEFAULT_FORM.images]);
  const fileInputRef = useRef();
  const formTopRef = useRef(null);
  const scrollPositionRef = useRef(0);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverMsg, setServerMsg] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [showTopErrorBanner, setShowTopErrorBanner] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [isSold, setIsSold] = useState(false);

  const [atListingCap, setAtListingCap] = useState(false);
  const [activeListingCount, setActiveListingCount] = useState(0);

  const [showSuccess, setShowSuccess] = useState(false);

  const { availableCategories, catFetchError, catLoading } =
    useListingCategories();
  const [selectedCategory, setSelectedCategory] = useState("");

  const [showCropper, setShowCropper] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [cropImgEl, setCropImgEl] = useState(null);
  const [pendingFileName, setPendingFileName] = useState("");

  const [previewBoxSize, setPreviewBoxSize] = useState(getPreviewBoxSize);

  useEffect(() => {
    const updatePreviewSize = () => setPreviewBoxSize(getPreviewBoxSize());

    window.addEventListener("resize", updatePreviewSize);
    return () => window.removeEventListener("resize", updatePreviewSize);
  }, []);

  // Prevent body scroll when cropper modal is open
  useEffect(() => {
    if (showCropper) {
      scrollPositionRef.current = window.scrollY || window.pageYOffset || 0;
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollPositionRef.current}px`;
      document.body.style.width = "100%";
    } else {
      const scrollY = scrollPositionRef.current;
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY);
      });
    }
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
    };
  }, [showCropper]);

  // Mirror crop geometry in refs so dragging reads the latest values.
  const displayInfoRef = useRef({
    dx: 0,
    dy: 0,
    dw: 0,
    dh: 0,
    scale: 1,
  });

  const [selection, setSelection] = useState({
    x: 0,
    y: 0,
    size: 200,
  });
  const selectionRef = useRef({
    x: 0,
    y: 0,
    size: 200,
  });

  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const selectionStartRef = useRef({ x: 0, y: 0 });

  const cropCanvasRef = useRef(null);
  const cropContainerRef = useRef(null);

  function resetFormFields() {
    setTitle(DEFAULT_FORM.title);
    setCategories([...DEFAULT_FORM.categories]);
    setItemLocation(DEFAULT_FORM.itemLocation);
    setCondition(DEFAULT_FORM.condition);
    setDescription(DEFAULT_FORM.description);
    setPrice(DEFAULT_FORM.price);
    setAcceptTrades(DEFAULT_FORM.acceptTrades);
    setPriceNegotiable(DEFAULT_FORM.priceNegotiable);
    setImages([...DEFAULT_FORM.images]);
    setSelectedCategory("");
    setErrors({});
  }

  // New listing cap
  useEffect(() => {
    if (!isNew) return;
    let ignore = false;
    async function checkActiveListingCap() {
      try {
        const res = await fetch(
          `${API_BASE}/seller_dashboard/manage_seller_listings.php`,
          {
            method: "POST",
            credentials: "include",
          },
        );
        const data = await res.json();
        if (ignore) return;
        if (data?.success && Array.isArray(data.data)) {
          const count = data.data.filter(
            (item) => item.status === "Active",
          ).length;
          setActiveListingCount(count);
          setAtListingCap(count >= LIMITS.maxActiveListings);
        }
      } catch {
        // Non-critical; server-side check is authoritative
      }
    }
    checkActiveListingCap();
    return () => {
      ignore = true;
    };
  }, [isNew]);

  // Existing listing
  useEffect(() => {
    if (!isEdit || !id) return;

    let ignore = false;
    async function loadExistingListing() {
      try {
        setLoadingExisting(true);
        setLoadError(null);
        setServerMsg(null);

        const res = await fetch(
          `${API_BASE}/product/view_product.php?product_id=${encodeURIComponent(id)}`,
          {
            credentials: "include",
          },
        );

        if (!res.ok) {
          throw new Error(`Failed to load listing: HTTP ${res.status}`);
        }

        const data = await res.json();
        if (!data || !data.product_id) {
          throw new Error("Invalid listing data received");
        }

        if (ignore) return;

        // Prevent editing sold items
        if (data.sold === true) {
          setIsSold(true);
          setLoadError("Cannot edit sold items.");
          setServerMsg(
            "Cannot edit sold items. Please return to the seller dashboard.",
          );
          setLoadingExisting(false);
          // Redirect to seller dashboard after a short delay
          setTimeout(() => {
            navigate("/app/seller-dashboard", { replace: true });
          }, 2000);
          return;
        }

        setIsSold(false);

        // Populate form fields
        setTitle(data.title || "");

        // Handle categories (can be tags array or categories JSON)
        let cats = [];
        if (Array.isArray(data.tags)) {
          cats = data.tags;
        } else if (data.categories) {
          try {
            const parsed =
              typeof data.categories === "string"
                ? JSON.parse(data.categories)
                : data.categories;
            if (Array.isArray(parsed)) {
              cats = parsed;
            }
          } catch (e) {
            console.warn("Failed to parse categories:", e);
          }
        }
        setCategories(cats);

        setItemLocation(data.item_location || "");
        setCondition(data.item_condition || "");
        setDescription(data.description || "");
        setPrice(data.listing_price || "");
        setAcceptTrades(data.trades === true || data.trades === 1);
        setPriceNegotiable(data.price_nego === true || data.price_nego === 1);

        // Handle existing photos
        let existingPhotos = [];
        if (Array.isArray(data.photos)) {
          existingPhotos = data.photos;
        } else if (typeof data.photos === "string" && data.photos) {
          try {
            const parsed = JSON.parse(data.photos);
            if (Array.isArray(parsed)) {
              existingPhotos = parsed;
            }
          } catch (e) {
            // If not JSON, treat as comma-separated
            existingPhotos = data.photos
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          }
        }

        // Convert existing photo URLs to image objects for display
        // Store original URLs separately so we can send them back
        const imageObjects = existingPhotos.map((url) => {
          return {
            file: null, // No file object for existing images
            url: resolveProductPhotoUrl(url, {
              apiBase: API_BASE,
              publicBase: PUBLIC_BASE,
            }),
            originalUrl: url, // Store original URL for submission
          };
        });
        setImages(imageObjects);

        setSelectedCategory("");
        setErrors({}); // This already clears all errors including images
      } catch (e) {
        if (!ignore) {
          console.error("Error loading existing listing:", e);
          setLoadError(e?.message || "Failed to load listing data.");
          setServerMsg(e?.message || "Failed to load listing data.");
        }
      } finally {
        if (!ignore) {
          setLoadingExisting(false);
        }
      }
    }

    loadExistingListing();
    return () => {
      ignore = true;
    };
  }, [id, isEdit, navigate]);

  // Reset form when switching back to new-listing mode.
  useEffect(() => {
    if (isNew) {
      resetFormFields();
      setServerMsg(null);
      setLoadError(null);
      setIsSold(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew]);

  const handleInputChange = (field, value, setter) => {
    if (field === "title" && value.length > LIMITS.title) return;
    if (field === "description" && value.length > LIMITS.description) return;

    if (field === "price") {
      if (value === "") {
        setter(value);
        return;
      }

      const decimalCount = (value.match(/\./g) || []).length;
      if (decimalCount > 1) return;

      if (!PRICE_INPUT_PATTERN.test(value)) return;

      if (
        value !== "" &&
        !isNaN(parseFloat(value)) &&
        parseFloat(value) > LIMITS.price
      )
        return;
    }

    setter(value);
    if (errors[field]) {
      setErrors((prev) => {
        const ne = { ...prev };
        delete ne[field];
        return ne;
      });
    }
  };

  const removeCategory = (val) => {
    const next = categories.filter((c) => c !== val);
    setCategories(next);
    setErrors((p) => {
      const ne = { ...p };
      if (next.length && next.length <= CATEGORIES_MAX) delete ne.categories;
      return ne;
    });
  };

  const validateAll = () => {
    const newErrors = {};

    if (!title.trim()) {
      newErrors.title = "Title is required";
    } else if (containsXssPattern(title)) {
      newErrors.title = "Invalid characters in title";
    } else if (title.length > LIMITS.title) {
      newErrors.title = `Title must be ${LIMITS.title} characters or fewer`;
    }

    if (!description.trim()) {
      newErrors.description = "Description is required";
    } else if (containsXssPattern(description)) {
      newErrors.description = "Invalid characters in description";
    } else if (description.length > LIMITS.description) {
      newErrors.description = `Description must be ${LIMITS.description} characters or fewer`;
    }

    if (price === "") {
      newErrors.price = "Price is required";
    } else if (containsMemePrice(price)) {
      newErrors.price =
        "The price has a meme input in it. Please try a different price.";
    } else if (Number(price) < LIMITS.priceMin) {
      newErrors.price = `Minimum price is $${LIMITS.priceMin.toFixed(2)}`;
    } else if (Number(price) > LIMITS.price) {
      newErrors.price = `Price must be $${LIMITS.price} or less`;
    }

    if (!categories || categories.length === 0) {
      newErrors.categories = "Select at least one category";
    } else if (categories.length > CATEGORIES_MAX) {
      newErrors.categories = `Select at most ${CATEGORIES_MAX} categories`;
    }

    if (!itemLocation) {
      newErrors.itemLocation = "Select an item location";
    }
    if (!condition || condition === "") {
      newErrors.condition = "Select an item condition";
    }

    if (!images || images.length === 0) {
      newErrors.images = "At least one image is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    if (images.length > 0 && errors.images) {
      setErrors((prev) => {
        const ne = { ...prev };
        delete ne.images;
        return ne;
      });
    }
  }, [images.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function isAllowedType(f) {
    if (f.type && ALLOWED_IMAGE_MIME_TYPES.has(f.type)) return true;

    const name = (f.name || "").toLowerCase();
    return ALLOWED_IMAGE_EXTENSIONS.has(name.slice(name.lastIndexOf(".")));
  }

  function onFileChange(e) {
    const files = Array.from(e.target.files || []).slice(0, 1);
    if (!files.length) return;

    if (images.length >= LIMITS.images) {
      setErrors((prev) => ({
        ...prev,
        images: `Maximum ${LIMITS.images} images allowed.`,
      }));
      e.target.value = null;
      return;
    }

    const file = files[0];

    if (file.size > MAX_IMAGE_BYTES) {
      setErrors((prev) => ({
        ...prev,
        images: "Image is too large. Max size is 2 MB.",
      }));
      e.target.value = null;
      return;
    }

    if (!isAllowedType(file)) {
      setErrors((prev) => ({
        ...prev,
        images: "Only JPG/JPEG, PNG, and WEBP images are allowed.",
      }));
      e.target.value = null;
      return;
    }

    // Clear file size and type errors if validation passes
    if (
      errors.images &&
      (errors.images.includes("Image is too large") ||
        errors.images.includes("Only JPG/JPEG"))
    ) {
      setErrors((prev) => {
        const ne = { ...prev };
        delete ne.images;
        return ne;
      });
    }

    const reader = new FileReader();
    reader.onload = function (ev) {
      const img = new Image();
      img.onload = function () {
        // Check image limit again before adding (in case user added images while file was loading)
        if (images.length >= LIMITS.images) {
          setErrors((prev) => ({
            ...prev,
            images: `Maximum ${LIMITS.images} images allowed.`,
          }));
          e.target.value = null;
          return;
        }

        const w = img.width;
        const h = img.height;
        if (w === h) {
          // already square
          setImages((prev) => [
            ...prev,
            {
              file,
              url: ev.target.result,
            },
          ]);
          // Clear image error when image is added
          if (errors.images) {
            setErrors((prev) => {
              const ne = { ...prev };
              delete ne.images;
              return ne;
            });
          }
        } else {
          // Check image limit before opening cropper
          if (images.length >= LIMITS.images) {
            setErrors((prev) => ({
              ...prev,
              images: `Maximum ${LIMITS.images} images allowed.`,
            }));
            e.target.value = null;
            return;
          }
          // open cropper
          setCropImageSrc(ev.target.result);
          setCropImgEl(img);
          setPendingFileName(file.name || "image.png");
          setShowCropper(true);
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);

    e.target.value = null;
  }

  function removeImage(idx) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  function handlePreviewImgLoaded() {
    if (!cropImgEl) return;

    const naturalW = cropImgEl.width;
    const naturalH = cropImgEl.height;
    const box = previewBoxSize;

    const scale = Math.min(box / naturalW, box / naturalH);
    const dispW = naturalW * scale;
    const dispH = naturalH * scale;
    const offsetX = (box - dispW) / 2;
    const offsetY = (box - dispH) / 2;

    const di = {
      dx: offsetX,
      dy: offsetY,
      dw: dispW,
      dh: dispH,
      scale,
    };
    displayInfoRef.current = di;

    const fixedSize = Math.min(dispW, dispH);
    const sel = {
      x: offsetX + (dispW - fixedSize) / 2,
      y: offsetY + (dispH - fixedSize) / 2,
      size: fixedSize,
    };
    setSelection(sel);
    selectionRef.current = sel;
  }

  function startDrag(e) {
    e.preventDefault();
    draggingRef.current = true;
    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    dragStartRef.current = { x: clientX, y: clientY };
    selectionStartRef.current = {
      x: selectionRef.current.x,
      y: selectionRef.current.y,
    };
  }

  function onCropMouseMove(e) {
    if (!draggingRef.current) return;

    const di = displayInfoRef.current;
    const selStart = selectionStartRef.current;
    const dragStart = dragStartRef.current;
    const size = selectionRef.current.size;

    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;

    let newX = selStart.x + (clientX - dragStart.x);
    let newY = selStart.y + (clientY - dragStart.y);

    const minX = di.dx;
    const minY = di.dy;
    const maxX = di.dx + di.dw - size;
    const maxY = di.dy + di.dh - size;

    if (newX < minX) newX = minX;
    if (newY < minY) newY = minY;
    if (newX > maxX) newX = maxX;
    if (newY > maxY) newY = maxY;

    const newSel = { ...selectionRef.current, x: newX, y: newY };
    selectionRef.current = newSel;
    setSelection(newSel);
  }

  function onCropMouseUp(e) {
    if (e) {
      e.preventDefault();
    }
    draggingRef.current = false;
  }

  function handleCropConfirm() {
    if (!cropImgEl || !cropImageSrc) {
      setShowCropper(false);
      return;
    }

    if (images.length >= LIMITS.images) {
      setErrors((prev) => ({
        ...prev,
        images: `Maximum ${LIMITS.images} images allowed.`,
      }));
      setShowCropper(false);
      setCropImageSrc(null);
      setCropImgEl(null);
      setPendingFileName("");
      return;
    }

    const di = displayInfoRef.current;
    const sel = selectionRef.current;

    const selXInImg = (sel.x - di.dx) / di.scale;
    const selYInImg = (sel.y - di.dy) / di.scale;
    const selSizeInImg = sel.size / di.scale;

    const canvasSize = 360;
    const canvas = cropCanvasRef.current;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    ctx.drawImage(
      cropImgEl,
      selXInImg,
      selYInImg,
      selSizeInImg,
      selSizeInImg,
      0,
      0,
      canvasSize,
      canvasSize,
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setShowCropper(false);
          return;
        }

        if (images.length >= LIMITS.images) {
          setErrors((prev) => ({
            ...prev,
            images: `Maximum ${LIMITS.images} images allowed.`,
          }));
          setShowCropper(false);
          setCropImageSrc(null);
          setCropImgEl(null);
          setPendingFileName("");
          return;
        }

        const finalFile = new File([blob], pendingFileName, {
          type: "image/png",
        });
        const finalUrl = URL.createObjectURL(blob);

        setImages((prev) => [...prev, { file: finalFile, url: finalUrl }]);

        if (errors.images) {
          setErrors((prev) => {
            const ne = { ...prev };
            delete ne.images;
            return ne;
          });
        }

        setShowCropper(false);
        setCropImageSrc(null);
        setCropImgEl(null);
        setPendingFileName("");
      },
      "image/png",
      1,
    );
  }

  function handleCropCancel() {
    setShowCropper(false);
    setCropImageSrc(null);
    setCropImgEl(null);
    setPendingFileName("");
  }

  async function publishListing(e) {
    e.preventDefault();
    setServerMsg(null);

    if (isEdit && isSold) {
      setServerMsg("Cannot edit sold items.");
      formTopRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }

    if (!validateAll()) {
      formTopRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setShowTopErrorBanner(true);
      return;
    }
    setShowTopErrorBanner(false);

    const fd = new FormData();
    fd.append("mode", isEdit ? "update" : "create");
    if (isEdit) fd.append("id", String(id));
    fd.append("title", title.trim());
    categories.forEach((c) => fd.append("tags[]", c));
    fd.append("meetLocation", itemLocation);
    fd.append("condition", condition);
    fd.append("description", description);
    fd.append("price", String(Number(price)));
    fd.append("acceptTrades", acceptTrades ? "1" : "0");
    fd.append("priceNegotiable", priceNegotiable ? "1" : "0");

    // Separate existing photos (no file) from new uploads (has file)
    const existingPhotoUrls = [];
    images.forEach((img) => {
      if (img?.file) {
        // New upload - add as file
        fd.append(
          "images[]",
          img.file,
          img.file.name || `image_${Date.now()}.png`,
        );
      } else if (img?.originalUrl) {
        // Existing photo - store original URL to send back
        existingPhotoUrls.push(img.originalUrl);
      }
    });

    // In edit mode, send existing photos that should be kept
    if (isEdit && existingPhotoUrls.length > 0) {
      existingPhotoUrls.forEach((url) => {
        fd.append("existingPhotos[]", url);
      });
    }

    try {
      setSubmitting(true);
      const res = await csrfFetch(
        `${API_BASE}/seller_dashboard/product_listing.php`,
        {
          method: "POST",
          body: fd,
          credentials: "include",
        },
      );
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Server returned non-JSON response.");
      }

      if (!data?.ok) {
        setServerMsg(data?.message || data?.error || "Submission failed.");
        return;
      }

      if (isEdit) {
        const returnTo = location.state?.returnTo || "/app/seller-dashboard";
        navigate(returnTo);
      } else {
        setShowSuccess(true);
        resetFormFields();
      }
    } catch (err) {
      setServerMsg(err?.message || "Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  const headerText = isEdit ? "Edit Product Listing" : "New Product Listing";
  const selectableOptions = availableCategories.filter(
    (opt) => !categories.includes(opt),
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
            {headerText}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Fill out the form below to{" "}
            {isEdit ? "update your listing" : "create your listing"}
          </p>
        </div>

        <ListingStatusBanners
          activeListingCount={activeListingCount}
          atListingCap={atListingCap}
          isNew={isNew}
          loadError={loadError}
          loadingExisting={loadingExisting}
          serverMsg={serverMsg}
        />
        {loadingExisting ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              Loading listing data...
            </p>
          </div>
        ) : (
          <ListingForm
            acceptTrades={acceptTrades}
            atListingCap={atListingCap}
            catFetchError={catFetchError}
            catLoading={catLoading}
            categories={categories}
            condition={condition}
            description={description}
            errors={errors}
            fileInputRef={fileInputRef}
            formTopRef={formTopRef}
            handleInputChange={handleInputChange}
            images={images}
            isEdit={isEdit}
            isNew={isNew}
            itemLocation={itemLocation}
            loadingExisting={loadingExisting}
            location={location}
            navigate={navigate}
            onFileChange={onFileChange}
            price={price}
            priceNegotiable={priceNegotiable}
            publishListing={publishListing}
            removeCategory={removeCategory}
            removeImage={removeImage}
            scrollPositionRef={scrollPositionRef}
            selectableOptions={selectableOptions}
            selectedCategory={selectedCategory}
            setAcceptTrades={setAcceptTrades}
            setCategories={setCategories}
            setCondition={setCondition}
            setDescription={setDescription}
            setErrors={setErrors}
            setItemLocation={setItemLocation}
            setPrice={setPrice}
            setPriceNegotiable={setPriceNegotiable}
            setSelectedCategory={setSelectedCategory}
            setTitle={setTitle}
            showTopErrorBanner={showTopErrorBanner}
            submitting={submitting}
            title={title}
          />
        )}
      </main>

      <ListingSuccessModal
        isEdit={isEdit}
        location={location}
        navigate={navigate}
        setShowSuccess={setShowSuccess}
        showSuccess={showSuccess}
      />
      <ImageCropperModal
        cropCanvasRef={cropCanvasRef}
        cropContainerRef={cropContainerRef}
        cropImageSrc={cropImageSrc}
        handleCropCancel={handleCropCancel}
        handleCropConfirm={handleCropConfirm}
        handlePreviewImgLoaded={handlePreviewImgLoaded}
        onCropMouseMove={onCropMouseMove}
        onCropMouseUp={onCropMouseUp}
        previewBoxSize={previewBoxSize}
        selection={selection}
        showCropper={showCropper}
        startDrag={startDrag}
      />
    </div>
  );
}

export default ProductListingPage;
