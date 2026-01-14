/**
 * Shared types for Carpentry Agents
 */

export interface Point2D {
    x: number;
    y: number;
}

export interface Polygon {
    nodes: Point2D[];
}

export interface CutResult {
    profile_code: string;
    length_mm: number;
    angle_start: number;
    angle_end: number;
    quantity: number;
    description: string;
}

export interface GlassResult {
    width_mm: number;
    height_mm: number;
    quantity: number;
    description: string;
}

export interface CostResult {
    total_cost: number;
    profiles_cost: number;
    accessories_cost: number;
    glass_cost: number;
    items: {
        description: string;
        quantity: number;
        unit_cost: number;
        total_cost: number;
    }[];
}
