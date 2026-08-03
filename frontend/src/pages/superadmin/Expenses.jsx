import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
    FiCalendar, FiFilter, FiPlus, FiTrendingUp, FiCreditCard, 
    FiArrowRight, FiEdit2, FiTrash2, FiDownload, FiDollarSign, FiUsers, FiFileText
} from "react-icons/fi";
import { BiWallet, BiMoney } from "react-icons/bi";
import { FaFire } from "react-icons/fa";
import { Line, Doughnut } from "react-chartjs-2";
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
    Title, Tooltip, Legend, Filler, ArcElement
} from "chart.js";
import ThemeSelector from "../../components/ThemeSelector";
import api from "../../services/api";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import toast from "react-hot-toast";
import "./Expenses.css";

ChartJS.register(
    CategoryScale, LinearScale, PointElement, LineElement,
    Title, Tooltip, Legend, Filler, ArcElement
);

function Expenses() {
    const [startDate, setStartDate] = useState("2025-08-01");
    const [endDate, setEndDate] = useState("2026-08-31");
    const [filterPeriod, setFilterPeriod] = useState("current_month");
    const [showModal, setShowModal] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [editExpenseId, setEditExpenseId] = useState(null);
    
    const [newExpense, setNewExpense] = useState({
        title: "", category: "Rent", method: "Bank Transfer", amount: "", date: new Date().toISOString().split('T')[0], description: ""
    });

    const [stats, setStats] = useState({
        totalExpense: 0, totalIncome: 0, profitLoss: 0, burnRate: 0
    });
    const [chartDataRaw, setChartDataRaw] = useState([]);
    const [recentExpenses, setRecentExpenses] = useState([]);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const dateVal = filterPeriod === 'year' ? `&dateValue=${new Date().getFullYear()}` : '';
            const [expensesRes, statsRes] = await Promise.all([
                api.get(`/expenses?period=${filterPeriod}${dateVal}`),
                api.get(`/expenses/stats?period=${filterPeriod}${dateVal}`)
            ]);
            
            if (expensesRes.data.success) {
                setRecentExpenses(expensesRes.data.expenses);
            }
            if (statsRes.data.success) {
                setStats(statsRes.data.stats);
                setChartDataRaw(statsRes.data.chartData);
            }
        } catch (error) {
            toast.error("Failed to fetch expenses data");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [filterPeriod]);

    // Line Chart Data
    const lineData = {
        labels: chartDataRaw.map(d => d.month),
        datasets: [
            {
                label: "Expenses (₹)",
                data: chartDataRaw.map(d => d.expense),
                borderColor: "#ef4444",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                tension: 0.4,
                fill: true,
                pointBackgroundColor: "#ef4444"
            },
            {
                label: "Income (₹)",
                data: chartDataRaw.map(d => d.income),
                borderColor: "#10b981",
                backgroundColor: "transparent",
                tension: 0.4,
                pointBackgroundColor: "#10b981"
            }
        ]
    };

    const lineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        },
        scales: {
            y: { grid: { color: 'var(--sal-border, #e2e8f0)', borderDash: [5, 5] }, ticks: { callback: (val) => val >= 1000 ? `₹${val/1000}K` : `₹${val}` } },
            x: { grid: { display: false } }
        }
    };

    // Calculate Category Data from actual expenses
    const categoryTotals = recentExpenses.reduce((acc, exp) => {
        const cat = exp.category || 'Other Expenses';
        acc[cat] = (acc[cat] || 0) + parseFloat(exp.amount || 0);
        return acc;
    }, {});
    
    const donutLabels = Object.keys(categoryTotals);
    const donutValues = Object.values(categoryTotals);
    const totalDonut = donutValues.reduce((a,b) => a+b, 0);

    const donutData = {
        labels: donutLabels,
        datasets: [
            {
                data: donutValues.length ? donutValues : [1],
                backgroundColor: ["#3b82f6", "#8b5cf6", "#f97316", "#10b981", "#94a3b8"],
                borderWidth: 0,
                cutout: '65%'
            }
        ]
    };

    const donutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        }
    };

    const handleAddExpense = async (e) => {
        e.preventDefault();
        if (!newExpense.title || !newExpense.amount) return toast.error("Please fill required fields");
        
        const expenseData = {
            title: newExpense.title,
            category: newExpense.category,
            method: newExpense.method,
            amount: parseFloat(newExpense.amount),
            date: newExpense.date,
            description: newExpense.description
        };
        
        if (editExpenseId) {
            // Edit Mode Optimistic UI
            const prevExpenses = [...recentExpenses];
            const updatedExpense = { ...expenseData, id: editExpenseId, addedBy: "Super Admin", amount: expenseData.amount };
            setRecentExpenses(prev => prev.map(exp => exp.id === editExpenseId ? { ...exp, ...updatedExpense } : exp));
            setShowModal(false);
            setNewExpense({ title: "", category: "Rent", method: "Bank Transfer", amount: "", date: new Date().toISOString().split('T')[0], description: "" });
            setEditExpenseId(null);
            
            try {
                const res = await api.put(`/expenses/${editExpenseId}`, expenseData);
                if (res.data.success) {
                    toast.success("Expense updated successfully");
                    fetchData();
                }
            } catch (error) {
                toast.error("Failed to update expense");
                setRecentExpenses(prevExpenses);
            }
        } else {
            // Create Mode Optimistic UI
            const tempId = Date.now();
            const tempExpense = { ...expenseData, id: tempId, addedBy: "Super Admin", amount: expenseData.amount };
            setRecentExpenses([tempExpense, ...recentExpenses]);
            setShowModal(false);
            setNewExpense({ title: "", category: "Rent", method: "Bank Transfer", amount: "", date: new Date().toISOString().split('T')[0], description: "" });
            
            try {
                const res = await api.post('/expenses', expenseData);
                if (res.data.success) {
                    setRecentExpenses(prev => prev.map(exp => exp.id === tempId ? res.data.expense : exp));
                    toast.success("Expense added successfully");
                    fetchData();
                }
            } catch (error) {
                toast.error("Failed to save expense");
                setRecentExpenses(prev => prev.filter(exp => exp.id !== tempId));
            }
        }
    };

    const handleEditClick = (exp) => {
        setNewExpense({
            title: exp.title,
            category: exp.category,
            method: exp.method || "Bank Transfer",
            amount: exp.amount,
            date: new Date(exp.date || exp.createdAt).toISOString().split('T')[0],
            description: exp.description || ""
        });
        setEditExpenseId(exp.id);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditExpenseId(null);
        setNewExpense({ title: "", category: "Rent", method: "Bank Transfer", amount: "", date: new Date().toISOString().split('T')[0], description: "" });
    };

    const handleDelete = async (id) => {
        const prevExpenses = [...recentExpenses];
        setRecentExpenses(recentExpenses.filter(e => e.id !== id));
        toast.success("Expense deleted");

        try {
            await api.delete(`/expenses/${id}`);
            fetchData();
        } catch (error) {
            toast.error("Failed to delete expense");
            setRecentExpenses(prevExpenses);
        }
    };

    const handleExport = () => {
        toast.loading("Exporting expenses to Excel...", { id: 'export' });
        setTimeout(() => {
            const ws = XLSX.utils.json_to_sheet(recentExpenses);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Expenses");
            XLSX.writeFile(wb, "ZenithFlows_Expenses.xlsx");
            toast.success("Expenses exported successfully!", { id: 'export' });
        }, 800);
    };

    const handleDateChange = (type, val) => {
        if(type === 'start') setStartDate(val);
        else setEndDate(val);
        toast.success("Date filter applied");
    };

    return (
        <div className="sm-expenses-container">
            {/* Header */}
            <div className="sm-exp-header">
                <div className="sm-exp-header-left">
                    <div className="sm-exp-icon-wrap">
                        <BiMoney />
                    </div>
                    <div className="sm-exp-header-text">
                        <h1>Expenses</h1>
                        <p>Track and manage all business expenses</p>
                    </div>
                </div>
                <div className="sm-exp-header-right">
                    <div className="sm-exp-btn-secondary" style={{ padding: '0.25rem 0.5rem' }}>
                        <input type="date" value={startDate} onChange={e => handleDateChange('start', e.target.value)} style={{border:'none', background:'transparent', outline:'none', color:'inherit', fontFamily:'inherit'}} />
                        <span style={{margin: '0 4px'}}>-</span>
                        <input type="date" value={endDate} onChange={e => handleDateChange('end', e.target.value)} style={{border:'none', background:'transparent', outline:'none', color:'inherit', fontFamily:'inherit'}} />
                    </div>
                    <button className="sm-exp-btn-secondary" onClick={() => toast("Advanced filters coming soon", {icon: '⚙️'})}>
                        <FiFilter /> Filters
                    </button>
                    <button className="sm-exp-btn-primary" onClick={() => setShowModal(true)}>
                        <FiPlus /> Add Expense
                    </button>
                    <ThemeSelector />
                </div>
            </div>

            {isLoading ? (
                <div style={{padding: '3rem', textAlign: 'center'}}>Loading data...</div>
            ) : (
                <>
                    {/* KPI Cards */}
                    <div className="sm-exp-kpi-grid">
                        <div className="sm-exp-kpi-card">
                            <div className="icon-box" style={{background: 'var(--sal-danger-light, #fee2e2)', color: 'var(--sal-danger, #ef4444)'}}>
                                <FiCreditCard />
                            </div>
                            <div className="info">
                                <span className="label">Total Expenses</span>
                                <span className="value">₹{stats.totalExpense.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                            </div>
                        </div>

                        <div className="sm-exp-kpi-card">
                            <div className="icon-box" style={{background: 'var(--sal-success-light, #d1fae5)', color: 'var(--sal-success, #10b981)'}}>
                                <FiDollarSign />
                            </div>
                            <div className="info">
                                <span className="label">Total Income</span>
                                <span className="value">₹{stats.totalIncome.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                            </div>
                        </div>

                        <div className="sm-exp-kpi-card">
                            <div className="icon-box" style={{background: 'var(--sal-primary-light, #ede9fe)', color: 'var(--sal-primary, #8b5cf6)'}}>
                                <FiTrendingUp />
                            </div>
                            <div className="info">
                                <span className="label">Profit / Loss</span>
                                <span className="value">₹{stats.profitLoss.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                            </div>
                        </div>

                        <div className="sm-exp-kpi-card">
                            <div className="icon-box" style={{background: 'var(--sal-warning-light, #ffedd5)', color: 'var(--sal-warning, #f97316)'}}>
                                <FaFire />
                            </div>
                            <div className="info">
                                <span className="label">Burn Rate</span>
                                <span className="value">₹{stats.burnRate.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                            </div>
                        </div>
                    </div>

            {/* Charts Section */}
            <div className="sm-exp-charts-grid">
                {/* Line Chart */}
                <div className="sm-exp-card">
                    <div className="sm-exp-card-header">
                        <div style={{display:'flex', alignItems:'center', gap:'1rem'}}>
                            <span className="sm-exp-card-title">Expenses Overview</span>
                            <div style={{display:'flex', gap:'1rem', fontSize:'0.75rem', fontWeight:600, color:'#64748b'}}>
                                <div style={{display:'flex', alignItems:'center', gap:'4px'}}><span style={{width:'8px', height:'2px', background:'#ef4444'}}></span>Expenses (₹)</div>
                                <div style={{display:'flex', alignItems:'center', gap:'4px'}}><span style={{width:'8px', height:'2px', background:'#10b981'}}></span>Income (₹)</div>
                            </div>
                        </div>
                        <select className="sm-exp-btn-secondary" style={{padding:'0.25rem 0.5rem'}} value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
                            <option value="current_month">This Month</option>
                            <option value="year">This Year</option>
                            <option value="all">All Time</option>
                        </select>
                    </div>
                    <div className="sm-exp-chart-container">
                        <Line data={lineData} options={lineOptions} />
                    </div>
                </div>

                {/* Doughnut Chart */}
                <div className="sm-exp-card">
                    <span className="sm-exp-card-title" style={{marginBottom: '1rem'}}>Expenses by Category</span>
                    <div className="sm-exp-doughnut-layout">
                        <div className="sm-exp-doughnut-wrap">
                            <Doughnut data={donutData} options={donutOptions} />
                        </div>
                        <div className="sm-exp-legend">
                            {donutData.labels.map((label, i) => (
                                <div className="sm-exp-legend-item" key={i}>
                                    <div className="left">
                                        <span className="dot" style={{backgroundColor: donutData.datasets[0].backgroundColor[i]}}></span>
                                        <span className="label">{label}</span>
                                    </div>
                                    <div className="right">
                                        <span className="value">₹{donutData.datasets[0].data[i].toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                                        <span className="pct">{totalDonut ? ((donutData.datasets[0].data[i] / totalDonut) * 100).toFixed(1) : 0}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="sm-exp-card-footer">
                        <button className="sm-exp-btn-secondary" style={{margin:'0 auto'}} onClick={() => toast.success("Generating full category report...")}>View Full Report</button>
                    </div>
                </div>
            </div>

            {/* Bottom Grid */}
            <div className="sm-exp-bottom-grid">
                {/* Table */}
                <div className="sm-exp-card" style={{padding: '0'}}>
                    <div className="sm-exp-card-header" style={{padding: '1.5rem 1.5rem 0 1.5rem', marginBottom:'1rem'}}>
                        <span className="sm-exp-card-title">Recent Expenses</span>
                        <Link to="#" style={{fontSize: '0.875rem', color: '#6366f1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px'}}>
                            View All Expenses <FiArrowRight />
                        </Link>
                    </div>
                    <div className="sm-exp-table-container">
                        <table className="sm-exp-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Title</th>
                                    <th>Category</th>
                                    <th>Payment Method</th>
                                    <th>Amount</th>
                                    <th>Added By</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentExpenses.length === 0 ? (
                                    <tr><td colSpan="6" style={{textAlign:'center', padding:'2rem'}}>No expenses found</td></tr>
                                ) : recentExpenses.map((exp) => {
                                    let badge = "bg-orange-light";
                                    if (exp.category === "Marketing") badge = "bg-purple-light";
                                    if (exp.category === "Software & Tools") badge = "bg-green-light";
                                    if (exp.category === "Salaries & Wages" || exp.category === "Rent") badge = "bg-blue-light text-blue-500";
                                    
                                    return (
                                    <tr key={exp.id}>
                                        <td style={{color:'#64748b'}}>{new Date(exp.date || exp.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                        <td style={{fontWeight:500}}>{exp.title}</td>
                                        <td><span className={`sm-exp-cat-badge ${badge}`}>{exp.category}</span></td>
                                        <td style={{color:'#64748b', fontSize:'0.85rem'}}>
                                            <span style={{display:'inline-flex', alignItems:'center', gap:'0.25rem'}}>
                                                <BiWallet /> {exp.method || 'Cash'}
                                            </span>
                                        </td>
                                        <td style={{fontWeight:600}}>₹{parseFloat(exp.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                                        <td style={{color:'#64748b'}}>{exp.created_by ? 'Admin' : 'Super Admin'}</td>
                                        <td>
                                            <div className="sm-exp-table-actions">
                                                <button className="sm-exp-btn-secondary" style={{padding:'0.3rem'}} onClick={() => handleEditClick(exp)}><FiEdit2 size={14} /></button>
                                                <button className="sm-exp-btn-secondary" style={{padding:'0.3rem', color:'#ef4444'}} onClick={() => handleDelete(exp.id)}><FiTrash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right Sidebar */}
                <div style={{display:'flex', flexDirection:'column', gap:'1.25rem'}}>
                    {/* Top Category */}
                    <div className="sm-exp-card">
                        <div className="sm-exp-card-header" style={{marginBottom: 0}}>
                            <span className="sm-exp-card-title">Top Expense Category</span>
                            <span className="sm-exp-badge bg-blue-light" style={{color:'#3b82f6', background:'rgba(59, 130, 246, 0.1)'}}>This Month</span>
                        </div>
                        <div className="sm-exp-top-cat">
                            <div style={{display:'flex', gap:'1rem', alignItems:'center', background:'#f8fafc', padding:'1rem', borderRadius:'8px', border:'1px solid #e2e8f0'}}>
                            <div style={{width:'40px', height:'40px', borderRadius:'50%', background:'#e0e7ff', color:'#4f46e5', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem'}}>
                                <FiUsers />
                            </div>
                            <div>
                                <span style={{display:'block', fontSize:'0.8rem', color:'#64748b', fontWeight:600, marginBottom:'0.25rem'}}>{donutLabels[0] || 'N/A'}</span>
                                <span style={{display:'block', fontSize:'1.1rem', fontWeight:700, color:'#1e293b'}}>₹{donutValues[0] ? donutValues[0].toLocaleString('en-IN', {minimumFractionDigits: 2}) : '0.00'}</span>
                                <span style={{display:'block', fontSize:'0.75rem', color:'#64748b', marginTop:'0.25rem'}}>{totalDonut ? ((donutValues[0] / totalDonut) * 100).toFixed(1) : 0}% of total expenses</span>
                            </div>
                        </div>
                        </div>
                        <div style={{textAlign:'center', marginTop:'0.5rem'}}>
                            <Link to="#" onClick={(e) => {e.preventDefault(); toast.success("Category report downloaded!")}} style={{fontSize: '0.875rem', color: '#6366f1', fontWeight: 600}}>View Category Report</Link>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="sm-exp-card">
                        <span className="sm-exp-card-title" style={{marginBottom: '1rem', display:'block'}}>Quick Actions</span>
                        <div className="sm-exp-actions-list">
                            <button className="sm-exp-action-item" onClick={() => setShowModal(true)}>
                                <div className="left">
                                    <FiPlus /> Add New Expense
                                </div>
                                <FiArrowRight style={{color:'#94a3b8'}} />
                            </button>
                            <button className="sm-exp-action-item" onClick={handleExport}>
                                <div className="left">
                                    <FiDownload style={{color:'#10b981'}} /> Export Expenses
                                </div>
                                <FiArrowRight style={{color:'#94a3b8'}} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Expense Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', 
                    alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        background: 'var(--sal-card-bg, #fff)', color: 'var(--sal-sidebar-text, #1e293b)',
                        padding: '2rem', borderRadius: '16px', width: '100%', maxWidth: '450px',
                        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                        maxHeight: '90vh', overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <div style={{ 
                                    width: '48px', height: '48px', borderRadius: '12px', 
                                    background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem'
                                }}>
                                    <FiPlus />
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>{editExpenseId ? "Edit Expense" : "Add New Expense"}</h2>
                                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                                        {editExpenseId ? "Modify the details of this expense." : "Fill in the details to record a new expense."}
                                    </p>
                                </div>
                            </div>
                            <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}>&times;</button>
                        </div>
                        
                        <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>
                                    Title <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <div style={{position: 'relative'}}>
                                    <FiFileText style={{position: 'absolute', left: '12px', top: '12px', color: '#94a3b8'}} />
                                    <input type="text" required value={newExpense.title} onChange={e => setNewExpense({...newExpense, title: e.target.value})} style={{
                                        width: '100%', padding: '0.6rem 0.6rem 0.6rem 2.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#1e293b', fontSize: '0.9rem'
                                    }} placeholder="e.g. November Rent" />
                                </div>
                            </div>
                            
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>
                                    Category <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <div style={{position: 'relative'}}>
                                    <BiMoney style={{position: 'absolute', left: '12px', top: '12px', color: '#10b981'}} />
                                    <select required value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value})} style={{
                                        width: '100%', padding: '0.6rem 0.6rem 0.6rem 2.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#1e293b', fontSize: '0.9rem', appearance: 'none'
                                    }}>
                                        <option>Rent</option>
                                        <option>Operations</option>
                                        <option>Marketing</option>
                                        <option>Software & Tools</option>
                                        <option>Salaries & Wages</option>
                                        <option>Other Expenses</option>
                                    </select>
                                    <div style={{position:'absolute', right:'12px', top:'12px', pointerEvents:'none', color:'#94a3b8'}}>▼</div>
                                </div>
                            </div>
                            
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>
                                    Amount (₹) <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <div style={{position: 'relative'}}>
                                    <span style={{position: 'absolute', left: '12px', top: '10px', color: '#8b5cf6', fontWeight: 600}}>₹</span>
                                    <input type="number" required value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} style={{
                                        width: '100%', padding: '0.6rem 0.6rem 0.6rem 2.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#1e293b', fontSize: '0.9rem'
                                    }} placeholder="e.g. 5000" />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>
                                    Date <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <div style={{position: 'relative'}}>
                                    <FiCalendar style={{position: 'absolute', left: '12px', top: '12px', color: '#3b82f6'}} />
                                    <input type="date" required value={newExpense.date} onChange={e => setNewExpense({...newExpense, date: e.target.value})} style={{
                                        width: '100%', padding: '0.6rem 0.6rem 0.6rem 2.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#1e293b', fontSize: '0.9rem',
                                        fontFamily: 'inherit'
                                    }} />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>
                                    Description (Optional)
                                </label>
                                <textarea value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} maxLength={500} style={{
                                    width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#1e293b', fontSize: '0.9rem',
                                    minHeight: '80px', resize: 'vertical', fontFamily: 'inherit'
                                }} placeholder="Additional details (optional)..." />
                                <div style={{textAlign: 'right', fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem'}}>
                                    {newExpense.description.length} / 500
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                <button type="button" onClick={handleCloseModal} style={{ 
                                    flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', 
                                    background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                                }}>
                                    <span style={{fontSize:'1.25rem', lineHeight:'1'}}>&times;</span> Cancel
                                </button>
                                <button type="submit" style={{ 
                                    flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', 
                                    background: '#8b5cf6', color: '#fff', fontWeight: 600, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                    boxShadow: '0 4px 6px -1px rgba(139, 92, 246, 0.3)'
                                }}>
                                    💾 {editExpenseId ? "Save Changes" : "Save Expense"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
                </>
            )}
            
        </div>
    );
}

export default Expenses;
