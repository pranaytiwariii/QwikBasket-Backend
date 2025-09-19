import {Category} from "../models/category.models.js";
import {SubCategory} from "../models/subcategory.models.js";
import {Products} from "../models/product.models.js";
// @route   GET /api/categories
// @access  Public
export const getCategories=async (req,res)=>{
    try {
       const categories= await Category.find().lean();
       const categoriesWithSubcategories=await Promise.all(
        categories.map(async(category)=>{
            const subcategories=await SubCategory.find({parentCategory:category._id}).lean();
            return{
                ...category,
                subcategories
            };
        })
       );
       res.status(200).json({
        success:true,
        data:categoriesWithSubcategories
       });
    } catch (error) {
        res.status(500).json({
            success:false,
            message:"Error fetching categories",
            error:error.message
        });

    }
}
// @route   GET /api/categories/:id
// @access  Public
export const getCategoryById=async(req,res)=>{
    try {
        const {id}=req.params;
        const category=Category.findById(id).lean();
        if(!category)
        {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });   
        }
        const subcategories=await SubCategory.find({parentCategory:id}).lean();
        res.status(200).json({
            success: true,
            data: {
              ...category,
              subcategories
            }
          });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching category',
            error: error.message
          });
    }
}
// @route   POST /api/categories
// @access  Private/Admin
export const createCategory=async(req,res)=>{
    try {
        const {name,image}=req.body;
        const existingCategory=await Category.findOne({name});
        if(existingCategory)
            {
                return res.status(400).json({
                    success: false,
                    message: 'Category already exists'
                  });  
            }
        const category=await Category.create({name,image});
        res.status(201).json({
            success: true,
            data: category,
            message: 'Category created successfully'
          });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating category',
            error: error.message
          }); 
    }
}
// @route   PUT /api/categories/:id
// @access  Private/Admin
export const updateCategory=async(req,res)=>{
    try {
        const {id}=req.params;
        const {name,image}=req.body;
        const category=await Category.findById({id});
        if (!category) {
            return res.status(404).json({
              success: false,
              message: 'Category not found'
            });
          }
        if(name&& name!==category.name)
            {
                const existingCategory=await Category.findOne({name});
                if(existingCategory)
                    {
                        return res.status(400).json({
                            success: false,
                            message: 'Category name already exists'
                          });   
                    }
            }
        const updatedCategory = await Category.findByIdAndUpdate(
                id,
                { name, image },
                { new: true, runValidators: true }
              );
        res.status(200).json({
                success: true,
                data: updatedCategory,
                message: 'Category updated successfully'
              });
        
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating category',
            error: error.message
          });
    }
}
// @route   DELETE /api/categories/:id
// @access  Private/Admin
export const deleteCategory=async(req,res)=>{
    try {
       const {id}=req.params;
       const category=await Category.findById({id});
       if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }
    const subcategoriesCount = await SubCategory.countDocuments({ parentCategory: id });
    if (subcategoriesCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with existing subcategories'
      });
    }

    const productsCount = await Product.countDocuments({ category: id });
    if (productsCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with existing products'
      });
    }
    await Category.findByIdAndDelete(id);
    res.status(200).json({
        success: true,
        message: 'Category deleted successfully'
      });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting category',
            error: error.message
          }); 
    }
}
// @route   GET /api/categories/:categoryId/subcategories
// @access  Public
export const getSubcategoriesByCategory=async(req,res)=>{
    try {
        const{categoryId}=req.params;
        const category = await Category.findById(categoryId);
        if (!category) {
        return res.status(404).json({
            success: false,
            message: 'Category not found'
        });
        }
        const subcategories = await SubCategory.find({ parentCategory: categoryId }).lean();
        res.status(200).json({
            success: true,
            data: subcategories
          });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching subcategories',
            error: error.message
          });
    }
}