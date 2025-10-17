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
  import { upload } from '../config/cloudinary.js';
  const router=express.Router();
  router.get('/',getProducts);
  router.get('/search', searchProducts); 
  router.get('/category/:categoryId', getProductsByCategory);
  router.get('/subcategory/:subcategoryId', getProductsBySubCategory);
  router.get('/:id', getProductById);
  router.post('/', upload.array("images", 10), createProduct);
  router.put('/:id', upload.array("images", 10), updateProduct);
  router.delete('/:id', deleteProduct);
  export default router;