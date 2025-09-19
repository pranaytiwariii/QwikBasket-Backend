import mongoose from "mongoose";
import { model , Schema} from "mongoose";

const SubCategorySchema = new mongoose.Schema({
  name: { type: String, required: true }, //subcategory name
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category", // Links this subcategory to a document in the 'Category' collection
    required: true,
  },
});

export const SubCategory=model("SubCategory", SubCategorySchema);