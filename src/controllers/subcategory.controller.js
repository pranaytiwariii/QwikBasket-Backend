import SubCategory from "../models/subcategory.models.js";
import Category from "../models/category.models.js";
import Products from "../models/product.models.js";
import { imageUploadUtil } from "../config/cloudinary.js";
// @route   GET /api/subcategories
// @access  Public
export const getSubCategories = async (req, res) => {
  try {
    const subcategories = await SubCategory.find({})
      .populate("parentCategory", "name image")
      .lean();
    res.status(200).json({
      success: true,
      data: subcategories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching subcategories",
      error: error.message,
    });
  }
};
// @route   GET /api/subcategories/:id
// @access  Public
export const getSubCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const subcategory = await SubCategory.findById(id)
      .populate("parentCategory", "name image")
      .lean();

    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found",
      });
    }
    res.status(200).json({
      success: true,
      data: subcategory,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching subcategory",
      error: error.message,
    });
  }
};
// @route   POST /api/subcategories
// @access  Private/Admin
export const createSubCategory = async (req, res) => {
  try {
    const { name, parentCategory } = req.body;

    const category = await Category.findById(parentCategory);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Parent category not found",
      });
    }

    const existingSubCategory = await SubCategory.findOne({
      name,
      parentCategory,
    });
    if (existingSubCategory) {
      return res.status(400).json({
        success: false,
        message: "Subcategory already exists for this category",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Subcategory image is required",
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

    const subcategory = await SubCategory.create({
      name,
      parentCategory,
      image: imageUrl,
    });
    await subcategory.populate("parentCategory", "name image");

    res.status(201).json({
      success: true,
      data: subcategory,
      message: "Subcategory created successfully",
    });
  } catch (error) {
    console.error("Error in createSubCategory:", error);
    console.error("Error stack:", error.stack);

    // Provide more specific error messages
    let errorMessage = "Error creating subcategory";
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
// @route   PUT /api/subcategories/:id
// @access  Private/Admin
export const updateSubCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, parentCategory } = req.body;

    const subcategory = await SubCategory.findById(id);
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found",
      });
    }

    if (
      parentCategory &&
      parentCategory !== subcategory.parentCategory.toString()
    ) {
      const category = await Category.findById(parentCategory);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Parent category not found",
        });
      }
    }

    if (name || parentCategory) {
      const checkParentCategory = parentCategory || subcategory.parentCategory;
      const checkName = name || subcategory.name;

      const existingSubCategory = await SubCategory.findOne({
        name: checkName,
        parentCategory: checkParentCategory,
        _id: { $ne: id },
      });
      if (existingSubCategory) {
        return res.status(400).json({
          success: false,
          message: "Subcategory name already exists for this category",
        });
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (parentCategory) updateData.parentCategory = parentCategory;

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
        console.error("Error uploading subcategory image:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload image",
          error: uploadError.message,
        });
      }
    }

    const updatedSubCategory = await SubCategory.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate("parentCategory", "name image");

    if (!updatedSubCategory) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found after update",
      });
    }

    res.status(200).json({
      success: true,
      data: updatedSubCategory,
      message: "Subcategory updated successfully",
    });
  } catch (error) {
    console.error("Error in updateSubCategory:", error);
    console.error("Error stack:", error.stack);

    // Provide more specific error messages
    let errorMessage = "Error updating subcategory";
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
// @route   DELETE /api/subcategories/:id
// @access  Private/Admin
export const deleteSubCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const subcategory = await SubCategory.findById(id);
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found",
      });
    }
    const productsCount = await Products.countDocuments({ subcategory: id });
    if (productsCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete subcategory with existing products",
      });
    }
    await SubCategory.findByIdAndDelete(id);
    res.status(200).json({
      success: true,
      message: "Subcategory deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting subcategory",
      error: error.message,
    });
  }
};
