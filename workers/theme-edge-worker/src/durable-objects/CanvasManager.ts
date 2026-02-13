
import { CanvasState, CanvasLayoutMode, RankedPrimitive, DisplayUpdate } from './conversation-types';

export class CanvasManager {
    private static WEIGHTS = {
        HIGH: 100,
        MEDIUM: 50,
        LOW: 10,
        RECENCY_DECAY: 0.1, // Points lost per second
    };

    private state: CanvasState;

    constructor() {
        this.state = {
            layoutMode: 'grid',
            activePrimitives: [],
            priorityHints: {}
        };
    }

    /**
     * Process a new display update and recalculate the canvas state
     */
    processUpdate(update: DisplayUpdate): CanvasState {
        const primitiveId = `${update.type}-${update.timestamp}`;

        // 1. Store Priority Hint
        if (update.priority) {
            this.state.priorityHints[primitiveId] = {
                priority: update.priority,
                metadata: update.metadata,
                timestamp: update.timestamp
            };
        }

        // 2. Add or Update Primitive
        // Remove if exists to avoid duplicates (newest wins)
        this.state.activePrimitives = this.state.activePrimitives.filter((p: RankedPrimitive) => p.id !== primitiveId);

        // Add new (unless it's a transient type we don't want to stack)
        if (['dish_card', 'menu_grid', 'menu_section', 'advice_card', 'time_based_suggestions'].includes(update.type)) {
            this.state.activePrimitives.push({
                id: primitiveId,
                type: update.type,
                data: update,
                score: 0 // Will be calculated below
            });
        }

        // 3. Prune old primitives
        if (this.state.activePrimitives.length > 20) {
            this.state.activePrimitives.shift();
        }

        // 4. Rank Primitives
        this.rankPrimitives();

        // 5. Determine Layout
        this.determineLayout();

        return this.state;
    }

    private rankPrimitives() {
        const now = Date.now();

        this.state.activePrimitives.forEach((primitive: RankedPrimitive) => {
            const hint = this.state.priorityHints[primitive.id] || { priority: 'low', timestamp: now, metadata: {} };
            let score = 0;

            // Base Score
            switch (hint.priority) {
                case 'high': score += CanvasManager.WEIGHTS.HIGH; break;
                case 'medium': score += CanvasManager.WEIGHTS.MEDIUM; break;
                case 'low': default: score += CanvasManager.WEIGHTS.LOW; break;
            }

            // Recency
            const ageSeconds = (now - hint.timestamp) / 1000;
            const recencyScore = Math.max(0, 50 - ageSeconds * CanvasManager.WEIGHTS.RECENCY_DECAY);
            score += recencyScore;

            // Metadata Boosts
            if (hint.metadata?.isCritical) score += 200;
            if (hint.metadata?.isAwaitingChoice) score += 40;

            primitive.score = score;
        });

        // Sort descending
        this.state.activePrimitives.sort((a: RankedPrimitive, b: RankedPrimitive) => b.score - a.score);
    }

    private determineLayout() {
        if (this.state.activePrimitives.length === 0) {
            this.state.layoutMode = 'grid';
            return;
        }

        const topScore = this.state.activePrimitives[0].score;

        if (topScore > 150) {
            this.state.layoutMode = 'highlight';
        } else if (this.state.activePrimitives.length > 3) {
            this.state.layoutMode = 'grid';
        } else {
            this.state.layoutMode = 'stack';
        }
    }

    public getState(): CanvasState {
        return this.state;
    }
}
