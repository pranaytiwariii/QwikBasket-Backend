// controllers/product.controller.js
import Products from "../models/product.models.js";
import Category from "../models/category.models.js";
import SubCategory from "../models/subcategory.models.js";
import { imageUploadUtil } from "../config/cloudinary.js";

// @desc    Get all products with filtering, sorting, and pagination
// @route   GET /api/products
// @access  Public only for users
export const getProducts = async (req, res) => {
  try {
    const {
      category,
      subcategory,
      search,
      minPrice,
      maxPrice,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 10,
      customerType = "business", // default to business
    } = req.query;

    // Build query object
    const query = {};

    // Filter by customerType: if normal, only show products where showToCustomer is true
    if (customerType === "normal") {
      query.showToCustomer = true;
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by subcategory
    if (subcategory) {
      query.subcategory = subcategory;
    }

    // Search by product name
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    // Price range filter - use appropriate price field based on customerType
    const priceField = customerType === "normal" ? "priceForCustomer" : "price";
    if (minPrice || maxPrice) {
      query[priceField] = {};
      if (minPrice) query[priceField].$gte = Number(minPrice);
      if (maxPrice) query[priceField].$lte = Number(maxPrice);
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Execute query
    const products = await Products.find(query)
      .populate("category", "name image")
      .populate("subcategory", "name")
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Transform products to show appropriate price based on customerType
    let transformedProducts = products.map((product) => {
      const { price, priceForCustomer, ...rest } = product;
      return {
        ...rest,
        price:
          customerType === "normal" ? Number(priceForCustomer) : Number(price),
      };
    });

    // Additional filter: Remove products with showToCustomer: false when customerType is normal
    if (customerType === "normal") {
      transformedProducts = transformedProducts.filter(
        (product) => product.showToCustomer === true
      );
    }

    // Get total count for pagination
    const totalProducts = await Products.countDocuments(query);

    res.status(200).json({
      success: true,
      data: transformedProducts,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalProducts / Number(limit)),
        totalProducts,
        hasNextPage: skip + products.length < totalProducts,
        hasPrevPage: Number(page) > 1,
      },
    });
  } catch (error) {
    console.error("Error in getProducts:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching products",
      error: error.message,
    });
  }
};

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Public
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const { customerType = "business" } = req.query;

    // Build query
    const query = { _id: id };

    // If customerType is normal, check if product should be shown to customer
    if (customerType === "normal") {
      query.showToCustomer = true;
    }

    const product = await Products.findOne(query)
      .populate("category", "name image")
      .populate("subcategory", "name")
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Additional safety check: Remove product if showToCustomer is false when customerType is normal
    // Only show product if showToCustomer is explicitly true
    if (customerType === "normal" && product.showToCustomer !== true) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Transform product to show appropriate price based on customerType
    const { price, priceForCustomer, ...rest } = product;
    const transformedProduct = {
      ...rest,
      price:
        customerType === "normal" ? Number(priceForCustomer) : Number(price),
    };

    // Get similar products from the same subcategory (excluding current product)
    // Apply customerType filter for similar products too
    const similarProductsQuery = {
      subcategory: product.subcategory?._id,
      _id: { $ne: id },
    };

    if (customerType === "normal") {
      similarProductsQuery.showToCustomer = true;
    }

    const similarProducts = await Products.find(similarProductsQuery)
      .populate("category", "name image")
      .populate("subcategory", "name")
      .limit(6)
      .lean();

    // Transform similar products
    let transformedSimilarProducts = similarProducts.map((prod) => {
      const {
        price: spPrice,
        priceForCustomer: spCustomerPrice,
        ...spRest
      } = prod;
      return {
        ...spRest,
        price:
          customerType === "normal" ? Number(spCustomerPrice) : Number(spPrice),
      };
    });

    // Additional filter: Remove products with showToCustomer: false when customerType is normal
    // Only show products where showToCustomer is explicitly true
    if (customerType === "normal") {
      transformedSimilarProducts = transformedSimilarProducts.filter(
        (product) => product.showToCustomer === true
      );
    }

    res.status(200).json({
      success: true,
      data: {
        ...transformedProduct,
        similarProducts: transformedSimilarProducts,
      },
    });
  } catch (error) {
    console.error("Error in getProductById:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching product",
      error: error.message,
    });
  }
};

// @desc    Get products by category
// @route   GET /api/products/category/:categoryId
// @access  Public
export const getProductsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const {
      subcategory,
      search,
      minPrice,
      maxPrice,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 10,
      customerType = "business",
    } = req.query;

    // Check if category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Build query
    const query = { category: categoryId };

    // Filter by customerType: if normal, only show products where showToCustomer is true
    if (customerType === "normal") {
      query.showToCustomer = true;
    }

    if (subcategory) query.subcategory = subcategory;
    if (search) query.name = { $regex: search, $options: "i" };

    // Price range filter - use appropriate price field based on customerType
    const priceField = customerType === "normal" ? "priceForCustomer" : "price";
    if (minPrice || maxPrice) {
      query[priceField] = {};
      if (minPrice) query[priceField].$gte = Number(minPrice);
      if (maxPrice) query[priceField].$lte = Number(maxPrice);
    }

    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const skip = (Number(page) - 1) * Number(limit);

    const products = await Products.find(query)
      .populate("category", "name image")
      .populate("subcategory", "name")
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Transform products to show appropriate price based on customerType
    let transformedProducts = products.map((product) => {
      const { price, priceForCustomer, ...rest } = product;
      return {
        ...rest,
        price:
          customerType === "normal" ? Number(priceForCustomer) : Number(price),
      };
    });

    // Additional filter: Remove products with showToCustomer: false when customerType is normal
    // Only show products where showToCustomer is explicitly true
    if (customerType === "normal") {
      transformedProducts = transformedProducts.filter(
        (product) => product.showToCustomer === true
      );
    }

    const totalProducts = await Products.countDocuments(query);

    res.status(200).json({
      success: true,
      data: transformedProducts,
      category: category,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalProducts / Number(limit)),
        totalProducts,
        hasNextPage: skip + products.length < totalProducts,
        hasPrevPage: Number(page) > 1,
      },
    });
  } catch (error) {
    console.error("Error in getProductsByCategory:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching products by category",
      error: error.message,
    });
  }
};

// @desc    Get products by subcategory
// @route   GET /api/products/subcategory/:subcategoryId
// @access  Public
export const getProductsBySubCategory = async (req, res) => {
  try {
    const { subcategoryId } = req.params;
    const {
      search,
      minPrice,
      maxPrice,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 10,
      customerType = "business",
    } = req.query;

    // Check if subcategory exists
    const subcategory = await SubCategory.findById(subcategoryId).populate(
      "parentCategory"
    );
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found",
      });
    }

    // Build query
    const query = { subcategory: subcategoryId };

    // Filter by customerType: if normal, only show products where showToCustomer is true
    if (customerType === "normal") {
      query.showToCustomer = true;
    }

    if (search) query.name = { $regex: search, $options: "i" };

    // Price range filter - use appropriate price field based on customerType
    const priceField = customerType === "normal" ? "priceForCustomer" : "price";
    if (minPrice || maxPrice) {
      query[priceField] = {};
      if (minPrice) query[priceField].$gte = Number(minPrice);
      if (maxPrice) query[priceField].$lte = Number(maxPrice);
    }

    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const skip = (Number(page) - 1) * Number(limit);

    const products = await Products.find(query)
      .populate("category", "name image")
      .populate("subcategory", "name")
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Transform products to show appropriate price based on customerType
    let transformedProducts = products.map((product) => {
      const { price, priceForCustomer, ...rest } = product;
      return {
        ...rest,
        price:
          customerType === "normal" ? Number(priceForCustomer) : Number(price),
      };
    });

    // Additional filter: Remove products with showToCustomer: false when customerType is normal
    // Only show products where showToCustomer is explicitly true
    if (customerType === "normal") {
      transformedProducts = transformedProducts.filter(
        (product) => product.showToCustomer === true
      );
    }

    const totalProducts = await Products.countDocuments(query);

    res.status(200).json({
      success: true,
      data: transformedProducts,
      subcategory: subcategory,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalProducts / Number(limit)),
        totalProducts,
        hasNextPage: skip + products.length < totalProducts,
        hasPrevPage: Number(page) > 1,
      },
    });
  } catch (error) {
    console.error("Error in getProductsBySubCategory:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching products by subcategory",
      error: error.message,
    });
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      imageColour,
      category,
      subcategory,
      stockInPackets,
      packagingQuantity,
      unit,
      price,
      mrpPrice,
      showToCustomer,
      priceForCustomer,
      origin,
      hybrid,
      sellerFssai,
      description,
    } = req.body;

    // Check if category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check if subcategory exists and belongs to the category
    if (subcategory) {
      const subcategoryExists = await SubCategory.findById(subcategory);
      if (!subcategoryExists) {
        return res.status(404).json({
          success: false,
          message: "Subcategory not found",
        });
      }

      if (subcategoryExists.parentCategory.toString() !== category) {
        return res.status(400).json({
          success: false,
          message: "Subcategory does not belong to the specified category",
        });
      }
    }

    // Handle image uploads
    let images = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const b64 = Buffer.from(file.buffer).toString("base64");
        const url = "data:" + file.mimetype + ";base64," + b64;
        const uploadResult = await imageUploadUtil(url);
        images.push(uploadResult.secure_url);
      }
    } else {
      return res
        .status(400)
        .json({ message: "At least one product image is required" });
    }

    const productData = {
      name,
      images,
      imageColour,
      category,
      stockInPackets: Number(stockInPackets),
      packagingQuantity: Number(packagingQuantity),
      unit,
      price: Number(price),
      mrpPrice: Number(mrpPrice),
      showToCustomer: showToCustomer === "true" ? true : false,
      priceForCustomer: Number(priceForCustomer),
      origin,
      hybrid,
      sellerFssai,
      description,
    };

    // Only add subcategory if it's not empty
    if (subcategory && subcategory.trim() !== "") {
      productData.subcategory = subcategory;
    }

    const product = await Products.create(productData);
    await product.populate([
      { path: "category", select: "name image" },
      { path: "subcategory", select: "name" },
    ]);

    res.status(201).json({
      success: true,
      data: product,
      message: "Product created successfully",
    });
  } catch (error) {
    console.error("Error in createProduct:", error);
    res.status(500).json({
      success: false,
      message: "Error creating product",
      error: error.message,
    });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const product = await Products.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Validate category if provided
    if (updateData.category) {
      const categoryExists = await Category.findById(updateData.category);
      if (!categoryExists) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }
    }

    // Validate subcategory if provided
    if (updateData.subcategory && updateData.subcategory.trim() !== "") {
      const subcategoryExists = await SubCategory.findById(
        updateData.subcategory
      );
      if (!subcategoryExists) {
        return res.status(404).json({
          success: false,
          message: "Subcategory not found",
        });
      }
      const categoryId = updateData.category || product.category;
      if (
        subcategoryExists.parentCategory.toString() !== categoryId.toString()
      ) {
        return res.status(400).json({
          success: false,
          message: "Subcategory does not belong to the specified category",
        });
      }
    } else if (updateData.subcategory === "") {
      updateData.subcategory = null;
    }

    // Handle images: Merge existing URLs with newly uploaded files
    // Parse existingImages from request body (sent as JSON string in FormData)
    let existingImageUrls = [];
    const hasExistingImagesField =
      updateData.existingImages !== undefined &&
      updateData.existingImages !== null &&
      updateData.existingImages !== "";

    if (hasExistingImagesField) {
      try {
        // If it's already an array, use it directly; otherwise parse JSON string
        if (Array.isArray(updateData.existingImages)) {
          existingImageUrls = updateData.existingImages;
        } else if (typeof updateData.existingImages === "string") {
          // Handle empty string case
          if (updateData.existingImages.trim() === "") {
            existingImageUrls = [];
          } else {
            existingImageUrls = JSON.parse(updateData.existingImages);
          }
        }
      } catch (parseError) {
        console.error("Error parsing existingImages:", parseError);
        return res.status(400).json({
          success: false,
          message:
            "Invalid existingImages format. Expected JSON array or array of URLs.",
          error: parseError.message,
        });
      }
    } else {
      // If existingImages not provided and no new files, keep existing images
      if (!req.files || req.files.length === 0) {
        existingImageUrls = product.images || [];
      }
    }

    // Validate existing image URLs (should be valid HTTP/HTTPS URLs)
    existingImageUrls = existingImageUrls.filter((url) => {
      return (
        typeof url === "string" &&
        (url.startsWith("http://") || url.startsWith("https://"))
      );
    });

    // Handle image updates
    const hasNewFiles =
      req.files && Array.isArray(req.files) && req.files.length > 0;

    if (hasNewFiles) {
      // Validate file types (only allow images)
      const allowedMimeTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
      ];
      const invalidFiles = req.files.filter(
        (file) => !allowedMimeTypes.includes(file.mimetype)
      );

      if (invalidFiles.length > 0) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid file type. Only image files (JPEG, PNG, GIF, WebP) are allowed.",
          invalidFiles: invalidFiles.map((f) => ({
            name: f.originalname,
            type: f.mimetype,
          })),
        });
      }

      // Validate file count (existing + new should not exceed 10, as per route limit)
      const maxImages = 10;
      const totalImageCount = existingImageUrls.length + req.files.length;
      if (totalImageCount > maxImages) {
        return res.status(400).json({
          success: false,
          message: `Maximum ${maxImages} images allowed. You have ${existingImageUrls.length} existing and ${req.files.length} new images (total: ${totalImageCount})`,
        });
      }

      // Upload new images with error handling
      let newImageUrls = [];
      const uploadErrors = [];

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        try {
          // Validate file buffer exists
          if (!file.buffer) {
            throw new Error("File buffer is missing");
          }

          // Convert to base64 data URL
          const b64 = Buffer.from(file.buffer).toString("base64");
          const url = "data:" + file.mimetype + ";base64," + b64;

          // Upload to Cloudinary
          const uploadResult = await imageUploadUtil(url);

          if (!uploadResult || !uploadResult.secure_url) {
            throw new Error(
              "Upload failed: No secure URL returned from Cloudinary"
            );
          }

          newImageUrls.push(uploadResult.secure_url);
        } catch (uploadError) {
          console.error(
            `Error uploading file ${file.originalname}:`,
            uploadError
          );
          uploadErrors.push({
            filename: file.originalname,
            error: uploadError.message,
          });
        }
      }

      // If any uploads failed, return error (don't partially update)
      if (uploadErrors.length > 0) {
        return res.status(500).json({
          success: false,
          message: "Failed to upload some images",
          uploadErrors: uploadErrors,
          uploadedCount: newImageUrls.length,
          failedCount: uploadErrors.length,
        });
      }

      // Merge existing URLs with newly uploaded URLs
      updateData.images = [...existingImageUrls, ...newImageUrls];
    } else if (hasExistingImagesField) {
      // No new files, but existingImages field was provided
      // This means user wants to update which existing images to keep (remove some)
      const maxImages = 10;
      if (existingImageUrls.length > maxImages) {
        return res.status(400).json({
          success: false,
          message: `Maximum ${maxImages} images allowed`,
        });
      }
      updateData.images = existingImageUrls;
    }

    // Convert numeric fields
    if (updateData.stockInPackets !== undefined) {
      updateData.stockInPackets = Number(updateData.stockInPackets);
    }
    if (updateData.packagingQuantity !== undefined) {
      updateData.packagingQuantity = Number(updateData.packagingQuantity);
    }
    if (updateData.price !== undefined) {
      updateData.price = Number(updateData.price);
    }
    if (updateData.mrpPrice !== undefined) {
      updateData.mrpPrice = Number(updateData.mrpPrice);
    }
    if (updateData.showToCustomer !== undefined) {
      updateData.showToCustomer =
        updateData.showToCustomer === "true" ||
        updateData.showToCustomer === true;
    }
    if (updateData.priceForCustomer !== undefined) {
      updateData.priceForCustomer = Number(updateData.priceForCustomer);
    }

    // Remove existingImages from updateData before saving (it's not a product field)
    if (updateData.existingImages !== undefined) {
      delete updateData.existingImages;
    }

    // Ensure images array exists if being updated
    if (updateData.images !== undefined && !Array.isArray(updateData.images)) {
      return res.status(400).json({
        success: false,
        message: "Images must be an array",
      });
    }

    const updatedProduct = await Products.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate([
      { path: "category", select: "name image" },
      { path: "subcategory", select: "name" },
    ]);

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found after update",
      });
    }

    res.status(200).json({
      success: true,
      data: updatedProduct,
      message: "Product updated successfully",
    });
  } catch (error) {
    console.error("Error in updateProduct:", error);
    console.error("Error stack:", error.stack);

    // Provide more specific error messages
    let errorMessage = "Error updating product";
    let statusCode = 500;

    if (error.name === "ValidationError") {
      errorMessage =
        "Validation error: " +
        Object.values(error.errors)
          .map((e) => e.message)
          .join(", ");
      statusCode = 400;
    } else if (error.name === "CastError") {
      errorMessage = "Invalid data format: " + error.message;
      statusCode = 400;
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Products.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    await Products.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteProduct:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting product",
      error: error.message,
    });
  }
};

// @desc    Search products
// @route   GET /api/products/search
// @access  Public
export const searchProducts = async (req, res) => {
  try {
    const {
      q,
      category,
      subcategory,
      minPrice,
      maxPrice,
      page = 1,
      limit = 10,
      customerType = "business",
    } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    // Build search query
    const query = {
      $or: [
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ],
    };

    // Filter by customerType: if normal, only show products where showToCustomer is true
    if (customerType === "normal") {
      query.showToCustomer = true;
    }

    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;

    // Price range filter - use appropriate price field based on customerType
    const priceField = customerType === "normal" ? "priceForCustomer" : "price";
    if (minPrice || maxPrice) {
      query[priceField] = {};
      if (minPrice) query[priceField].$gte = Number(minPrice);
      if (maxPrice) query[priceField].$lte = Number(maxPrice);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const products = await Products.find(query)
      .populate("category", "name image")
      .populate("subcategory", "name")
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Transform products to show appropriate price based on customerType
    let transformedProducts = products.map((product) => {
      const { price, priceForCustomer, ...rest } = product;
      return {
        ...rest,
        price:
          customerType === "normal" ? Number(priceForCustomer) : Number(price),
      };
    });

    // Additional filter: Remove products with showToCustomer: false when customerType is normal
    // Only show products where showToCustomer is explicitly true
    if (customerType === "normal") {
      transformedProducts = transformedProducts.filter(
        (product) => product.showToCustomer === true
      );
    }

    const totalProducts = await Products.countDocuments(query);

    res.status(200).json({
      success: true,
      data: transformedProducts,
      searchQuery: q,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalProducts / Number(limit)),
        totalProducts,
        hasNextPage: skip + products.length < totalProducts,
        hasPrevPage: Number(page) > 1,
      },
    });
  } catch (error) {
    console.error("Error in searchProducts:", error);
    res.status(500).json({
      success: false,
      message: "Error searching products",
      error: error.message,
    });
  }
};

export const getProductsAdmin = async (req, res) => {
  try {
    const {
      category,
      subcategory,
      search,
      minPrice,
      maxPrice,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 10,
    } = req.query;

    // Build query object
    const query = {};

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by subcategory
    if (subcategory) {
      query.subcategory = subcategory;
    }

    // Search by product name
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Execute query - return all fields, no transformation
    let products = await Products.find(query)
      .populate("category", "name image")
      .populate("subcategory", "name")
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Apply price filter in memory if needed (check both price fields)
    if (minPrice || maxPrice) {
      products = products.filter((product) => {
        const price = Number(product.price);
        const priceForCustomer = Number(product.priceForCustomer);
        const matchesPrice =
          (!minPrice || price >= Number(minPrice)) &&
          (!maxPrice || price <= Number(maxPrice));
        const matchesPriceForCustomer =
          (!minPrice || priceForCustomer >= Number(minPrice)) &&
          (!maxPrice || priceForCustomer <= Number(maxPrice));
        return matchesPrice || matchesPriceForCustomer;
      });
    }

    // Ensure all numeric fields are numbers
    const productsWithNumbers = products.map((product) => ({
      ...product,
      price: Number(product.price),
      mrpPrice: Number(product.mrpPrice),
      priceForCustomer: Number(product.priceForCustomer),
      stockInPackets: Number(product.stockInPackets),
      packagingQuantity: Number(product.packagingQuantity),
    }));

    // Get total count for pagination (without price filter for accurate count)
    const totalProducts = await Products.countDocuments(query);

    res.status(200).json({
      success: true,
      data: productsWithNumbers,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalProducts / Number(limit)),
        totalProducts,
        hasNextPage: skip + products.length < totalProducts,
        hasPrevPage: Number(page) > 1,
      },
    });
  } catch (error) {
    console.error("Error in getProductsAdmin:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching products",
      error: error.message,
    });
  }
};

// @desc    Get single product by ID for admin (all fields)
// @route   GET /api/admin/products/:id
// @access  Private/Admin
export const getProductByIdAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Products.findById(id)
      .populate("category", "name image")
      .populate("subcategory", "name")
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Get similar products from the same subcategory (excluding current product)
    const similarProducts = await Products.find({
      subcategory: product.subcategory?._id,
      _id: { $ne: id },
    })
      .populate("category", "name image")
      .populate("subcategory", "name")
      .limit(6)
      .lean();

    // Ensure all numeric fields are numbers
    const productWithNumbers = {
      ...product,
      price: Number(product.price),
      mrpPrice: Number(product.mrpPrice),
      priceForCustomer: Number(product.priceForCustomer),
      stockInPackets: Number(product.stockInPackets),
      packagingQuantity: Number(product.packagingQuantity),
    };

    const similarProductsWithNumbers = similarProducts.map((prod) => ({
      ...prod,
      price: Number(prod.price),
      mrpPrice: Number(prod.mrpPrice),
      priceForCustomer: Number(prod.priceForCustomer),
      stockInPackets: Number(prod.stockInPackets),
      packagingQuantity: Number(prod.packagingQuantity),
    }));

    res.status(200).json({
      success: true,
      data: {
        ...productWithNumbers,
        similarProducts: similarProductsWithNumbers,
      },
    });
  } catch (error) {
    console.error("Error in getProductByIdAdmin:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching product",
      error: error.message,
    });
  }
};

// @desc    Get products by category for admin (all fields)
// @route   GET /api/admin/products/category/:categoryId
// @access  Private/Admin
export const getProductsByCategoryAdmin = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const {
      subcategory,
      search,
      minPrice,
      maxPrice,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 10,
    } = req.query;

    // Check if category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Build query
    const query = { category: categoryId };

    if (subcategory) query.subcategory = subcategory;
    if (search) query.name = { $regex: search, $options: "i" };

    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const skip = (Number(page) - 1) * Number(limit);

    let products = await Products.find(query)
      .populate("category", "name image")
      .populate("subcategory", "name")
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Apply price filter in memory if needed (check both price fields)
    if (minPrice || maxPrice) {
      products = products.filter((product) => {
        const price = Number(product.price);
        const priceForCustomer = Number(product.priceForCustomer);
        const matchesPrice =
          (!minPrice || price >= Number(minPrice)) &&
          (!maxPrice || price <= Number(maxPrice));
        const matchesPriceForCustomer =
          (!minPrice || priceForCustomer >= Number(minPrice)) &&
          (!maxPrice || priceForCustomer <= Number(maxPrice));
        return matchesPrice || matchesPriceForCustomer;
      });
    }

    // Ensure all numeric fields are numbers
    const productsWithNumbers = products.map((product) => ({
      ...product,
      price: Number(product.price),
      mrpPrice: Number(product.mrpPrice),
      priceForCustomer: Number(product.priceForCustomer),
      stockInPackets: Number(product.stockInPackets),
      packagingQuantity: Number(product.packagingQuantity),
    }));

    const totalProducts = await Products.countDocuments(query);

    res.status(200).json({
      success: true,
      data: productsWithNumbers,
      category: category,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalProducts / Number(limit)),
        totalProducts,
        hasNextPage: skip + products.length < totalProducts,
        hasPrevPage: Number(page) > 1,
      },
    });
  } catch (error) {
    console.error("Error in getProductsByCategoryAdmin:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching products by category",
      error: error.message,
    });
  }
};

// @desc    Get products by subcategory for admin (all fields)
// @route   GET /api/admin/products/subcategory/:subcategoryId
// @access  Private/Admin
export const getProductsBySubCategoryAdmin = async (req, res) => {
  try {
    const { subcategoryId } = req.params;
    const {
      search,
      minPrice,
      maxPrice,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 10,
    } = req.query;

    // Check if subcategory exists
    const subcategory = await SubCategory.findById(subcategoryId).populate(
      "parentCategory"
    );
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found",
      });
    }

    // Build query
    const query = { subcategory: subcategoryId };

    if (search) query.name = { $regex: search, $options: "i" };

    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const skip = (Number(page) - 1) * Number(limit);

    let products = await Products.find(query)
      .populate("category", "name image")
      .populate("subcategory", "name")
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Apply price filter in memory if needed (check both price fields)
    if (minPrice || maxPrice) {
      products = products.filter((product) => {
        const price = Number(product.price);
        const priceForCustomer = Number(product.priceForCustomer);
        const matchesPrice =
          (!minPrice || price >= Number(minPrice)) &&
          (!maxPrice || price <= Number(maxPrice));
        const matchesPriceForCustomer =
          (!minPrice || priceForCustomer >= Number(minPrice)) &&
          (!maxPrice || priceForCustomer <= Number(maxPrice));
        return matchesPrice || matchesPriceForCustomer;
      });
    }

    // Ensure all numeric fields are numbers
    const productsWithNumbers = products.map((product) => ({
      ...product,
      price: Number(product.price),
      mrpPrice: Number(product.mrpPrice),
      priceForCustomer: Number(product.priceForCustomer),
      stockInPackets: Number(product.stockInPackets),
      packagingQuantity: Number(product.packagingQuantity),
    }));

    const totalProducts = await Products.countDocuments(query);

    res.status(200).json({
      success: true,
      data: productsWithNumbers,
      subcategory: subcategory,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalProducts / Number(limit)),
        totalProducts,
        hasNextPage: skip + products.length < totalProducts,
        hasPrevPage: Number(page) > 1,
      },
    });
  } catch (error) {
    console.error("Error in getProductsBySubCategoryAdmin:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching products by subcategory",
      error: error.message,
    });
  }
};

// @desc    Search products for admin (all fields)
// @route   GET /api/admin/products/search
// @access  Private/Admin
export const searchProductsAdmin = async (req, res) => {
  try {
    const {
      q,
      category,
      subcategory,
      minPrice,
      maxPrice,
      page = 1,
      limit = 10,
    } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    // Build search query
    const query = {
      $or: [
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ],
    };

    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;

    const skip = (Number(page) - 1) * Number(limit);

    let products = await Products.find(query)
      .populate("category", "name image")
      .populate("subcategory", "name")
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Apply price filter in memory if needed (check both price fields)
    if (minPrice || maxPrice) {
      products = products.filter((product) => {
        const price = Number(product.price);
        const priceForCustomer = Number(product.priceForCustomer);
        const matchesPrice =
          (!minPrice || price >= Number(minPrice)) &&
          (!maxPrice || price <= Number(maxPrice));
        const matchesPriceForCustomer =
          (!minPrice || priceForCustomer >= Number(minPrice)) &&
          (!maxPrice || priceForCustomer <= Number(maxPrice));
        return matchesPrice || matchesPriceForCustomer;
      });
    }

    // Ensure all numeric fields are numbers
    const productsWithNumbers = products.map((product) => ({
      ...product,
      price: Number(product.price),
      mrpPrice: Number(product.mrpPrice),
      priceForCustomer: Number(product.priceForCustomer),
      stockInPackets: Number(product.stockInPackets),
      packagingQuantity: Number(product.packagingQuantity),
    }));

    const totalProducts = await Products.countDocuments(query);

    res.status(200).json({
      success: true,
      data: productsWithNumbers,
      searchQuery: q,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalProducts / Number(limit)),
        totalProducts,
        hasNextPage: skip + products.length < totalProducts,
        hasPrevPage: Number(page) > 1,
      },
    });
  } catch (error) {
    console.error("Error in searchProductsAdmin:", error);
    res.status(500).json({
      success: false,
      message: "Error searching products",
      error: error.message,
    });
  }
};
