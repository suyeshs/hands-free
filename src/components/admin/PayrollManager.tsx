import { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { usePayrollStore, StaffPayslip } from '../../stores/payrollStore';
import { useStaffStore } from '../../stores/staffStore';

interface PayrollManagerProps {
    tenantId?: string;
}

export const PayrollManager = ({ tenantId }: PayrollManagerProps) => {
    const {
        advances,
        payslips,
        loadAdvances,
        loadPayslips,
        loadSalaries,
        loadDeductions,
        loadBonuses,
        addAdvance,
        generatePayslip,
        updatePayslip,
    } = usePayrollStore();

    const { staff, loadStaffFromDatabase } = useStaffStore();

    const [activeTab, setActiveTab] = useState<'advances' | 'payslips'>('advances');
    const [isAdvanceFormOpen, setIsAdvanceFormOpen] = useState(false);
    const [isPayslipDetailsOpen, setIsPayslipDetailsOpen] = useState(false);
    const [selectedPayslip, setSelectedPayslip] = useState<StaffPayslip | null>(null);
    const [selectedStaffId, setSelectedStaffId] = useState<string>('');

    // Advance form state
    const [advanceForm, setAdvanceForm] = useState({
        staffId: '',
        amount: 0,
        reason: '',
        installments: 1,
    });

    // Payslip generation state
    const [payslipMonth, setPayslipMonth] = useState<string>('');

    useEffect(() => {
        if (tenantId) {
            loadStaffFromDatabase(tenantId);
            loadAdvances(tenantId);
            loadPayslips(tenantId);
            loadSalaries(tenantId);
            loadDeductions(tenantId);
            loadBonuses(tenantId);
        }
    }, [tenantId, loadStaffFromDatabase, loadAdvances, loadPayslips, loadSalaries, loadDeductions, loadBonuses]);

    const handleAddAdvance = async () => {
        if (!advanceForm.staffId || advanceForm.amount <= 0) {
            alert('Please select a staff member and enter a valid amount');
            return;
        }

        try {
            const today = new Date().toISOString().split('T')[0];
            const currentMonth = new Date().toISOString().substring(0, 7);

            await addAdvance({
                staffId: advanceForm.staffId,
                amount: advanceForm.amount,
                reason: advanceForm.reason,
                advanceDate: today,
                repaymentStartMonth: currentMonth,
                installments: advanceForm.installments,
                installmentsPaid: 0,
                status: 'active',
            });

            setIsAdvanceFormOpen(false);
            setAdvanceForm({ staffId: '', amount: 0, reason: '', installments: 1 });
        } catch (error) {
            console.error('Failed to add advance:', error);
            alert('Failed to add advance');
        }
    };

    const handleGeneratePayslip = async () => {
        if (!selectedStaffId || !payslipMonth) {
            alert('Please select a staff member and month');
            return;
        }

        try {
            const payslip = await generatePayslip(selectedStaffId, payslipMonth);
            setSelectedPayslip(payslip);
            setIsPayslipDetailsOpen(true);
        } catch (error) {
            console.error('Failed to generate payslip:', error);
            alert('Failed to generate payslip: ' + (error as Error).message);
        }
    };

    const handleMarkPayslipPaid = async (payslipId: string, paymentMethod: 'cash' | 'bank_transfer' | 'cheque' | 'upi') => {
        try {
            await updatePayslip(payslipId, {
                status: 'paid',
                paidDate: new Date().toISOString().split('T')[0],
                paymentMethod,
            });
            setIsPayslipDetailsOpen(false);
        } catch (error) {
            console.error('Failed to update payslip:', error);
            alert('Failed to update payslip');
        }
    };

    const getStaffName = (staffId: string) => {
        const member = staff.find(s => s.id === staffId);
        return member?.name || 'Unknown';
    };

    const filteredAdvances = selectedStaffId
        ? advances.filter(a => a.staffId === selectedStaffId)
        : advances;

    const filteredPayslips = selectedStaffId
        ? payslips.filter(p => p.staffId === selectedStaffId)
        : payslips;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="glass-panel p-6 rounded-2xl border border-border">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-accent/20 flex items-center justify-center text-2xl">
                            💰
                        </div>
                        <div>
                            <h2 className="text-xl font-black uppercase tracking-tight">Payroll Management</h2>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                                Advances, Salary & Payslips
                            </p>
                        </div>
                    </div>
                </div>

                {/* Staff Filter */}
                <div className="flex gap-3">
                    <select
                        value={selectedStaffId}
                        onChange={(e) => setSelectedStaffId(e.target.value)}
                        className="flex-1 bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                    >
                        <option value="">All Staff Members</option>
                        {staff.filter(s => s.isActive).map(member => (
                            <option key={member.id} value={member.id}>
                                {member.name} - {member.role}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-border">
                <button
                    onClick={() => setActiveTab('advances')}
                    className={cn(
                        "px-6 py-3 text-xs font-black uppercase tracking-widest transition-all",
                        activeTab === 'advances'
                            ? "text-accent border-b-2 border-accent"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    Advances ({filteredAdvances.length})
                </button>
                <button
                    onClick={() => setActiveTab('payslips')}
                    className={cn(
                        "px-6 py-3 text-xs font-black uppercase tracking-widest transition-all",
                        activeTab === 'payslips'
                            ? "text-accent border-b-2 border-accent"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    Payslips ({filteredPayslips.length})
                </button>
            </div>

            {/* Advances Tab */}
            {activeTab === 'advances' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button
                            onClick={() => setIsAdvanceFormOpen(true)}
                            className="px-6 py-3 bg-accent text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-accent/20 hover:scale-105 active:scale-95 transition-all"
                        >
                            + New Advance
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredAdvances.map((advance) => (
                            <div
                                key={advance.id}
                                className={cn(
                                    "glass-panel p-5 rounded-2xl border transition-all",
                                    advance.status === 'active' ? "border-green-500/30" :
                                    advance.status === 'completed' ? "border-blue-500/30" :
                                    "border-border"
                                )}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-bold text-lg">{getStaffName(advance.staffId)}</h3>
                                        <p className="text-xs text-muted-foreground">{advance.advanceDate}</p>
                                    </div>
                                    <div className={cn(
                                        "px-3 py-1 rounded-full text-[10px] font-black uppercase",
                                        advance.status === 'active' ? "bg-green-500/20 text-green-300" :
                                        advance.status === 'completed' ? "bg-blue-500/20 text-blue-300" :
                                        advance.status === 'pending' ? "bg-yellow-500/20 text-yellow-300" :
                                        "bg-red-500/20 text-red-300"
                                    )}>
                                        {advance.status}
                                    </div>
                                </div>

                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Amount:</span>
                                        <span className="font-bold text-accent">₹{advance.amount.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Installments:</span>
                                        <span className="font-bold">{advance.installmentsPaid} / {advance.installments}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Per Month:</span>
                                        <span className="font-bold">₹{(advance.amount / advance.installments).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Remaining:</span>
                                        <span className="font-bold text-orange-400">
                                            ₹{((advance.amount / advance.installments) * (advance.installments - advance.installmentsPaid)).toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                {advance.reason && (
                                    <div className="bg-white/5 p-3 mb-3">
                                        <p className="text-xs text-muted-foreground mb-1 font-bold uppercase">Reason:</p>
                                        <p className="text-sm">{advance.reason}</p>
                                    </div>
                                )}

                                {/* Progress Bar */}
                                <div className="mt-3">
                                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-accent transition-all"
                                            style={{ width: `${(advance.installmentsPaid / advance.installments) * 100}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                        {Math.round((advance.installmentsPaid / advance.installments) * 100)}% Repaid
                                    </p>
                                </div>
                            </div>
                        ))}

                        {filteredAdvances.length === 0 && (
                            <div className="col-span-full glass-panel p-12 rounded-2xl border border-border border-dashed text-center">
                                <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                                    <span className="text-4xl">💵</span>
                                </div>
                                <p className="text-xl font-bold text-muted-foreground">No Advances</p>
                                <p className="text-sm text-muted-foreground">Start by providing an advance to a staff member</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Payslips Tab */}
            {activeTab === 'payslips' && (
                <div className="space-y-4">
                    <div className="glass-panel p-6 rounded-2xl border border-border">
                        <h3 className="text-xs font-black uppercase text-accent tracking-widest mb-4">Generate New Payslip</h3>
                        <div className="flex gap-3">
                            <select
                                value={selectedStaffId}
                                onChange={(e) => setSelectedStaffId(e.target.value)}
                                className="flex-1 bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                            >
                                <option value="">Select Staff Member</option>
                                {staff.filter(s => s.isActive).map(member => (
                                    <option key={member.id} value={member.id}>
                                        {member.name}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="month"
                                value={payslipMonth}
                                onChange={(e) => setPayslipMonth(e.target.value)}
                                className="bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                            />
                            <button
                                onClick={handleGeneratePayslip}
                                disabled={!selectedStaffId || !payslipMonth}
                                className="px-6 py-3 bg-accent text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-accent/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Generate
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {filteredPayslips.map((payslip) => (
                            <div
                                key={payslip.id}
                                className="glass-panel p-5 rounded-2xl border border-border hover:border-accent/30 transition-all cursor-pointer"
                                onClick={() => {
                                    setSelectedPayslip(payslip);
                                    setIsPayslipDetailsOpen(true);
                                }}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-lg">{getStaffName(payslip.staffId)}</h3>
                                        <p className="text-xs text-muted-foreground">{payslip.month}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-xs text-muted-foreground">Net Salary</p>
                                            <p className="text-2xl font-black text-accent">₹{payslip.netSalary.toLocaleString()}</p>
                                        </div>
                                        <div className={cn(
                                            "px-3 py-1 rounded-full text-[10px] font-black uppercase",
                                            payslip.status === 'paid' ? "bg-green-500/20 text-green-300" :
                                            payslip.status === 'processed' ? "bg-blue-500/20 text-blue-300" :
                                            "bg-yellow-500/20 text-yellow-300"
                                        )}>
                                            {payslip.status}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {filteredPayslips.length === 0 && (
                            <div className="glass-panel p-12 rounded-2xl border border-border border-dashed text-center">
                                <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                                    <span className="text-4xl">📄</span>
                                </div>
                                <p className="text-xl font-bold text-muted-foreground">No Payslips</p>
                                <p className="text-sm text-muted-foreground">Generate a payslip to get started</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Advance Form Modal */}
            {isAdvanceFormOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="glass-panel w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden">
                        <div className="bg-accent/10 border-b border-border p-6 flex justify-between items-center">
                            <h3 className="text-xl font-black uppercase tracking-tight">Provide Advance</h3>
                            <button
                                onClick={() => setIsAdvanceFormOpen(false)}
                                className="w-10 h-10 bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                            >
                                <span className="text-2xl leading-none">&times;</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                                    Staff Member
                                </label>
                                <select
                                    value={advanceForm.staffId}
                                    onChange={(e) => setAdvanceForm({ ...advanceForm, staffId: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                                >
                                    <option value="">Select staff member</option>
                                    {staff.filter(s => s.isActive).map(member => (
                                        <option key={member.id} value={member.id}>
                                            {member.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                                        Amount (₹)
                                    </label>
                                    <input
                                        type="number"
                                        value={advanceForm.amount || ''}
                                        onChange={(e) => setAdvanceForm({ ...advanceForm, amount: parseFloat(e.target.value) || 0 })}
                                        placeholder="5000"
                                        min="0"
                                        step="100"
                                        className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                                        Installments
                                    </label>
                                    <input
                                        type="number"
                                        value={advanceForm.installments || ''}
                                        onChange={(e) => setAdvanceForm({ ...advanceForm, installments: parseInt(e.target.value) || 1 })}
                                        placeholder="3"
                                        min="1"
                                        max="12"
                                        className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                                    Reason (Optional)
                                </label>
                                <textarea
                                    value={advanceForm.reason}
                                    onChange={(e) => setAdvanceForm({ ...advanceForm, reason: e.target.value })}
                                    placeholder="Emergency, festival advance, etc."
                                    rows={3}
                                    className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                                />
                            </div>

                            {advanceForm.amount > 0 && advanceForm.installments > 0 && (
                                <div className="bg-blue-500/10 border border-blue-500/20 p-3">
                                    <p className="text-xs text-blue-300">
                                        <strong>Monthly deduction:</strong> ₹{(advanceForm.amount / advanceForm.installments).toFixed(2)} for {advanceForm.installments} month{advanceForm.installments > 1 ? 's' : ''}
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setIsAdvanceFormOpen(false)}
                                    className="flex-1 py-3 bg-white/5 border border-white/10 text-muted-foreground font-bold uppercase tracking-widest text-xs hover:bg-white/10 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddAdvance}
                                    className="flex-1 py-3 bg-accent text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-95 transition-all"
                                >
                                    Provide Advance
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Payslip Details Modal */}
            {isPayslipDetailsOpen && selectedPayslip && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="glass-panel w-full max-w-2xl rounded-2xl border border-border shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                        <div className="bg-accent/10 border-b border-border p-6 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tight">Payslip Details</h3>
                                <p className="text-xs text-muted-foreground">{getStaffName(selectedPayslip.staffId)} - {selectedPayslip.month}</p>
                            </div>
                            <button
                                onClick={() => setIsPayslipDetailsOpen(false)}
                                className="w-10 h-10 bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                            >
                                <span className="text-2xl leading-none">&times;</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Earnings */}
                            <div>
                                <h4 className="text-xs font-black uppercase text-green-400 tracking-widest mb-3">Earnings</h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-sm">Base Salary:</span>
                                        <span className="font-bold">₹{selectedPayslip.baseSalary.toLocaleString()}</span>
                                    </div>
                                    {selectedPayslip.overtimePay > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-sm">Overtime Pay:</span>
                                            <span className="font-bold text-green-400">+₹{selectedPayslip.overtimePay.toLocaleString()}</span>
                                        </div>
                                    )}
                                    {selectedPayslip.bonuses > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-sm">Bonuses:</span>
                                            <span className="font-bold text-green-400">+₹{selectedPayslip.bonuses.toLocaleString()}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between pt-2 border-t border-border">
                                        <span className="text-sm font-bold">Gross Salary:</span>
                                        <span className="font-black text-lg text-accent">₹{selectedPayslip.grossSalary.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Deductions */}
                            {(selectedPayslip.advancesDeducted > 0 || selectedPayslip.otherDeductions > 0) && (
                                <div>
                                    <h4 className="text-xs font-black uppercase text-red-400 tracking-widest mb-3">Deductions</h4>
                                    <div className="space-y-2">
                                        {selectedPayslip.advancesDeducted > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-sm">Advance Repayment:</span>
                                                <span className="font-bold text-red-400">-₹{selectedPayslip.advancesDeducted.toLocaleString()}</span>
                                            </div>
                                        )}
                                        {selectedPayslip.otherDeductions > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-sm">Other Deductions:</span>
                                                <span className="font-bold text-red-400">-₹{selectedPayslip.otherDeductions.toLocaleString()}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Net Salary */}
                            <div className="bg-accent/10 p-6 border border-accent/30">
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-black uppercase">Net Salary:</span>
                                    <span className="text-3xl font-black text-accent">₹{selectedPayslip.netSalary.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Attendance Info */}
                            {(selectedPayslip.daysWorked || selectedPayslip.hoursWorked) && (
                                <div>
                                    <h4 className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-3">Attendance</h4>
                                    <div className="space-y-2">
                                        {selectedPayslip.daysWorked && (
                                            <div className="flex justify-between">
                                                <span className="text-sm">Days Worked:</span>
                                                <span className="font-bold">{selectedPayslip.daysWorked} days</span>
                                            </div>
                                        )}
                                        {selectedPayslip.hoursWorked && (
                                            <div className="flex justify-between">
                                                <span className="text-sm">Hours Worked:</span>
                                                <span className="font-bold">{selectedPayslip.hoursWorked.toFixed(2)} hrs</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Payment Actions */}
                            {selectedPayslip.status !== 'paid' && (
                                <div className="pt-4 border-t border-border">
                                    <h4 className="text-xs font-black uppercase text-accent tracking-widest mb-3">Mark as Paid</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => handleMarkPayslipPaid(selectedPayslip.id, 'cash')}
                                            className="py-3 bg-green-500/20 border border-green-500/30 text-green-300 font-bold uppercase tracking-widest text-xs hover:bg-green-500/30 transition-colors"
                                        >
                                            💵 Cash
                                        </button>
                                        <button
                                            onClick={() => handleMarkPayslipPaid(selectedPayslip.id, 'bank_transfer')}
                                            className="py-3 bg-blue-500/20 border border-blue-500/30 text-blue-300 font-bold uppercase tracking-widest text-xs hover:bg-blue-500/30 transition-colors"
                                        >
                                            🏦 Bank Transfer
                                        </button>
                                        <button
                                            onClick={() => handleMarkPayslipPaid(selectedPayslip.id, 'upi')}
                                            className="py-3 bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold uppercase tracking-widest text-xs hover:bg-purple-500/30 transition-colors"
                                        >
                                            📱 UPI
                                        </button>
                                        <button
                                            onClick={() => handleMarkPayslipPaid(selectedPayslip.id, 'cheque')}
                                            className="py-3 bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 font-bold uppercase tracking-widest text-xs hover:bg-yellow-500/30 transition-colors"
                                        >
                                            📝 Cheque
                                        </button>
                                    </div>
                                </div>
                            )}

                            {selectedPayslip.status === 'paid' && (
                                <div className="bg-green-500/10 border border-green-500/20 p-4">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">✅</span>
                                        <div>
                                            <p className="font-bold text-green-300">Payment Completed</p>
                                            <p className="text-xs text-muted-foreground">
                                                Paid on {selectedPayslip.paidDate} via {selectedPayslip.paymentMethod?.replace('_', ' ').toUpperCase()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
