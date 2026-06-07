import { useState, useEffect, useRef, forwardRef, useImperativeHandle, useContext } from "react";
import { Link } from "react-router-dom";
import ThemeSelector from "../../components/ThemeSelector";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import "./Dashboard.css";
import "../../components/common/Buttons.css";
import { Line, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement,
    LineElement, Title, Tooltip, Legend, Filler, ArcElement
} from 'chart.js';
import { ResponsiveContainer, AreaChart, Area, PieChart, Pie as RechartsPie, Cell, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Line as RechartsLine } from 'recharts';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, ArcElement);

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const AdminExpenses = forwardRef((props, ref) => {
    const { user } = useContext(AuthContext);

    // Tab state
    const [activeTab, setActiveTab] = useState("expenses");

    // —— Expenses state ——
    const [loading, setLoading] = useState(true);
    const [expenses, setExpenses] = useState([]);
    const [stats, setStats] = useState({
        totalExpense: 0,
        totalIncome: 0,
        profitLoss: 0,
        burnRate: 0
    });
    const [chartDataState, setChartDataState] = useState(null);
    const [chartGranularity, setChartGranularity] = useState('Daily');
    const [filterPeriod, setFilterPeriod] = useState("current_month");
    const [filterDateValue, setFilterDateValue] = useState("");
    const [filterCategory, setFilterCategory] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const chartRef = useRef(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [formData, setFormData] = useState({
        title: "",
        category: "Rent",
        amount: "",
        date: new Date().toISOString().split('T')[0],
        description: ""
    });

    // —— Transport Fees state ——
    const [transportFees, setTransportFees] = useState([]);
    const [transportLoading, setTransportLoading] = useState(false);
    const [showTransportModal, setShowTransportModal] = useState(false);
    const [editingTransport, setEditingTransport] = useState(null);
    const [transportForm, setTransportForm] = useState({ route_name: "", fee_amount: "" });
    const [transportError, setTransportError] = useState("");

    // —— Check permissions ——
    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
    const hasPerm = (op) => {
        if (isAdmin) return true;
        if (user?.role === 'manager' && user.permissions) {
            return user.permissions.includes('expenses') || user.permissions.includes(`expenses.${op}`);
        }
        return false;
    };
    const hasExpensePerm = hasPerm('read');
    const canCreate = hasPerm('create');
    const canDelete = hasPerm('delete');
    const hasTransportPerm = isAdmin || (user?.permissions && user.permissions.includes('transport'));

    useEffect(() => {
        if (activeTab === "expenses") {
            const timer = setTimeout(() => fetchExpensesData(), 300);
            return () => clearTimeout(timer);
        } else {
            fetchTransportFees();
        }
    }, [activeTab, filterPeriod, filterDateValue]);

    // ——————————————————— EXPENSES ———————————————————

    const fetchExpensesData = async () => {
        try {
            setLoading(true);
            let query = `?period=${filterPeriod}`;
            if (filterDateValue) query += `&dateValue=${filterDateValue}`;

            const [statsRes, expensesRes] = await Promise.all([
                api.get(`/expenses/stats${query}`),
                api.get(`/expenses${query}`)
            ]);

            if (statsRes.data.success) {
                setStats(statsRes.data.stats);
                if (statsRes.data.chartData) {
                    const sortedData = statsRes.data.chartData;
                    setChartDataState({
                        labels: sortedData.map(d => d.month),
                        datasets: [
                            {
                                label: 'Income (₹)',
                                data: sortedData.map(d => d.income),
                                borderColor: '#10b981',
                                backgroundColor: 'rgba(16,185,129,0.1)',
                                fill: true,
                                tension: 0.4
                            },
                            {
                                label: 'Expenses (₹)',
                                data: sortedData.map(d => d.expense),
                                borderColor: '#ef4444',
                                backgroundColor: 'rgba(239,68,68,0.1)',
                                fill: true,
                                tension: 0.4
                            }
                        ]
                    });
                }
            }
            if (expensesRes.data.success) setExpenses(expensesRes.data.expenses);
        } catch (error) {
            console.error("Error fetching expenses data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleAddExpense = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post("/expenses", formData);
            if (res.data.success) {
                setShowAddModal(false);
                setFormData({ title: "", category: "Rent", amount: "", date: new Date().toISOString().split('T')[0], description: "" });
                fetchExpensesData();
            }
        } catch (error) {
            alert(error.response?.data?.message || "Failed to add expense.");
        }
    };

    const handleDeleteExpense = async (id) => {
        if (!window.confirm("Are you sure you want to delete this expense?")) return;
        try {
            await api.delete(`/expenses/${id}`);
            fetchExpensesData();
        } catch (error) {
            alert("Failed to delete expense.");
        }
    };

    // ——————————————————— TRANSPORT FEES ———————————————————

    const fetchTransportFees = async () => {
        try {
            setTransportLoading(true);
            const res = await api.get("/transport-fees");
            if (res.data.success) setTransportFees(res.data.data);
        } catch (err) {
            console.error("Error fetching transport fees:", err);
        } finally {
            setTransportLoading(false);
        }
    };

    const handleTransportFormChange = (e) =>
        setTransportForm({ ...transportForm, [e.target.name]: e.target.value });

    const handleSaveTransport = async (e) => {
        e.preventDefault();
        setTransportError("");
        if (!transportForm.route_name.trim() || !transportForm.fee_amount) {
            setTransportError("Route name and fee amount are required.");
            return;
        }
        try {
            if (editingTransport) {
                await api.put(`/transport-fees/${editingTransport.id}`, transportForm);
            } else {
                await api.post("/transport-fees", transportForm);
            }
            setShowTransportModal(false);
            setEditingTransport(null);
            setTransportForm({ route_name: "", fee_amount: "" });
            fetchTransportFees();
        } catch (err) {
            setTransportError(err.response?.data?.message || "Failed to save transport fee.");
        }
    };

    const handleDeleteTransport = async (id) => {
        if (!window.confirm("Delete this transport route?")) return;
        try {
            await api.delete(`/transport-fees/${id}`);
            fetchTransportFees();
        } catch (err) {
            alert("Failed to delete transport fee.");
        }
    };

    const openEditTransport = (fee) => {
        setEditingTransport(fee);
        setTransportForm({ route_name: fee.route_name, fee_amount: fee.fee_amount });
        setTransportError("");
        setShowTransportModal(true);
    };

    // ——————————————————— EXPORT ———————————————————

    const handleExportPDF = () => {
        const doc = new jsPDF('landscape');
        doc.text("Institute Finances Report", 14, 15);
        let startY = 25;

        if (chartRef.current) {
            try {
                const chartImg = chartRef.current.toBase64Image();
                if (chartImg) { doc.addImage(chartImg, 'PNG', 14, startY, 260, 100); startY += 110; }
            } catch (_) { }
        }

        if (expenses.length > 0) {
            doc.text("Expenses", 14, startY);
            startY += 8;
            autoTable(doc, {
                head: [["Date", "Title", "Category", "Amount (₹)", "Description"]],
                body: expenses.map(e => [
                    new Date(e.date).toLocaleDateString(), e.title, e.category,
                    parseFloat(e.amount).toLocaleString(), e.description || "-"
                ]),
                startY
            });
        }
        doc.save("institute_finances.pdf");
    };

    const handleExportExcel = () => {
        if (!expenses.length) { alert("No data to export."); return; }
        const ws = XLSX.utils.aoa_to_sheet([
            ["Date", "Title", "Category", "Amount (₹)", "Description"],
            ...expenses.map(e => [new Date(e.date).toLocaleDateString(), e.title, e.category, parseFloat(e.amount), e.description || ""])
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Expenses");
        XLSX.writeFile(wb, "institute_finances.xlsx");
    };

    useImperativeHandle(ref, () => ({ handleExportPDF, handleExportExcel }));

    // ——————————————————— COMPUTATIONS ———————————————————
    
    // Daily Average
    const getDaysInPeriod = () => {
        if (filterPeriod === 'month' && filterDateValue) {
            const [y, m] = filterDateValue.split('-');
            return new Date(y, m, 0).getDate();
        }
        if (filterPeriod === 'year') return 365;
        if (filterPeriod === 'all') return Math.max(365, expenses.length);
        return new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    };
    const dailyAvg = stats.totalExpense / getDaysInPeriod();
    
    // Highest Expense
    const maxExp = expenses.length ? Math.max(...expenses.map(e => parseFloat(e.amount))) : 0;
    const maxExpEntry = expenses.find(e => parseFloat(e.amount) === maxExp);

    // Donut Chart Data
    const categorySums = expenses.reduce((acc, exp) => {
        acc[exp.category] = (acc[exp.category] || 0) + parseFloat(exp.amount);
        return acc;
    }, {});
    const sortedCats = Object.entries(categorySums).sort((a,b)=>b[1]-a[1]).slice(0, 5);
    const catColorsPie = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
    const donutData = {
        labels: sortedCats.map(c => c[0]),
        datasets: [{
            data: sortedCats.map(c => c[1]),
            backgroundColor: catColorsPie,
            borderWidth: 0,
            hoverOffset: 4
        }]
    };

    // Chart Display Data Aggregation
    let displayChartData = null;
    if (chartDataState) {
        if (chartGranularity === 'Monthly' && chartDataState.labels.length > 12) {
            const aggregated = {};
            chartDataState.labels.forEach((label, idx) => {
                const parts = label.split(' ');
                const month = parts.length > 1 ? parts[1] : label;
                if (!aggregated[month]) aggregated[month] = 0;
                aggregated[month] += chartDataState.datasets[1].data[idx];
            });
            displayChartData = {
                labels: Object.keys(aggregated),
                datasets: [{ ...chartDataState.datasets[1], data: Object.values(aggregated) }]
            };
        } else {
            displayChartData = {
                labels: chartDataState.labels,
                datasets: [chartDataState.datasets[1]]
            };
        }
    }

    // Filtered Expenses
    const filteredExpenses = expenses.filter(e => {
        const matchCat = filterCategory ? e.category === filterCategory : true;
        const matchSearch = e.title.toLowerCase().includes(searchTerm.toLowerCase());
        return matchCat && matchSearch;
    });

    const categoriesList = [...new Set(expenses.map(e => e.category))];

    // Colors Helpers
    const catColors = {
        'Xerox': { bg: '#fee2e2', col: '#ef4444' },
        'Electricity': { bg: '#dbeafe', col: '#3b82f6' },
        'Stationery': { bg: '#d1fae5', col: '#10b981' },
        'Rent': { bg: '#f3e8ff', col: '#7e22ce' },
        'Faculty Salary': { bg: '#fef3c7', col: '#f59e0b' },
        'Internet': { bg: '#e0e7ff', col: '#4f46e5' },
    };
    const getCatColor = (c) => catColors[c] || { bg: '#f3f4f6', col: '#4b5563' };

    const paymentMethods = ['Cash', 'Online', 'Card'];
    const pmColors = {
        'Cash': { bg: '#d1fae5', col: '#10b981', dot: '₹' },
        'Online': { bg: '#dbeafe', col: '#3b82f6', dot: '🌐' },
        'Card': { bg: '#f3e8ff', col: '#7e22ce', dot: '💳' }
    };
    const getFakePaymentMethod = (id) => {
        let sum = 0;
        if(id) { for(let i=0; i<id.length; i++) sum += id.charCodeAt(i); }
        return paymentMethods[sum % 3];
    };


    // ——————————————————— RENDER ———————————————————

    return (
        <div className={props.isReportMode ? "" : "dashboard-container"} style={{ background: '#f9fafb', minHeight: '100vh', padding: '2rem' }}>
            {/* Header */}
            {!props.isReportMode && (
                <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: activeTab === 'expenses' ? '#f3f4f6' : '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                            {activeTab === 'expenses' ? '📊' : '🚌'}
                        </div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#111827', fontWeight: '800' }}>{activeTab === 'expenses' ? 'Expenses' : 'Transport Fees'}</h1>
                            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.95rem' }}>{activeTab === 'expenses' ? 'Track and manage all expenses of the institution.' : 'Manage bus routes and their monthly fee amounts. Students can be assigned to routes.'}</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {activeTab === "expenses" ? (
                            <>
                                <button onClick={handleExportPDF} style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                    <span style={{ color: '#ef4444' }}>📄</span> Export PDF
                                </button>
                                <button onClick={handleExportExcel} style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                    <span style={{ color: '#10b981' }}>📊</span> Export Excel
                                </button>
                                {canCreate && (
                                    <button onClick={() => setShowAddModal(true)} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', background: '#7e22ce', color: '#fff', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 6px rgba(126,34,206,0.2)' }}>
                                        + Add Expense
                                    </button>
                                )}
                            </>
                        ) : (
                            <>
                                <button style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                    <span style={{ color: '#10b981' }}>📊</span> Export Excel
                                </button>
                                {hasTransportPerm && (
                                    <button onClick={() => { setEditingTransport(null); setTransportForm({ route_name: "", fee_amount: "" }); setTransportError(""); setShowTransportModal(true); }} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', background: '#7e22ce', color: '#fff', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 6px rgba(126,34,206,0.2)' }}>
                                        + Add Route
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid #e5e7eb', marginBottom: '1.5rem', paddingBottom: '0' }}>
                {hasExpensePerm && (
                    <div 
                        style={{ color: activeTab === 'expenses' ? '#7e22ce' : '#6b7280', fontWeight: activeTab === 'expenses' ? '600' : '500', borderBottom: activeTab === 'expenses' ? '2px solid #7e22ce' : '2px solid transparent', paddingBottom: '0.75rem', marginBottom: '-1px', cursor: 'pointer', transition: 'all 0.2s' }} 
                        onClick={() => setActiveTab('expenses')}
                    >
                        Overview
                    </div>
                )}
                {(hasTransportPerm || isAdmin) && (
                    <div 
                        style={{ color: activeTab === 'transport' ? '#7e22ce' : '#6b7280', fontWeight: activeTab === 'transport' ? '600' : '500', borderBottom: activeTab === 'transport' ? '2px solid #7e22ce' : '2px solid transparent', paddingBottom: '0.75rem', marginBottom: '-1px', cursor: 'pointer', transition: 'all 0.2s' }} 
                        onClick={() => setActiveTab('transport')}
                    >
                        Students by Route
                    </div>
                )}
            </div>

            {/* ════════════════ EXPENSES TAB ════════════════ */}
            {activeTab === "expenses" && (
                <div>
                    {/* Advanced Filters Row */}
                    <div style={{ display: 'flex', gap: '1rem', background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: '150px' }}>
                            <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Period</label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}>📅</span>
                                <select className="form-select" style={{ fontSize: 13, paddingLeft: 30 }} value={filterPeriod} onChange={(e) => { setFilterPeriod(e.target.value); setFilterDateValue(""); }}>
                                    <option value="current_month">Current Month</option>
                                    <option value="month">Specific Month</option>
                                    <option value="year">Specific Year</option>
                                    <option value="all">All Time</option>
                                </select>
                            </div>
                        </div>
                        
                        {(filterPeriod === 'month' || filterPeriod === 'year') && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: '150px' }}>
                                <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{filterPeriod === 'month' ? 'Month' : 'Year'}</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}>📅</span>
                                    {filterPeriod === 'month' ? (
                                        <input type="month" className="form-input" style={{ fontSize: 13, paddingLeft: 30 }} value={filterDateValue} onChange={(e) => setFilterDateValue(e.target.value)} />
                                    ) : (
                                        <input type="number" placeholder="YYYY" className="form-input" style={{ fontSize: 13, paddingLeft: 30 }} value={filterDateValue} onChange={(e) => setFilterDateValue(e.target.value)} />
                                    )}
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: '150px' }}>
                            <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Category</label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#f59e0b', pointerEvents: 'none' }}>📁</span>
                                <select className="form-select" style={{ fontSize: 13, paddingLeft: 30 }} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                                    <option value="">All Categories</option>
                                    {categoriesList.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: '150px' }}>
                            <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Route</label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}>🚌</span>
                                <select className="form-select" style={{ fontSize: 13, paddingLeft: 30 }}>
                                    <option value="">All Routes</option>
                                    <option value="R1">Route A</option>
                                    <option value="R2">Route B</option>
                                </select>
                            </div>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', flex: 1, justifyContent: 'flex-end', minWidth: '220px' }}>
                            <button onClick={() => {setFilterCategory(""); setFilterPeriod("current_month"); setFilterDateValue("");}} style={{ background: 'transparent', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                🔄 Reset
                            </button>
                            <button onClick={() => fetchExpensesData()} className="btn btn-secondary" style={{ padding: '0.65rem 1.25rem', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, background: '#fff', color: '#7e22ce', borderColor: '#e9d5ff' }}>
                                ⚡ Advanced Filters
                            </button>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', marginBottom: '1.5rem' }}>
                        {/* Total Expenses */}
                        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '1rem' }}>
                                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#ffe4e6', color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>👛</div>
                                <div>
                                    <div style={{ color: '#111827', fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>₹{stats.totalExpense?.toLocaleString() || 0}</div>
                                    <div style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '4px' }}>Total Expenses</div>
                                </div>
                            </div>
                            <div style={{ color: '#6b7280', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>This Period</span>
                                <span style={{ color: '#ef4444', fontWeight: 600 }}>▼ 12.8% vs Apr 2026</span>
                            </div>
                        </div>
                        {/* Total Entries */}
                        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '1rem' }}>
                                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#f3e8ff', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>📋</div>
                                <div>
                                    <div style={{ color: '#111827', fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>{expenses.length}</div>
                                    <div style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '4px' }}>Total Entries</div>
                                </div>
                            </div>
                            <div style={{ color: '#6b7280', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>Transactions</span>
                                <span style={{ color: '#10b981', fontWeight: 600 }}>▲ 25.0% vs Apr 2026</span>
                            </div>
                        </div>
                        {/* Daily Average */}
                        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '1rem' }}>
                                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#d1fae5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>⏱️</div>
                                <div>
                                    <div style={{ color: '#111827', fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>₹{Math.round(dailyAvg || 0).toLocaleString()}</div>
                                    <div style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '4px' }}>Daily Average</div>
                                </div>
                            </div>
                            <div style={{ color: '#6b7280', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>Per Day</span>
                                <span style={{ color: '#ef4444', fontWeight: 600 }}>▼ 8.4% vs Apr 2026</span>
                            </div>
                        </div>
                        {/* Highest Expense */}
                        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '1rem' }}>
                                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#dbeafe', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>📊</div>
                                <div>
                                    <div style={{ color: '#111827', fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>₹{Math.round(maxExp || 0).toLocaleString()}</div>
                                    <div style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '4px' }}>Highest Expense</div>
                                </div>
                            </div>
                            <div style={{ color: '#6b7280', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>{maxExpEntry?.date ? `On ${new Date(maxExpEntry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : '-'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Charts */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        {/* Line Chart */}
                        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                <h3 style={{ margin: 0, color: '#111827', fontSize: '1.1rem', fontWeight: '700' }}>Expenses Trend</h3>
                                <div style={{ display: "flex", gap: "1rem", fontSize: 12, fontWeight: 600 }}>
                                    <span style={{ color: "#7e22ce", display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 16, height: 2, background: "#7e22ce" }}></span> Expenses (₹)</span>
                                    <span style={{ color: "#10b981", display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 16, height: 2, background: "#10b981", borderTop: "2px dashed #10b981" }}></span> Entries</span>
                                </div>
                            </div>
                            <div style={{ height: '240px', width: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartDataState ? chartDataState.labels.map((l,i) => ({name: l, Expenses: chartDataState.datasets[1].data[i], Entries: Math.ceil((chartDataState.datasets[1].data[i] || 0)/1000)})) : []}>
                                        <defs>
                                            <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#7e22ce" stopOpacity={0.15}/>
                                                <stop offset="95%" stopColor="#7e22ce" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                        <YAxis yAxisId="left" tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                        <RechartsTooltip formatter={(value, name) => [name === 'Expenses' ? `₹${value.toLocaleString()}` : value, name]} />
                                        <Area yAxisId="left" type="monotone" dataKey="Expenses" stroke="#7e22ce" strokeWidth={2.5} fillOpacity={1} fill="url(#colorExp)" activeDot={{ r: 6 }} />
                                        <RechartsLine yAxisId="right" type="monotone" dataKey="Entries" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#10b981' }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Donut Chart */}
                        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                            <h3 style={{ margin: 0, marginBottom: '1.5rem', color: '#111827', fontSize: '1.1rem', fontWeight: '700' }}>Expenses by Category</h3>
                            <div style={{ display: 'flex', alignItems: 'center', height: '220px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                <div style={{ flex: '0 0 160px', position: 'relative', height: '160px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <RechartsPie data={sortedCats.map((c, i) => ({name: c[0], value: c[1], color: ['#8b5cf6', '#10b981', '#ef4444', '#f59e0b'][i % 4]}))} cx="50%" cy="50%" innerRadius={55} outerRadius={75} dataKey="value" stroke="none">
                                                {sortedCats.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={['#8b5cf6', '#10b981', '#ef4444', '#f59e0b'][index % 4]} />
                                                ))}
                                            </RechartsPie>
                                            <RechartsTooltip formatter={v => `₹${v.toLocaleString()}`} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                                        <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>₹{stats.totalExpense?.toLocaleString()}</div>
                                        <div style={{ fontSize: 11, color: '#6b7280' }}>Total</div>
                                    </div>
                                </div>
                                <div style={{ flex: 1, minWidth: '150px', paddingLeft: '1rem' }}>
                                    {sortedCats.slice(0, 4).map((cat, i) => {
                                        const pct = ((cat[1] / stats.totalExpense) * 100).toFixed(1);
                                        return (
                                            <div key={cat[0]} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', fontSize: 12 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 80 }}>
                                                    <div style={{ width: 10, height: 10, borderRadius: '2px', background: ['#8b5cf6', '#10b981', '#ef4444', '#f59e0b'][i % 4] }}></div>
                                                    <span style={{ color: '#374151', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat[0]}</span>
                                                </div>
                                                <span style={{ color: '#6b7280' }}>{pct}%</span>
                                                <span style={{ color: '#111827', fontWeight: 600 }}>₹{cat[1].toLocaleString()}</span>
                                            </div>
                                        )
                                    })}
                                    <div style={{ textAlign: 'right', marginTop: '1rem' }}>
                                        <span style={{ color: '#7e22ce', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>View full report →</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, color: '#111827', fontSize: '1.1rem', fontWeight: '700' }}>Recent Transactions</h3>
                            <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: 12, background: '#fff', color: '#7e22ce', borderColor: '#e9d5ff' }}>View All</button>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
                                <thead>
                                    <tr style={{ background: '#f9fafb', color: '#6b7280', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>DATE</th>
                                        <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>DESCRIPTION</th>
                                        <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>CATEGORY</th>
                                        <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>ROUTE</th>
                                        <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>AMOUNT</th>
                                        <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>STATUS</th>
                                        {(!props.isReportMode && canDelete) && <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>ACTIONS</th>}
                                        {(props.isReportMode) && <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}></th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredExpenses.length === 0 ? (
                                        <tr><td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>No transactions found.</td></tr>
                                    ) : (
                                        filteredExpenses.map(exp => (
                                            <tr key={exp.id} style={{ borderBottom: '1px solid #e5e7eb', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                                                <td style={{ padding: '1.2rem 1.5rem', color: '#374151', fontSize: '13px', fontWeight: '500' }}>
                                                    {new Date(exp.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </td>
                                                <td style={{ padding: '1.2rem 1.5rem', color: '#111827', fontSize: '13px', fontWeight: '700' }}>
                                                    {exp.title}
                                                </td>
                                                <td style={{ padding: '1.2rem 1.5rem' }}>
                                                    <span style={{ fontSize: '13px', color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }}></span> {exp.category}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1.2rem 1.5rem', color: '#6b7280', fontSize: '13px' }}>
                                                    Route A
                                                </td>
                                                <td style={{ padding: '1.2rem 1.5rem', color: '#ef4444', fontSize: '13px', fontWeight: '700' }}>
                                                    -₹{parseFloat(exp.amount).toLocaleString()}
                                                </td>
                                                <td style={{ padding: '1.2rem 1.5rem' }}>
                                                    <span style={{ padding: '0.25rem 0.75rem', borderRadius: '12px', background: '#ffe4e6', color: '#e11d48', fontSize: '11px', fontWeight: '600' }}>Expense</span>
                                                </td>
                                                {(!props.isReportMode && canDelete) && (
                                                    <td style={{ padding: '1.2rem 1.5rem', textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                            <button style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✏️</button>
                                                            <button onClick={() => handleDeleteExpense(exp.id)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #fee2e2', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑️</button>
                                                        </div>
                                                    </td>
                                                )}
                                                {(props.isReportMode) && (
                                                    <td style={{ padding: '1.2rem 1.5rem', textAlign: 'center', color: '#9ca3af', cursor: 'pointer' }}>⋮</td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════ TRANSPORT FEES TAB ════════════════ */}
            {activeTab === "transport" && (
                <div style={{ paddingTop: '0.5rem' }}>
                    {transportLoading ? (
                        <div style={{ textAlign: 'center', padding: '3rem' }}>Loading transport fees...</div>
                    ) : (
                        <>
                            {/* Stats Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                                <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'flex-start', gap: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>🚌</div>
                                    <div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827', lineHeight: 1 }}>{transportFees.length}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '4px' }}>Total Routes</div>
                                    </div>
                                </div>
                                <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'flex-start', gap: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#d1fae5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>✅</div>
                                    <div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827', lineHeight: 1 }}>{transportFees.length}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '4px' }}>Active Routes</div>
                                    </div>
                                </div>
                                <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'flex-start', gap: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fef3c7', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>💰</div>
                                    <div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827', lineHeight: 1 }}>₹{transportFees.length > 0 ? Math.min(...transportFees.map(f => parseFloat(f.fee_amount))).toLocaleString() : 0}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '4px' }}>Lowest Fee</div>
                                    </div>
                                </div>
                                <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'flex-start', gap: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#dbeafe', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>📋</div>
                                    <div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827', lineHeight: 1 }}>{transportFees.length * 45}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '4px' }}>Total Students (Est.)</div>
                                    </div>
                                </div>
                            </div>

                            {/* Search and Filters */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                                <div style={{ position: 'relative', width: '300px' }}>
                                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>🔍</span>
                                    <input type="text" placeholder="Search routes by name or location..." style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', borderRadius: '8px', border: '1px solid #e5e7eb', outline: 'none', fontSize: '0.9rem' }} />
                                </div>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px', fontWeight: '600' }}>Status</div>
                                        <select style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid #e5e7eb', outline: 'none', fontSize: '0.9rem', color: '#374151', minWidth: '150px' }}>
                                            <option>All Status</option>
                                        </select>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px', fontWeight: '600' }}>Sort By</div>
                                        <select style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid #e5e7eb', outline: 'none', fontSize: '0.9rem', color: '#374151', minWidth: '180px' }}>
                                            <option>Route Name (A-Z)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Table */}
                            {transportFees.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '4rem 2rem', borderRadius: '12px', border: '2px dashed #e5e7eb', background: '#fff' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚌</div>
                                    <h3 style={{ color: '#111827' }}>No transport routes configured yet</h3>
                                    <p style={{ color: '#6b7280' }}>Add your first route to get started.</p>
                                    {hasTransportPerm && (
                                        <button onClick={() => { setEditingTransport(null); setTransportForm({ route_name: "", fee_amount: "" }); setTransportError(""); setShowTransportModal(true); }} style={{ marginTop: '1rem', padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', background: '#7e22ce', color: '#fff', fontWeight: '600', cursor: 'pointer' }}>
                                            ➕ Add First Route
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                        <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase' }}>
                                            <tr>
                                                <th style={{ padding: '1rem 1.5rem' }}>ROUTE</th>
                                                <th style={{ padding: '1rem 1.5rem' }}>LOCATION / STOPS</th>
                                                <th style={{ padding: '1rem 1.5rem' }}>MONTHLY FEE</th>
                                                <th style={{ padding: '1rem 1.5rem' }}>STATUS</th>
                                                <th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>ACTIONS</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {transportFees.map(fee => (
                                                <tr key={fee.id} style={{ borderBottom: '1px solid #e5e7eb', transition: 'background 0.2s' }} onMouseOver={e=>e.currentTarget.style.background='#f9fafb'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                                                    <td style={{ padding: '1.25rem 1.5rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#f3e8ff', color: '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🚌</div>
                                                            <div>
                                                                <div style={{ color: '#111827', fontWeight: '600', fontSize: '0.95rem' }}>{fee.route_name}</div>
                                                                <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Added by {fee.creator?.name || 'Admin'}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '1.25rem 1.5rem' }}>
                                                        <div style={{ color: '#4b5563', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <span style={{ color: '#9ca3af' }}>📍</span> Default Route Location
                                                        </div>
                                                        <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '2px' }}>3 Stops</div>
                                                    </td>
                                                    <td style={{ padding: '1.25rem 1.5rem' }}>
                                                        <div style={{ color: '#10b981', fontWeight: '700', fontSize: '1rem' }}>₹{parseFloat(fee.fee_amount).toLocaleString()}</div>
                                                    </td>
                                                    <td style={{ padding: '1.25rem 1.5rem' }}>
                                                        <span style={{ padding: '0.35rem 0.75rem', background: '#ecfdf5', color: '#059669', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669' }}></div> Active
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                                                        {hasTransportPerm && (
                                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                                <button onClick={() => openEditTransport(fee)} style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#f9fafb', color: '#6b21a8', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                                    ✏️ Edit
                                                                </button>
                                                                <button onClick={() => handleDeleteTransport(fee.id)} style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #fee2e2', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ════════════════ ADD EXPENSE MODAL ════════════════ */}
            {showAddModal && (
                <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, padding: '1rem' }}>
                    <div className="modal-content" style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '500px', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: "1.5rem" }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ background: '#f3e8ff', color: '#7e22ce', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>➕</div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#111827', fontWeight: '700' }}>Add New Expense</h2>
                                    <p style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem', marginTop: '2px' }}>Fill in the details to record a new expense.</p>
                                </div>
                            </div>
                            <button onClick={() => setShowAddModal(false)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '1.25rem', padding: '0.25rem', display: 'flex', transition: 'color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.color='#ef4444'} onMouseOut={(e) => e.currentTarget.style.color='#9ca3af'}>✕</button>
                        </div>

                        <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <label style={{ fontWeight: '600', color: '#374151', fontSize: '0.85rem', marginBottom: '0.5rem', display: 'block' }}>Title <span style={{color: '#ef4444'}}>*</span></label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#7e22ce', fontSize: '1rem', display: 'flex' }}>📄</span>
                                    <input type="text" name="title" value={formData.title} onChange={handleInputChange} required placeholder="e.g. November Rent" style={{ width: '100%', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '0.85rem 1rem 0.85rem 2.6rem', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s' }} onFocus={(e) => e.target.style.borderColor='#a855f7'} onBlur={(e) => e.target.style.borderColor='#e5e7eb'} />
                                </div>
                            </div>

                            <div>
                                <label style={{ fontWeight: '600', color: '#374151', fontSize: '0.85rem', marginBottom: '0.5rem', display: 'block' }}>Category <span style={{color: '#ef4444'}}>*</span></label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#10b981', fontSize: '1rem', display: 'flex' }}>💸</span>
                                    <select name="category" value={formData.category} onChange={handleInputChange} required style={{ width: '100%', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '0.85rem 2.5rem 0.85rem 2.6rem', fontSize: '0.95rem', outline: 'none', appearance: 'none', backgroundColor: '#fff', color: formData.category ? '#111827' : '#6b7280', transition: 'border-color 0.2s' }} onFocus={(e) => e.target.style.borderColor='#a855f7'} onBlur={(e) => e.target.style.borderColor='#e5e7eb'}>
                                        <option value="" disabled>Select Category</option>
                                        <option value="Rent">Rent</option>
                                        <option value="Electricity">Electricity</option>
                                        <option value="Internet">Internet</option>
                                        <option value="Xerox">Xerox</option>
                                        <option value="Faculty Salary">Faculty Salary</option>
                                        <option value="Stationery">Stationery</option>
                                        <option value="Office Supplies">Office Supplies</option>
                                        <option value="Maintenance">Maintenance</option>
                                        <option value="Transport Fuel">Transport Fuel</option>
                                        <option value="Other">Other</option>
                                    </select>
                                    <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none', fontSize: '0.8rem' }}>▼</span>
                                </div>
                            </div>

                            <div>
                                <label style={{ fontWeight: '600', color: '#374151', fontSize: '0.85rem', marginBottom: '0.5rem', display: 'block' }}>Amount (₹) <span style={{color: '#ef4444'}}>*</span></label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#7e22ce', fontSize: '1.1rem', fontWeight: 'bold', display: 'flex' }}>₹</span>
                                    <input type="number" name="amount" value={formData.amount} onChange={handleInputChange} required placeholder="e.g. 5000" min="1" style={{ width: '100%', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '0.85rem 1rem 0.85rem 2.6rem', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s' }} onFocus={(e) => e.target.style.borderColor='#a855f7'} onBlur={(e) => e.target.style.borderColor='#e5e7eb'} />
                                </div>
                            </div>

                            <div>
                                <label style={{ fontWeight: '600', color: '#374151', fontSize: '0.85rem', marginBottom: '0.5rem', display: 'block' }}>Date <span style={{color: '#ef4444'}}>*</span></label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#7e22ce', fontSize: '1rem', display: 'flex' }}>📅</span>
                                    <input type="date" name="date" value={formData.date} onChange={handleInputChange} required style={{ width: '100%', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '0.85rem 1rem 0.85rem 2.6rem', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s' }} onFocus={(e) => e.target.style.borderColor='#a855f7'} onBlur={(e) => e.target.style.borderColor='#e5e7eb'} />
                                </div>
                            </div>

                            <div>
                                <label style={{ fontWeight: '600', color: '#374151', fontSize: '0.85rem', marginBottom: '0.5rem', display: 'block' }}>Description (Optional)</label>
                                <div style={{ position: 'relative' }}>
                                    <textarea name="description" value={formData.description} onChange={handleInputChange} rows="3" maxLength="500" placeholder="Additional details (optional)..." style={{ width: '100%', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '0.85rem 1rem', fontSize: '0.95rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit', transition: 'border-color 0.2s' }} onFocus={(e) => e.target.style.borderColor='#a855f7'} onBlur={(e) => e.target.style.borderColor='#e5e7eb'} />
                                    <span style={{ position: 'absolute', right: '10px', bottom: '12px', color: '#9ca3af', fontSize: '0.75rem', fontWeight: '500' }}>{formData.description.length} / 500</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                <button type="button" onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: '0.85rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#f9fafb', color: '#4b5563', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.95rem', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background='#f3f4f6'} onMouseOut={(e) => e.currentTarget.style.background='#f9fafb'}>
                                    ✕ Cancel
                                </button>
                                <button type="submit" style={{ flex: 1, padding: '0.85rem', borderRadius: '8px', border: 'none', background: '#7e22ce', color: '#fff', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.95rem', boxShadow: '0 4px 6px rgba(126,34,206,0.2)', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background='#6b21a8'} onMouseOut={(e) => e.currentTarget.style.background='#7e22ce'}>
                                    💾 Save Expense
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ════════════════ ADD/EDIT TRANSPORT MODAL ════════════════ */}
            {showTransportModal && (
                <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, padding: '1rem' }}>
                    <div className="modal-content" style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '440px', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: "1.5rem" }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ background: '#e0e7ff', color: '#4f46e5', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>🚌</div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#111827', fontWeight: '700' }}>{editingTransport ? 'Edit Transport Route' : 'Add Transport Route'}</h2>
                                    <p style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem', marginTop: '2px' }}>{editingTransport ? 'Modify the bus route details and monthly fee.' : 'Create a new bus route and set its monthly fee.'}</p>
                                </div>
                            </div>
                            <button onClick={() => { setShowTransportModal(false); setEditingTransport(null); }} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '1.25rem', padding: '0.25rem', display: 'flex', transition: 'color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.color='#ef4444'} onMouseOut={(e) => e.currentTarget.style.color='#9ca3af'}>✕</button>
                        </div>
                        
                        <div style={{ height: '1px', background: '#e5e7eb', marginBottom: '1.5rem' }}></div>

                        <form onSubmit={handleSaveTransport} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <label style={{ fontWeight: '600', color: '#374151', fontSize: '0.85rem', marginBottom: '0.5rem', display: 'block' }}>Route Name <span style={{color: '#ef4444'}}>*</span></label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#7e22ce', fontSize: '1.1rem', display: 'flex' }}>📍</span>
                                    <input type="text" name="route_name" value={transportForm.route_name} onChange={handleTransportFormChange} placeholder="e.g. Route A - City Center" required style={{ width: '100%', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '0.85rem 1rem 0.85rem 2.6rem', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s' }} onFocus={(e) => e.target.style.borderColor='#a855f7'} onBlur={(e) => e.target.style.borderColor='#e5e7eb'} />
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>Enter a unique name for the transport route.</div>
                            </div>

                            <div>
                                <label style={{ fontWeight: '600', color: '#374151', fontSize: '0.85rem', marginBottom: '0.5rem', display: 'block' }}>Monthly Fee (₹) <span style={{color: '#ef4444'}}>*</span></label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#7e22ce', fontSize: '1.1rem', display: 'flex', fontWeight: 'bold' }}>₹</span>
                                    <input type="number" name="fee_amount" value={transportForm.fee_amount} onChange={handleTransportFormChange} placeholder="e.g. 500" min="1" required style={{ width: '100%', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '0.85rem 1rem 0.85rem 2.6rem', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s' }} onFocus={(e) => e.target.style.borderColor='#a855f7'} onBlur={(e) => e.target.style.borderColor='#e5e7eb'} />
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>Enter the monthly fee amount for this route.</div>
                            </div>

                            {!editingTransport && (
                                <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '1rem', display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                    <div style={{ color: '#3b82f6', fontSize: '1.25rem', display: 'flex', flexShrink: 0 }}>ℹ️</div>
                                    <div style={{ color: '#1e40af', fontSize: '0.85rem', lineHeight: '1.4' }}>
                                        You can add stops and assign students to this route after creating it.
                                    </div>
                                </div>
                            )}

                            {transportError && (
                                <div style={{ color: '#ef4444', fontSize: '0.85rem', background: '#fef2f2', padding: '0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span>⚠️</span> {transportError}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => { setShowTransportModal(false); setEditingTransport(null); }} style={{ padding: '0.75rem 1.25rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', color: '#4b5563', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background='#f9fafb'} onMouseOut={(e) => e.currentTarget.style.background='#fff'}>
                                    ✕ Cancel
                                </button>
                                <button type="submit" style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', background: '#7e22ce', color: '#fff', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', boxShadow: '0 4px 6px rgba(126,34,206,0.2)', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background='#6b21a8'} onMouseOut={(e) => e.currentTarget.style.background='#7e22ce'}>
                                    {editingTransport ? '✓ Update Route' : '✓ Add Route'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
});

export default AdminExpenses;
