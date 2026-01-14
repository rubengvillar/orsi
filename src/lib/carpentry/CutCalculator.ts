import type { CutResult } from './types';

export class CutCalculator {
    /**
     * Calculates cuts for a standard rectangular frame (Marco).
     */
    static calculateFrameCuts(
        width: number,
        height: number,
        systemConfig: any // Contains default joint types (45 vs 90)
    ): CutResult[] {
        const cuts: CutResult[] = [];
        const jointType = systemConfig.frame_joint || 45;

        // Top & Bottom (Horizontal)
        cuts.push({
            profile_code: 'FRAME_PROFILE', // This would come from resolving system_profiles
            length_mm: width, // Logic for 90 degree joints might involve modifying this length using offset
            angle_start: jointType,
            angle_end: jointType,
            quantity: 2,
            description: 'Marco Horizontal'
        });

        // Left & Right (Vertical)
        cuts.push({
            profile_code: 'FRAME_PROFILE',
            length_mm: height,
            angle_start: jointType,
            angle_end: jointType,
            quantity: 2,
            description: 'Marco Vertical'
        });

        return cuts;
    }

    // TODO: Implement Sash cuts, Zocalos, Contravidrios logic
}
