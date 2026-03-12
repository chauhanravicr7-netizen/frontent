import { sawnTimberTotal, hoppusTotal, plywoodCBM } from '../utils/timberMath';

// When user fills thickness/width/length/pieces, auto-calculate:
const result = sawnTimberTotal(18, 150, 8, 50); // 18mm × 150mm × 8ft × 50 pieces
// → { cftPerPiece: 1.0417, totalCFT: 52.08, totalCBM: 1.475 }