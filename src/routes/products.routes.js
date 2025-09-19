import express from "express";
import {
    getProducts,
    getProductById,
    getProductsByCategory,
    getProductsBySubCategory,
    createProduct,
    updateProduct,
    deleteProduct,
    searchProducts
  } from '../controllers/product.controller.js';
  const router=express.Router();
  router.get('/',getProducts);
  router.get('/search', searchProducts); 
  router.get('/category/:categoryId', getProductsByCategory);
  router.get('/subcategory/:subcategoryId', getProductsBySubCategory);
  router.get('/:id', getProductById);
  router.post('/', createProduct);
  router.put('/:id', updateProduct);
  router.delete('/:id', deleteProduct);
  export default router;