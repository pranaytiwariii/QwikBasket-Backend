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

    let imageUrl = "";
    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      const url = "data:" + req.file.mimetype + ";base64," + b64;
      const uploadResult = await imageUploadUtil(url);
      imageUrl = uploadResult.secure_url;
    } else {
      return res.status(400).json({ message: "Subcategory image is required" });
    }

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
    res.status(500).json({
      success: false,
      message: "Error creating subcategory",
      error: error.message,
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

    let imageUrl = subcategory.image; // Keep existing image if no new one provided

    // Handle image upload if file is provided
    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      const url = "data:" + req.file.mimetype + ";base64," + b64;
      const uploadResult = await imageUploadUtil(url);
      imageUrl = uploadResult.secure_url;
    }

    const updatedSubCategory = await SubCategory.findByIdAndUpdate(
      id,
      { name, parentCategory, image: imageUrl },
      { new: true, runValidators: true }
    ).populate("parentCategory", "name image");

    res.status(200).json({
      success: true,
      data: updatedSubCategory,
      message: "Subcategory updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating subcategory",
      error: error.message,
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
