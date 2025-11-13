import Category from "../models/category.models.js";
import SubCategory from "../models/subcategory.models.js";
import Products from "../models/product.models.js";
import { imageUploadUtil } from "../config/cloudinary.js";
// @route   GET /api/categories
// @access  Public
export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().lean();
    const categoriesWithSubcategories = await Promise.all(
      categories.map(async (category) => {
        const subcategories = await SubCategory.find({
          parentCategory: category._id,
        }).lean();
        return {
          ...category,
          subcategories,
        };
      })
    );
    res.status(200).json({
      success: true,
      data: categoriesWithSubcategories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching categories",
      error: error.message,
    });
  }
};
// @route   GET /api/categories/:id
// @access  Public
export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id).lean();
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }
    const subcategories = await SubCategory.find({ parentCategory: id }).lean();
    res.status(200).json({
      success: true,
      data: {
        ...category,
        subcategories,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching category",
      error: error.message,
    });
  }
};
// @route   POST /api/categories
// @access  Private/Admin
export const createCategory = async (req, res) => {
  try {
    const { name, estimatedDelivery } = req.body;
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: "Category already exists",
      });
    }
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Category image is required",
      });
    }

    // Validate file type (only allow images)
    const allowedMimeTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];

    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid file type. Only image files (JPEG, PNG, GIF, WebP) are allowed.",
        receivedType: req.file.mimetype,
      });
    }

    // Validate file buffer exists
    if (!req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: "File buffer is missing",
      });
    }

    // Convert to base64 data URL
    const b64 = Buffer.from(req.file.buffer).toString("base64");
    const url = "data:" + req.file.mimetype + ";base64," + b64;

    // Upload to Cloudinary
    const uploadResult = await imageUploadUtil(url);

    if (!uploadResult || !uploadResult.secure_url) {
      return res.status(500).json({
        success: false,
        message: "Upload failed: No secure URL returned from Cloudinary",
      });
    }

    const imageUrl = uploadResult.secure_url;
    if (!estimatedDelivery) {
      return res.status(400).json({
        success: false,
        message: "Estimated delivery text is required",
      });
    }
    const category = await Category.create({
      name,
      image: imageUrl,
      estimatedDelivery,
    });
    res.status(201).json({
      success: true,
      data: category,
      message: "Category created successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating category",
      error: error.message,
    });
  }
};
// @route   PUT /api/categories/:id
// @access  Private/Admin
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, estimatedDelivery } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ name });
      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: "Category name already exists",
        });
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (estimatedDelivery) updateData.estimatedDelivery = estimatedDelivery;

    // Handle image upload if file is provided
    if (req.file) {
      try {
        // Validate file type (only allow images)
        const allowedMimeTypes = [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/gif",
          "image/webp",
        ];

        if (!allowedMimeTypes.includes(req.file.mimetype)) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid file type. Only image files (JPEG, PNG, GIF, WebP) are allowed.",
            receivedType: req.file.mimetype,
          });
        }

        // Validate file buffer exists
        if (!req.file.buffer) {
          return res.status(400).json({
            success: false,
            message: "File buffer is missing",
          });
        }

        // Convert to base64 data URL
        const b64 = Buffer.from(req.file.buffer).toString("base64");
        const url = "data:" + req.file.mimetype + ";base64," + b64;

        // Upload to Cloudinary
        const uploadResult = await imageUploadUtil(url);

        if (!uploadResult || !uploadResult.secure_url) {
          throw new Error(
            "Upload failed: No secure URL returned from Cloudinary"
          );
        }

        updateData.image = uploadResult.secure_url;
      } catch (uploadError) {
        console.error("Error uploading category image:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload image",
          error: uploadError.message,
        });
      }
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({
        success: false,
        message: "Category not found after update",
      });
    }

    res.status(200).json({
      success: true,
      data: updatedCategory,
      message: "Category updated successfully",
    });
  } catch (error) {
    console.error("Error in updateCategory:", error);
    console.error("Error stack:", error.stack);

    // Provide more specific error messages
    let errorMessage = "Error updating category";
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
// @route   DELETE /api/categories/:id
// @access  Private/Admin
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }
    const subcategoriesCount = await SubCategory.countDocuments({
      parentCategory: id,
    });
    if (subcategoriesCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete category with existing subcategories",
      });
    }

    const productsCount = await Products.countDocuments({ category: id });
    if (productsCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete category with existing products",
      });
    }
    await Category.findByIdAndDelete(id);
    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting category",
      error: error.message,
    });
  }
};
// @route   GET /api/categories/:categoryId/subcategories
// @access  Public
export const getSubcategoriesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { customerType = "business" } = req.query;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }
    const subcategories = await SubCategory.find({
      parentCategory: categoryId,
    }).lean();

    // Build query for products
    const productsQuery = { category: categoryId };

    // Filter by customerType: if normal, only show products where showToCustomer is true
    if (customerType === "normal") {
      productsQuery.showToCustomer = true;
    }

    let products = await Products.find(productsQuery).lean();

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

    res.status(200).json({
      success: true,
      subcategories,
      products: transformedProducts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching subcategories",
      error: error.message,
    });
  }
};
