import express from "express";
import {
    getSubCategories,
    getSubCategoryById,
    createSubCategory,
    updateSubCategory,
    deleteSubCategory
  } from '../controllers/subcategory.controller.js';
const router=express.Router();
router.get('/',getSubCategories);
router.get('/:id',getSubCategoryById);
router.post('/',createSubCategory);
router.put('/:id',updateSubCategory);
router.delete('/:id',deleteSubCategory);
export default router;