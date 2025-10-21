import express from "express";
import {
    getSubCategories,
    getSubCategoryById,
    createSubCategory,
    updateSubCategory,
    deleteSubCategory
} from '../controllers/subcategory.controller.js';
import { upload } from '../config/cloudinary.js';
const router=express.Router();
router.get('/',getSubCategories);
router.get('/:id',getSubCategoryById);
router.post('/',upload.single("image"),createSubCategory);
router.put('/:id',upload.single("image"),updateSubCategory);
router.delete('/:id',deleteSubCategory);
export default router;
