/**
 * Professional Restaurant Table SVG Components
 * Renders realistic table shapes with chairs for floor plan visualization
 */

import { TableStatus } from '../../types/floor-plan';

interface TableSVGProps {
    tableNumber: string;
    capacity: number;
    status: TableStatus;
    isSelected?: boolean;
    onClick?: () => void;
    showQR?: boolean;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    isDragging?: boolean;
}

// Status colors that match the design system
const statusColors: Record<TableStatus, { fill: string; stroke: string; text: string; chairFill: string }> = {
    available: {
        fill: '#d1fae5', // success-light
        stroke: '#10b981', // success
        text: '#059669',
        chairFill: '#a7f3d0'
    },
    occupied: {
        fill: '#ffedd5', // orange light
        stroke: '#ff8c00', // accent
        text: '#c2410c',
        chairFill: '#fed7aa'
    },
    reserved: {
        fill: '#dbeafe', // info-light
        stroke: '#3b82f6', // info
        text: '#1d4ed8',
        chairFill: '#bfdbfe'
    },
    cleaning: {
        fill: '#f1f5f9', // muted
        stroke: '#94a3b8', // gray
        text: '#64748b',
        chairFill: '#e2e8f0'
    }
};

const sizeMap = {
    xs: { table: 40, chair: 6, fontSize: 10 },
    sm: { table: 50, chair: 8, fontSize: 12 },
    md: { table: 65, chair: 10, fontSize: 14 },
    lg: { table: 85, chair: 12, fontSize: 16 }
};

// Round table with chairs around it
export const RoundTableSVG = ({
    tableNumber,
    capacity,
    status,
    isSelected,
    onClick,
    size = 'md',
    isDragging
}: TableSVGProps) => {
    const colors = statusColors[status];
    const { table: tableSize, chair: chairSize, fontSize } = sizeMap[size];
    const svgSize = tableSize + chairSize * 4;
    const center = svgSize / 2;
    const tableRadius = tableSize / 2;

    // Generate chair positions around the table
    const chairs = [];
    const effectiveCapacity = Math.min(capacity, 8);
    for (let i = 0; i < effectiveCapacity; i++) {
        const angle = (2 * Math.PI * i) / effectiveCapacity - Math.PI / 2;
        const chairDistance = tableRadius + chairSize + 4;
        const x = center + Math.cos(angle) * chairDistance;
        const y = center + Math.sin(angle) * chairDistance;
        chairs.push({ x, y, angle: angle + Math.PI / 2 });
    }

    return (
        <svg
            width={svgSize}
            height={svgSize}
            viewBox={`0 0 ${svgSize} ${svgSize}`}
            className={`transition-all duration-200 ${isDragging ? 'opacity-60 scale-110 cursor-grabbing' : 'cursor-grab hover:scale-105'} ${isSelected ? 'drop-shadow-lg' : ''}`}
            onClick={onClick}
        >
            {/* Shadow */}
            <ellipse
                cx={center + 2}
                cy={center + 3}
                rx={tableRadius}
                ry={tableRadius}
                fill="rgba(0,0,0,0.08)"
            />

            {/* Table */}
            <circle
                cx={center}
                cy={center}
                r={tableRadius}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={isSelected ? 3 : 2}
            />

            {/* Chairs */}
            {chairs.map((chair, i) => (
                <g key={i}>
                    {/* Chair shadow */}
                    <rect
                        x={chair.x - chairSize/2 + 1}
                        y={chair.y - chairSize/2 + 1}
                        width={chairSize}
                        height={chairSize}
                        rx={2}
                        fill="rgba(0,0,0,0.06)"
                        transform={`rotate(${(chair.angle * 180) / Math.PI}, ${chair.x + 1}, ${chair.y + 1})`}
                    />
                    {/* Chair */}
                    <rect
                        x={chair.x - chairSize/2}
                        y={chair.y - chairSize/2}
                        width={chairSize}
                        height={chairSize}
                        rx={2}
                        fill={colors.chairFill}
                        stroke={colors.stroke}
                        strokeWidth={1}
                        transform={`rotate(${(chair.angle * 180) / Math.PI}, ${chair.x}, ${chair.y})`}
                    />
                </g>
            ))}

            {/* Table number */}
            <text
                x={center}
                y={center + fontSize / 3}
                textAnchor="middle"
                fill={colors.text}
                fontSize={fontSize}
                fontWeight="bold"
                fontFamily="Inter, system-ui, sans-serif"
            >
                {tableNumber}
            </text>

            {/* Selection ring */}
            {isSelected && (
                <circle
                    cx={center}
                    cy={center}
                    r={tableRadius + chairSize + 8}
                    fill="none"
                    stroke="#ff8c00"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    opacity={0.8}
                />
            )}
        </svg>
    );
};

// Square table with chairs
export const SquareTableSVG = ({
    tableNumber,
    capacity,
    status,
    isSelected,
    onClick,
    size = 'md',
    isDragging
}: TableSVGProps) => {
    const colors = statusColors[status];
    const { table: tableSize, chair: chairSize, fontSize } = sizeMap[size];
    const svgSize = tableSize + chairSize * 4 + 8;
    const center = svgSize / 2;
    const halfTable = tableSize / 2;

    // Chair positions for square table (one on each side)
    const chairPositions = [
        { x: center, y: center - halfTable - chairSize/2 - 4, rotation: 0 }, // top
        { x: center + halfTable + chairSize/2 + 4, y: center, rotation: 90 }, // right
        { x: center, y: center + halfTable + chairSize/2 + 4, rotation: 180 }, // bottom
        { x: center - halfTable - chairSize/2 - 4, y: center, rotation: 270 }, // left
    ];

    const chairs = chairPositions.slice(0, Math.min(capacity, 4));

    return (
        <svg
            width={svgSize}
            height={svgSize}
            viewBox={`0 0 ${svgSize} ${svgSize}`}
            className={`transition-all duration-200 ${isDragging ? 'opacity-60 scale-110 cursor-grabbing' : 'cursor-grab hover:scale-105'} ${isSelected ? 'drop-shadow-lg' : ''}`}
            onClick={onClick}
        >
            {/* Shadow */}
            <rect
                x={center - halfTable + 2}
                y={center - halfTable + 3}
                width={tableSize}
                height={tableSize}
                rx={4}
                fill="rgba(0,0,0,0.08)"
            />

            {/* Table */}
            <rect
                x={center - halfTable}
                y={center - halfTable}
                width={tableSize}
                height={tableSize}
                rx={4}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={isSelected ? 3 : 2}
            />

            {/* Chairs */}
            {chairs.map((chair, i) => (
                <g key={i}>
                    <rect
                        x={chair.x - chairSize/2 + 1}
                        y={chair.y - chairSize/2 + 1}
                        width={chairSize}
                        height={chairSize}
                        rx={2}
                        fill="rgba(0,0,0,0.06)"
                    />
                    <rect
                        x={chair.x - chairSize/2}
                        y={chair.y - chairSize/2}
                        width={chairSize}
                        height={chairSize}
                        rx={2}
                        fill={colors.chairFill}
                        stroke={colors.stroke}
                        strokeWidth={1}
                    />
                </g>
            ))}

            {/* Table number */}
            <text
                x={center}
                y={center + fontSize / 3}
                textAnchor="middle"
                fill={colors.text}
                fontSize={fontSize}
                fontWeight="bold"
                fontFamily="Inter, system-ui, sans-serif"
            >
                {tableNumber}
            </text>

            {/* Selection ring */}
            {isSelected && (
                <rect
                    x={center - halfTable - chairSize - 10}
                    y={center - halfTable - chairSize - 10}
                    width={tableSize + chairSize * 2 + 20}
                    height={tableSize + chairSize * 2 + 20}
                    rx={8}
                    fill="none"
                    stroke="#ff8c00"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    opacity={0.8}
                />
            )}
        </svg>
    );
};

// Rectangular table (for 6+ guests) with chairs on long sides
export const RectangularTableSVG = ({
    tableNumber,
    capacity,
    status,
    isSelected,
    onClick,
    size = 'md',
    isDragging
}: TableSVGProps) => {
    const colors = statusColors[status];
    const { table: baseSize, chair: chairSize, fontSize } = sizeMap[size];
    const tableWidth = baseSize * 1.6;
    const tableHeight = baseSize;
    const svgWidth = tableWidth + chairSize * 4;
    const svgHeight = tableHeight + chairSize * 4;
    const centerX = svgWidth / 2;
    const centerY = svgHeight / 2;

    // Calculate chairs: distribute on long sides
    const chairsPerSide = Math.ceil(Math.min(capacity, 8) / 2);
    const chairs: { x: number; y: number }[] = [];

    // Top side
    for (let i = 0; i < chairsPerSide; i++) {
        const spacing = tableWidth / (chairsPerSide + 1);
        chairs.push({
            x: centerX - tableWidth/2 + spacing * (i + 1),
            y: centerY - tableHeight/2 - chairSize/2 - 4
        });
    }

    // Bottom side
    for (let i = 0; i < Math.min(capacity - chairsPerSide, chairsPerSide); i++) {
        const spacing = tableWidth / (chairsPerSide + 1);
        chairs.push({
            x: centerX - tableWidth/2 + spacing * (i + 1),
            y: centerY + tableHeight/2 + chairSize/2 + 4
        });
    }

    return (
        <svg
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className={`transition-all duration-200 ${isDragging ? 'opacity-60 scale-110 cursor-grabbing' : 'cursor-grab hover:scale-105'} ${isSelected ? 'drop-shadow-lg' : ''}`}
            onClick={onClick}
        >
            {/* Shadow */}
            <rect
                x={centerX - tableWidth/2 + 2}
                y={centerY - tableHeight/2 + 3}
                width={tableWidth}
                height={tableHeight}
                rx={6}
                fill="rgba(0,0,0,0.08)"
            />

            {/* Table */}
            <rect
                x={centerX - tableWidth/2}
                y={centerY - tableHeight/2}
                width={tableWidth}
                height={tableHeight}
                rx={6}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={isSelected ? 3 : 2}
            />

            {/* Chairs */}
            {chairs.map((chair, i) => (
                <g key={i}>
                    <rect
                        x={chair.x - chairSize/2 + 1}
                        y={chair.y - chairSize/2 + 1}
                        width={chairSize}
                        height={chairSize}
                        rx={2}
                        fill="rgba(0,0,0,0.06)"
                    />
                    <rect
                        x={chair.x - chairSize/2}
                        y={chair.y - chairSize/2}
                        width={chairSize}
                        height={chairSize}
                        rx={2}
                        fill={colors.chairFill}
                        stroke={colors.stroke}
                        strokeWidth={1}
                    />
                </g>
            ))}

            {/* Table number */}
            <text
                x={centerX}
                y={centerY + fontSize / 3}
                textAnchor="middle"
                fill={colors.text}
                fontSize={fontSize}
                fontWeight="bold"
                fontFamily="Inter, system-ui, sans-serif"
            >
                {tableNumber}
            </text>

            {/* Selection ring */}
            {isSelected && (
                <rect
                    x={centerX - tableWidth/2 - chairSize - 10}
                    y={centerY - tableHeight/2 - chairSize - 10}
                    width={tableWidth + chairSize * 2 + 20}
                    height={tableHeight + chairSize * 2 + 20}
                    rx={10}
                    fill="none"
                    stroke="#ff8c00"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    opacity={0.8}
                />
            )}
        </svg>
    );
};

// Booth/Sofa seating (U-shaped)
export const BoothTableSVG = ({
    tableNumber,
    capacity,
    status,
    isSelected,
    onClick,
    size = 'md'
}: TableSVGProps) => {
    const colors = statusColors[status];
    const { table: baseSize, fontSize } = sizeMap[size];
    const boothWidth = baseSize * 1.2;
    const boothHeight = baseSize * 0.9;
    const svgWidth = boothWidth + 40;
    const svgHeight = boothHeight + 40;
    const centerX = svgWidth / 2;
    const centerY = svgHeight / 2;
    const boothPadding = 8;

    return (
        <svg
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className={`cursor-pointer transition-all duration-200 ${isSelected ? 'drop-shadow-lg scale-105' : 'hover:scale-102'}`}
            onClick={onClick}
        >
            {/* Booth seating (U-shape) */}
            <path
                d={`
                    M ${centerX - boothWidth/2 + boothPadding} ${centerY - boothHeight/2}
                    L ${centerX - boothWidth/2} ${centerY - boothHeight/2}
                    Q ${centerX - boothWidth/2 - boothPadding} ${centerY - boothHeight/2} ${centerX - boothWidth/2 - boothPadding} ${centerY - boothHeight/2 + boothPadding}
                    L ${centerX - boothWidth/2 - boothPadding} ${centerY + boothHeight/2 - boothPadding}
                    Q ${centerX - boothWidth/2 - boothPadding} ${centerY + boothHeight/2} ${centerX - boothWidth/2} ${centerY + boothHeight/2}
                    L ${centerX + boothWidth/2} ${centerY + boothHeight/2}
                    Q ${centerX + boothWidth/2 + boothPadding} ${centerY + boothHeight/2} ${centerX + boothWidth/2 + boothPadding} ${centerY + boothHeight/2 - boothPadding}
                    L ${centerX + boothWidth/2 + boothPadding} ${centerY - boothHeight/2 + boothPadding}
                    Q ${centerX + boothWidth/2 + boothPadding} ${centerY - boothHeight/2} ${centerX + boothWidth/2} ${centerY - boothHeight/2}
                    L ${centerX + boothWidth/2 - boothPadding} ${centerY - boothHeight/2}
                `}
                fill={colors.chairFill}
                stroke={colors.stroke}
                strokeWidth={1.5}
            />

            {/* Shadow */}
            <rect
                x={centerX - boothWidth/2 + boothPadding + 2}
                y={centerY - boothHeight/2 + boothPadding + 3}
                width={boothWidth - boothPadding * 2}
                height={boothHeight - boothPadding * 2}
                rx={4}
                fill="rgba(0,0,0,0.08)"
            />

            {/* Table inside booth */}
            <rect
                x={centerX - boothWidth/2 + boothPadding}
                y={centerY - boothHeight/2 + boothPadding}
                width={boothWidth - boothPadding * 2}
                height={boothHeight - boothPadding * 2}
                rx={4}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={isSelected ? 3 : 2}
            />

            {/* Table number */}
            <text
                x={centerX}
                y={centerY + fontSize / 3}
                textAnchor="middle"
                fill={colors.text}
                fontSize={fontSize}
                fontWeight="bold"
                fontFamily="Inter, system-ui, sans-serif"
            >
                {tableNumber}
            </text>

            {/* Capacity indicator */}
            <text
                x={centerX}
                y={centerY + fontSize / 3 + fontSize}
                textAnchor="middle"
                fill={colors.text}
                fontSize={fontSize * 0.6}
                opacity={0.7}
                fontFamily="Inter, system-ui, sans-serif"
            >
                {capacity} seats
            </text>

            {/* Selection ring */}
            {isSelected && (
                <rect
                    x={centerX - boothWidth/2 - boothPadding - 8}
                    y={centerY - boothHeight/2 - 8}
                    width={boothWidth + boothPadding * 2 + 16}
                    height={boothHeight + 16}
                    rx={12}
                    fill="none"
                    stroke="#ff8c00"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    opacity={0.8}
                />
            )}
        </svg>
    );
};

// Bar stool (for bar counter seating)
export const BarStoolSVG = ({
    tableNumber,
    status,
    isSelected,
    onClick,
    size = 'sm'
}: Omit<TableSVGProps, 'capacity'>) => {
    const colors = statusColors[status];
    const { chair: stoolSize, fontSize } = sizeMap[size];
    const svgSize = stoolSize * 3;
    const center = svgSize / 2;

    return (
        <svg
            width={svgSize}
            height={svgSize}
            viewBox={`0 0 ${svgSize} ${svgSize}`}
            className={`cursor-pointer transition-all duration-200 ${isSelected ? 'drop-shadow-lg scale-105' : 'hover:scale-102'}`}
            onClick={onClick}
        >
            {/* Shadow */}
            <circle
                cx={center + 1}
                cy={center + 2}
                r={stoolSize}
                fill="rgba(0,0,0,0.1)"
            />

            {/* Stool */}
            <circle
                cx={center}
                cy={center}
                r={stoolSize}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={isSelected ? 2 : 1.5}
            />

            {/* Number */}
            <text
                x={center}
                y={center + fontSize * 0.3}
                textAnchor="middle"
                fill={colors.text}
                fontSize={fontSize * 0.8}
                fontWeight="bold"
                fontFamily="Inter, system-ui, sans-serif"
            >
                {tableNumber}
            </text>

            {/* Selection ring */}
            {isSelected && (
                <circle
                    cx={center}
                    cy={center}
                    r={stoolSize + 6}
                    fill="none"
                    stroke="#ff8c00"
                    strokeWidth={2}
                    strokeDasharray="3 2"
                    opacity={0.8}
                />
            )}
        </svg>
    );
};

// Main TableSVG component that picks the right shape based on capacity
export const TableSVG = (props: TableSVGProps) => {
    const { capacity } = props;

    // Choose table shape based on capacity
    if (capacity <= 2) {
        return <SquareTableSVG {...props} size={props.size || 'sm'} />;
    } else if (capacity <= 4) {
        return <SquareTableSVG {...props} size={props.size || 'md'} />;
    } else if (capacity <= 5) {
        return <RoundTableSVG {...props} size={props.size || 'md'} />;
    } else {
        return <RectangularTableSVG {...props} size={props.size || 'lg'} />;
    }
};

export default TableSVG;
