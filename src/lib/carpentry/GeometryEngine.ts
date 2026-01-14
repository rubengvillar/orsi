import type { Polygon, Point2D } from './types';

export class GeometryEngine {
    /**
     * Calculates the bounding box of a polygon.
     */
    static getBounds(polygon: Polygon): { width: number; height: number } {
        if (polygon.nodes.length === 0) return { width: 0, height: 0 };

        const xs = polygon.nodes.map(n => n.x);
        const ys = polygon.nodes.map(n => n.y);

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        return {
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * Helper to create a rectangular polygon.
     */
    static createRectangle(width: number, height: number): Polygon {
        return {
            nodes: [
                { x: 0, y: 0 },
                { x: width, y: 0 },
                { x: width, y: height },
                { x: 0, y: height }
            ]
        };
    }
}
