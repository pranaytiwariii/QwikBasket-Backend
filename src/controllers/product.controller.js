// controllers/product.controller.js
import Products from "../models/product.models.js";
import Category from "../models/category.models.js";
import SubCategory from "../models/subcategory.models.js";
import { imageUploadUtil } from "../config/cloudinary.js";

// @desc    Get all products with filtering, sorting, and pagination
// @route   GET /api/products
// @access  Public
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

    // Price range filter
    if (minPrice || maxPrice) {
      query.pricePerKg = {};
      if (minPrice) query.pricePerKg.$gte = Number(minPrice);
      if (maxPrice) query.pricePerKg.$lte = Number(maxPrice);
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

    // Get total count for pagination
    const totalProducts = await Products.countDocuments(query);

    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalProducts / Number(limit)),
        totalProducts,
        hasNextPage: skip + products.length < totalProducts,
        hasPrevPage: Number(page) > 1,
      },
    });
  } catch (error) {
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

    res.status(200).json({
      success: true,
      data: {
        ...product,
        similarProducts,
      },
    });
  } catch (error) {
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
    if (minPrice || maxPrice) {
      query.pricePerKg = {};
      if (minPrice) query.pricePerKg.$gte = Number(minPrice);
      if (maxPrice) query.pricePerKg.$lte = Number(maxPrice);
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

    const totalProducts = await Products.countDocuments(query);

    res.status(200).json({
      success: true,
      data: products,
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
    if (minPrice || maxPrice) {
      query.pricePerKg = {};
      if (minPrice) query.pricePerKg.$gte = Number(minPrice);
      if (maxPrice) query.pricePerKg.$lte = Number(maxPrice);
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

    const totalProducts = await Products.countDocuments(query);

    res.status(200).json({
      success: true,
      data: products,
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
      stockQuantity,
      packagingQuantity,
      defaultUnit,
      pricePerKg,
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

    const product = await Products.create({
      name,
      images,
      imageColour,
      category,
      subcategory,
      stockQuantity: parseFloat(stockQuantity.toFixed(2)),
      packagingQuantity: parseFloat(packagingQuantity.toFixed(2)),
      defaultUnit,
      pricePerKg,
      origin,
      hybrid,
      sellerFssai,
      description,
    });

    // Populate the created product
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

    // If category is being updated, check if it exists
    if (updateData.category) {
      const categoryExists = await Category.findById(updateData.category);
      if (!categoryExists) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }
    }

    // If subcategory is being updated, check if it exists and belongs to category
    if (updateData.subcategory) {
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
    }

    // Handle image uploads if files are provided
    if (req.files && req.files.length > 0) {
      let newImages = [];
      for (const file of req.files) {
        const b64 = Buffer.from(file.buffer).toString("base64");
        const url = "data:" + file.mimetype + ";base64," + b64;
        const uploadResult = await imageUploadUtil(url);
        newImages.push(uploadResult.secure_url);
      }
      updateData.images = newImages;
    }

    // Format quantities to 2 decimal places
    if (updateData.stockQuantity !== undefined) {
      updateData.stockQuantity = parseFloat(
        updateData.stockQuantity.toFixed(2)
      );
    }
    if (updateData.packagingQuantity !== undefined) {
      updateData.packagingQuantity = parseFloat(
        updateData.packagingQuantity.toFixed(2)
      );
    }

    const updatedProduct = await Products.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate([
      { path: "category", select: "name image" },
      { path: "subcategory", select: "name" },
    ]);

    res.status(200).json({
      success: true,
      data: updatedProduct,
      message: "Product updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating product",
      error: error.message,
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
        { "info.description": { $regex: q, $options: "i" } },
      ],
    };

    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;
    if (minPrice || maxPrice) {
      query.pricePerKg = {};
      if (minPrice) query.pricePerKg.$gte = Number(minPrice);
      if (maxPrice) query.pricePerKg.$lte = Number(maxPrice);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const products = await Products.find(query)
      .populate("category", "name image")
      .populate("subcategory", "name")
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const totalProducts = await Products.countDocuments(query);

    res.status(200).json({
      success: true,
      data: products,
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
    res.status(500).json({
      success: false,
      message: "Error searching products",
      error: error.message,
    });
  }
};
