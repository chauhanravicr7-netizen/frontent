/**
 * Calculates Hoppus Volume (used for round logs)
 * Formula: (Quarter Girth in inches)^2 * Length in feet / 144
 */
export const calculateHoppusCFT = (circumferenceInches, lengthFeet) => {
  if (!circumferenceInches || !lengthFeet) return 0;
  const quarterGirth = circumferenceInches / 4;
  const volume = Math.pow(quarterGirth, 2) * lengthFeet / 144;
  return parseFloat(volume.toFixed(3)); // [6, 7]
};

/**
 * Calculates Cubic Meters (CBM) for Sawn Timber
 * Based on user inputs: thickness (mm), width (ft), length (ft), quantity (pcs)
 * Conversion: 1 ft = 0.3048 m, 1 mm = 0.001 m
 */
export const calculateSawnCBM = (thicknessMm, widthFt, lengthFt, quantityPcs) => {
  if (!thicknessMm || !widthFt || !lengthFt || !quantityPcs) return 0;
  
  const thicknessMeters = thicknessMm / 1000;
  const widthMeters = widthFt * 0.3048;
  const lengthMeters = lengthFt * 0.3048;
  
  const singlePieceCBM = thicknessMeters * widthMeters * lengthMeters;
  const totalCBM = singlePieceCBM * quantityPcs;
  
  return parseFloat(totalCBM.toFixed(4));
};
