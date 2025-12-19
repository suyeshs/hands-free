import { useState } from 'react';
import { useFloorPlanStore } from '../../stores/floorPlanStore';
import { IndustrialButton } from '../ui-industrial/IndustrialButton';
import { IndustrialInput } from '../ui-industrial/IndustrialInput';
import { IndustrialCard } from '../ui-industrial/IndustrialCard';
import { QRCodeSVG } from 'qrcode.react';

export const FloorPlanManager = () => {
    const { sections, tables, addSection, removeSection, addTable, removeTable } = useFloorPlanStore();
    const [newSectionName, setNewSectionName] = useState('');
    const [newTableNumber, setNewTableNumber] = useState('');
    const [newTableCapacity, setNewTableCapacity] = useState('4');
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

    const handleAddSection = () => {
        if (newSectionName.trim()) {
            addSection(newSectionName);
            setNewSectionName('');
        }
    };

    const handleAddTable = (sectionId: string) => {
        if (newTableNumber.trim()) {
            addTable(sectionId, newTableNumber, parseInt(newTableCapacity));
            setNewTableNumber('');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-4 items-end bg-white p-4 rounded-lg shadow">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Section Name</label>
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sections.map((section) => {
                    const sectionTables = tables.filter(t => t.sectionId === section.id);
                    return (
                        <IndustrialCard key={section.id} variant="raised" className="bg-white">
                            <div className="flex justify-between items-center mb-4 border-b pb-2">
                                <h3 className="text-xl font-black uppercase">{section.name}</h3>
                                <button
                                    onClick={() => removeSection(section.id)}
                                    className="text-red-500 hover:text-red-700 font-bold px-2"
                                >
                                    DELETE
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">Tables</div>

                                <div className="grid grid-cols-2 gap-2">
                                    {sectionTables.map(table => (
                                        <div key={table.id} className="border-2 border-slate-200 p-2 rounded bg-slate-50 relative group">
                                            <div className="flex justify-between items-start">
                                                <span className="font-black text-lg">#{table.tableNumber}</span>
                                                <span className="text-xs font-bold bg-slate-200 px-1 rounded">👥 {table.capacity}</span>
                                            </div>
                                            <div className="mt-2 flex justify-center bg-white p-1">
                                                <QRCodeSVG value={table.qrCodeUrl} size={64} />
                                            </div>
                                            <button
                                                onClick={() => removeTable(table.id)}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 pt-4 border-t border-slate-100">
                                    <div className="flex gap-2 mb-2">
                                        <input
                                            className="flex-1 border-2 border-slate-300 px-2 py-1 rounded"
                                            placeholder="Table #"
                                            value={selectedSectionId === section.id ? newTableNumber : ''}
                                            onChange={(e) => {
                                                setSelectedSectionId(section.id);
                                                setNewTableNumber(e.target.value);
                                            }}
                                        />
                                        <input
                                            className="w-16 border-2 border-slate-300 px-2 py-1 rounded"
                                            placeholder="Cap"
                                            type="number"
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
                        </IndustrialCard>
                    )
                })}
            </div>
        </div>
    );
};
