import type { CostResult, CutResult, GlassResult } from './types';

export class CostCalculator {
    static calculateTotal(
        cuts: CutResult[],
        glass: GlassResult,
        profilePrices: Record<string, { price: number; weight: number; isByWeight: boolean }>, // code -> info
        glassPricePerM2: number
    ): CostResult {
        let profilesCost = 0;
        const lineItems = [];

        // 1. Calculate Profiles
        for (const cut of cuts) {
            const info = profilePrices[cut.profile_code];
            if (!info) continue;

            let cost = 0;
            const totalLenM = (cut.length_mm / 1000) * cut.quantity;

            if (info.isByWeight) {
                const totalWeight = totalLenM * info.weight;
                cost = totalWeight * info.price;
            } else {
                // Per bar length logic is complex (optimization), simplified here as linear meter / bar ratio
                // For estimation, we might just assume price per meter if available, or price_per_bar / length_bar * usage
                // Assuming 'price' input here is effectively 'price per meter' for simplicity in this V1
                cost = totalLenM * info.price;
            }

            profilesCost += cost;
            lineItems.push({
                description: `${cut.description} (${cut.profile_code})`,
                quantity: cut.quantity,
                unit_cost: cost / cut.quantity,
                total_cost: cost
            });
        }

        // 2. Calculate Glass
        const glassArea = (glass.width_mm / 1000) * (glass.height_mm / 1000) * glass.quantity;
        const glassCost = glassArea * glassPricePerM2;

        lineItems.push({
            description: glass.description,
            quantity: glass.quantity,
            unit_cost: glassCost / glass.quantity, // approx
            total_cost: glassCost
        });

        // 3. Accessories (simplified placeholder)
        const accessoriesCost = 0;

        return {
            total_cost: profilesCost + glassCost + accessoriesCost,
            profiles_cost: profilesCost,
            glass_cost: glassCost,
            accessories_cost: accessoriesCost,
            items: lineItems
        };
    }
}
