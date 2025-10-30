import Category from "../models/category.models.js";
import Product from "../models/product.models.js";
import Order from "../models/order.models.js";

// API TO GET STATS
export const getDashboardStats=async(req,res)=>{
    try {
        const totalCategories=await Category.countDocuments();
        const totalProducts=await Product.countDocuments();
        const totalOrders=await Order.countDocuments();
        const pendingOrders=await Order.countDocuments({status:"Pending"});
        res.status(200).json({
            totalCategories,
            totalProducts,
            totalOrders,
            pendingOrders,
          });
    } catch (error) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
      }
}