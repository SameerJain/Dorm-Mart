import { useState, useRef, useEffect } from "react";
import { useParams, useMatch, useNavigate, useLocation } from "react-router-dom";
import { MEET_LOCATION_OPTIONS } from "../../constants/meetLocations";
import { decimalNumericKeyDownHandler } from "../../utils/numericInputKeyHandlers";
import { API_BASE, PUBLIC_BASE } from "../../utils/apiConfig";
import { resolveProductPhotoUrl } from "../../utils/imageFallback";
import { MAX_LISTING_PRICE, containsMemePrice } from "../../utils/priceValidation";
import { containsXssPattern } from "../../utils/inputValidation";

const CATEGORIES_MAX = 3;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const PRICE_INPUT_PATTERN = /^\d*\.?\d*$/;
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const LIMITS = {
  title: 50,
  description: 1000,
  price: MAX_LISTING_PRICE,
  priceMin: 0.01,
  images: 6,
  maxActiveListings: 25,
};

const DEFAULT_FORM = {
  title: "",
  categories: [],
  itemLocation: "",
  condition: "",
  description: "",
  price: "",
  acceptTrades: false,
  priceNegotiable: false,
  images: [],
};

function getPreviewBoxSize() {
  if (typeof window === "undefined") {
    return 480;
  }

  const isMobile = window.innerWidth < 768;
  return isMobile ? Math.min(480, window.innerWidth - 80) : 480;
}

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
  const [categories, setCategories] = useState(() => [...DEFAULT_FORM.categories]);
  const [itemLocation, setItemLocation] = useState(DEFAULT_FORM.itemLocation);
  const [condition, setCondition] = useState(DEFAULT_FORM.condition);
  const [description, setDescription] = useState(DEFAULT_FORM.description);
  const [price, setPrice] = useState(DEFAULT_FORM.price);
  const [acceptTrades, setAcceptTrades] = useState(DEFAULT_FORM.acceptTrades);
  const [priceNegotiable, setPriceNegotiable] = useState(
    DEFAULT_FORM.priceNegotiable
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

  const [availableCategories, setAvailableCategories] = useState([]);
  const [catFetchError, setCatFetchError] = useState(null);
  const [catLoading, setCatLoading] = useState(false);
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
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollPositionRef.current}px`;
      document.body.style.width = '100%';
    } else {
      const scrollY = scrollPositionRef.current;
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY);
      });
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
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
        const res = await fetch(`${API_BASE}/seller_dashboard/manage_seller_listings.php`, {
          method: "POST",
          credentials: "include",
        });
        const data = await res.json();
        if (ignore) return;
        if (data?.success && Array.isArray(data.data)) {
          const count = data.data.filter((item) => item.status === "Active").length;
          setActiveListingCount(count);
          setAtListingCap(count >= LIMITS.maxActiveListings);
        }
      } catch {
        // Non-critical; server-side check is authoritative
      }
    }
    checkActiveListingCap();
    return () => { ignore = true; };
  }, [isNew]);

  // Categories
  useEffect(() => {
    let ignore = false;
    async function loadCategories() {
      try {
        setCatLoading(true);
        setCatFetchError(null);
        const res = await fetch(`${API_BASE}/utility/get_categories.php`, {
          credentials: "include",
        });
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error("Non-JSON response from get_categories.php");
        }
        if (!Array.isArray(data)) throw new Error("Expected array");
        if (!ignore) {
          setAvailableCategories(data.map(String));
        }
      } catch (e) {
        if (!ignore) setCatFetchError(e?.message || "Failed to load categories.");
      } finally {
        if (!ignore) setCatLoading(false);
      }
    }
    loadCategories();
    return () => {
      ignore = true;
    };
  }, []);

  // Existing listing
  useEffect(() => {
    if (!isEdit || !id) return;

    let ignore = false;
    async function loadExistingListing() {
      try {
        setLoadingExisting(true);
        setLoadError(null);
        setServerMsg(null);

        const res = await fetch(`${API_BASE}/product/view_product.php?product_id=${encodeURIComponent(id)}`, {
          credentials: "include",
        });

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
          setServerMsg("Cannot edit sold items. Please return to the seller dashboard.");
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
            const parsed = typeof data.categories === 'string' 
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
        } else if (typeof data.photos === 'string' && data.photos) {
          try {
            const parsed = JSON.parse(data.photos);
            if (Array.isArray(parsed)) {
              existingPhotos = parsed;
            }
          } catch (e) {
            // If not JSON, treat as comma-separated
            existingPhotos = data.photos.split(',').map(s => s.trim()).filter(Boolean);
          }
        }

        // Convert existing photo URLs to image objects for display
        // Store original URLs separately so we can send them back
        const imageObjects = existingPhotos.map(url => {
          return {
            file: null, // No file object for existing images
            url: resolveProductPhotoUrl(url, { apiBase: API_BASE, publicBase: PUBLIC_BASE }),
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
      
      if (value !== "" && !isNaN(parseFloat(value)) && parseFloat(value) > LIMITS.price) return;
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
      newErrors.price = "The price has a meme input in it. Please try a different price.";
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
    if (errors.images && (errors.images.includes("Image is too large") || errors.images.includes("Only JPG/JPEG"))) {
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
    const clientX = e.clientX ?? (e.touches?.[0]?.clientX ?? 0);
    const clientY = e.clientY ?? (e.touches?.[0]?.clientY ?? 0);
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

    const clientX = e.clientX ?? (e.touches?.[0]?.clientX ?? 0);
    const clientY = e.clientY ?? (e.touches?.[0]?.clientY ?? 0);

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
      canvasSize
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
      1
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
      formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    
    if (!validateAll()) {
      formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
          img.file.name || `image_${Date.now()}.png`
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
      const res = await fetch(`${API_BASE}/seller_dashboard/product_listing.php`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
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
    (opt) => !categories.includes(opt)
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

        {serverMsg && (
          <div className={`mb-4 rounded-lg border p-3 text-sm ${
            loadError ? "bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300" 
            : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
          }`}>
            {serverMsg}
          </div>
        )}

        {isNew && atListingCap && (
          <div className="mb-4 rounded-lg border-2 border-amber-500 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/20 p-4">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-200">
                  Active listing limit reached
                </h3>
                <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                  You currently have {activeListingCount} of {LIMITS.maxActiveListings} active listings.
                  Please deactivate or remove an existing listing before creating a new one.
                </p>
              </div>
            </div>
          </div>
        )}

        {loadingExisting && (
          <div className="mb-4 rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20 p-4">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 dark:border-blue-400"></div>
              <p className="text-blue-700 dark:text-blue-300 font-medium">Loading existing listing data...</p>
            </div>
          </div>
        )}

        {loadingExisting ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400 text-lg">Loading listing data...</p>
          </div>
        ) : (
        <div ref={formTopRef}>
        {/* Top-of-Form Error Banner */}
        {showTopErrorBanner && Object.keys(errors).length > 0 && (() => {
          const errorCount = Object.keys(errors).length;
          const showSpecificErrors = errorCount <= 2;
          
          return (
            <div className="mb-6 rounded-lg border-2 border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-950/20 p-4">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  {showSpecificErrors ? (
                    <>
                      <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">
                        A few things need your attention:
                      </h3>
                      <ul className="list-disc list-inside space-y-1">
                        {Object.values(errors).map((error, index) => (
                          <li key={index} className="text-sm text-red-800 dark:text-red-300">
                            {error}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="text-lg font-semibold text-red-900 dark:text-red-200">
                      Please fill out the missing information.
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white dark:bg-gray-950/50 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-6">
              Basic Information
            </h2>

            <div className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Item Title <span className="text-red-500">*</span>
                </label>
                <input
                  value={title}
                  onChange={(e) =>
                    handleInputChange("title", e.target.value, setTitle)
                  }
                  className={`w-full p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    errors.title
                      ? "border-red-500 bg-red-50/70 dark:bg-red-950/20"
                      : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                  }`}
                  placeholder="Enter a descriptive title for your item"
                  maxLength={LIMITS.title}
                />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Be specific and descriptive to attract buyers.
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    {title.length}/{LIMITS.title}
                  </p>
                </div>
                {errors.title && (
                  <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                    {errors.title}
                  </p>
                )}
              </div>

              {/* Item Condition */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-lg font-semibold text-gray-900 mb-2 dark:text-gray-100">
                    Item Condition <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => {
                      setCondition(e.target.value);
                      if (errors.condition) {
                        setErrors((prev) => {
                          const ne = { ...prev };
                          delete ne.condition;
                          return ne;
                        });
                      }
                    }}
                    className={`w-full p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      errors.condition
                        ? "border-red-500 bg-red-50/70 dark:bg-red-950/20"
                        : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                    }`}
                  >
                    <option value="" disabled>Select An Option</option>
                    <option>Like New</option>
                    <option>Excellent</option>
                    <option>Good</option>
                    <option>Fair</option>
                    <option>For Parts</option>
                  </select>
                  {errors.condition && (
                    <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                      {errors.condition}
                    </p>
                  )}
                </div>
              </div>

              {/* Categories */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Categories <span className="text-red-500">*</span>
                  </label>

                  <div className="flex flex-col gap-2">
                  <select
                    value={selectedCategory}
                    disabled={categories.length >= CATEGORIES_MAX}
                    onChange={(e) => {
                      const selected = e.target.value;
                      if (selected) {
                        // Automatically add the selected category
                        setSelectedCategory(selected);
                        // Check if already added
                        if (categories.includes(selected)) {
                          setSelectedCategory("");
                          return;
                        }
                        // Check max limit
                        if (categories.length >= CATEGORIES_MAX) {
                          setErrors((p) => ({
                            ...p,
                            categories: `Select at most ${CATEGORIES_MAX} categories`,
                          }));
                          setSelectedCategory("");
                          return;
                        }
                        // Add the category
                        const next = [...categories, selected];
                        setCategories(next);
                        setSelectedCategory("");
                        setErrors((p) => {
                          const ne = { ...p };
                          if (next.length && next.length <= CATEGORIES_MAX) delete ne.categories;
                          return ne;
                        });
                      } else {
                        setSelectedCategory("");
                        if (errors.categories) {
                          setErrors((p) => {
                            const ne = { ...p };
                            delete ne.categories;
                            return ne;
                          });
                        }
                      }
                    }}
                    className={`w-full p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      categories.length >= CATEGORIES_MAX
                        ? "opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800"
                        : errors.categories
                        ? "border-red-500 bg-red-50/70 dark:bg-red-950/20"
                        : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                    }`}
                  >
                    <option value="" disabled>Select An Option</option>
                    {catLoading && <option disabled>Loading...</option>}
                    {!catLoading && selectableOptions.length === 0 && (
                      <option disabled>
                        {catFetchError || "No categories available"}
                      </option>
                    )}
                    {selectableOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>

                  {/* Selected chips */}
                  <div className="flex flex-wrap gap-2">
                    {categories.map((c) => (
                      <span
                        key={c}
                        className="flex items-center gap-2 bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-100 rounded-full px-3 py-1"
                      >
                        <span className="text-sm font-medium">{c}</span>
                        <button
                          type="button"
                          aria-label={`remove ${c}`}
                          onClick={() => removeCategory(c)}
                          className="text-blue-600 dark:text-blue-200 hover:text-blue-800 dark:hover:text-white"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Select up to {CATEGORIES_MAX}.
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      {categories.length}/{CATEGORIES_MAX}
                    </p>
                  </div>
                </div>

                  {errors.categories && (
                    <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                      {errors.categories}
                    </p>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) =>
                    handleInputChange(
                      "description",
                      e.target.value,
                      setDescription
                    )
                  }
                  rows={6}
                  className={`w-full p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none ${
                    errors.description
                      ? "border-red-500 bg-red-50/70 dark:bg-red-950/20"
                      : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                  }`}
                  placeholder="Describe the item — condition, usage, and history."
                  maxLength={LIMITS.description}
                />
                <div className="flex justify-end items-center mt-2">
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    {description.length}/{LIMITS.description}
                  </p>
                </div>
                {errors.description && (
                  <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                    {errors.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Location & Pricing */}
          <div className="bg-white dark:bg-gray-950/50 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-6">
              Location & Pricing
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Item Location */}
              <div>
                <label className="block text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Item Location <span className="text-red-500">*</span>
                </label>
                <select
                  value={itemLocation}
                  onChange={(e) => {
                    setItemLocation(e.target.value);
                    if (errors.itemLocation) {
                      setErrors((prev) => {
                        const ne = { ...prev };
                        delete ne.itemLocation;
                        return ne;
                      });
                    }
                  }}
                  className={`w-full p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    errors.itemLocation
                      ? "border-red-500 bg-red-50/70 dark:bg-red-950/20"
                      : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                  }`}
                >
                  <option value="" disabled>Select An Option</option>
                  {MEET_LOCATION_OPTIONS.filter((opt) => opt.value !== "").map((opt) => (
                    <option key={opt.value || "unselected"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {errors.itemLocation && (
                  <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                    {errors.itemLocation}
                  </p>
                )}
              </div>

              {/* Price */}
              <div>
                <label className="block text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Price <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={price}
                    onKeyDown={decimalNumericKeyDownHandler}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Store raw string value to preserve exact user input
                      // Only convert to number when needed (validation/submission)
                      handleInputChange("price", value, setPrice);
                    }}
                    className={`w-full pl-8 pr-4 py-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      errors.price
                        ? "border-red-500 bg-red-50/70 dark:bg-red-950/20"
                        : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                    }`}
                    placeholder="0.00"
                  />
                </div>
                {errors.price && (
                  <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                    {errors.price}
                  </p>
                )}
              </div>
            </div>

            {/* Pricing Options */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/30 rounded-lg">
                <div>
                  <label className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Accepting Trades
                  </label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Open to trade offers for your item
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={acceptTrades}
                  onChange={() => setAcceptTrades((s) => !s)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/30 rounded-lg">
                <div>
                  <label className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Price Negotiable
                  </label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Willing to negotiate on price
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={priceNegotiable}
                  onChange={() => setPriceNegotiable((s) => !s)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Photos */}
            <div className={`bg-white dark:bg-gray-950/30 rounded-2xl shadow-sm border p-6 mt-6 ${
              errors.images
                ? "border-red-500 dark:border-red-600"
                : "border-gray-200 dark:border-gray-800"
            }`}>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-6">
                Photos <span className="text-red-500">*</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                {images.length ? (
                  images.map((img, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={img.url}
                        alt={`preview-${i}`}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="remove image"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                ) : (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center text-gray-400 text-sm"
                    >
                      No photo
                    </div>
                  ))
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={onFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  // Store scroll position before opening file dialog
                  scrollPositionRef.current = window.scrollY || window.pageYOffset || 0;
                  fileInputRef.current.click();
                }}
                disabled={images.length >= LIMITS.images}
                className={`w-full py-4 px-6 border-2 border-dashed rounded-lg font-medium transition-colors ${
                  images.length >= LIMITS.images
                    ? "border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50"
                    : errors.images
                    ? "border-red-500 dark:border-red-600 text-red-600 dark:text-red-400 hover:border-red-600 dark:hover:border-red-500"
                    : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-200 hover:border-blue-500 hover:text-blue-600"
                }`}
              >
                + Add Photos
              </button>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 text-center">
                All photos are displayed as squares. You can adjust the crop area when uploading.
                {images.length >= LIMITS.images && (
                  <span className="block mt-1 text-gray-600 dark:text-gray-300 font-medium">
                    Maximum {LIMITS.images} images reached.
                  </span>
                )}
              </p>
              {errors.images && (
                <p className="text-red-600 dark:text-red-400 text-sm mt-2 text-center">
                  {errors.images}
                </p>
              )}
            </div>

            {/* Safety Tips */}
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-900/40 p-6 mt-6">
              <h3 className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-4">
                Safety Tips
              </h3>
              <ul className="text-sm text-blue-800 dark:text-blue-100 space-y-3">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-200 flex-shrink-0">•</span>
                  <span>Consider bringing a friend, especially for high value items.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-200 flex-shrink-0">•</span>
                  <span>Report suspicious messages or behavior.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-200 flex-shrink-0">•</span>
                  <span>Trust your gut. Don't proceed if something feels off.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-200 flex-shrink-0">•</span>
                  <span>Keep receipts or transaction records.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-200 flex-shrink-0">•</span>
                  <span>Use secure payment methods (cash, Venmo, Zelle).</span>
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="bg-white dark:bg-gray-950/30 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 mt-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-6">
                Publish Your Listing
              </h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={publishListing}
                  disabled={submitting || loadingExisting || (isNew && atListingCap)}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {isNew && atListingCap
                    ? "Listing Limit Reached"
                    : submitting
                    ? "Submitting..."
                    : loadingExisting
                    ? "Loading..."
                    : isEdit
                    ? "Update Listing"
                    : "Publish Listing"}
                </button>

                <button
                  onClick={() => {
                    const returnTo = location.state?.returnTo || "/app/seller-dashboard";
                    navigate(returnTo);
                  }}
                  className="flex-1 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                  type="button"
                >
                  {isNew ? "Cancel" : "Discard Changes"}
                </button>
              </div>
              {(catLoading || catFetchError) && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                  {catLoading
                    ? "Loading categories..."
                    : `Category load error: ${catFetchError}`}
                </p>
              )}
            </div>
          </div>
        </div>
        </div>
        )}
      </main>

      {/* Success Modal - Only show for new listings */}
      {showSuccess && !isEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="success-title"
        >
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
            <div className="px-6 pt-6">
              <h2
                id="success-title"
                className="text-2xl font-bold text-green-700 dark:text-green-400"
              >
                Success
              </h2>
              <p className="mt-2 text-gray-700 dark:text-gray-200">
                Your product posting is now visible to prospective buyers.
              </p>
              <p className="mt-1 text-gray-900 dark:text-gray-100 font-semibold">
                Congrats!
              </p>
            </div>
            <div className="px-6 py-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSuccess(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                Post another product
              </button>
              <button
                type="button"
                onClick={() => {
                  window.scrollTo(0, 0);
                  navigate("/app/seller-dashboard");
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
              >
                {location.state?.fromDashboard === true ? "Go back to Dashboard" : "View Dashboard"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cropper Modal */}
      {showCropper && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-950 rounded-2xl shadow-2xl max-w-3xl w-full p-3 md:p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-2">
              Crop Image
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Drag the square to choose the area you want. The square size is fixed.
            </p>

            <div className="flex justify-center">
              <div
                ref={cropContainerRef}
                onMouseMove={onCropMouseMove}
                onMouseUp={onCropMouseUp}
                onMouseLeave={onCropMouseUp}
                onTouchMove={onCropMouseMove}
                onTouchEnd={onCropMouseUp}
                className="relative bg-gray-100 dark:bg-gray-900 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 select-none"
                style={{
                  width: `${previewBoxSize}px`,
                  height: `${previewBoxSize}px`,
                  touchAction: 'none',
                }}
              >
              {cropImageSrc ? (
                <>
                  <img
                    src={cropImageSrc}
                    alt="to crop"
                    onLoad={handlePreviewImgLoaded}
                    draggable={false}
                    className="w-full h-full object-contain pointer-events-none"
                  />

                  {/* fixed-size draggable selection */}
                  <div
                    onMouseDown={startDrag}
                    onTouchStart={startDrag}
                    style={{
                      position: "absolute",
                      left: `${selection.x}px`,
                      top: `${selection.y}px`,
                      width: `${selection.size}px`,
                      height: `${selection.size}px`,
                      border: "2px dashed #3b82f6",
                      borderRadius: "8px",
                      boxShadow: "0 0 0 9999px rgba(0,0,0,0.25)",
                      cursor: "move",
                      pointerEvents: "auto",
                      touchAction: "none",
                    }}
                  />
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  Loading...
                </div>
              )}
              </div>
            </div>

            {/* hidden canvas */}
            <canvas
              ref={cropCanvasRef}
              width={360}
              height={360}
              className="hidden"
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCropCancel}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900/40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCropConfirm}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
              >
                Crop &amp; Use
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductListingPage;
