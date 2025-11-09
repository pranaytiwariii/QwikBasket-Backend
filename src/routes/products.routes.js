import express from "express";
import {
    getProducts,
    getProductById,
    getProductsByCategory,
    getProductsBySubCategory,
    createProduct,
    updateProduct,
    deleteProduct,
  searchProducts,
  getProductsAdmin,
  getProductByIdAdmin,
  getProductsByCategoryAdmin,
  getProductsBySubCategoryAdmin,
  searchProductsAdmin,
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
  // Admin routes
  router.get('/admin', getProductsAdmin);
  router.get('/admin/search', searchProductsAdmin);
  router.get('/admin/category/:categoryId', getProductsByCategoryAdmin);
  router.get('/admin/subcategory/:subcategoryId', getProductsBySubCategoryAdmin);
  router.get('/admin/:id', getProductByIdAdmin);
  export default router;