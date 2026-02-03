import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { LayoutDashboard, Clock, CheckCircle, Menu, X } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import supabase from './supabaseClient';

function Dashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubmissions = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('stock_submissions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200);

        if (error) throw error;
        setSubmissions(data || []);
      } catch (err) {
        toast.error('Data load fail hua');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions();
  }, []);

  const pending = submissions.filter(s => s.status === 'pending' || !s.status);
  const delivered = submissions.filter(s => s.status === 'delivered');

  const stats = {
    total: submissions.length,
    pending: pending.length,
    delivered: delivered.length,
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

  const updateStatus = async (id, newStatus) => {
    const updateData = { status: newStatus };

    // Agar Delivered mark kar rahe ho to delivered_at set kar do
    if (newStatus === 'delivered') {
      updateData.delivered_at = new Date().toISOString(); // current date-time
    }

    const { error } = await supabase
      .from('stock_submissions')
      .update(updateData)
      .eq('id', id);

    if (error) {
      toast.error('Status update fail');
      console.error(error);
    } else {
      toast.success(`Status ${newStatus} ho gaya`);
      setSubmissions(prev =>
        prev.map(s =>
          s.id === id ? { ...s, ...updateData } : s
        )
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Toaster position="top-right" />

      {/* Sticky Top Bar */}
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl sm:text-2xl font-bold text-indigo-700">StockPro</h1>

            {/* Desktop Tabs */}
            <div className="hidden md:flex items-center space-x-1 lg:space-x-4">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'pending' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Pending ({stats.pending})
              </button>
              <button
                onClick={() => setActiveTab('delivered')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'delivered' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Delivered ({stats.delivered})
              </button>
            </div>

            {/* Mobile Hamburger */}
            <button 
              className="md:hidden p-2 rounded-lg hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={24} className="text-gray-700" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Right Side Menu */}
      {mobileMenuOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div 
            className={`fixed top-0 right-0 h-full w-72 bg-white shadow-2xl z-50 transform transition-transform duration-300 md:hidden ${
              mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-indigo-700">Menu</h2>
              <button onClick={() => setMobileMenuOpen(false)}>
                <X size={24} className="text-gray-700" />
              </button>
            </div>

            <nav className="p-4 space-y-2">
              <button
                onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
                className={`w-full text-left px-4 py-3 rounded-lg ${activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}
              >
                Dashboard
              </button>
              <button
                onClick={() => { setActiveTab('pending'); setMobileMenuOpen(false); }}
                className={`w-full text-left px-4 py-3 rounded-lg ${activeTab === 'pending' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}
              >
                Pending Orders ({stats.pending})
              </button>
              <button
                onClick={() => { setActiveTab('delivered'); setMobileMenuOpen(false); }}
                className={`w-full text-left px-4 py-3 rounded-lg ${activeTab === 'delivered' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}
              >
                Delivered Orders ({stats.delivered})
              </button>
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

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  {[
                    { title: 'Total Updates', value: stats.total, color: 'indigo' },
                    { title: 'Pending', value: stats.pending, color: 'yellow' },
                    { title: 'Delivered', value: stats.delivered, color: 'green' },
                    { title: "Today's", value: stats.today, color: 'blue' }
                  ].map((stat, i) => (
                    <div key={i} className="bg-white p-5 sm:p-6 rounded-xl shadow border hover:shadow-md transition-shadow">
                      <p className="text-sm text-gray-600">{stat.title}</p>
                      <p className="text-3xl lg:text-4xl font-bold text-gray-900 mt-1">{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Chart */}
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

                {/* Recent Updates */}
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
                              {sub.photo_url ? (
                                <a href={sub.photo_url} target="_blank" className="text-indigo-600 hover:underline">View</a>
                              ) : sub.photo_url}
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
                          <th className="px-6 py-4 text-center text-sm font-medium text-gray-600">Action</th>
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
                              {sub.photo_url ? (
                                <a href={sub.photo_url} target="_blank" className="text-indigo-600 hover:underline">View</a>
                              ) : sub.photo_url}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {new Date(sub.created_at).toLocaleDateString('en-IN')}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={async () => {
                                  await updateStatus(sub.id, 'delivered');

                                  // Delivery hone ke baad WhatsApp/SMS bhejo
                                  const feedbackLink = `https://party-stock-update.vercel.app/feedback?party=${encodeURIComponent(sub.party)}`;

                                  const message = `
                              Your order has been delivered!

                              Party: ${sub.party}
                              Product: ${sub.product_name}

                              Please give us quick feedback (takes 10 seconds):
                              ${feedbackLink}

                              Thanks for your business!
                                  `;

                                  try {
                                    await fetch('/functions/v1/send-whatsapp', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        to_number: sub.MobileNo || '919131749390',  // Agar table mein MobileNo hai to yahan se lo
                                        message: message
                                      })
                                    });
                                    toast.success('Delivery marked & feedback link sent!');
                                  } catch (err) {
                                    console.error('WhatsApp send failed:', err);
                                    toast.error('Feedback link send nahi hua');
                                  }
                                }}
                                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700"
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
              </div>
            )}

            {activeTab === 'delivered' && (
              <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">Delivered Orders</h1>
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
                          <th className="px-6 py-4 text-center text-sm font-medium text-gray-600">Delivered At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {delivered.map(sub => (
                          <tr key={sub.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-medium">{sub.party}</td>
                            <td className="px-6 py-4 text-sm">{sub.product_name}</td>
                            <td className="px-6 py-4 text-center text-sm">{sub.current_qty}</td>
                            <td className="px-6 py-4 text-center text-sm">{sub.order_qty}</td>
                            <td className="px-6 py-4 text-center text-sm">
                              {sub.photo_url ? (
                                <a href={sub.photo_url} target="_blank" className="text-indigo-600 hover:underline">View</a>
                              ) : sub.photo_url}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {new Date(sub.created_at).toLocaleDateString('en-IN')}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {sub.delivered_at 
                                ? new Date(sub.delivered_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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