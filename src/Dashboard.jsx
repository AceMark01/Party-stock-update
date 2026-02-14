// src/Dashboard.jsx - Updated: Fixed Delivered Tab (No Deleted in Mark Delivered) + Pending Tab Message + Open Link Buttons

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { LayoutDashboard, Clock, CheckCircle, Menu, X, MessageSquare, ExternalLink } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import supabase from './supabaseClient';

function Dashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [partyMobileMap, setPartyMobileMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      try {
        // Fetch submissions
        const { data: subsData, error: subsError } = await supabase
          .from('stock_submissions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200);

        if (subsError) throw subsError;
        setSubmissions(subsData || []);

        // Fetch party mobile numbers
        const uniqueParties = [...new Set(subsData?.map(s => s.party) || [])];

        if (uniqueParties.length > 0) {
          const { data: mobileData, error: mobileError } = await supabase
            .from('stock_items')
            .select('party, party_mob_no')
            .in('party', uniqueParties);

          if (mobileError) throw mobileError;

          const mobileMap = {};
          mobileData?.forEach(item => {
            let mob = item.party_mob_no?.trim();
            if (mob && !mob.startsWith('91')) mob = '91' + mob;
            if (mob) mobileMap[item.party] = mob;
          });

          setPartyMobileMap(mobileMap);
        }
      } catch (err) {
        toast.error('Data load fail hua');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const pending = submissions.filter(s => s.approval_status === 'Pending');
  const approved = submissions.filter(s => s.approval_status === 'Approved');
  const deleted = submissions.filter(s => s.approval_status === 'Deleted');

  // For Delivered tab: Pending items (excluding deleted)
  const pendingForDelivery = submissions.filter(s => s.status === 'pending' && s.approval_status !== 'Deleted');

  // For Delivered Items table: Delivered items
  const deliveredItems = submissions.filter(s => s.status === 'delivered');

  const stats = {
    total: submissions.length,
    pending: pending.length,
    approved: approved.length,
    deleted: deleted.length,
    today: submissions.filter(s => {
      const today = new Date().toISOString().split('T')[0];
      return s.created_at?.split('T')[0] === today;
    }).length
  };

  const chartData = Object.entries(
    submissions.reduce((acc, s) => {
      acc[s.party] = (acc[s.party] || 0) + (s.order_qty || 0);
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const markDelivered = async (id) => {
    const updateData = {
      status: 'delivered',
      delivered_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('stock_submissions')
      .update(updateData)
      .eq('id', id);

    if (error) {
      toast.error('Mark Delivered fail hua');
      console.error(error);
    } else {
      toast.success('Item Delivered mark ho gaya!');
      setSubmissions(prev =>
        prev.map(s => s.id === id ? { ...s, ...updateData } : s)
      );
    }
  };

  const sendApprovalWhatsApp = (sub) => {
    const approvalLink = `https://party-stock-update.vercel.app/review?party=${encodeURIComponent(sub.party)}&key=${sub.unique_key}`;

    const message = `Dear ${sub.party},

We’ve received your latest stock update request.

Please review and approve the suggested quantities at your earliest convenience — your approval helps us process orders quickly and accurately.

Our approval system takes less than 30 seconds to complete.

Approval Link: ${approvalLink}

Your input is highly valued and greatly appreciated.

Thank you for your continued trust and partnership.

Best regards,  
Acemark Stationers`;

    const encoded = encodeURIComponent(message);
    const mobile = partyMobileMap[sub.party] || '919131749390';
    window.open(`https://wa.me/${mobile}?text=${encoded}`, '_blank');
    toast.success('Approval request sent via WhatsApp!');
  };

  const sendFeedbackWhatsApp = (sub) => {
    const feedbackLink = `https://party-stock-update.vercel.app/feedbackpage?party=${encodeURIComponent(sub.party)}&key=${sub.unique_key}`;

    const message = `Dear ${sub.party},

As one of our valued Golden Partners, your satisfaction means everything to us.

We’d truly appreciate 30 seconds of your time to share your honest feedback on our recent delivery.

Your thoughts help us serve you even better.

Feedback Link: ${feedbackLink}

Thank you for being part of the Acemark family.

Warm regards,  
Acemark Stationers`;

    const encoded = encodeURIComponent(message);
    const mobile = partyMobileMap[sub.party] || '919131749390';
    window.open(`https://wa.me/${mobile}?text=${encoded}`, '_blank');
    toast.success('Feedback request sent — thank you!');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl sm:text-2xl font-bold text-indigo-700">StockPro</h1>

            <div className="hidden md:flex items-center space-x-1 lg:space-x-4">
              <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>Dashboard</button>
              <button onClick={() => setActiveTab('pending')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'pending' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>Pending ({stats.pending})</button>
              <button onClick={() => setActiveTab('approved-deleted')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'approved-deleted' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>Approved & Deleted</button>
              <button onClick={() => setActiveTab('delivered')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'delivered' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>Delivered ({stats.delivered})</button>
            </div>

            <button className="md:hidden p-2 rounded-lg hover:bg-gray-100" onClick={() => setMobileMenuOpen(true)}>
              <Menu size={24} className="text-gray-700" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setMobileMenuOpen(false)} />
          <div className={`fixed top-0 right-0 h-full w-72 bg-white shadow-2xl z-50 transform transition-transform duration-300 md:hidden ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-indigo-700">Menu</h2>
              <button onClick={() => setMobileMenuOpen(false)}>
                <X size={24} className="text-gray-700" />
              </button>
            </div>
            <nav className="p-4 space-y-2">
              <button onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-lg ${activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}>Dashboard</button>
              <button onClick={() => { setActiveTab('pending'); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-lg ${activeTab === 'pending' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}>Pending ({stats.pending})</button>
              <button onClick={() => { setActiveTab('approved-deleted'); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-lg ${activeTab === 'approved-deleted' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}>Approved & Deleted</button>
              <button onClick={() => { setActiveTab('delivered'); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-lg ${activeTab === 'delivered' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}>Delivered ({stats.delivered})</button>
            </nav>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-gray-50">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <div className="max-w-7xl mx-auto space-y-8 lg:space-y-12">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Dashboard Overview</h1>

                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
                  {[
                    { title: 'Total Updates', value: stats.total },
                    { title: 'Pending', value: stats.pending },
                    { title: 'Approved', value: stats.approved },
                    { title: 'Deleted', value: stats.deleted },
                    { title: "Today's", value: stats.today }
                  ].map((stat, i) => (
                    <div key={i} className="bg-white p-5 sm:p-6 rounded-xl shadow border hover:shadow-md transition-shadow">
                      <p className="text-sm text-gray-600">{stat.title}</p>
                      <p className="text-3xl lg:text-4xl font-bold text-gray-900 mt-1">{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-white p-6 rounded-xl shadow border">
                  <h2 className="text-xl lg:text-2xl font-semibold mb-6">Top Parties by Order Quantity</h2>
                  <div className="h-64 lg:h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={window.innerWidth < 768 ? 20 : 32} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow border overflow-hidden">
                  <div className="p-6 border-b">
                    <h2 className="text-xl lg:text-2xl font-semibold">Recent Updates</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-6 py-4 text-left text-sm font-medium text-gray-600">Party</th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-gray-600">Product</th>
                          <th className="px-6 py-4 text-center text-sm font-medium text-gray-600">Current</th>
                          <th className="px-6 py-4 text-center text-sm font-medium text-gray-600">Order</th>
                          <th className="px-6 py-4 text-center text-sm font-medium text-gray-600">Photo</th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-gray-600">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {submissions.slice(0, 10).map(sub => (
                          <tr key={sub.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-medium">{sub.party}</td>
                            <td className="px-6 py-4 text-sm">{sub.product_name}</td>
                            <td className="px-6 py-4 text-center text-sm">{sub.current_qty}</td>
                            <td className="px-6 py-4 text-center text-sm">{sub.order_qty}</td>
                            <td className="px-6 py-4 text-center text-sm">
                              {sub.photo_url ? <a href={sub.photo_url} target="_blank" className="text-indigo-600 hover:underline">View</a> : 'No Photo'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {new Date(sub.created_at).toLocaleDateString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'pending' && (
              <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">Pending Orders</h1>
                {pending.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No pending orders found.</p>
                ) : (
                  <div className="bg-white rounded-xl shadow border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-6 py-4 text-left text-sm font-medium text-gray-600">Party</th>
                            <th className="px-6 py-4 text-left text-sm font-medium text-gray-600">Product</th>
                            <th className="px-6 py-4 text-center text-sm font-medium text-gray-600">Current</th>
                            <th className="px-6 py-4 text-center text-sm font-medium text-gray-600">Order</th>
                            <th className="px-6 py-4 text-center text-sm font-medium text-gray-600">Photo</th>
                            <th className="px-6 py-4 text-left text-sm font-medium text-gray-600">Date</th>
                            <th className="px-6 py-4 text-center text-sm font-medium text-gray-600">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {pending.map(sub => (
                            <tr key={sub.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm font-medium">{sub.party}</td>
                              <td className="px-6 py-4 text-sm">{sub.product_name}</td>
                              <td className="px-6 py-4 text-center text-sm">{sub.current_qty}</td>
                              <td className="px-6 py-4 text-center text-sm">{sub.order_qty}</td>
                              <td className="px-6 py-4 text-center text-sm">
                                {sub.photo_url ? <a href={sub.photo_url} target="_blank" className="text-indigo-600 hover:underline">View</a> : 'No Photo'}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">{new Date(sub.created_at).toLocaleString('en-IN')}</td>
                              <td className="px-6 py-4 text-center flex gap-2 justify-center">
                                <button
                                  onClick={() => window.open(`https://party-stock-update.vercel.app/review?party=${encodeURIComponent(sub.party)}&key=${sub.unique_key}`, '_blank')}
                                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center gap-1"
                                >
                                  <ExternalLink size={16} />
                                  Open Link
                                </button>
                                <button
                                  onClick={() => sendApprovalWhatsApp(sub)}
                                  className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 flex items-center gap-1"
                                >
                                  <MessageSquare size={16} />
                                  Send WhatsApp
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'approved-deleted' && (
              <div className="max-w-7xl mx-auto space-y-10">
                <h1 className="text-3xl font-bold mb-8">Approved & Deleted Items</h1>

                <div>
                  <h2 className="text-2xl font-semibold mb-4 text-green-700">Approved Items ({approved.length})</h2>
                  <div className="bg-white rounded-xl shadow border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-6 py-4 text-left text-sm font-medium text-gray-600">Party</th>
                            <th className="px-6 py-4 text-left text-sm font-medium text-gray-600">Product</th>
                            <th className="px-6 py-4 text-center text-sm font-medium text-gray-600">Order Qty</th>
                            <th className="px-6 py-4 text-center text-sm font-medium text-gray-600">Photo</th>
                            <th className="px-6 py-4 text-left text-sm font-medium text-gray-600">Approved At</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {approved.map(sub => (
                            <tr key={sub.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm font-medium">{sub.party}</td>
                              <td className="px-6 py-4 text-sm">{sub.product_name}</td>
                              <td className="px-6 py-4 text-center text-sm">{sub.order_qty}</td>
                              <td className="px-6 py-4 text-center text-sm">
                                {sub.photo_url ? <a href={sub.photo_url} target="_blank" className="text-indigo-600 hover:underline">View</a> : 'No Photo'}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {sub.deleted_at ? new Date(sub.deleted_at).toLocaleString('en-IN') : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-2xl font-semibold mb-4 text-red-700">Deleted Items ({deleted.length})</h2>
                  <div className="bg-white rounded-xl shadow border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-6 py-4 text-left text-sm font-medium text-gray-600">Party</th>
                            <th className="px-6 py-4 text-left text-sm font-medium text-gray-600">Product</th>
                            <th className="px-6 py-4 text-center text-sm font-medium text-gray-600">Order Qty</th>
                            <th className="px-6 py-4 text-center text-sm font-medium text-gray-600">Photo</th>
                            <th className="px-6 py-4 text-left text-sm font-medium text-gray-600">Deleted At</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {deleted.map(sub => (
                            <tr key={sub.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm font-medium">{sub.party}</td>
                              <td className="px-6 py-4 text-sm">{sub.product_name}</td>
                              <td className="px-6 py-4 text-center text-sm">{sub.order_qty}</td>
                              <td className="px-6 py-4 text-center text-sm">
                                {sub.photo_url ? <a href={sub.photo_url} target="_blank" className="text-indigo-600 hover:underline">View</a> : 'No Photo'}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {sub.deleted_at ? new Date(sub.deleted_at).toLocaleString('en-IN') : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'delivered' && (
              <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">Delivered Orders</h1>

                {/* Table 1: Mark as Delivered (Pending items) */}
                <div className="mb-12">
                  <h2 className="text-2xl font-semibold mb-4 text-amber-700">Mark as Delivered ({pendingForDelivery.length})</h2>
                  {pendingForDelivery.length === 0 ? (
                    <p className="text-gray-500">No pending items to mark as delivered.</p>
                  ) : (
                    <div className="bg-white rounded-xl shadow border overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-6 py-4 text-left text-sm font-medium text-gray-600">Party</th>
                              <th className="px-6 py-4 text-left text-sm font-medium text-gray-600">Product</th>
                              <th className="px-6 py-4 text-center text-sm font-medium text-gray-600">Current</th>
                              <th className="px-6 py-4 text-center text-sm font-medium text-gray-600">Order</th>
                              <th className="px-6 py-4 text-center text-sm font-medium text-gray-600">Photo</th>
                              <th className="px-6 py-4 text-center text-sm font-medium text-gray-600">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {pendingForDelivery.map(sub => (
                              <tr key={sub.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm font-medium">{sub.party}</td>
                                <td className="px-6 py-4 text-sm">{sub.product_name}</td>
                                <td className="px-6 py-4 text-center text-sm">{sub.current_qty}</td>
                                <td className="px-6 py-4 text-center text-sm">{sub.order_qty}</td>
                                <td className="px-6 py-4 text-center text-sm">
                                  {sub.photo_url ? <a href={sub.photo_url} target="_blank" className="text-indigo-600 hover:underline">View</a> : 'No Photo'}
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <button
                                    onClick={() => markDelivered(sub.id)}
                                    className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition shadow-sm"
                                  >
                                    Mark Delivered
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Table 2: Delivered Items (status = 'delivered') */}
                <div>
                  <h2 className="text-2xl font-semibold mb-4 text-green-700">Delivered Items ({deliveredItems.length})</h2>
                  {deliveredItems.length === 0 ? (
                    <p className="text-gray-500">No delivered items yet.</p>
                  ) : (
                    <div className="bg-white rounded-xl shadow border overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-6 py-4 text-left text-sm font-medium text-gray-600">Party</th>
                              <th className="px-6 py-4 text-left text-sm font-medium text-gray-600">Product</th>
                              <th className="px-6 py-4 text-center text-sm font-medium text-gray-600">Current</th>
                              <th className="px-6 py-4 text-center text-sm font-medium text-gray-600">Order</th>
                              <th className="px-6 py-4 text-center text-sm font-medium text-gray-600">Photo</th>
                              <th className="px-6 py-4 text-left text-sm font-medium text-gray-600">Delivered At</th>
                              <th className="px-6 py-4 text-center text-sm font-medium text-gray-600">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {deliveredItems.map(sub => (
                              <tr key={sub.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm font-medium">{sub.party}</td>
                                <td className="px-6 py-4 text-sm">{sub.product_name}</td>
                                <td className="px-6 py-4 text-center text-sm">{sub.current_qty}</td>
                                <td className="px-6 py-4 text-center text-sm">{sub.order_qty}</td>
                                <td className="px-6 py-4 text-center text-sm">
                                  {sub.photo_url ? <a href={sub.photo_url} target="_blank" className="text-indigo-600 hover:underline">View</a> : 'No Photo'}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                  {sub.delivered_at ? new Date(sub.delivered_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                                </td>
                                <td className="px-6 py-4 text-center flex gap-2 justify-center">
                                  <button
                                    onClick={() => window.open(`https://party-stock-update.vercel.app/feedbackpage?party=${encodeURIComponent(sub.party)}&key=${sub.unique_key}`, '_blank')}
                                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center gap-1"
                                  >
                                    <ExternalLink size={16} />
                                    Open Link
                                  </button>
                                  <button
                                    onClick={() => sendFeedbackWhatsApp(sub)}
                                    className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 flex items-center gap-1"
                                  >
                                    <MessageSquare size={16} />
                                    Send Feedback
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default Dashboard;