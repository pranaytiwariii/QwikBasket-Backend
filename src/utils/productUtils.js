// Truncate to 2 decimals without rounding
function toTwoDecimalsNoRound(num) {
  // Handle floating point precision issues by first rounding to 3 decimals
  const rounded = Math.round(num * 1000) / 1000;
  return Math.trunc(rounded * 100) / 100;
}

// Truncate to 3 decimals without rounding
function toThreeDecimalsNoRound(num) {
  // Handle floating point precision issues by first rounding to 4 decimals
  const rounded = Math.round(num * 10000) / 10000;
  return Math.trunc(rounded * 1000) / 1000;
}

// Round up to 2 decimals
function roundUpTo2(num) {
  // Handle floating point precision issues by first rounding to 3 decimals
  const rounded = Math.round(num * 1000) / 1000;
  return Math.ceil(rounded * 100) / 100;
}

// Convert quantity from selected unit to kg for storage in database
function convertQuantityToStorageUnit(quantity, selectedUnit) {
  if (selectedUnit === "gms") {
    return toThreeDecimalsNoRound(quantity / 1000); // convert grams to kg by dividing
  }
  // For kg and ltr, store as-is (assuming ltr is treated same as kg for storage)
  return toThreeDecimalsNoRound(quantity);
}

// Convert quantity from storage unit (kg) back to selected unit for display
function convertQuantityFromStorageUnit(quantity, selectedUnit) {
  if (selectedUnit === "gms") {
    return quantity * 1000; // convert kg to grams by multiplying
  }
  // For kg and ltr, return as-is since they're stored in same unit
  return quantity;
}

// Calculate price for cart item (price per kg * quantity in kg)
function calculateCartItemPrice(product, quantity, selectedUnit) {
  const quantityInKg = convertQuantityToStorageUnit(quantity, selectedUnit);
  // Handle floating point precision issues in price calculation
  const rawPrice = quantityInKg * product.pricePerKg;
  // Round to 2 decimal places (not round up) for accurate pricing
  return Math.round(rawPrice * 100) / 100;
}

// Stock management - convert to kg for storage
async function updateStock(product, quantity, selectedUnit) {
  const quantityInKg = convertQuantityToStorageUnit(quantity, selectedUnit);

  if (quantityInKg > product.stockQuantity) {
    throw new Error("Insufficient stock");
  }

  product.stockQuantity = toThreeDecimalsNoRound(
    product.stockQuantity - quantityInKg
  );
  await product.save();
  return product;
}

// Validation function for packaging quantity
function validatePackagingQuantity(product, quantity, selectedUnit) {
  const unit = selectedUnit || product.defaultUnit;
  let minQuantity;
  if (unit === product.defaultUnit) {
    minQuantity = product.packagingQuantity;
  } else {
    // Different unit, need to convert
    if (product.defaultUnit === "gms" && unit === "kg") {
      // Convert gms to kg (round up to ensure minimum packaging is met)
      minQuantity = Math.ceil(product.packagingQuantity / 1000); //If the packaging quantity is 500 gms, then the minimum quantity is 1 kg.
    } else {
      // For other unit combinations or liquids, use packaging quantity directly
      minQuantity = product.packagingQuantity;
    }
  }

  return {
    isValid: quantity >= minQuantity,
    minQuantity,
    message: `Quantity cannot be less than ${minQuantity} ${unit} for this product`,
  };
}

// Export functions
export {
  updateStock,
  validatePackagingQuantity,
  convertQuantityToStorageUnit,
  convertQuantityFromStorageUnit,
  calculateCartItemPrice,
  toTwoDecimalsNoRound,
  toThreeDecimalsNoRound,
  roundUpTo2,
};
