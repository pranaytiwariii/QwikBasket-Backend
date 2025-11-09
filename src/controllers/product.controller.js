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
      userType = "business", // default to business
    } = req.query;

    // Build query object
    const query = {};

    // Filter by userType: if normal, only show products where showToCustomer is true
    if (userType === "normal") {
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

    // Price range filter - use appropriate price field based on userType
    const priceField = userType === "normal" ? "priceForCustomer" : "price";
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

    // Transform products to show appropriate price based on userType
    let transformedProducts = products.map((product) => {
      const { price, priceForCustomer, ...rest } = product;
      return {
        ...rest,
        price: userType === "normal" ? Number(priceForCustomer) : Number(price),
      };
    });

    // Additional filter: Remove products with showToCustomer: false when userType is normal
    if (userType === "normal") {
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
    const { userType = "business" } = req.query;

    // Build query
    const query = { _id: id };

    // If userType is normal, check if product should be shown to customer
    if (userType === "normal") {
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

    // Transform product to show appropriate price based on userType
    const { price, priceForCustomer, ...rest } = product;
    const transformedProduct = {
      ...rest,
      price: userType === "normal" ? Number(priceForCustomer) : Number(price),
    };

    // Get similar products from the same subcategory (excluding current product)
    // Apply userType filter for similar products too
    const similarProductsQuery = {
      subcategory: product.subcategory?._id,
      _id: { $ne: id },
    };

    if (userType === "normal") {
      similarProductsQuery.showToCustomer = true;
    }

    const similarProducts = await Products.find(similarProductsQuery)
      .populate("category", "name image")
      .populate("subcategory", "name")
      .limit(6)
      .lean();

    // Transform similar products
    const transformedSimilarProducts = similarProducts.map((prod) => {
      const {
        price: spPrice,
        priceForCustomer: spCustomerPrice,
        ...spRest
      } = prod;
      return {
        ...spRest,
        price:
          userType === "normal" ? Number(spCustomerPrice) : Number(spPrice),
      };
    });

    res.status(200).json({
      success: true,
      data: {
        ...transformedProduct,
        similarProducts: transformedSimilarProducts,
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
      userType = "business",
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

    // Filter by userType: if normal, only show products where showToCustomer is true
    if (userType === "normal") {
      query.showToCustomer = true;
    }

    if (subcategory) query.subcategory = subcategory;
    if (search) query.name = { $regex: search, $options: "i" };

    // Price range filter - use appropriate price field based on userType
    const priceField = userType === "normal" ? "priceForCustomer" : "price";
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

    // Transform products to show appropriate price based on userType
    const transformedProducts = products.map((product) => {
      const { price, priceForCustomer, ...rest } = product;
      return {
        ...rest,
        price: userType === "normal" ? Number(priceForCustomer) : Number(price),
      };
    });

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
      userType = "business",
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

    // Filter by userType: if normal, only show products where showToCustomer is true
    if (userType === "normal") {
      query.showToCustomer = true;
    }

    if (search) query.name = { $regex: search, $options: "i" };

    // Price range filter - use appropriate price field based on userType
    const priceField = userType === "normal" ? "priceForCustomer" : "price";
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

    // Transform products to show appropriate price based on userType
    const transformedProducts = products.map((product) => {
      const { price, priceForCustomer, ...rest } = product;
      return {
        ...rest,
        price: userType === "normal" ? Number(priceForCustomer) : Number(price),
      };
    });

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

    if (updateData.category) {
      const categoryExists = await Category.findById(updateData.category);
      if (!categoryExists) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }
    }

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

    if (req.files && req.files.length > 5) {
      return res.status(400).json({
        success: false,
        message: "Maximum 5 images allowed",
      });
    }
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
      userType = "business",
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

    // Filter by userType: if normal, only show products where showToCustomer is true
    if (userType === "normal") {
      query.showToCustomer = true;
    }

    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;

    // Price range filter - use appropriate price field based on userType
    const priceField = userType === "normal" ? "priceForCustomer" : "price";
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

    // Transform products to show appropriate price based on userType
    const transformedProducts = products.map((product) => {
      const { price, priceForCustomer, ...rest } = product;
      return {
        ...rest,
        price: userType === "normal" ? Number(priceForCustomer) : Number(price),
      };
    });

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
    res.status(500).json({
      success: false,
      message: "Error searching products",
      error: error.message,
    });
  }
};
