import mongoose from "mongoose";
import { model , Schema} from "mongoose";

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // Catergory name
  image: { type: String, required: true }, // URL for the category image
});

export const Category=model("Category",CategorySchema);