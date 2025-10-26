import Cart from "../models/cart.models.js";
import User from "../models/user.models.js";
import Address from "../models/address.models.js";

// Helper function to calculate the Delivery fees
const calculateDeliveryFee=(subtotal)=>{
    if(subtotal>=500)
        {
            return 0;
        }
        return 50;
}
// Helper function to calculate checkout summary
const calculateCheckoutSummary=(cart,deliveryFee=null)=>{
    const subtotal=cart.items.reduce((sum,item)=>{
        const price=item.productId?.pricePerKg||0;
        return sum+price*item.quantity;
    },0);
    if(deliveryFee===null)
        {
            deliveryFee=calculateDeliveryFee(subtotal);
        }
    // This will be implemented later
    const couponDiscount=cart.couponDiscount||0;
    const totalAmount=subtotal-couponDiscount+deliveryFee;
    return {
        subtotal: Number(subtotal.toFixed(2)),
        couponDiscount: Number(couponDiscount.toFixed(2)),
        deliveryFee: Number(deliveryFee.toFixed(2)),
        totalAmount: Number(totalAmount.toFixed(2)),
        totalItems: cart.items.reduce((sum, item) => sum + item.quantity, 0)
      };

}
// @route   GET /api/checkout/:userId
// @access  Private
export const getCheckoutSummary=async(req,res)=>{
    try {
        const {userId}=req.params;
        if(!userId)
            {
                return res.status(400).json({
                    success:false,
                    message:"User ID is required"
                })
            }
        const user= await User.findById(userId);
        if(!user)
            {
                return res.status(404).json({
                    success:false,
                    message:"User not found"
                })
            }
        const cart=await Cart.findOne({user:userId}).populate("items.productId");
        if (!cart) {
            return res.status(400).json({
              success: false,
              message: "Cart is empty. Please add items to proceed to checkout.",
            });
          }
          
          if (cart.items.length === 0) {
            return res.status(400).json({
              success: false,
              message: "Cart has no items.",
            });
          }
        const defaultAddress=await Address.findOne({
            user:userId,
            isDefault:true
        });
        const summary=calculateCheckoutSummary(cart);
        const checkoutData = {
            user: {
              _id: user._id,
              phone: user.phone
            },
            deliveryAddress: defaultAddress || null,
            cart: {
                items: cart.items.filter(item => item.productId).map(item => ({
                productId: item.productId._id || "unknown",
                name: item.productId.name,
                image: item.productId.images?.[0] || null,
                pricePerKg: item.productId.pricePerKg,
                quantity: item.quantity,
                itemTotal: Number((item.productId.pricePerKg * item.quantity).toFixed(2))
              })),
              totalItems: summary.totalItems
            },
            paymentSummary: {
              subtotal: summary.subtotal,
              couponDiscount: summary.couponDiscount,
              deliveryFee: summary.deliveryFee,
              totalAmount: summary.totalAmount
            }
          };
        res.status(200).json({
            success:true,
            data:checkoutData
        })
    } catch (error) {
        console.error("Error in getCheckoutSummary",error);
        res.status(500).json({
            success:false,
            message:"Internal Server Error",
            error: error
        });
    }
}
// @route   POST /api/checkout/validate
// @access  Private
export const validateCheckout=async(req,res)=>{
    try {
        const {userId,addressId}=req.body;
        if(!userId)
            {
                return res.status(400).json({
                    success:false,
                    message:"User ID is required"
                })
            }
        if(!addressId)
            {
                return res.status(400).json({
                    success:false,
                    message:"Delivery address is required"
                })
            }
        const user=await User.findById(userId);
        if (!user) {
            return res.status(404).json({
              success: false,
              message: "User not found"
            });
          }
        const address = await Address.findOne({ _id: addressId, userId });
        if (!address) {
            return res.status(404).json({
              success: false,
              message: "Delivery address not found or does not belong to user"
            });
          }
          const cart = await Cart.findOne({ user: userId }).populate("items.productId");
    
          if (!cart) {
            return res.status(400).json({
              success: false,
              message: "Cart is empty. Please add items to proceed to checkout.",
            });
          }
          
          if (cart.items.length === 0) {
            return res.status(400).json({
              success: false,
              message: "Cart has no items.",
            });
          }
        const stockIssues=[];
        for(const item of cart.items)
            {
                const product=item.productId || "unknown";
                if(!product)
                    {
                        stockIssues.push({
                            productId:item.productId._id || "unknown",
                            issue:"Product no longer exists"
                        });
                        continue;
                    }
                if(product.quantityAvailable<=0)
                    {
                        stockIssues.push({
                            productId:product._id || "unknown",
                            productName:product.name,
                            issue:"Out of stock"
                        });
                    }
                else if(item.quantity> product.quantityAvailable)
                    {
                        stockIssues.push({
                            productId:product._id || "unknown",
                            productName:product.name,
                            issue:`Only ${product.quantityAvailable} items available, but ${item.quantity} in cart`
                        })
                    }
            }
            if(stockIssues.length>0)
                {
                    return res.status(400).json({
                        success:false,
                        message:"Some items in ur cart have stock issues",
                        stockIssues
                    });
                }
            const summary=calculateCheckoutSummary(cart);
            res.status(200).json({
                success: true,
                message: "Checkout validation successful",
                data: {
                  isValid: true,
                  deliveryAddress: {
                    _id: address._id,
                    completeAddress: address.completeAddress,
                    landmark: address.landmark,
                    pincode: address.pincode,
                    city: address.city,
                    state: address.state,
                    addressNickname: address.addressNickname
                  },
                  paymentSummary: summary
                }
              });
    } catch (error) {
        console.error("Error in validating checkout:",error);
        res.status(500).json({
            success:false,
            message:"Internal server error"
        });
    }
};
export const getDeliveryFee=async(req,res)=>{
    try {
        const {userId}=req.body;
        if (!userId) {
            return res.status(400).json({
              success: false,
              message: "User ID is required"
            });
          }
        const cart = await Cart.findOne({ user: userId }).populate("items.productId");
    
        if (!cart) {
            return res.status(400).json({
              success: false,
              message: "Cart is empty. Please add items to proceed to checkout.",
            });
          }
          
          if (cart.items.length === 0) {
            return res.status(400).json({
              success: false,
              message: "Cart has no items.",
            });
          }
        const subtotal = cart.items.reduce((sum, item) => {
            const price = item.productId?.pricePerKg || 0;
            return sum + price * item.quantity;
          }, 0);
        const deliveryFee = calculateDeliveryFee(subtotal);
        res.status(200).json({
            success: true,
            data: {
              subtotal: Number(subtotal.toFixed(2)),
              deliveryFee: Number(deliveryFee.toFixed(2)),
              freeDeliveryThreshold: 500,
              isFreeDelivery: deliveryFee === 0
            }
          });
        
    } catch (error) {
        console.error("Error in getDeliveryFee:", error);
        res.status(500).json({
        success: false,
        message: "Internal server error",
        });
    }
}
// @route   PUT /api/checkout/address
// @access  Private
export const updateCheckoutAddress=async(req,res)=>{
    try {
        const {userId,addressId}=req.body;
        if (!userId) {
            return res.status(400).json({
              success: false,
              message: "User ID is required"
            });
          }
        if (!addressId) {
            return res.status(400).json({
              success: false,
              message: "Address ID is required"
            });
        }
        const user = await User.findById(userId);
        if (!user) {
        return res.status(404).json({
            success: false,
            message: "User not found"
        });
        }
        const address = await Address.findOne({ _id: addressId, userId });
        if (!address) {
        return res.status(404).json({
            success: false,
            message: "Address not found or does not belong to user"
        });
        }
        res.status(200).json({
            success: true,
            message: "Delivery address selected",
            data: {
              address: {
                _id: address._id,
                completeAddress: address.completeAddress,
                landmark: address.landmark,
                pincode: address.pincode,
                city: address.city,
                state: address.state,
                addressNickname: address.addressNickname
              }
            }
          });
      
    } catch (error) {
        console.error("Error in updateCheckoutAddress:", error);
        res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error
        });
    }
}