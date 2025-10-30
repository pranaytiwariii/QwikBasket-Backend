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
// API TO GET TOP CATEGORIES

export const getTopCategories=async(req,res)=>{
    try {
        const pipeline = [
            { $unwind: "$items" },
            {
              $lookup: {
                from: "products",
                localField: "items.productId",
                foreignField: "_id",
                as: "product",
              },
            },
            { $unwind: "$product" },
            {
              $lookup: {
                from: "categories",
                localField: "product.category",
                foreignField: "_id",
                as: "category",
              },
            },
            { $unwind: "$category" },
            {
              $group: {
                _id: "$category._id",
                categoryName: { $first: "$category.name" },
                totalQuantity: { $sum: "$items.quantity" },
              },
            },
            { $sort: { totalQuantity: -1 } },
          ];
          const results=await Order.aggregate(pipeline);
          if(!results.length) return res.json([]);
          const total = results.reduce((sum, r) => sum + r.totalQuantity, 0);
          const formatted = results.map((r) => ({
            label: r.categoryName,
            percentage: parseFloat(((r.totalQuantity / total) * 100).toFixed(1)),
          }));
      
          res.json(formatted);
    } catch (error) {
        console.error("Top categories error:", err);
    res.status(500).json({ error: "Failed to fetch top selling categories" });
    }
}