import { useState, useEffect } from 'react';
import { useFloorPlanStore } from '../../stores/floorPlanStore';
import { useAuthStore } from '../../stores/authStore';
import { IndustrialButton } from '../ui-industrial/IndustrialButton';
import { IndustrialInput } from '../ui-industrial/IndustrialInput';
import { QRCodeSVG } from 'qrcode.react';

export const FloorPlanManager = () => {
    const { user } = useAuthStore();
    const { sections, tables, addSection, removeSection, addTable, removeTable, loadFloorPlan, isLoading, isLoaded } = useFloorPlanStore();
    const [newSectionName, setNewSectionName] = useState('');
    const [newTableNumber, setNewTableNumber] = useState('');
    const [newTableCapacity, setNewTableCapacity] = useState('4');
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

    const tenantId = user?.tenantId;

    // Load floor plan on mount
    useEffect(() => {
        if (tenantId && !isLoaded && !isLoading) {
            loadFloorPlan(tenantId);
        }
    }, [tenantId, isLoaded, isLoading, loadFloorPlan]);

    const handleAddSection = () => {
        if (newSectionName.trim()) {
            addSection(newSectionName, tenantId);
            setNewSectionName('');
        }
    };

    const handleAddTable = (sectionId: string) => {
        if (newTableNumber.trim()) {
            addTable(sectionId, newTableNumber, parseInt(newTableCapacity), tenantId);
            setNewTableNumber('');
        }
    };

    return (
        <div className="space-y-6">
            {/* Add Section Form */}
            <div className="flex gap-4 items-end glass-panel border border-border p-4 rounded-lg">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-foreground/70 mb-1">New Section Name</label>
                    <IndustrialInput
                        value={newSectionName}
                        onChange={(e) => setNewSectionName(e.target.value)}
                        placeholder="e.g. Patio, Main Hall"
                    />
                </div>
                <IndustrialButton onClick={handleAddSection} size="md">
                    Add Section
                </IndustrialButton>
            </div>

            {/* Sections Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sections.map((section) => {
                    const sectionTables = tables.filter(t => t.sectionId === section.id);
                    return (
                        <div key={section.id} className="glass-panel border border-border rounded-lg p-4">
                            <div className="flex justify-between items-center mb-4 border-b border-border pb-2">
                                <h3 className="text-xl font-black uppercase text-foreground">{section.name}</h3>
                                <button
                                    onClick={() => removeSection(section.id, tenantId)}
                                    className="text-red-400 hover:text-red-300 font-bold px-2 transition-colors"
                                >
                                    DELETE
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="text-sm font-bold text-foreground/50 uppercase tracking-widest mb-2">Tables</div>

                                <div className="grid grid-cols-2 gap-2">
                                    {sectionTables.map(table => (
                                        <div key={table.id} className="border border-border p-2 rounded-lg bg-accent/20 relative group">
                                            <div className="flex justify-between items-start">
                                                <span className="font-black text-lg text-foreground">#{table.tableNumber}</span>
                                                <span className="text-xs font-bold bg-accent/40 text-foreground/80 px-1.5 py-0.5 rounded">👥 {table.capacity}</span>
                                            </div>
                                            <div className="mt-2 flex justify-center bg-white/90 p-1.5 rounded">
                                                <QRCodeSVG value={table.qrCodeUrl} size={64} />
                                            </div>
                                            <button
                                                onClick={() => removeTable(table.id, tenantId)}
                                                className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-400 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 pt-4 border-t border-border">
                                    <div className="flex gap-2 mb-2">
                                        <input
                                            className="input-neo flex-1"
                                            placeholder="1, 2, 3..."
                                            type="number"
                                            min="1"
                                            value={selectedSectionId === section.id ? newTableNumber : ''}
                                            onChange={(e) => {
                                                setSelectedSectionId(section.id);
                                                setNewTableNumber(e.target.value);
                                            }}
                                        />
                                        <input
                                            className="input-neo w-20"
                                            placeholder="Cap"
                                            type="number"
                                            min="1"
                                            value={selectedSectionId === section.id ? newTableCapacity : '4'}
                                            onChange={(e) => {
                                                setSelectedSectionId(section.id);
                                                setNewTableCapacity(e.target.value);
                                            }}
                                        />
                                    </div>
                                    <IndustrialButton
                                        fullWidth
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleAddTable(section.id)}
                                        disabled={selectedSectionId !== section.id || !newTableNumber}
                                    >
                                        + Add Table
                                    </IndustrialButton>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};
