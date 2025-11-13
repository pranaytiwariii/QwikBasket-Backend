import mongoose from "mongoose";

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // Catergory name
  image: { type: String, required: true }, // URL for the category image
  estimatedDelivery:{type:String , required:true}
});

export default mongoose.model("Category", CategorySchema);
