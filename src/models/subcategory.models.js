import mongoose from "mongoose";

const SubCategorySchema = new mongoose.Schema({
  name: { type: String, required: true }, //subcategory name
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category", // Links this subcategory to a document in the 'Category' collection
    required: true,
  },
  image:{type:String,required:true}
});

export default mongoose.model("SubCategory", SubCategorySchema);
