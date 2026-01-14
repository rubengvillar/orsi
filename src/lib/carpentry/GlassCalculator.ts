import type { GlassResult, Polygon } from './types';
import { GeometryEngine } from './GeometryEngine';

export class GlassCalculator {
    /**
     * Calculates the glass size for a simple rectangular opening.
     * @param openingWidth Width of the opening (or sash) in mm
     * @param openingHeight Height of the opening (or sash) in mm
     * @param systemRules The rules for the selected system (e.g., deductions)
     * @param composition 'simple' or 'dvh' (affects bead/chamber choice, not usually size logic unless DVH has diff offset)
     */
    static calculateSimpleGlass(
        openingWidth: number,
        openingHeight: number,
        systemRules: { glass_deduction_w: number; glass_deduction_h: number },
        composition: 'simple' | 'dvh' = 'simple'
    ): GlassResult {
        return {
            width_mm: openingWidth - (systemRules.glass_deduction_w || 0),
            height_mm: openingHeight - (systemRules.glass_deduction_h || 0),
            quantity: 1,
            description: `Vidrio ${composition.toUpperCase()}`
        };
    }

    /**
     * Calculates glass for irregular shapes (placeholder).
     */
    static calculatePolygonGlass(polygon: Polygon): GlassResult {
        const bounds = GeometryEngine.getBounds(polygon);
        // Simplified logic: bounding box - standard deduction
        // In reality, irregular glass would need a DXF or nodes list
        return {
            width_mm: bounds.width - 10,
            height_mm: bounds.height - 10,
            quantity: 1,
            description: 'Vidrio Irregular (Medidas Aprox)'
        };
    }
}
