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

    console.log("=== getProducts ===");
    console.log("Query params:", {
      category,
      subcategory,
      search,
      minPrice,
      maxPrice,
      sortBy,
      sortOrder,
      page,
      limit,
      customerType,
    });

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
    console.log("Price field used:", priceField, "customerType:", customerType);
    if (minPrice || maxPrice) {
      query[priceField] = {};
      if (minPrice) query[priceField].$gte = Number(minPrice);
      if (maxPrice) query[priceField].$lte = Number(maxPrice);
    }

    console.log("Built query:", JSON.stringify(query, null, 2));

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

    console.log("Products fetched from DB:", products.length);
    if (products.length > 0) {
      console.log("Sample product (before transformation):", {
        id: products[0]._id,
        name: products[0].name,
        price: products[0].price,
        priceForCustomer: products[0].priceForCustomer,
        showToCustomer: products[0].showToCustomer,
      });
    }

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
      const beforeFilter = transformedProducts.length;
      transformedProducts = transformedProducts.filter(
        (product) => product.showToCustomer === true
      );
      console.log(
        `Filtered ${
          beforeFilter - transformedProducts.length
        } products with showToCustomer=false`
      );
    }

    // Get total count for pagination
    const totalProducts = await Products.countDocuments(query);

    console.log("Query result:", {
      productsFound: products.length,
      totalProducts,
      transformedCount: transformedProducts.length,
    });
    console.log(
      "Sample product:",
      transformedProducts[0] || "No products found"
    );

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

    console.log("=== getProductById ===");
    console.log("Product ID:", id, "UserType:", customerType);

    // Build query
    const query = { _id: id };

    // If customerType is normal, check if product should be shown to customer
    if (customerType === "normal") {
      query.showToCustomer = true;
    }

    console.log("Query for product:", JSON.stringify(query, null, 2));

    const product = await Products.findOne(query)
      .populate("category", "name image")
      .populate("subcategory", "name")
      .lean();

    if (!product) {
      console.log("Product not found with query:", query);
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    console.log("Product found (before transformation):", {
      id: product._id,
      name: product.name,
      price: product.price,
      priceForCustomer: product.priceForCustomer,
      showToCustomer: product.showToCustomer,
      stockInPackets: product.stockInPackets,
    });

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
    const transformedSimilarProducts = similarProducts.map((prod) => {
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

    console.log("Product found:", {
      id: transformedProduct._id,
      name: transformedProduct.name,
      price: transformedProduct.price,
      showToCustomer: transformedProduct.showToCustomer,
      similarProductsCount: transformedSimilarProducts.length,
    });

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

    console.log("=== getProductsByCategory ===");
    console.log("Category ID:", categoryId, "UserType:", customerType);

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
    const transformedProducts = products.map((product) => {
      const { price, priceForCustomer, ...rest } = product;
      return {
        ...rest,
        price:
          customerType === "normal" ? Number(priceForCustomer) : Number(price),
      };
    });

    const totalProducts = await Products.countDocuments(query);

    console.log("Products by category result:", {
      categoryId,
      productsFound: products.length,
      totalProducts,
      transformedCount: transformedProducts.length,
    });

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

    console.log("=== getProductsBySubCategory ===");
    console.log("Subcategory ID:", subcategoryId, "UserType:", customerType);

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
    const transformedProducts = products.map((product) => {
      const { price, priceForCustomer, ...rest } = product;
      return {
        ...rest,
        price:
          customerType === "normal" ? Number(priceForCustomer) : Number(price),
      };
    });

    const totalProducts = await Products.countDocuments(query);

    console.log("Products by subcategory result:", {
      subcategoryId,
      productsFound: products.length,
      totalProducts,
      transformedCount: transformedProducts.length,
    });

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

    console.log("=== createProduct ===");
    console.log("Request body:", {
      name,
      category,
      subcategory,
      stockInPackets,
      packagingQuantity,
      unit,
      price,
      mrpPrice,
      showToCustomer,
      priceForCustomer,
      imagesCount: req.files?.length || 0,
    });

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

    console.log("Product data to create:", productData);

    const product = await Products.create(productData);
    await product.populate([
      { path: "category", select: "name image" },
      { path: "subcategory", select: "name" },
    ]);

    console.log("Product created successfully:", {
      id: product._id,
      name: product.name,
      price: product.price,
      priceForCustomer: product.priceForCustomer,
      stockInPackets: product.stockInPackets,
    });

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

    console.log("=== updateProduct ===");
    console.log("Product ID:", id);
    console.log("Update data received:", updateData);

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

    console.log("Processed update data:", updateData);

    const updatedProduct = await Products.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate([
      { path: "category", select: "name image" },
      { path: "subcategory", select: "name" },
    ]);

    console.log("Product updated successfully:", {
      id: updatedProduct._id,
      name: updatedProduct.name,
      price: updatedProduct.price,
      priceForCustomer: updatedProduct.priceForCustomer,
      stockInPackets: updatedProduct.stockInPackets,
    });

    res.status(200).json({
      success: true,
      data: updatedProduct,
      message: "Product updated successfully",
    });
  } catch (error) {
    console.error("Error in updateProduct:", error);
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

    console.log("=== deleteProduct ===");
    console.log("Product ID to delete:", id);

    const product = await Products.findById(id);
    if (!product) {
      console.log("Product not found:", id);
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    console.log("Deleting product:", { id: product._id, name: product.name });

    await Products.findByIdAndDelete(id);

    console.log("Product deleted successfully:", id);

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

    console.log("=== searchProducts ===");
    console.log("Search query:", q, "UserType:", customerType);

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
    const transformedProducts = products.map((product) => {
      const { price, priceForCustomer, ...rest } = product;
      return {
        ...rest,
        price:
          customerType === "normal" ? Number(priceForCustomer) : Number(price),
      };
    });

    const totalProducts = await Products.countDocuments(query);

    console.log("Search results:", {
      searchQuery: q,
      productsFound: products.length,
      totalProducts,
      transformedCount: transformedProducts.length,
    });

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

    console.log("=== getProductsAdmin ===");
    console.log("Query params:", {
      category,
      subcategory,
      search,
      minPrice,
      maxPrice,
      sortBy,
      sortOrder,
      page,
      limit,
    });

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

    console.log("Admin products result:", {
      productsFound: products.length,
      totalProducts,
      afterPriceFilter: productsWithNumbers.length,
    });

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

    console.log("=== getProductByIdAdmin ===");
    console.log("Product ID:", id);

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

    console.log("Admin product found:", {
      id: productWithNumbers._id,
      name: productWithNumbers.name,
      price: productWithNumbers.price,
      priceForCustomer: productWithNumbers.priceForCustomer,
      stockInPackets: productWithNumbers.stockInPackets,
      similarProductsCount: similarProductsWithNumbers.length,
    });

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

    console.log("=== getProductsByCategoryAdmin ===");
    console.log("Category ID:", categoryId);

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

    console.log("Admin products by category result:", {
      categoryId,
      productsFound: products.length,
      totalProducts,
      afterPriceFilter: productsWithNumbers.length,
    });

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

    console.log("=== getProductsBySubCategoryAdmin ===");
    console.log("Subcategory ID:", subcategoryId);

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

    console.log("Admin products by subcategory result:", {
      subcategoryId,
      productsFound: products.length,
      totalProducts,
      afterPriceFilter: productsWithNumbers.length,
    });

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

    console.log("=== searchProductsAdmin ===");
    console.log("Search query:", q);

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

    console.log("Admin search results:", {
      searchQuery: q,
      productsFound: products.length,
      totalProducts,
      afterPriceFilter: productsWithNumbers.length,
    });

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
